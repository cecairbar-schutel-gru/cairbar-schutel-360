import UploadFileIcon from '@mui/icons-material/UploadFile'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useId, useMemo, useState } from 'react'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import {
  GradeForm,
  LinhaAcoes,
  Pilha,
  TextoSuave,
} from '../../../shared/components/layout'
import {
  formatarData,
  hoje,
  paraIsoData,
} from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useTelaCheia } from '../../../shared/hooks/useTelaCheia'
import { Valor } from '../../financeiro/components/Tags'
import {
  decodificarArquivo,
  detectarFormato,
  ErroLeituraExtrato,
  lerCsv,
  lerOfx,
  separarCsv,
  sugerirColunas,
  temCabecalho,
  type ExtratoOfx,
  type MapeamentoCsv,
} from '../leitorExtrato'
import { somar } from '../regras'
import { conciliacaoService } from '../services'
import type {
  FormatoExtrato,
  LinhaExtratoLida,
  SessaoConciliacao,
} from '../types'

interface Props {
  sessao: SessaoConciliacao
  /** Formato escolhido antes de abrir; sem ele, aceita OFX ou CSV. */
  formato?: FormatoExtrato
  onFechar(): void
  onImportado(sessao: SessaoConciliacao, lidas: number): void
}

interface ArquivoLido {
  nome: string
  formato: FormatoExtrato
  ofx: ExtratoOfx | null
  tabela: string[][]
}

const TAMANHO_MAXIMO = 5 * 1024 * 1024
const AMOSTRA = 8

/**
 * Importação do extrato do banco: o arquivo OFX ou CSV é lido aqui, com a prévia (e as colunas, no
 * CSV) antes de enviar. Do OFX vêm também o saldo e a data do extrato, que podem atualizar a sessão.
 */
export function ImportarExtratoDialogo({
  sessao,
  formato: formatoEscolhido,
  onFechar,
  onImportado,
}: Props) {
  const idTitulo = useId()
  const telaCheia = useTelaCheia()
  const [lido, setLido] = useState<ArquivoLido | null>(null)
  const [mapa, setMapa] = useState<MapeamentoCsv>({
    data: 0,
    descricao: 1,
    valor: 2,
    saida: null,
  })
  const [cabecalho, setCabecalho] = useState(true)
  const [ignorarSaldos, setIgnorarSaldos] = useState(true)
  const [atualizarExtrato, setAtualizarExtrato] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function escolher(arquivo: File | undefined) {
    setErro(null)
    setLido(null)
    if (!arquivo) return
    if (!/\.(ofx|csv|txt)$/i.test(arquivo.name)) {
      setErro(
        'Envie o extrato em OFX ou CSV (no internet banking: Extrato › Exportar › OFX/Money ou CSV/Excel).',
      )
      return
    }
    if (formatoEscolhido === 'OFX' && !/\.ofx$/i.test(arquivo.name))
      return setErro(
        'Escolha um arquivo .ofx (no internet banking: Extrato › Exportar › OFX/Money).',
      )
    if (formatoEscolhido === 'CSV' && !/\.(csv|txt)$/i.test(arquivo.name))
      return setErro(
        'Escolha um arquivo .csv (no internet banking: Extrato › Exportar › CSV/Excel).',
      )
    if (arquivo.size === 0) return setErro('O arquivo está vazio.')
    if (arquivo.size > TAMANHO_MAXIMO)
      return setErro('O arquivo passa de 5 MB: exporte um período menor.')
    try {
      const texto = decodificarArquivo(await arquivo.arrayBuffer())
      const formato = detectarFormato(arquivo.name, texto)
      if (formato === 'OFX') {
        setLido({ nome: arquivo.name, formato, ofx: lerOfx(texto), tabela: [] })
      } else {
        const tabela = separarCsv(texto)
        if (tabela.length === 0)
          throw new ErroLeituraExtrato('O CSV não tem linhas.')
        setCabecalho(temCabecalho(tabela))
        setMapa(sugerirColunas(tabela))
        setLido({ nome: arquivo.name, formato, ofx: null, tabela })
      }
    } catch (e) {
      setErro(
        e instanceof ErroLeituraExtrato
          ? e.message
          : 'Não foi possível ler o arquivo.',
      )
    }
  }

  const csv = useMemo(
    () =>
      lido?.formato === 'CSV'
        ? lerCsv(lido.tabela, mapa, { cabecalho, ignorarSaldos })
        : null,
    [lido, mapa, cabecalho, ignorarSaldos],
  )
  const linhas: LinhaExtratoLida[] = lido?.ofx?.linhas ?? csv?.linhas ?? []

  // Saldo e data do OFX: oferecidos quando diferem dos dados da sessão (a data nunca futura).
  const ofx = lido?.ofx
  const dataOfx = ofx ? (ofx.dataSaldo ?? ofx.dataFim) : null
  const dataSugerida =
    dataOfx && dataOfx > paraIsoData(hoje()) ? paraIsoData(hoje()) : dataOfx
  const extratoDoOfx =
    ofx &&
    ofx.saldoFinal !== null &&
    dataSugerida &&
    (dataSugerida !== sessao.dataFim || ofx.saldoFinal !== sessao.saldoExtrato)
      ? { dataFim: dataSugerida, saldo: ofx.saldoFinal }
      : null
  const usarOfx = !!extratoDoOfx && atualizarExtrato
  const dataFim = usarOfx ? extratoDoOfx.dataFim : sessao.dataFim

  const depois = linhas.filter((l) => l.data > dataFim).length
  const antes = sessao.dataFimAnterior
    ? linhas.filter((l) => l.data <= sessao.dataFimAnterior!).length
    : 0
  const noPeriodo = linhas.length - depois - antes
  const datas = linhas.map((l) => l.data).sort()

  async function importar() {
    if (!lido || linhas.length === 0) return
    setEnviando(true)
    setErro(null)
    try {
      if (usarOfx)
        await conciliacaoService.alterarExtrato(
          sessao.id,
          extratoDoOfx.dataFim,
          extratoDoOfx.saldo,
        )
      onImportado(
        await conciliacaoService.importarExtrato(sessao.id, {
          arquivo: lido.nome,
          formato: lido.formato,
          linhas,
        }),
        linhas.length,
      )
    } catch (e) {
      setErro(mensagemDeErro(e))
      setEnviando(false)
    }
  }

  const colunas =
    lido?.formato === 'CSV'
      ? Math.max(...lido.tabela.slice(0, 20).map((l) => l.length))
      : 0
  const nomeColuna = (i: number) =>
    (cabecalho && lido?.tabela[0]?.[i]) || `Coluna ${i + 1}`
  const seletor = (
    rotulo: string,
    valor: number | null,
    alterar: (v: number | null) => void,
    opcional = false,
  ) => (
    <TextField
      select
      label={rotulo}
      value={valor ?? ''}
      onChange={(e) =>
        alterar(e.target.value === '' ? null : Number(e.target.value))
      }
    >
      {opcional && (
        <MenuItem value="">
          <em>Nenhuma (valor com sinal)</em>
        </MenuItem>
      )}
      {[...Array(colunas).keys()].map((i) => (
        <MenuItem key={i} value={i}>
          {nomeColuna(i)}
        </MenuItem>
      ))}
    </TextField>
  )

  return (
    <Dialog
      open
      onClose={onFechar}
      aria-labelledby={idTitulo}
      fullScreen={telaCheia}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle id={idTitulo}>
        <Typography
          component="span"
          variant="overline"
          color="text.secondary"
          sx={{ display: 'block' }}
        >
          {sessao.contaNome} · extrato até {formatarData(sessao.dataFim)}
        </Typography>
        Importar extrato do banco{formatoEscolhido && ` (${formatoEscolhido})`}
      </DialogTitle>
      <DialogContent>
        <Pilha spacing={2} sx={{ pt: 1 }}>
          <TextoSuave>
            Envie o arquivo {formatoEscolhido ?? 'OFX ou CSV'} exportado do
            internet banking. O sistema sugere, para cada linha, o lançamento
            com o mesmo valor e data próxima; você confere as sugestões antes de
            marcá-las.
            {sessao.extrato &&
              ` Substitui o extrato importado antes (${sessao.extrato.arquivo}); as marcações ficam.`}
          </TextoSuave>
          <LinhaAcoes>
            <Button
              variant={lido ? 'outlined' : 'contained'}
              component="label"
              startIcon={<UploadFileIcon />}
              disabled={enviando}
            >
              {lido ? 'Escolher outro arquivo' : 'Escolher arquivo'}
              <input
                hidden
                type="file"
                accept={
                  formatoEscolhido === 'OFX'
                    ? '.ofx,application/x-ofx'
                    : formatoEscolhido === 'CSV'
                      ? '.csv,.txt,text/csv'
                      : '.ofx,.csv,.txt,text/csv,application/x-ofx'
                }
                aria-label={`Arquivo do extrato (${formatoEscolhido ?? 'OFX ou CSV'})`}
                onChange={(e) => {
                  void escolher(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </Button>
            {lido && (
              <TextoSuave>
                {lido.nome} · {lido.formato}
                {ofx?.conta && ` · conta ${ofx.conta}`}
              </TextoSuave>
            )}
          </LinhaAcoes>
          {erro && (
            <Aviso tipo="error" titulo="Não foi possível importar">
              {erro}
            </Aviso>
          )}

          {lido?.formato === 'CSV' && (
            <Pilha
              spacing={1}
              component="fieldset"
              sx={{ border: 0, p: 0, m: 0 }}
            >
              <Typography component="legend" variant="subtitle2">
                Colunas do arquivo
              </Typography>
              <GradeForm>
                {seletor('Data', mapa.data, (v) =>
                  setMapa((m) => ({ ...m, data: v ?? 0 })),
                )}
                {seletor('Descrição', mapa.descricao, (v) =>
                  setMapa((m) => ({ ...m, descricao: v ?? 0 })),
                )}
                {seletor(
                  mapa.saida === null ? 'Valor' : 'Entradas (crédito)',
                  mapa.valor,
                  (v) => setMapa((m) => ({ ...m, valor: v ?? 0 })),
                )}
                {seletor(
                  'Saídas (débito), se separadas',
                  mapa.saida,
                  (v) => setMapa((m) => ({ ...m, saida: v })),
                  true,
                )}
              </GradeForm>
              <LinhaAcoes>
                <FormControlLabel
                  control={
                    <Switch
                      checked={cabecalho}
                      onChange={(e) => setCabecalho(e.target.checked)}
                    />
                  }
                  label="A primeira linha é o cabeçalho"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={ignorarSaldos}
                      onChange={(e) => setIgnorarSaldos(e.target.checked)}
                    />
                  }
                  label="Ignorar linhas de saldo"
                />
              </LinhaAcoes>
              {csv && csv.erros.length > 0 && (
                <Aviso
                  tipo="warning"
                  titulo={`${csv.erros.length} linha(s) não lida(s)`}
                >
                  {csv.erros.slice(0, 5).join(' ')}
                  {csv.erros.length > 5 && ' …'} Confira as colunas escolhidas;
                  essas linhas não serão importadas.
                </Aviso>
              )}
            </Pilha>
          )}

          {extratoDoOfx && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={atualizarExtrato}
                  onChange={(e) => setAtualizarExtrato(e.target.checked)}
                />
              }
              label={`Usar o saldo do arquivo: ${formatarMoeda(extratoDoOfx.saldo)} em ${formatarData(extratoDoOfx.dataFim)} (hoje a sessão tem ${formatarMoeda(sessao.saldoExtrato)} em ${formatarData(sessao.dataFim)})`}
            />
          )}

          {lido && (
            <Pilha spacing={1} aria-label="Prévia do extrato">
              <Typography variant="subtitle2" component="h3">
                Prévia
              </Typography>
              {linhas.length === 0 ? (
                <TextoSuave>Nenhum movimento lido do arquivo.</TextoSuave>
              ) : (
                <>
                  <TextoSuave>
                    {linhas.length} movimento(s) de {formatarData(datas[0])} a{' '}
                    {formatarData(datas[datas.length - 1])}, somando{' '}
                    {formatarMoeda(somar(linhas))}. {noPeriodo} no período desta
                    conciliação
                    {depois > 0 &&
                      `; ${depois} depois de ${formatarData(dataFim)}`}
                    {antes > 0 &&
                      `; ${antes} até a última conciliação (${formatarData(sessao.dataFimAnterior)})`}
                    {depois + antes > 0 && ' ficam de fora'}.
                    {csv &&
                      csv.saldosIgnorados > 0 &&
                      ` ${csv.saldosIgnorados} linha(s) de saldo ignorada(s).`}
                  </TextoSuave>
                  <Box sx={{ overflowX: 'auto' }}>
                    <TableContainer>
                      <Table
                        size="small"
                        aria-label="Primeiras linhas do extrato"
                      >
                        <TableHead>
                          <TableRow>
                            <TableCell>Data</TableCell>
                            <TableCell>Descrição</TableCell>
                            <TableCell align="right">Valor</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {linhas.slice(0, AMOSTRA).map((l, i) => (
                            <TableRow
                              key={i}
                              sx={{ opacity: l.data > dataFim ? 0.5 : 1 }}
                            >
                              <TableCell>{formatarData(l.data)}</TableCell>
                              <TableCell>{l.descricao || '—'}</TableCell>
                              <TableCell align="right">
                                <Valor valor={l.valor} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                  {linhas.length > AMOSTRA && (
                    <TextoSuave>… e mais {linhas.length - AMOSTRA}.</TextoSuave>
                  )}
                </>
              )}
            </Pilha>
          )}
        </Pilha>
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={!lido || noPeriodo <= 0 || enviando}
          onClick={() => void importar()}
        >
          Importar {noPeriodo > 0 ? `${noPeriodo} linha(s)` : ''}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
