import { Button } from '@mui/material'
import { Link } from 'react-router-dom'
import { Aviso } from '../../../shared/components/Aviso'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { contasPagarService } from '../services'

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** Alerta dos painéis da Tesouraria: contas vencidas e as que vencem nos próximos dias. */
export function AvisoContasPagar() {
  const resumo = useCarregamento(() => contasPagarService.resumo(), [])
  const r = resumo.dados
  if (!r || (r.vencidas === 0 && r.aVencer === 0)) return null
  const partes = [
    r.vencidas > 0 && `${plural(r.vencidas, 'conta vencida', 'contas vencidas')} (${formatarMoeda(r.valorVencidas)} previstos)`,
    r.aVencer > 0 && `${plural(r.aVencer, 'vence', 'vencem')} nos próximos ${r.diasAVencer} dias (${formatarMoeda(r.valorAVencer)})`,
  ].filter(Boolean)
  return (
    <Aviso
      tipo={r.vencidas > 0 ? 'error' : 'warning'}
      titulo="Contas a pagar"
      acao={
        <Button color="inherit" size="small" component={Link} to="/contas-pagar">
          Ver contas
        </Button>
      }
    >
      {partes.join('; ')}.
    </Aviso>
  )
}
