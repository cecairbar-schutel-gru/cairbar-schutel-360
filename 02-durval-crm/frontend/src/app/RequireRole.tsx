import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Papel } from '../auth'
import { useAuth } from '../auth/AuthProvider'
import { Aviso } from '../shared/components/Aviso'

export function RequireRole({
  papeis,
  children,
}: {
  papeis?: Papel[]
  children?: ReactNode
}) {
  const { usuario, possuiPapel } = useAuth()
  const local = useLocation()
  // Sem papel do DurvalCRM a tela de entrada explica e oferece a saída.
  if (!usuario || usuario.papeis.length === 0)
    return (
      <Navigate
        to="/entrar"
        replace
        state={{ de: local.pathname + local.search }}
      />
    )
  if (papeis && !possuiPapel(...papeis)) {
    return (
      <Aviso tipo="error" titulo="Acesso negado">
        Seu perfil não possui permissão para esta tela.
      </Aviso>
    )
  }
  return <>{children ?? <Outlet />}</>
}
