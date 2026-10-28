import { Table, TableBody, TableContainer, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { LinkRota } from '../../../shared/components/LinkRota'
import { formatarData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { origemObrigacao } from '../rotulos'
import type { LinhaObrigacao } from '../types'
import { StatusObrigacaoTag } from './Tags'

/** Obrigações com origem (venda ou baixa), remessa, título, valor, pago e em aberto (US-PUBLISHER-006). */
export function TabelaObrigacoes({ obrigacoes, rotulo }: { obrigacoes: LinhaObrigacao[]; rotulo: string }) {
  return (
    <TableContainer>
      <Table size="small" aria-label={rotulo}>
        <TableHead>
          <TableRow>
            <TableCell>Data</TableCell>
            <TableCell>Origem</TableCell>
            <TableCell>Remessa</TableCell>
            <TableCell>Título</TableCell>
            <TableCell align="right">Qtd.</TableCell>
            <TableCell align="right">Valor</TableCell>
            <TableCell align="right">Pago</TableCell>
            <TableCell align="right">Em aberto</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {obrigacoes.map((o) => (
            <TableRow key={o.id}>
              <TableCell>{formatarData(o.data)}</TableCell>
              <TableCell>
                {o.origem === 'VENDA' ? (
                  <LinkRota to={`/vendas/${o.origemId}`}>{origemObrigacao(o.origem, o.origemNumero)}</LinkRota>
                ) : (
                  origemObrigacao(o.origem, o.origemNumero)
                )}
              </TableCell>
              <TableCell>{o.remessaCodigo}</TableCell>
              <TableCell>
                {o.titulo}
                <Typography variant="body2" color="text.secondary">
                  {formatarMoeda(o.precoUnitario)} × {o.repassePercentual}%
                </Typography>
              </TableCell>
              <TableCell align="right">{o.quantidade}</TableCell>
              <TableCell align="right">{formatarMoeda(o.valor)}</TableCell>
              <TableCell align="right">{formatarMoeda(o.valorPago)}</TableCell>
              <TableCell align="right">{formatarMoeda(o.valorAberto)}</TableCell>
              <TableCell>
                <StatusObrigacaoTag status={o.status} />
                {o.estornadaEm && (
                  <Typography variant="caption" component="p" color="text.secondary">
                    em {formatarData(o.estornadaEm)}
                  </Typography>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
