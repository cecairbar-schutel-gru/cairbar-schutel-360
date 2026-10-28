import { Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'

export { Fieldset, GradeForm, LinhaAcoes } from './blocos'

export function Legenda({ children }: { children: ReactNode }) {
  return (
    <Typography
      component="legend"
      variant="subtitle2"
      color="text.secondary"
      sx={{ mb: 1 }}
    >
      {children}
    </Typography>
  )
}

export function TituloPagina({
  id,
  children,
}: {
  id?: string
  children: ReactNode
}) {
  return (
    <Typography id={id} variant="h1">
      {children}
    </Typography>
  )
}

export function TextoSuave({
  children,
  role,
}: {
  children: ReactNode
  role?: string
}) {
  return (
    <Typography variant="body2" color="text.secondary" role={role}>
      {children}
    </Typography>
  )
}

/** Pilha vertical padrão das páginas e formulários. */
export const Pilha = ((props: Parameters<typeof Stack>[0]) => (
  <Stack spacing={3} {...props} />
)) as typeof Stack
