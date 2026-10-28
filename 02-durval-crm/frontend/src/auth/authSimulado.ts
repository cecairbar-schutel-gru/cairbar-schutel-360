import type { AuthService, Usuario } from './tipos'
import { USUARIOS_SIMULADOS } from './usuariosSimulados'

const CHAVE = 'durvalcrm.usuario-simulado'
const PREFIXO_TOKEN = 'simulado.'

/** Retorna o usuário de um token simulado (usado pelos handlers MSW). */
export function usuarioDoToken(token: string | null | undefined): Usuario | null {
  if (!token?.startsWith(PREFIXO_TOKEN)) return null
  const id = token.slice(PREFIXO_TOKEN.length)
  return USUARIOS_SIMULADOS.find((u) => u.id === id) ?? null
}

/** Implementação simulada: guarda apenas o id do usuário na sessão da aba. */
export const authSimulado: AuthService = {
  modo: 'simulado',
  iniciar: async () => false,
  usuariosDisponiveis: () => USUARIOS_SIMULADOS,
  entrar(usuarioId) {
    const usuario = USUARIOS_SIMULADOS.find((u) => u.id === usuarioId)
    if (!usuario) throw new Error('Usuário simulado não encontrado.')
    sessionStorage.setItem(CHAVE, usuario.id)
    return usuario
  },
  redirecionarParaLogin: async () => {
    throw new Error('O modo simulado entra pelo seletor de usuários.')
  },
  async sair() {
    sessionStorage.removeItem(CHAVE)
  },
  usuarioAtual() {
    const id = sessionStorage.getItem(CHAVE)
    return USUARIOS_SIMULADOS.find((u) => u.id === id) ?? null
  },
  async obterToken() {
    const usuario = this.usuarioAtual()
    return usuario ? `${PREFIXO_TOKEN}${usuario.id}` : null
  },
}
