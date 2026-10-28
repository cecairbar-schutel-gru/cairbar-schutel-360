import AddIcon from '@mui/icons-material/Add'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import {
  Box,
  Button,
  FormControlLabel,
  Switch,
  Tab,
  TablePagination,
  Tabs,
  TextField,
} from '@mui/material'
import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { LinkRota } from '../../../shared/components/LinkRota'
import {
  GradeForm,
  LinhaAcoes,
  Pilha,
  TextoSuave,
  TituloPagina,
} from '../../../shared/components/layout'
import {
  formatarData,
  formatarDataHora,
} from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { paraCentavos, paraReais } from '../../../shared/pagamento/regras'
import { EstornoModal } from '../../financeiro/components/EstornoModal'
import { financeiroService } from '../../financeiro/services'
import type {
  DetalheLancamento,
  ResultadoEstorno,
  ResultadoLancamento,
} from '../../financeiro/types'
import { AdicionarLancamentoDialogo } from '../components/AdicionarLancamentoDialogo'
import { ExtratoDialogo } from '../components/ExtratoDialogo'
import { ImportarExtratoDialogo } from '../components/ImportarExtratoDialogo'
import { PainelExtrato } from '../components/PainelExtrato'
import { RelatorioConciliacao } from '../components/RelatorioConciliacao'
import { ResumoSessao } from '../components/ResumoSessao'
import { TabelaLancamentos } from '../components/TabelaLancamentos'
import {
  diferencaZerada,
  FILTRO_VAZIO,
  filtrarLancamentos,
  type FiltroSessao,
} from '../regras'
import { conciliacaoService } from '../services'
import type {
  ItemConciliacao,
  LinhaDoExtrato,
  ParExtrato,
  SessaoConciliacao,
} from '../types'

/** Marcação aplicada na tela antes da resposta do servidor (cada clique é gravado na hora). */
function marcarLocalmente(
  s: SessaoConciliacao,
  ids: number[],
  marcado: boolean,
): SessaoConciliacao {
  const alvo = new Set(ids)
  const lancamentos = s.lancamentos.map((l) =>
    alvo.has(l.id) ? { ...l, marcado } : l,
  )
  const total = lancamentos
    .filter((l) => l.marcado)
    .reduce((t, l) => t + paraCentavos(l.valor), 0)
  const conciliado = paraCentavos(s.saldoAbertura) + total
  return {
    ...s,
    lancamentos,
    totalMarcado: paraReais(total),
    saldoConciliado: paraReais(conciliado),
    diferenca: paraReais(paraCentavos(s.saldoExtrato) - conciliado),
  }
}

type Dialogo = 'extrato' | 'adicionar' | 'importar' | 'concluir' | null
type Aba = 'extrato' | 'lancamentos'

/**
 * Sessão de conciliação: em andamento, a lista para marcar (US-RECONCILIATION-003) com o resumo
 * sempre visível, o extrato do banco importado (OFX/CSV) com os pares sugeridos, o lançamento ausente
 * (005), a correção por estorno e a conclusão (007);
 * concluída, o relatório (010).
 */
export function SessaoConciliacaoPage() {
  const id = Number(useParams().id)
  const { perfilAtivo } = useAuth()
  const carga = useCarregamento(() => conciliacaoService.sessao(id), [id])
  const [local, setLocal] = useState<SessaoConciliacao | null>(null)
  const [filtro, setFiltro] = useState<FiltroSessao>(FILTRO_VAZIO)
  const [pagina, setPagina] = useState(0)
  const [porPagina, setPorPagina] = useState(50)
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [corrigindo, setCorrigindo] = useState<DetalheLancamento | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])
  const [concluindo, setConcluindo] = useState(false)
  const [aba, setAba] = useState<Aba | null>(null)
  const [linhaAdicionar, setLinhaAdicionar] = useState<
    LinhaDoExtrato | undefined
  >()
  const [ocupado, setOcupado] = useState(false)
  // Marcações em série, para o servidor recebê-las na ordem dos cliques.
  const fila = useRef<Promise<unknown>>(Promise.resolve())
  const ultimaMarcacao = useRef(0)

  const sessao = local ?? carga.dados
  if (carga.carregando && !sessao) return <Carregando linhas={8} />
  if (!sessao) {
    return (
      <Aviso tipo="error" titulo="Erro">
        {carga.erro ?? 'Conciliação não encontrada.'}
      </Aviso>
    )
  }
  if (sessao.status === 'CONCLUIDA') {
    return (
      <Pilha>
        {sucesso && (
          <Aviso
            tipo="success"
            titulo="Conciliação concluída"
            onFechar={() => setSucesso(null)}
          >
            {sucesso}
          </Aviso>
        )}
        <RelatorioConciliacao sessao={sessao} />
      </Pilha>
    )
  }

  const editavel =
    perfilAtivo === 'tesoureiro' || perfilAtivo === 'administrador'
  const abaAtual: Aba = aba ?? (sessao.extrato ? 'extrato' : 'lancamentos')
  const exibidos = filtrarLancamentos(sessao.lancamentos, filtro)
  const visiveis = exibidos.slice(pagina * porPagina, (pagina + 1) * porPagina)
  const marcados = sessao.lancamentos.filter((l) => l.marcado).length
  const naoMarcados = sessao.lancamentos.length - marcados
  const alterarFiltro = (parcial: Partial<FiltroSessao>) => {
    setFiltro((f) => ({ ...f, ...parcial }))
    setPagina(0)
  }

  function recarregar() {
    setLocal(null)
    carga.recarregar()
  }

  function marcar(ids: number[], marcado: boolean) {
    if (ids.length === 0) return
    setErro(null)
    setLocal((s) => marcarLocalmente(s ?? sessao!, ids, marcado))
    const numero = ++ultimaMarcacao.current
    fila.current = fila.current.then(async () => {
      try {
        const resposta = await conciliacaoService.marcar(id, ids, marcado)
        if (numero === ultimaMarcacao.current) setLocal(resposta)
      } catch (e) {
        setErro(mensagemDeErro(e))
        recarregar()
      }
    })
  }

  async function abrirCorrecao(item: ItemConciliacao) {
    setErro(null)
    try {
      setCorrigindo(await financeiroService.lancamento(item.id))
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  function aposEstorno(r: ResultadoEstorno) {
    setCorrigindo(null)
    setSucesso(
      `Estorno nº ${r.estornoId} registrado${r.correcaoId ? ` com a correção nº ${r.correcaoId}` : ''}. Marque-os se estiverem no extrato.`,
    )
    setAvisos(r.avisos)
    recarregar()
  }

  /** Ações do extrato: esperam as marcações em andamento e trocam a sessão pela resposta. */
  async function acaoExtrato(
    acao: () => Promise<SessaoConciliacao>,
    mensagem: (s: SessaoConciliacao) => string,
  ) {
    setOcupado(true)
    setErro(null)
    try {
      await fila.current
      const r = await acao()
      setLocal(r)
      setSucesso(mensagem(r))
    } catch (e) {
      setErro(mensagemDeErro(e))
      recarregar()
    }
    setOcupado(false)
  }

  function confirmarPares(pares: ParExtrato[]) {
    void acaoExtrato(
      () => conciliacaoService.confirmarPares(id, pares),
      () => `${pares.length} lançamento(s) marcado(s) a partir do extrato.`,
    )
  }

  function desfazerPar(linha: LinhaDoExtrato) {
    void acaoExtrato(
      () => conciliacaoService.desfazerPar(id, linha.id),
      () =>
        `Par de “${linha.descricao}” desfeito: o lançamento nº ${linha.lancamentoId} foi desmarcado.`,
    )
  }

  function aposImportar(r: SessaoConciliacao, lidas: number) {
    setDialogo(null)
    setLocal(r)
    setAba('extrato')
    const linhas = r.extrato?.linhas ?? []
    const sugestoes = linhas.filter((l) => l.sugestaoId !== null).length
    const fora = lidas - linhas.length
    setSucesso(
      `Extrato importado: ${linhas.length} linha(s)${fora > 0 ? ` (${fora} fora do período ficaram de fora)` : ''}, ` +
        `${sugestoes} com sugestão de lançamento. Confira as sugestões e confirme.`,
    )
  }

  function aposAdicionar(r: ResultadoLancamento) {
    setDialogo(null)
    setLinhaAdicionar(undefined)
    setSucesso(`Lançamento nº ${r.id} registrado e marcado.`)
    setAvisos(r.avisos)
    recarregar()
  }

  async function concluir() {
    setConcluindo(true)
    setErro(null)
    try {
      await fila.current
      const r = await conciliacaoService.concluir(id)
      setSucesso(
        `${r.contaNome} está conciliada até ${formatarData(r.dataFim)}: ${r.lancamentos.length} lançamento(s) conciliado(s)` +
          (r.pendentes.length > 0
            ? ` e ${r.pendentes.length} pendente(s) para a próxima sessão.`
            : '.'),
      )
      setLocal(r)
    } catch (e) {
      setErro(mensagemDeErro(e))
      recarregar()
    }
    setConcluindo(false)
    setDialogo(null)
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-sessao">
      <LinkRota to="/conciliacao">Voltar à conciliação</LinkRota>
      <Box>
        <TituloPagina id="titulo-sessao">
          Conciliação — {sessao.contaNome}
        </TituloPagina>
        <TextoSuave>
          Extrato até {formatarData(sessao.dataFim)} · iniciada por{' '}
          {sessao.iniciadaPor} em {formatarDataHora(sessao.iniciadaEm)} · cada
          marcação é gravada na hora.
        </TextoSuave>
      </Box>
      {editavel && (
        <LinhaAcoes>
          <Button
            variant="contained"
            startIcon={<UploadFileIcon />}
            onClick={() => setDialogo('importar')}
          >
            Importar extrato (OFX/CSV)
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setDialogo('adicionar')}
          >
            Adicionar lançamento ausente
          </Button>
          <Button variant="outlined" onClick={() => setDialogo('extrato')}>
            Alterar dados do extrato
          </Button>
        </LinhaAcoes>
      )}
      {!editavel && (
        <Aviso tipo="info" titulo="Somente consulta">
          A conciliação é feita pelo Tesoureiro ou pelo Administrador.
        </Aviso>
      )}
      {sucesso && (
        <Aviso tipo="success" titulo="Pronto" onFechar={() => setSucesso(null)}>
          {sucesso}
        </Aviso>
      )}
      {avisos.map((a) => (
        <Aviso
          key={a}
          tipo="warning"
          titulo="Atenção"
          onFechar={() => setAvisos((lista) => lista.filter((x) => x !== a))}
        >
          {a}
        </Aviso>
      ))}
      {erro && (
        <Aviso
          tipo="error"
          titulo="Não foi possível concluir a ação"
          onFechar={() => setErro(null)}
        >
          {erro}
        </Aviso>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 22rem' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Pilha spacing={2} sx={{ minWidth: 0 }}>
          <Tabs
            value={abaAtual}
            onChange={(_, v: Aba) => setAba(v)}
            aria-label="Extrato e lançamentos"
          >
            <Tab
              value="extrato"
              label={
                sessao.extrato
                  ? `Extrato do banco (${sessao.extrato.linhas.length})`
                  : 'Extrato do banco'
              }
              id="aba-extrato"
              aria-controls="painel-extrato"
            />
            <Tab
              value="lancamentos"
              label={`Lançamentos do sistema (${sessao.lancamentos.length})`}
              id="aba-lancamentos"
              aria-controls="painel-lancamentos"
            />
          </Tabs>
          {abaAtual === 'extrato' ? (
            <Box
              role="tabpanel"
              id="painel-extrato"
              aria-labelledby="aba-extrato"
            >
              <PainelExtrato
                sessao={sessao}
                editavel={editavel}
                ocupado={ocupado}
                onImportar={() => setDialogo('importar')}
                onConfirmar={confirmarPares}
                onDesfazer={desfazerPar}
                onAdicionar={(l) => {
                  setLinhaAdicionar(l)
                  setDialogo('adicionar')
                }}
              />
            </Box>
          ) : (
            <Pilha
              role="tabpanel"
              id="painel-lancamentos"
              aria-labelledby="aba-lancamentos"
              spacing={2}
            >
              <Pilha
                component="form"
                role="search"
                aria-label="Filtrar lançamentos"
                spacing={1}
                onSubmit={(e) => e.preventDefault()}
              >
                <GradeForm>
                  <TextField
                    type="date"
                    label="De"
                    value={filtro.de}
                    onChange={(e) => alterarFiltro({ de: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    type="date"
                    label="Até"
                    value={filtro.ate}
                    onChange={(e) => alterarFiltro({ ate: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    label="Valor"
                    value={filtro.valor}
                    onChange={(e) => alterarFiltro({ valor: e.target.value })}
                    slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                  />
                  <TextField
                    label="Texto ou nº"
                    value={filtro.texto}
                    onChange={(e) => alterarFiltro({ texto: e.target.value })}
                  />
                </GradeForm>
                <FormControlLabel
                  control={
                    <Switch
                      checked={filtro.mostrarMarcados}
                      onChange={(e) =>
                        alterarFiltro({ mostrarMarcados: e.target.checked })
                      }
                    />
                  }
                  label="Mostrar marcados"
                />
              </Pilha>
              <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
                <TextoSuave>
                  {sessao.lancamentos.length} lançamento(s) não conciliado(s)
                  até {formatarData(sessao.dataFim)}: {marcados} marcado(s),{' '}
                  {naoMarcados} sem marcar. Exibindo {exibidos.length}.
                </TextoSuave>
                {editavel && exibidos.length > 0 && (
                  <LinhaAcoes>
                    <Button
                      size="small"
                      onClick={() =>
                        marcar(
                          exibidos.filter((l) => !l.marcado).map((l) => l.id),
                          true,
                        )
                      }
                    >
                      Marcar todos os exibidos
                    </Button>
                    <Button
                      size="small"
                      onClick={() =>
                        marcar(
                          exibidos.filter((l) => l.marcado).map((l) => l.id),
                          false,
                        )
                      }
                    >
                      Desmarcar os exibidos
                    </Button>
                  </LinhaAcoes>
                )}
              </LinhaAcoes>
              {sessao.lancamentos.length === 0 ? (
                <TextoSuave>
                  Nenhum lançamento não conciliado até{' '}
                  {formatarData(sessao.dataFim)}. Se o extrato tem movimentos,
                  adicione os que faltam.
                </TextoSuave>
              ) : exibidos.length === 0 ? (
                <TextoSuave>Nenhum lançamento com esses filtros.</TextoSuave>
              ) : (
                <Box sx={{ overflowX: 'auto' }}>
                  <TabelaLancamentos
                    rotulo="Lançamentos a conciliar"
                    itens={visiveis}
                    comMarcacao
                    onMarcar={
                      editavel
                        ? (l, marcado) => marcar([l.id], marcado)
                        : undefined
                    }
                    onCorrigir={
                      editavel ? (l) => void abrirCorrecao(l) : undefined
                    }
                  />
                  <TablePagination
                    component="div"
                    count={exibidos.length}
                    page={pagina}
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
            </Pilha>
          )}
        </Pilha>
        <Box sx={{ position: { xl: 'sticky' }, top: { xl: 16 } }}>
          <ResumoSessao
            sessao={sessao}
            acoes={
              editavel && (
                <>
                  <Button
                    variant="contained"
                    disabled={!diferencaZerada(sessao.diferenca)}
                    onClick={() => setDialogo('concluir')}
                  >
                    Concluir conciliação
                  </Button>
                  {!diferencaZerada(sessao.diferenca) && (
                    <TextoSuave>
                      Disponível quando a diferença for R$ 0,00.
                    </TextoSuave>
                  )}
                </>
              )
            }
          />
        </Box>
      </Box>

      {dialogo === 'extrato' && (
        <ExtratoDialogo
          titulo="Alterar dados do extrato"
          contaNome={sessao.contaNome}
          conciliadaAte={sessao.dataFimAnterior}
          saldoAbertura={sessao.saldoAbertura}
          inicial={{
            dataFim: sessao.dataFim,
            saldoExtrato: sessao.saldoExtrato,
          }}
          textoConfirmar="Salvar"
          onFechar={() => setDialogo(null)}
          onConfirmar={async (dataFim, saldo) => {
            await fila.current
            setLocal(
              await conciliacaoService.alterarExtrato(id, dataFim, saldo),
            )
            setDialogo(null)
          }}
        />
      )}
      {dialogo === 'adicionar' && (
        <AdicionarLancamentoDialogo
          sessao={sessao}
          linha={linhaAdicionar}
          onFechar={() => {
            setDialogo(null)
            setLinhaAdicionar(undefined)
          }}
          onConcluido={aposAdicionar}
        />
      )}
      {dialogo === 'importar' && (
        <ImportarExtratoDialogo
          sessao={sessao}
          onFechar={() => setDialogo(null)}
          onImportado={aposImportar}
        />
      )}
      {corrigindo && (
        <EstornoModal
          lancamento={corrigindo}
          onFechar={() => setCorrigindo(null)}
          onConcluido={aposEstorno}
        />
      )}
      <DialogoAcao
        aberto={dialogo === 'concluir'}
        rotulo={sessao.contaNome}
        titulo="Concluir conciliação"
        textoConfirmar="Concluir"
        confirmarDesabilitado={concluindo}
        onFechar={() => setDialogo(null)}
        onConfirmar={() => void concluir()}
      >
        <TextoSuave>
          {sessao.contaNome} ficará conciliada até{' '}
          {formatarData(sessao.dataFim)}. Os {marcados} lançamento(s) marcado(s)
          passam a ser conciliados e não poderão ser desmarcados (um erro
          descoberto depois é corrigido por estorno).
          {naoMarcados > 0 &&
            ` Os ${naoMarcados} sem marcar ficam pendentes e aparecem na próxima conciliação.`}
        </TextoSuave>
      </DialogoAcao>
    </Pilha>
  )
}
