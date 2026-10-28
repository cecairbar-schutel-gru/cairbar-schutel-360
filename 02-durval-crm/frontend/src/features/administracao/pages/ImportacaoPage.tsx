import DownloadIcon from '@mui/icons-material/Download'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  Radio,
  RadioGroup,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { mensagemDetalhada, salvarArquivo } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { LinkRota } from '../../../shared/components/LinkRota'
import { LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarCompetencia, formatarDataHora } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { erroPlanilha, lerBase64 } from '../regras'
import { ROTULO_IMPORTACAO } from '../rotulos'
import { administracaoService } from '../services'
import type { DecisaoDuplicata, EnvioImportacao, Importacao, PreviaImportacao, TipoImportacao, TotalImportacao } from '../types'

const MOTIVO: Record<string, string> = { TELEFONE: 'mesmo telefone', EMAIL: 'mesmo e-mail', NOME_SIMILAR: 'nome parecido' }

const AJUDA: Record<TipoImportacao, string> = {
  FINANCEIRO:
    'Uma linha por lançamento: data, conta (nome ou código do caixa ou da conta bancária), tipo (Receita ou Despesa), subcategoria ("Categoria › Subcategoria"), descrição e valor. As datas devem ser anteriores à data de corte da conta; os meses importados entram fechados.',
  DOADORES:
    'Uma linha por doador: nome completo, telefone e/ou e-mail, data de nascimento, CPF, consentimentos (Sim, Não ou em branco) e as competências pendentes (mm/aaaa separadas por vírgula). Cada doador entra Ativo, com as pendentes e a competência do mês atual.',
}

/**
 * Importação do histórico (US-ADMIN-012): modelo → envio → validação com erros por linha → prévia com
 * totais → confirmação. Tudo ou nada; pode ser desfeita por inteiro enquanto nada foi feito sobre ela.
 */
export function ImportacaoPage() {
  const [tipo, setTipo] = useState<TipoImportacao>('FINANCEIRO')
  const [envio, setEnvio] = useState<EnvioImportacao | null>(null)
  const [previa, setPrevia] = useState<PreviaImportacao | null>(null)
  const [decisoes, setDecisoes] = useState<Record<number, DecisaoDuplicata>>({})
  const [analisando, setAnalisando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [desfazendo, setDesfazendo] = useState<Importacao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [erroDialogo, setErroDialogo] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const historico = useCarregamento(() => administracaoService.importacoes(), [])

  function limpar() {
    setEnvio(null)
    setPrevia(null)
    setDecisoes({})
    setErro(null)
  }

  async function baixarModelo() {
    setErro(null)
    try {
      salvarArquivo(await administracaoService.modeloImportacao(tipo))
    } catch (e) {
      setErro(mensagemDetalhada(e))
    }
  }

  async function escolher(arquivo: File | undefined) {
    limpar()
    setMensagem(null)
    if (!arquivo) return
    const problema = erroPlanilha(arquivo)
    if (problema) {
      setErro(problema)
      return
    }
    setAnalisando(true)
    try {
      const novo: EnvioImportacao = { tipo, arquivo: arquivo.name, conteudo: await lerBase64(arquivo) }
      setEnvio(novo)
      setPrevia(await administracaoService.previaImportacao(novo))
    } catch (e) {
      setErro(mensagemDetalhada(e))
    } finally {
      setAnalisando(false)
    }
  }

  async function importar() {
    if (!envio) return
    setErroDialogo(null)
    try {
      const i = await administracaoService.importar(envio, decisoes)
      setMensagem(`${i.arquivo}: ${i.linhasImportadas} ${i.tipo === 'FINANCEIRO' ? 'lançamento(s)' : 'doador(es)'} importado(s).`)
      setConfirmando(false)
      limpar()
      historico.recarregar()
    } catch (e) {
      setErroDialogo(mensagemDetalhada(e))
    }
  }

  async function desfazer() {
    if (!desfazendo) return
    setErroDialogo(null)
    try {
      await administracaoService.desfazerImportacao(desfazendo.id)
      setMensagem(`Importação de ${desfazendo.arquivo} desfeita.`)
      setDesfazendo(null)
      historico.recarregar()
    } catch (e) {
      setErroDialogo(mensagemDetalhada(e))
    }
  }

  const semDecisao = (previa?.duplicatas ?? []).filter((d) => !decisoes[d.linha]).length
  const podeImportar = !!previa && previa.erros.length === 0 && semDecisao === 0

  return (
    <Pilha component="section" aria-labelledby="titulo-importacao">
      <LinkRota to="/administracao">Voltar às Configurações</LinkRota>
      <TituloPagina id="titulo-importacao">Importação do histórico</TituloPagina>
      {mensagem && (
        <Aviso tipo="success" titulo="Pronto" onFechar={() => setMensagem(null)}>
          {mensagem}
        </Aviso>
      )}
      <Tabs
        value={tipo}
        onChange={(_, v: TipoImportacao) => {
          setTipo(v)
          limpar()
        }}
        aria-label="Tipo de planilha"
      >
        <Tab value="FINANCEIRO" label={ROTULO_IMPORTACAO.FINANCEIRO} />
        <Tab value="DOADORES" label={ROTULO_IMPORTACAO.DOADORES} />
      </Tabs>
      <TextoSuave>{AJUDA[tipo]}</TextoSuave>
      <LinhaAcoes>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => void baixarModelo()}>
          Baixar modelo (CSV)
        </Button>
        <Button variant="contained" component="label" startIcon={<UploadFileIcon />} disabled={analisando}>
          Enviar planilha
          <input hidden type="file" accept=".csv,text/csv" aria-label="Planilha CSV" onChange={(e) => void escolher(e.target.files?.[0])} />
        </Button>
        <TextoSuave>No Excel: Arquivo › Salvar como › CSV.</TextoSuave>
      </LinhaAcoes>
      {analisando && <Carregando linhas={3} />}
      {erro && (
        <Aviso tipo="error" titulo="Não foi possível ler a planilha">
          {erro}
        </Aviso>
      )}
      {previa && (
        <Pilha spacing={2} aria-label="Prévia da importação">
          <Typography variant="h6" component="h2">
            Prévia de {previa.arquivo}
          </Typography>
          <TextoSuave>
            {previa.linhas} linha(s) lidas.
            {previa.tipo === 'DOADORES' && ` ${previa.doadores} doador(es) e ${previa.competencias} competência(s) pendente(s).`}
            {previa.mesesAFechar.length > 0 &&
              ` Meses que entram fechados: ${previa.mesesAFechar.map(formatarCompetencia).join(', ')}.`}
          </TextoSuave>
          {previa.erros.length > 0 && (
            <>
              <Aviso tipo="error" titulo={`${previa.erros.length} erro(s): nada será importado`}>
                Corrija a planilha e envie de novo. A importação é tudo ou nada.
              </Aviso>
              <Table size="small" aria-label="Erros por linha">
                <TableHead>
                  <TableRow>
                    <TableCell>Linha</TableCell>
                    <TableCell>Coluna</TableCell>
                    <TableCell>Erro</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previa.erros.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{e.linha}</TableCell>
                      <TableCell>{e.coluna ?? '—'}</TableCell>
                      <TableCell>{e.mensagem}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
          {previa.tipo === 'FINANCEIRO' && previa.erros.length === 0 && (
            <>
              <Totais titulo="Totais por conta" totais={previa.totaisPorConta} />
              <Totais titulo="Totais por categoria" totais={previa.totaisPorCategoria} />
            </>
          )}
          {previa.duplicatas.length > 0 && (
            <Box>
              <Typography variant="h6" component="h3" gutterBottom>
                Possíveis duplicatas
              </Typography>
              <TextoSuave>Decida cada uma: é outra pessoa (importar) ou já está cadastrada (ignorar a linha).</TextoSuave>
              <Table size="small" aria-label="Possíveis duplicatas">
                <TableHead>
                  <TableRow>
                    <TableCell>Linha</TableCell>
                    <TableCell>Na planilha</TableCell>
                    <TableCell>Já cadastrados</TableCell>
                    <TableCell>Decisão</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previa.duplicatas.map((d) => (
                    <TableRow key={d.linha}>
                      <TableCell>{d.linha}</TableCell>
                      <TableCell>{d.nome}</TableCell>
                      <TableCell>
                        {d.possiveis.map((p) => (
                          <div key={p.id}>
                            <LinkRota to={`/doadores/${p.id}`}>{p.nome}</LinkRota> ({p.motivos.map((m) => MOTIVO[m] ?? m).join(', ')})
                          </div>
                        ))}
                      </TableCell>
                      <TableCell>
                        <RadioGroup
                          row
                          aria-label={`Decisão da linha ${d.linha}`}
                          value={decisoes[d.linha] ?? ''}
                          onChange={(e) => setDecisoes({ ...decisoes, [d.linha]: e.target.value as DecisaoDuplicata })}
                        >
                          <FormControlLabel value="IMPORTAR" control={<Radio size="small" />} label="É outra pessoa" />
                          <FormControlLabel value="IGNORAR" control={<Radio size="small" />} label="Ignorar" />
                        </RadioGroup>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
          <LinhaAcoes>
            <Button variant="contained" disabled={!podeImportar} onClick={() => setConfirmando(true)}>
              Confirmar importação
            </Button>
            <Button onClick={limpar}>Descartar</Button>
            {semDecisao > 0 && <TextoSuave>{semDecisao} duplicata(s) sem decisão.</TextoSuave>}
          </LinhaAcoes>
        </Pilha>
      )}

      <Typography variant="h6" component="h2">
        Importações realizadas
      </Typography>
      {historico.carregando && <Carregando linhas={2} />}
      {historico.dados?.length === 0 && <TextoSuave>Nenhuma importação até agora.</TextoSuave>}
      {historico.dados && historico.dados.length > 0 && (
        <Table size="small" aria-label="Importações realizadas">
          <TableHead>
            <TableRow>
              <TableCell>Data</TableCell>
              <TableCell>Arquivo</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Usuário</TableCell>
              <TableCell align="right">Linhas</TableCell>
              <TableCell align="right">Importadas</TableCell>
              <TableCell>Situação</TableCell>
              <TableCell>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {historico.dados.map((i) => (
              <TableRow key={i.id} hover>
                <TableCell>{formatarDataHora(i.registradaEm)}</TableCell>
                <TableCell>{i.arquivo}</TableCell>
                <TableCell>{ROTULO_IMPORTACAO[i.tipo]}</TableCell>
                <TableCell>{i.usuario ?? '—'}</TableCell>
                <TableCell align="right">{i.linhasTotal}</TableCell>
                <TableCell align="right">{i.linhasImportadas}</TableCell>
                <TableCell>
                  {i.situacao === 'DESFEITA' ? (
                    <Chip size="small" label={`Desfeita${i.desfeitaPor ? ` por ${i.desfeitaPor}` : ''}`} />
                  ) : (
                    <Chip size="small" color="success" label="Concluída" />
                  )}
                </TableCell>
                <TableCell>
                  {i.podeDesfazer && (
                    <Button size="small" color="error" onClick={() => setDesfazendo(i)}>
                      Desfazer
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {confirmando && previa && (
        <DialogoAcao
          aberto
          titulo="Confirmar importação"
          textoConfirmar="Importar"
          onFechar={() => {
            setConfirmando(false)
            setErroDialogo(null)
          }}
          onConfirmar={() => void importar()}
        >
          <Pilha spacing={2}>
            {erroDialogo && (
              <Aviso tipo="error" titulo="Não foi possível importar">
                {erroDialogo}
              </Aviso>
            )}
            <TextoSuave>
              {previa.tipo === 'FINANCEIRO'
                ? `${previa.linhas} lançamento(s) marcados “Importação” entram nos relatórios e ${previa.mesesAFechar.length} mês(es) ficam fechados.`
                : `${previa.doadores - Object.values(decisoes).filter((d) => d === 'IGNORAR').length} doador(es) serão cadastrados.`}{' '}
              A importação pode ser desfeita enquanto nada for feito sobre o que ela criou.
            </TextoSuave>
          </Pilha>
        </DialogoAcao>
      )}
      {desfazendo && (
        <DialogoAcao
          aberto
          rotulo={desfazendo.arquivo}
          titulo="Desfazer importação"
          textoConfirmar="Desfazer"
          perigo
          onFechar={() => {
            setDesfazendo(null)
            setErroDialogo(null)
          }}
          onConfirmar={() => void desfazer()}
        >
          <Pilha spacing={2}>
            {erroDialogo && (
              <Aviso tipo="error" titulo="Não foi possível desfazer">
                {erroDialogo}
              </Aviso>
            )}
            <TextoSuave>
              {desfazendo.tipo === 'FINANCEIRO'
                ? `Os ${desfazendo.linhasImportadas} lançamento(s) importados são removidos e os meses ${desfazendo.mesesFechados.map(formatarCompetencia).join(', ')} voltam a não ter fechamento.`
                : `Os ${desfazendo.linhasImportadas} doador(es) importados e as competências pendentes deles são removidos.`}
            </TextoSuave>
          </Pilha>
        </DialogoAcao>
      )}
    </Pilha>
  )
}

function Totais({ titulo, totais }: { titulo: string; totais: TotalImportacao[] }) {
  return (
    <Table size="small" aria-label={titulo}>
      <TableHead>
        <TableRow>
          <TableCell>{titulo}</TableCell>
          <TableCell align="right">Linhas</TableCell>
          <TableCell align="right">Receitas</TableCell>
          <TableCell align="right">Despesas</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {totais.map((t) => (
          <TableRow key={t.nome}>
            <TableCell>{t.nome}</TableCell>
            <TableCell align="right">{t.linhas}</TableCell>
            <TableCell align="right">{formatarMoeda(t.receitas)}</TableCell>
            <TableCell align="right">{formatarMoeda(t.despesas)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
