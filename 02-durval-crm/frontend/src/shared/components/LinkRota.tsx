import { Link } from '@mui/material'
import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'

/** Link MUI que navega pelo React Router. */
export function LinkRota({
  to,
  children,
}: {
  to: string
  children: ReactNode
}) {
  return (
    <Link component={RouterLink} to={to}>
      {children}
    </Link>
  )
}
