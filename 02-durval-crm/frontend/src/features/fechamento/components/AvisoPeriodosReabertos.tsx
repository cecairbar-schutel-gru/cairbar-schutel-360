import { Alert, Stack } from '@mui/material'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { formatarDataDoInstante } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { EVENTO_PERIODOS, mesCurto } from '../regras'
import { fechamentoService } from '../services'

/**
 * Aviso para todos os usuários enquanto um mês estiver reaberto (US-CLOSING-009): lançamentos datados
 * nele voltam a ser aceitos. Consultado de novo a cada troca de tela e quando um período é fechado ou
 * reaberto nesta aba.
 */
export function AvisoPeriodosReabertos() {
  const { pathname } = useLocation()
  const { dados, recarregar } = useCarregamento(() => fechamentoService.reabertos(), [pathname])
  useEffect(() => {
    window.addEventListener(EVENTO_PERIODOS, recarregar)
    return () => window.removeEventListener(EVENTO_PERIODOS, recarregar)
  }, [recarregar])
  if (!dados || dados.length === 0) return null
  return (
    <Stack spacing={1} sx={{ mb: 2 }} role="status">
      {dados.map((p) => (
        <Alert key={p.mes} severity="warning" variant="outlined">
          Período {mesCurto(p.mes)} reaberto por {p.reabertoPor} em {formatarDataDoInstante(p.reabertoEm)}.
        </Alert>
      ))}
    </Stack>
  )
}
