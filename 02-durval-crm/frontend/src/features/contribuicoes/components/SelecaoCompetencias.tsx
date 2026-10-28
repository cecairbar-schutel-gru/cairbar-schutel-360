import {
  Button,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { LinhaAcoes, Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarCompetencia } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { paraCentavos, paraReais } from '../regras'
import type { PainelCompetencias } from '../types'
import { SituacaoCompetenciaTag } from './SituacaoCompetenciaTag'

interface Props {
  painel: PainelCompetencias
  selecionadas: string[]
  onAlterar(selecionadas: string[]): void
}

/**
 * US-CONTRIB-003: nada vem marcado; pendentes e futuras (até 12 meses) podem ser escolhidas,
 * sempre por inteiro.
 */
export function SelecaoCompetencias({ painel, selecionadas, onAlterar }: Props) {
  const selecionaveis = painel.itens.filter((i) => i.selecionavel)
  const pendentes = selecionaveis.filter((i) => i.situacao === 'PENDENTE')
  const total = paraReais(
    selecionaveis
      .filter((i) => selecionadas.includes(i.competencia))
      .reduce((s, i) => s + paraCentavos(i.valor), 0),
  )

  function alternar(mes: string) {
    onAlterar(
      selecionadas.includes(mes)
        ? selecionadas.filter((m) => m !== mes)
        : [...selecionadas, mes].sort(),
    )
  }

  return (
    <Pilha spacing={2}>
      <LinhaAcoes>
        <Button
          variant="outlined"
          disabled={pendentes.length === 0}
          onClick={() =>
            onAlterar(
              [...new Set([...selecionadas, ...pendentes.map((p) => p.competencia)])].sort(),
            )
          }
        >
          Selecionar todas as pendentes
        </Button>
        {selecionadas.length > 0 && (
          <Button onClick={() => onAlterar([])}>Limpar seleção</Button>
        )}
      </LinhaAcoes>
      <Table size="small" aria-label="Competências para pagamento">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">Pagar</TableCell>
            <TableCell>Competência</TableCell>
            <TableCell>Valor</TableCell>
            <TableCell>Situação</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {selecionaveis.map((i) => (
              <TableRow
                key={i.competencia}
                hover
                selected={selecionadas.includes(i.competencia)}
              >
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selecionadas.includes(i.competencia)}
                    onChange={() => alternar(i.competencia)}
                    slotProps={{ input: { 'aria-label': `Pagar ${formatarCompetencia(i.competencia)}` } }}
                  />
                </TableCell>
                <TableCell>
                  {formatarCompetencia(i.competencia)}
                </TableCell>
                <TableCell>{formatarMoeda(i.valor)}</TableCell>
                <TableCell>
                  <SituacaoCompetenciaTag
                    situacao={i.situacao}
                    atrasada={i.atrasada}
                  />
                </TableCell>
              </TableRow>
          ))}
        </TableBody>
      </Table>
      <TextoSuave>
        Competências futuras são cobradas pelo valor vigente hoje (
        {formatarMoeda(painel.mensalidadeAtual)}).
      </TextoSuave>
      <Typography aria-live="polite">
        {selecionadas.length === 0 ? (
          'Nenhuma competência selecionada: o valor recebido será registrado como doação extraordinária.'
        ) : (
          <>
            <strong>{selecionadas.length}</strong>{' '}
            {selecionadas.length === 1 ? 'competência selecionada' : 'competências selecionadas'}{' '}
            — total <strong>{formatarMoeda(total)}</strong>
          </>
        )}
      </Typography>
    </Pilha>
  )
}
