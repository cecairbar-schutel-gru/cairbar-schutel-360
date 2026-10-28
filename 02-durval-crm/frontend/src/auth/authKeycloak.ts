import Keycloak from 'keycloak-js'
import { PAPEIS, type AuthService, type Papel, type Usuario } from './tipos'

/** Configuração pública servida pelo backend (o mesmo build vale para todo ambiente). */
interface ConfiguracaoAutenticacao {
  url: string
  realm: string
  clientId: string
  /** Audience do token. Os papéis são realm roles (`realm_access.roles`). */
  clientIdApi: string
}

const CAMINHO_CONFIGURACAO = '/api/publico/configuracao-autenticacao'
/** Marca o redirecionamento para o login, para registrar a entrada na auditoria na volta. */
const CHAVE_LOGIN_PENDENTE = 'durvalcrm.login-pendente'
/** Renova o token quando faltam menos de 30 s para expirar. */
const VALIDADE_MINIMA_S = 30

/**
 * Usuário a partir das claims do access token: realm roles do DurvalCRM (atribuídas pelos grupos do
 * realm cecairbar). As demais realm roles (schutelista, perfis do SGB) são ignoradas.
 */
export function usuarioDasClaims(claims: Record<string, unknown>): Usuario {
  const acesso = claims.realm_access as { roles?: unknown } | undefined
  const roles = acesso?.roles
  const papeis = PAPEIS.filter((p) => Array.isArray(roles) && roles.includes(p)) as Papel[]
  const nome = [claims.name, claims.preferred_username].find((v) => typeof v === 'string' && v)
  return { id: String(claims.sub ?? ''), nome: (nome as string | undefined) ?? 'Usuário', papeis }
}

let keycloak: Keycloak | null = null

async function carregarConfiguracao(): Promise<ConfiguracaoAutenticacao> {
  const resposta = await fetch(`${window.location.origin}${CAMINHO_CONFIGURACAO}`, {
    headers: { Accept: 'application/json' },
  })
  if (!resposta.ok) throw new Error('Não foi possível carregar a configuração de acesso.')
  return (await resposta.json()) as ConfiguracaoAutenticacao
}

/** Login no realm cecairbar pelo client público `durvalcrm-web` (Authorization Code + PKCE S256). */
export const authKeycloak: AuthService = {
  modo: 'keycloak',
  async iniciar() {
    const configuracao = await carregarConfiguracao()
    keycloak = new Keycloak({
      url: configuracao.url,
      realm: configuracao.realm,
      clientId: configuracao.clientId,
    })
    // check-sso por redirecionamento (sem iframe de terceiros): restaura a sessão do realm
    // depois de recarregar a página; os tokens ficam só em memória.
    await keycloak.init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      checkLoginIframe: false,
      responseMode: 'fragment',
    })
    const voltouDoLogin = sessionStorage.getItem(CHAVE_LOGIN_PENDENTE) !== null
    sessionStorage.removeItem(CHAVE_LOGIN_PENDENTE)
    return voltouDoLogin && !!keycloak.authenticated
  },
  usuariosDisponiveis: () => [],
  entrar() {
    throw new Error('O login é feito pelo Keycloak.')
  },
  async redirecionarParaLogin(destino) {
    if (!keycloak) throw new Error('Autenticação não iniciada.')
    sessionStorage.setItem(CHAVE_LOGIN_PENDENTE, '1')
    await keycloak.login({ redirectUri: `${window.location.origin}${destino}` })
  },
  async sair() {
    if (!keycloak?.authenticated) return
    await keycloak.logout({ redirectUri: `${window.location.origin}/` })
  },
  usuarioAtual() {
    if (!keycloak?.authenticated || !keycloak.tokenParsed) return null
    return usuarioDasClaims(keycloak.tokenParsed as Record<string, unknown>)
  },
  async obterToken() {
    if (!keycloak?.authenticated) return null
    try {
      await keycloak.updateToken(VALIDADE_MINIMA_S)
    } catch {
      // Sessão do realm encerrada: a API responde 401 e a tela pede para entrar de novo.
      keycloak.clearToken()
      return null
    }
    return keycloak.token ?? null
  },
}
