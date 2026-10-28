import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'
import { LinkRota } from '../../../shared/components/LinkRota'
import type { QuadroSaldos, SaldoConta } from '../types'
import { Valor } from './Tags'

interface Props {
  saldos: QuadroSaldos
  /** Liga cada conta ao extrato (US-FINANCIAL-005); só para a Tesouraria. */
  comExtrato: boolean
}

/** Saldos agrupados por tipo, com subtotais e total geral (US-FINANCIAL-002). */
export function QuadroDeSaldos({ saldos, comExtrato }: Props) {
  const linha = (s: SaldoConta) => (
    <TableRow key={s.id} hover>
      <TableCell sx={{ pl: 4 }}>
        {comExtrato ? <LinkRota to={`/financeiro/lancamentos?contaId=${s.id}`}>{s.nome}</LinkRota> : s.nome}
        {!s.ativa && ' (inativa)'}
      </TableCell>
      <TableCell align="right">
        <Valor valor={s.saldo} />
      </TableCell>
    </TableRow>
  )
  const grupo = (titulo: string, contas: SaldoConta[], subtotal: number) =>
    contas.length > 0 && (
      <>
        <TableRow>
          <TableCell component="th" scope="rowgroup" sx={{ fontWeight: 600 }}>
            {titulo}
          </TableCell>
          <TableCell align="right">
            <Valor valor={subtotal} negrito />
          </TableCell>
        </TableRow>
        {contas.map(linha)}
      </>
    )
  const mostraTotal = saldos.bancos.length > 0 || saldos.cartaoAReceber !== null || saldos.caixas.length > 1
  return (
    <Table size="small" aria-label="Saldos por conta">
      <TableHead>
        <TableRow>
          <TableCell>Conta</TableCell>
          <TableCell align="right">Saldo</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {grupo('Caixas', saldos.caixas, saldos.subtotalCaixas)}
        {grupo('Contas bancárias', saldos.bancos, saldos.subtotalBancos)}
        {saldos.cartaoAReceber && grupo('Cartão a receber', [saldos.cartaoAReceber], saldos.cartaoAReceber.saldo ?? 0)}
        {mostraTotal && (
          <TableRow>
            <TableCell component="th" scope="row" sx={{ fontWeight: 700 }}>
              Total geral
            </TableCell>
            <TableCell align="right">
              <Valor valor={saldos.total} negrito />
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
