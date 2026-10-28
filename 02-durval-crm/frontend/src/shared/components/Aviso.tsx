import { Alert, AlertTitle, type AlertColor } from '@mui/material'
import type { ReactNode } from 'react'

interface Props {
  tipo: AlertColor
  titulo: string
  children: ReactNode
  acao?: ReactNode
  onFechar?(): void
}

/** Notificação em linha com título e descrição. */
export function Aviso({ tipo, titulo, children, acao, onFechar }: Props) {
  return (
    <Alert
      severity={tipo}
      variant="outlined"
      action={acao}
      onClose={onFechar}
      closeText="Fechar"
    >
      <AlertTitle>{titulo}</AlertTitle>
      {children}
    </Alert>
  )
}
