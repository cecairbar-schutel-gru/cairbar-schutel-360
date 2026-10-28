import { Table, TableBody, TableContainer, TableCell, TableHead, TableRow } from '@mui/material'
import { formatarData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { origemObrigacao } from '../rotulos'
import type { LinhaAlocacao } from '../types'

/** Obrigações cobertas por um pagamento, da mais antiga para a mais nova (US-PUBLISHER-008). */
export function TabelaAlocacao({
  alocacoes,
  rotulo,
  rotuloAberto = 'Em aberto',
  rotuloRestante = 'Fica em aberto',
}: {
  alocacoes: LinhaAlocacao[]
  rotulo: string
  rotuloAberto?: string
  rotuloRestante?: string
}) {
  return (
    <TableContainer>
      <Table size="small" aria-label={rotulo}>
        <TableHead>
          <TableRow>
            <TableCell>Data</TableCell>
            <TableCell>Origem</TableCell>
            <TableCell>Remessa</TableCell>
            <TableCell>Título</TableCell>
            <TableCell align="right">{rotuloAberto}</TableCell>
            <TableCell align="right">Pago agora</TableCell>
            <TableCell align="right">{rotuloRestante}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {alocacoes.map((a) => (
            <TableRow key={a.obrigacaoId}>
              <TableCell>{formatarData(a.data)}</TableCell>
              <TableCell>{origemObrigacao(a.origem, a.origemNumero)}</TableCell>
              <TableCell>{a.remessaCodigo}</TableCell>
              <TableCell>{a.titulo}</TableCell>
              <TableCell align="right">{formatarMoeda(a.valorAberto)}</TableCell>
              <TableCell align="right">{formatarMoeda(a.valorAlocado)}</TableCell>
              <TableCell align="right">{formatarMoeda(a.restante)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
