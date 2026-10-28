import { Chip, Table, TableBody, TableContainer, TableCell, TableHead, TableRow } from '@mui/material'
import { LinkRota } from '../../../shared/components/LinkRota'
import { formatarData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { ROTULO_MEIO } from '../rotulos'
import type { LinhaPagamento } from '../types'

export function TabelaPagamentos({ pagamentos, rotulo }: { pagamentos: LinhaPagamento[]; rotulo: string }) {
  return (
    <TableContainer>
      <Table size="small" aria-label={rotulo}>
        <TableHead>
          <TableRow>
            <TableCell>Data</TableCell>
            <TableCell align="right">Valor</TableCell>
            <TableCell>Conta</TableCell>
            <TableCell>Meio</TableCell>
            <TableCell>Observação</TableCell>
            <TableCell align="right">Recibo</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pagamentos.map((p) => (
            <TableRow key={p.id}>
              <TableCell>{formatarData(p.pagoEm)}</TableCell>
              <TableCell align="right">
                {formatarMoeda(p.valor)}
                {p.estornadoEm && <Chip size="small" variant="outlined" label={`Estornado em ${formatarData(p.estornadoEm)}`} sx={{ ml: 1 }} />}
              </TableCell>
              <TableCell>{p.contaNome}</TableCell>
              <TableCell>{ROTULO_MEIO[p.meio]}</TableCell>
              <TableCell>
                {[p.creditoAplicado > 0 && `Crédito aplicado: ${formatarMoeda(p.creditoAplicado)}`, p.observacao].filter(Boolean).join(' · ') || '—'}
              </TableCell>
              <TableCell align="right">
                <LinkRota to={`/editoras/pagamentos/${p.id}`}>nº {p.id}</LinkRota>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
