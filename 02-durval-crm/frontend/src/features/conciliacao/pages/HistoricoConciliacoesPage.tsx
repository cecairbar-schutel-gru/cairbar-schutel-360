import {
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import {
  Pilha,
  TextoSuave,
  TituloPagina,
} from '../../../shared/components/layout'
import {
  formatarData,
  formatarDataHora,
} from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { Valor } from '../../financeiro/components/Tags'
import { conciliacaoService } from '../services'

/** Histórico de conciliações (US-RECONCILIATION-010): sessões concluídas por conta, com o relatório. */
export function HistoricoConciliacoesPage() {
  const [parametros, setParametros] = useSearchParams()
  const contaId = parametros.get('contaId')
    ? Number(parametros.get('contaId'))
    : undefined
  const contas = useCarregamento(() => conciliacaoService.contas(), [])
  const historico = useCarregamento(
    () => conciliacaoService.historico(contaId),
    [contaId],
  )

  return (
    <Pilha component="section" aria-labelledby="titulo-historico-conciliacoes">
      <LinkRota to="/conciliacao">Voltar à conciliação</LinkRota>
      <TituloPagina id="titulo-historico-conciliacoes">
        Histórico de conciliações
      </TituloPagina>
      <TextField
        select
        label="Conta bancária"
        value={contaId ?? ''}
        onChange={(e) =>
          setParametros(
            e.target.value === '' ? {} : { contaId: String(e.target.value) },
          )
        }
        sx={{ maxWidth: 360 }}
      >
        <MenuItem value="">Todas</MenuItem>
        {(contas.dados ?? []).map((c) => (
          <MenuItem key={c.contaId} value={c.contaId}>
            {c.contaNome}
          </MenuItem>
        ))}
      </TextField>
      {historico.carregando && <Carregando />}
      {historico.erro && (
        <Aviso tipo="error" titulo="Erro">
          {historico.erro}
        </Aviso>
      )}
      {historico.dados && historico.dados.length === 0 && (
        <TextoSuave>Nenhuma conciliação concluída.</TextoSuave>
      )}
      {historico.dados && historico.dados.length > 0 && (
        <Table aria-label="Conciliações concluídas">
          <TableHead>
            <TableRow>
              <TableCell>Conta</TableCell>
              <TableCell>Extrato até</TableCell>
              <TableCell align="right">Saldo do extrato</TableCell>
              <TableCell align="right">Conciliados</TableCell>
              <TableCell align="right">Pendentes</TableCell>
              <TableCell>Concluída por</TableCell>
              <TableCell>Concluída em</TableCell>
              <TableCell>Relatório</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {historico.dados.map((h) => (
              <TableRow key={h.id} hover>
                <TableCell>{h.contaNome}</TableCell>
                <TableCell>{formatarData(h.dataFim)}</TableCell>
                <TableCell align="right">
                  <Valor valor={h.saldoExtrato} />
                </TableCell>
                <TableCell align="right">{h.conciliados}</TableCell>
                <TableCell align="right">{h.pendentes}</TableCell>
                <TableCell>{h.concluidaPor}</TableCell>
                <TableCell>{formatarDataHora(h.concluidaEm)}</TableCell>
                <TableCell>
                  <LinkRota to={`/conciliacao/${h.id}`}>
                    Ver relatório nº {h.id}
                  </LinkRota>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Pilha>
  )
}
