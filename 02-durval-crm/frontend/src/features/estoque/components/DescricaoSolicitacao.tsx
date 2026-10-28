import { Typography } from '@mui/material'
import { formatarDataDoInstante } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { formatarPercentual } from '../regras'
import { plural, ROTULO_MOTIVO_BAIXA } from '../rotulos'
import type { ResumoSolicitacao } from '../types'

/** O que foi pedido: quantidade e motivo, preço atual → novo, ou saldo e última venda. */
export function DescricaoSolicitacao({ s }: { s: ResumoSolicitacao }) {
  if (s.tipo === 'BAIXA') {
    return (
      <>
        {plural(s.quantidade ?? 0, 'unidade', 'unidades')} · {s.motivoBaixa ? ROTULO_MOTIVO_BAIXA[s.motivoBaixa] : ''}
        <Typography variant="body2" color="text.secondary">
          {s.remessaCodigo ? `Remessa ${s.remessaCodigo}` : 'Estoque próprio'} · saldo atual {s.saldoAtual}
        </Typography>
      </>
    )
  }
  if (s.tipo === 'PRECO') {
    return (
      <>
        {formatarMoeda(s.precoVigente)} → {formatarMoeda(s.novoPreco ?? 0)}
        {s.diferencaPercentual !== null && (
          <Typography variant="body2" color="text.secondary">
            {formatarPercentual(s.diferencaPercentual)}
          </Typography>
        )}
      </>
    )
  }
  return (
    <>
      Estoque atual: {s.saldoAtual}
      <Typography variant="body2" color="text.secondary">
        Última venda: {formatarDataDoInstante(s.ultimaVenda)}
      </Typography>
    </>
  )
}
