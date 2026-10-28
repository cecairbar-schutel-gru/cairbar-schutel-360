import {
  Button,
  Checkbox,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { LinkRota } from '../../../shared/components/LinkRota'
import {
  formatarData,
  formatarDataHora,
} from '../../../shared/formatters/datas'
import { Valor } from '../../financeiro/components/Tags'
import { linkDaOrigem, ROTULO_ORIGEM } from '../../financeiro/rotulos'
import type { ItemConciliacao } from '../types'
import { COLUNA_ACOES_FIXA } from './colunaAcoes'

interface Props {
  rotulo: string
  itens: ItemConciliacao[]
  /** Com marcação: a coluna de seleção e "Corrigir" (sessão em andamento, Tesoureiro). */
  onMarcar?(item: ItemConciliacao, marcado: boolean): void
  onCorrigir?(item: ItemConciliacao): void
  /** Mostra quem marcou (sessão e relatório). */
  comMarcacao?: boolean
}

/** Sinais do lançamento: estorno, correção e adicionado na conciliação. */
export function SinaisLancamento({ item: l }: { item: ItemConciliacao }) {
  return (
    <>
      {l.adicionado && (
        <Chip
          size="small"
          variant="outlined"
          color="primary"
          label="Adicionado na conciliação"
          sx={{ ml: 1 }}
        />
      )}
      {l.estornadoPorId !== null && (
        <Chip
          size="small"
          variant="outlined"
          color="error"
          label={`Estornado pelo nº ${l.estornadoPorId}`}
          sx={{ ml: 1 }}
        />
      )}
      {l.estornaLancamentoId !== null && (
        <Chip
          size="small"
          variant="outlined"
          label={`Estorno do nº ${l.estornaLancamentoId}`}
          sx={{ ml: 1 }}
        />
      )}
      {l.corrigeLancamentoId !== null && (
        <Chip
          size="small"
          variant="outlined"
          color="info"
          label={`Corrige o nº ${l.corrigeLancamentoId}`}
          sx={{ ml: 1 }}
        />
      )}
    </>
  )
}

/** Lançamentos da conta na conciliação: data, descrição, origem e valor (+ entra, − sai). */
export function TabelaLancamentos({
  rotulo,
  itens,
  onMarcar,
  onCorrigir,
  comMarcacao,
}: Props) {
  return (
    <Table size="small" aria-label={rotulo}>
      <TableHead>
        <TableRow>
          {onMarcar && <TableCell padding="checkbox">No extrato</TableCell>}
          <TableCell>Data</TableCell>
          <TableCell>Descrição</TableCell>
          <TableCell>Origem</TableCell>
          <TableCell align="right">Valor</TableCell>
          {comMarcacao && <TableCell>Marcado por</TableCell>}
          {onCorrigir && <TableCell sx={COLUNA_ACOES_FIXA}>Ações</TableCell>}
        </TableRow>
      </TableHead>
      <TableBody>
        {itens.map((l) => {
          const origem = linkDaOrigem(l.origemTipo, l.origemId)
          return (
            <TableRow key={l.id} hover selected={!!onMarcar && l.marcado}>
              {onMarcar && (
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={l.marcado}
                    onChange={(e) => onMarcar(l, e.target.checked)}
                    slotProps={{
                      input: {
                        'aria-label': `Lançamento nº ${l.id}: ${l.descricao}`,
                      },
                    }}
                  />
                </TableCell>
              )}
              <TableCell>{formatarData(l.data)}</TableCell>
              <TableCell>
                <LinkRota to={`/financeiro/lancamentos/${l.id}`}>
                  {l.descricao}
                </LinkRota>
                <SinaisLancamento item={l} />
              </TableCell>
              <TableCell>
                {origem ? (
                  <LinkRota to={origem}>{ROTULO_ORIGEM[l.origemTipo]}</LinkRota>
                ) : (
                  ROTULO_ORIGEM[l.origemTipo]
                )}
              </TableCell>
              <TableCell align="right">
                <Valor valor={l.valor} />
              </TableCell>
              {comMarcacao && (
                <TableCell>
                  {l.marcadoPor ? (
                    <>
                      {l.marcadoPor}
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block' }}
                      >
                        {formatarDataHora(l.marcadoEm)}
                      </Typography>
                    </>
                  ) : (
                    '—'
                  )}
                </TableCell>
              )}
              {onCorrigir && (
                <TableCell sx={COLUNA_ACOES_FIXA}>
                  {l.podeCorrigir && (
                    <Button
                      size="small"
                      onClick={() => onCorrigir(l)}
                      aria-label={`Corrigir o lançamento nº ${l.id}`}
                    >
                      Corrigir
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
