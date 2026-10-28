import UploadFileIcon from '@mui/icons-material/UploadFile'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import {
  LinhaAcoes,
  Pilha,
  TextoSuave,
} from '../../../shared/components/layout'
import { LinkRota } from '../../../shared/components/LinkRota'
import {
  formatarData,
  formatarDataHora,
} from '../../../shared/formatters/datas'
import { Valor } from '../../financeiro/components/Tags'
import { situacaoDaLinha, type SituacaoLinha } from '../regras'
import type { LinhaDoExtrato, ParExtrato, SessaoConciliacao } from '../types'
import { COLUNA_ACOES_FIXA } from './colunaAcoes'

interface Props {
  sessao: SessaoConciliacao
  /** Tesoureiro: importa, confirma, desfaz e adiciona. */
  editavel: boolean
  ocupado: boolean
  onImportar(): void
  onConfirmar(pares: ParExtrato[]): void
  onDesfazer(linha: LinhaDoExtrato): void
  onAdicionar(linha: LinhaDoExtrato): void
}

/**
 * Extrato do banco importado na sessão: cada linha com a situação (conferida com um lançamento,
 * sugestão a confirmar, sem lançamento no sistema ou depois do fim do extrato). As sugestões vêm
 * selecionadas; confirmá-las marca os lançamentos.
 */
export function PainelExtrato({
  sessao,
  editavel,
  ocupado,
  onImportar,
  onConfirmar,
  onDesfazer,
  onAdicionar,
}: Props) {
  const [desmarcadas, setDesmarcadas] = useState<Set<number>>(new Set())
  const [mostrarConferidas, setMostrarConferidas] = useState(true)
  const [pagina, setPagina] = useState(0)
  const [porPagina, setPorPagina] = useState(50)
  const extrato = sessao.extrato

  if (!extrato) {
    return (
      <Pilha spacing={2} sx={{ py: 2 }}>
        <TextoSuave>
          Nenhum extrato importado nesta sessão. Importe o arquivo OFX ou CSV do
          banco para o sistema sugerir os pares com os lançamentos; ou marque os
          lançamentos um a um na aba “Lançamentos do sistema”.
        </TextoSuave>
        {editavel && (
          <Box>
            <Button
              variant="contained"
              startIcon={<UploadFileIcon />}
              onClick={onImportar}
            >
              Importar extrato
            </Button>
          </Box>
        )}
      </Pilha>
    )
  }

  const lancamentos = new Map(sessao.lancamentos.map((l) => [l.id, l]))
  const situacoes = extrato.linhas.map((l) =>
    situacaoDaLinha(l, sessao.dataFim),
  )
  const contar = (s: SituacaoLinha) => situacoes.filter((x) => x === s).length
  const sugestoes = extrato.linhas.filter((_, i) => situacoes[i] === 'SUGESTAO')
  const escolhidas = sugestoes.filter((l) => !desmarcadas.has(l.id))
  const exibidas = extrato.linhas.filter(
    (_, i) => mostrarConferidas || situacoes[i] !== 'CONFERIDA',
  )
  const visiveis = exibidas.slice(pagina * porPagina, (pagina + 1) * porPagina)
  const alternar = (id: number, escolhida: boolean) =>
    setDesmarcadas((atual) => {
      const novo = new Set(atual)
      if (escolhida) novo.delete(id)
      else novo.add(id)
      return novo
    })

  return (
    <Pilha spacing={2} sx={{ pt: 2 }}>
      <TextoSuave>
        {extrato.arquivo} ({extrato.formato}) · importado por{' '}
        {extrato.importadoPor} em {formatarDataHora(extrato.importadoEm)} ·{' '}
        {extrato.linhas.length} linha(s).
      </TextoSuave>
      <LinhaAcoes aria-label="Situação das linhas do extrato">
        <Chip
          color="success"
          variant="outlined"
          label={`${contar('CONFERIDA')} conferida(s)`}
        />
        <Chip
          color="primary"
          variant="outlined"
          label={`${contar('SUGESTAO')} sugestão(ões)`}
        />
        <Chip
          color="warning"
          variant="outlined"
          label={`${contar('SEM_LANCAMENTO')} sem lançamento`}
        />
        {contar('FORA_DO_PERIODO') > 0 && (
          <Chip
            variant="outlined"
            label={`${contar('FORA_DO_PERIODO')} depois do fim do extrato`}
          />
        )}
      </LinhaAcoes>
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <FormControlLabel
          control={
            <Switch
              checked={mostrarConferidas}
              onChange={(e) => {
                setMostrarConferidas(e.target.checked)
                setPagina(0)
              }}
            />
          }
          label="Mostrar conferidas"
        />
        {editavel && (
          <LinhaAcoes>
            <Button
              variant="contained"
              disabled={escolhidas.length === 0 || ocupado}
              onClick={() =>
                onConfirmar(
                  escolhidas.map((l) => ({
                    linhaId: l.id,
                    lancamentoId: l.sugestaoId!,
                  })),
                )
              }
            >
              Confirmar {escolhidas.length} sugestão(ões)
            </Button>
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              onClick={onImportar}
            >
              Importar outro arquivo
            </Button>
          </LinhaAcoes>
        )}
      </LinhaAcoes>
      {exibidas.length === 0 ? (
        <TextoSuave>Todas as linhas do extrato estão conferidas.</TextoSuave>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <TableContainer>
            <Table size="small" aria-label="Linhas do extrato do banco">
              <TableHead>
                <TableRow>
                  {editavel && (
                    <TableCell padding="checkbox">Confirmar</TableCell>
                  )}
                  <TableCell>Data</TableCell>
                  <TableCell>No extrato</TableCell>
                  <TableCell align="right">Valor</TableCell>
                  <TableCell>No sistema</TableCell>
                  {editavel && <TableCell sx={COLUNA_ACOES_FIXA}>Ações</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {visiveis.map((l) => {
                  const situacao = situacaoDaLinha(l, sessao.dataFim)
                  const sugerido =
                    l.sugestaoId !== null
                      ? lancamentos.get(l.sugestaoId)
                      : undefined
                  return (
                    <TableRow
                      key={l.id}
                      hover
                      selected={situacao === 'CONFERIDA'}
                    >
                      {editavel && (
                        <TableCell padding="checkbox">
                          {situacao === 'SUGESTAO' && (
                            <Checkbox
                              checked={!desmarcadas.has(l.id)}
                              onChange={(e) => alternar(l.id, e.target.checked)}
                              slotProps={{
                                input: {
                                  'aria-label': `Confirmar a sugestão para “${l.descricao}”`,
                                },
                              }}
                            />
                          )}
                        </TableCell>
                      )}
                      <TableCell>{formatarData(l.data)}</TableCell>
                      <TableCell>
                        {l.descricao}
                        {l.identificador && (
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block' }}
                          >
                            ID {l.identificador}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Valor valor={l.valor} />
                      </TableCell>
                      <TableCell>
                        {situacao === 'CONFERIDA' && (
                          <>
                            <Chip
                              size="small"
                              color="success"
                              label="Conferida"
                              sx={{ mr: 1 }}
                            />
                            <LinkRota
                              to={`/financeiro/lancamentos/${l.lancamentoId}`}
                            >
                              nº {l.lancamentoId}
                            </LinkRota>
                            <Typography
                              component="span"
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: 'block' }}
                            >
                              {l.conferidaPor} · {formatarDataHora(l.conferidaEm)}
                            </Typography>
                          </>
                        )}
                        {situacao === 'SUGESTAO' && (
                          <>
                            <Chip
                              size="small"
                              color="primary"
                              variant="outlined"
                              label="Sugestão"
                              sx={{ mr: 1 }}
                            />
                            <LinkRota
                              to={`/financeiro/lancamentos/${l.sugestaoId}`}
                            >
                              nº {l.sugestaoId}
                            </LinkRota>
                            {sugerido && (
                              <Typography
                                component="span"
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: 'block' }}
                              >
                                {formatarData(sugerido.data)} ·{' '}
                                {sugerido.descricao}
                                {sugerido.marcado && ' · já marcado'}
                              </Typography>
                            )}
                          </>
                        )}
                        {situacao === 'SEM_LANCAMENTO' && (
                          <Chip
                            size="small"
                            color="warning"
                            variant="outlined"
                            label="Sem lançamento"
                          />
                        )}
                        {situacao === 'FORA_DO_PERIODO' && (
                          <TextoSuave>
                            Depois do fim do extrato (
                            {formatarData(sessao.dataFim)})
                          </TextoSuave>
                        )}
                      </TableCell>
                      {editavel && (
                        <TableCell sx={COLUNA_ACOES_FIXA}>
                          {situacao === 'CONFERIDA' && (
                            <Button
                              size="small"
                              disabled={ocupado}
                              onClick={() => onDesfazer(l)}
                              aria-label={`Desfazer o par de “${l.descricao}”`}
                            >
                              Desfazer
                            </Button>
                          )}
                          {situacao === 'SEM_LANCAMENTO' && (
                            <Button
                              size="small"
                              disabled={ocupado}
                              onClick={() => onAdicionar(l)}
                              aria-label={`Adicionar lançamento para “${l.descricao}”`}
                            >
                              Adicionar
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={exibidas.length}
            page={Math.min(
              pagina,
              Math.max(0, Math.ceil(exibidas.length / porPagina) - 1),
            )}
            onPageChange={(_, p) => setPagina(p)}
            rowsPerPage={porPagina}
            onRowsPerPageChange={(e) => {
              setPorPagina(Number(e.target.value))
              setPagina(0)
            }}
            rowsPerPageOptions={[25, 50, 100]}
          />
        </Box>
      )}
      {contar('SEM_LANCAMENTO') > 0 && (
        <TextoSuave>
          “Sem lançamento”: o movimento está no banco e não no sistema (ex.:
          tarifa). Use “Adicionar” para registrá-lo já ligado à linha; se o
          lançamento existe com outro valor ou data, marque-o na aba
          “Lançamentos do sistema” ou corrija-o por estorno.
        </TextoSuave>
      )}
    </Pilha>
  )
}
