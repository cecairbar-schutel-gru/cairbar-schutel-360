import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { authService } from '.'
import { definirPerfilAtivo, requisitar } from '../shared/api/http'
import type { Papel, Usuario } from './tipos'

const CHAVE_PERFIL = 'durvalcrm.perfil'

/** Entrada e saída vão para a auditoria (US-ADMIN-009); uma falha aqui não impede a sessão. */
function registrarSessao(evento: 'LOGIN' | 'LOGOUT'): Promise<void> {
  return requisitar<void>('/auditoria/sessao', { metodo: 'POST', corpo: { evento } }).catch(() => undefined)
}

interface AuthContexto {
  usuario: Usuario | null
  perfilAtivo: Papel | null
  entrar(usuarioId: string): void
  sair(): void
  trocarPerfil(perfil: Papel): void
  /** Permissões são a união de todos os papéis do usuário (US-AUTH-003). */
  possuiPapel(...papeis: Papel[]): boolean
}

const Contexto = createContext<AuthContexto | null>(null)

function perfilInicial(usuario: Usuario | null): Papel | null {
  if (!usuario) return null
  const lembrado = localStorage.getItem(CHAVE_PERFIL) as Papel | null
  return lembrado && usuario.papeis.includes(lembrado) ? lembrado : usuario.papeis[0]
}

/** `loginConcluido`: a página voltou do login do Keycloak (a entrada ainda não foi auditada). */
export function AuthProvider({ children, loginConcluido = false }: { children: ReactNode; loginConcluido?: boolean }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => authService.usuarioAtual())
  const [perfilAtivo, setPerfilAtivo] = useState<Papel | null>(() =>
    perfilInicial(authService.usuarioAtual()),
  )
  const entradaAuditada = useRef(false)

  useEffect(() => definirPerfilAtivo(perfilAtivo), [perfilAtivo])

  useEffect(() => {
    if (!loginConcluido || entradaAuditada.current) return
    entradaAuditada.current = true
    void registrarSessao('LOGIN')
  }, [loginConcluido])

  const entrar = useCallback((usuarioId: string) => {
    const logado = authService.entrar(usuarioId)
    const perfil = perfilInicial(logado)
    definirPerfilAtivo(perfil)
    setUsuario(logado)
    setPerfilAtivo(perfil)
    void registrarSessao('LOGIN')
  }, [])

  const sair = useCallback(() => {
    // No Keycloak a saída redireciona a página: a auditoria precisa terminar antes.
    void registrarSessao('LOGOUT').then(() => authService.sair())
    setUsuario(null)
    setPerfilAtivo(null)
  }, [])

  const trocarPerfil = useCallback((perfil: Papel) => {
    localStorage.setItem(CHAVE_PERFIL, perfil)
    setPerfilAtivo(perfil)
  }, [])

  const valor = useMemo<AuthContexto>(
    () => ({
      usuario,
      perfilAtivo,
      entrar,
      sair,
      trocarPerfil,
      possuiPapel: (...papeis) => !!usuario && papeis.some((p) => usuario.papeis.includes(p)),
    }),
    [usuario, perfilAtivo, entrar, sair, trocarPerfil],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContexto {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('useAuth deve ser usado dentro de AuthProvider.')
  return contexto
}
