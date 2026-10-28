import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import DeleteIcon from '@mui/icons-material/Delete'
import PaymentsIcon from '@mui/icons-material/Payments'
import PersonIcon from '@mui/icons-material/Person'
import PixIcon from '@mui/icons-material/Pix'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import RemoveIcon from '@mui/icons-material/Remove'
import SearchIcon from '@mui/icons-material/Search'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import QRCode from 'qrcode'
import { useEffect, useId, useRef, useState, type ComponentType } from 'react'
import { useAuth } from '../../../auth/AuthProvider'
import { mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarDataHora } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { CampoValor } from '../../../shared/pagamento/CamposPagamento'
import { brlCentavos, lerValor, novaChaveIdempotencia, paraCentavos, rotuloPagamento } from '../../../shared/pagamento/regras'
import { gerarPayloadPix } from '../../../shared/pix/brcode'
import { normalizarTexto } from '../../../shared/text/texto'
import { administracaoService } from '../../administracao/services'
import type { Organizacao } from '../../administracao/types'
import { CancelarVendaModal } from '../components/CancelarVendaModal'
import { StatusVendaTag } from '../components/StatusVendaTag'
import {
  adicionarAoCarrinho,
  calcularTroco,
  FORMAS_PDV,
  mensagemLimite,
  pagamentoPdv,
  totalDoCarrinho,
  type FormaPdv,
} from '../regras'
import { vendaService } from '../services'
import {
  MOTIVO_CANCELAMENTO_PDV,
  type ItemCarrinho,
  type OpcoesVenda,
  type ProdutoVendavel,
  type VendaRegistrada,
} from '../types'

const ICONE_FORMA: Record<FormaPdv, ComponentType> = {
  CREDITO: CreditCardIcon,
  DEBITO: CreditCardIcon,
  PIX: PixIcon,
  DINHEIRO: PaymentsIcon,
}

/**
 * PDV da cantina para o tablet, com os produtos da cantina e, numa aba própria, os livros cadastrados
 * pelo Vendedor (vendidos também pelo perfil PDV). Cada toque num produto põe 1 unidade no carrinho;
 * a cobrança só abre pelo botão "Cobrar" e a venda só é registrada no botão final de confirmação
 * (PIX: "PIX recebido"), longe dos produtos, para um toque duplo nunca virar venda. Cada forma entra na
 * conta de recebimento definida pelo Administrador. "Última venda" mostra e cancela a última venda do
 * próprio usuário (US-SALES-022).
 */
export function PdvCantinaPage() {
  const opcoes = useCarregamento(() => vendaService.opcoes(), [])
  if (opcoes.carregando) return <Carregando linhas={6} />
  if (opcoes.erro || !opcoes.dados) {
    return (
      <Aviso tipo="error" titulo="Erro">
        {opcoes.erro ?? 'Não foi possível carregar as contas de recebimento.'}
      </Aviso>
    )
  }
  return <Pdv opcoes={opcoes.dados} />
}

function Pdv({ opcoes }: { opcoes: OpcoesVenda }) {
  const { possuiPapel, usuario } = useAuth()
  // O perfil PDV só opera o PDV: o comprovante fica na tela de vendas, que é do Vendedor.
  const veComprovante = possuiPapel('vendedor')
  const [aba, setAba] = useState<'CANTINA' | 'LIVRO'>('CANTINA')
  const [termo, setTermo] = useState('')
  const produtos = useCarregamento(() => vendaService.buscarProdutos('', aba), [aba])
  // Sem os dados da organização o PDV vende normalmente; só o QR Code PIX deixa de aparecer.
  const organizacao = useCarregamento(() => administracaoService.organizacao(), [])
  const [itens, setItens] = useState<ItemCarrinho[]>([])
  const [aviso, setAviso] = useState<string | null>(null)
  const [cobrando, setCobrando] = useState(false)
  const [registrada, setRegistrada] = useState<{ venda: VendaRegistrada; texto: string } | null>(null)
  const [vendoUltima, setVendoUltima] = useState(false)
  const [cancelando, setCancelando] = useState<VendaRegistrada | null>(null)
  const [cancelada, setCancelada] = useState<number | null>(null)

  const livros = aba === 'LIVRO'
  const busca = normalizarTexto(termo)
  const lista = (produtos.dados ?? []).filter(
    (p) => !livros || !busca || [p.nome, p.autor, p.isbn].some((t) => t && normalizarTexto(t).includes(busca)),
  )
  // Livros não têm categoria: ficam num grupo só, em ordem de título.
  const grupo = (p: ProdutoVendavel) => (livros ? 'Livros' : (p.categoria ?? 'Outros'))
  const categorias = [...new Set(lista.map(grupo))]
  const noCarrinho = (id: number) => itens.find((i) => i.produtoId === id)?.quantidade ?? 0

  function adicionar(produto: ProdutoVendavel) {
    const resultado = adicionarAoCarrinho(itens, produto)
    setItens(resultado.itens)
    setAviso(resultado.aviso)
  }

  function somar(item: ItemCarrinho, delta: number) {
    const quantidade = item.quantidade + delta
    if (quantidade > item.disponivel) {
      setAviso(`${item.nome}: ${mensagemLimite(item.disponivel)}`)
      return
    }
    setAviso(null)
    setItens((atuais) =>
      quantidade < 1
        ? atuais.filter((i) => i.produtoId !== item.produtoId)
        : atuais.map((i) => (i.produtoId === item.produtoId ? { ...i, quantidade } : i)),
    )
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-pdv" spacing={2}>
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <TituloPagina id="titulo-pdv">PDV da cantina</TituloPagina>
        <LinhaAcoes>
          {/* O AppBar esconde o nome em telas estreitas; no PDV ele fica sempre à vista. */}
          {usuario && <Chip icon={<PersonIcon />} label={usuario.nome} aria-label={`Usuário: ${usuario.nome}`} />}
          <Button variant="outlined" startIcon={<ReceiptLongIcon />} onClick={() => setVendoUltima(true)}>
            Última venda
          </Button>
        </LinhaAcoes>
      </LinhaAcoes>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 20rem' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Pilha spacing={2}>
          <Tabs
            value={aba}
            onChange={(_, v: 'CANTINA' | 'LIVRO') => {
              setAba(v)
              setTermo('')
            }}
            aria-label="Cantina ou livros"
          >
            <Tab value="CANTINA" label="Cantina" />
            <Tab value="LIVRO" label="Livros" />
          </Tabs>
          {livros && (
            <TextField
              label="Buscar por título, autor ou ISBN"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
            />
          )}

          {produtos.erro && (
            <Aviso tipo="error" titulo="Erro">
              {produtos.erro}
            </Aviso>
          )}
          {produtos.carregando && !produtos.dados && <Carregando />}
          {produtos.dados && lista.length === 0 && (
            <TextoSuave>{livros ? 'Nenhum livro disponível encontrado.' : 'Nenhum produto da cantina ativo.'}</TextoSuave>
          )}

          {categorias.map((categoria) => (
            <Box key={categoria} component="section" aria-label={categoria}>
              <Typography variant="subtitle1" component="h2" color="text.secondary" sx={{ mb: 1 }}>
                {categoria}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(11rem, 1fr))', gap: 1.5 }}>
                {lista
                  .filter((p) => grupo(p) === categoria)
                  .map((p) => {
                    const quantidade = noCarrinho(p.id)
                    return (
                      <Button
                        key={p.id}
                        variant={quantidade > 0 ? 'contained' : 'outlined'}
                        disabled={p.disponivel <= 0}
                        onClick={() => adicionar(p)}
                        aria-label={`Adicionar ${p.nome}, ${formatarMoeda(p.preco)}`}
                        sx={{ minHeight: '7rem', flexDirection: 'column', gap: 0.5, typography: 'h6', textTransform: 'none' }}
                      >
                        <Box component="span" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                          {p.nome}
                        </Box>
                        {p.autor && (
                          <Box component="span" sx={{ typography: 'body2' }}>
                            {p.autor}
                          </Box>
                        )}
                        <Box component="span">{formatarMoeda(p.preco)}</Box>
                        <Box component="span" sx={{ typography: 'caption' }}>
                          {p.disponivel <= 0
                            ? 'Sem estoque'
                            : quantidade > 0
                              ? `${quantidade} no carrinho · ${p.disponivel} disponíveis`
                              : `${p.disponivel} disponíveis`}
                        </Box>
                      </Button>
                    )
                  })}
              </Box>
            </Box>
          ))}
        </Pilha>

        <PainelCarrinho
          itens={itens}
          aviso={aviso}
          onFecharAviso={() => setAviso(null)}
          onSomar={somar}
          onRemover={(item) => {
            setAviso(null)
            setItens((atuais) => atuais.filter((i) => i.produtoId !== item.produtoId))
          }}
          onCobrar={() => setCobrando(true)}
        />
      </Box>

      {cobrando && (
        <DialogoCobranca
          itens={itens}
          contas={opcoes}
          organizacao={organizacao.dados}
          onFechar={() => setCobrando(false)}
          onRegistrada={(venda, texto) => {
            setCobrando(false)
            setItens([])
            setAviso(null)
            setRegistrada({ venda, texto })
            produtos.recarregar()
          }}
        />
      )}

      {vendoUltima && (
        <DialogoUltimaVenda
          onFechar={() => setVendoUltima(false)}
          onCancelar={(venda) => {
            setVendoUltima(false)
            setRegistrada(null)
            setCancelando(venda)
          }}
        />
      )}

      {cancelando && (
        <CancelarVendaModal
          venda={cancelando}
          motivoInicial={MOTIVO_CANCELAMENTO_PDV}
          onFechar={() => setCancelando(null)}
          onCancelada={() => {
            setCancelada(cancelando.numero)
            setCancelando(null)
            produtos.recarregar()
          }}
        />
      )}

      <Snackbar
        open={!!registrada}
        autoHideDuration={10000}
        onClose={(_, motivo) => motivo !== 'clickaway' && setRegistrada(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Paper elevation={6} sx={{ px: 2, py: 1.5 }} role="status">
          {registrada && (
            <LinhaAcoes>
              <Typography>
                Venda nº {registrada.venda.numero} registrada: {registrada.texto}.
              </Typography>
              {veComprovante && <LinkRota to={`/vendas/${registrada.venda.id}`}>Ver comprovante</LinkRota>}
              <Button
                color="error"
                onClick={() => {
                  setCancelando(registrada.venda)
                  setRegistrada(null)
                }}
              >
                Cancelar venda
              </Button>
            </LinhaAcoes>
          )}
        </Paper>
      </Snackbar>

      <Snackbar
        open={cancelada !== null}
        autoHideDuration={6000}
        onClose={() => setCancelada(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Paper elevation={6} sx={{ px: 2, py: 1.5 }} role="status">
          <Typography>Venda nº {cancelada} cancelada. Estoque e valores foram estornados.</Typography>
        </Paper>
      </Snackbar>
    </Pilha>
  )
}

interface PropsPainel {
  itens: ItemCarrinho[]
  aviso: string | null
  onFecharAviso(): void
  onSomar(item: ItemCarrinho, delta: number): void
  onRemover(item: ItemCarrinho): void
  onCobrar(): void
}

/**
 * Carrinho fixo: no rodapé com o tablet em retrato e na lateral em paisagem, sempre com o total e o
 * botão "Cobrar" à vista.
 */
function PainelCarrinho({ itens, aviso, onFecharAviso, onSomar, onRemover, onCobrar }: PropsPainel) {
  const total = totalDoCarrinho(itens)
  return (
    <Paper
      component="section"
      aria-label="Carrinho"
      elevation={6}
      sx={{
        position: 'sticky',
        bottom: { xs: 0, md: 'auto' },
        top: { md: 88 },
        zIndex: 1,
        p: 2,
      }}
    >
      <Pilha spacing={1.5}>
        <Typography variant="h6" component="h2">
          Carrinho
        </Typography>
        {aviso && (
          <Aviso tipo="warning" titulo="Limite do estoque" onFechar={onFecharAviso}>
            {aviso}
          </Aviso>
        )}
        {itens.length === 0 ? (
          <TextoSuave>Toque nos produtos para adicioná-los.</TextoSuave>
        ) : (
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, maxHeight: { xs: '28vh', md: '55vh' }, overflowY: 'auto' }}>
            {itens.map((item) => (
              <Box
                component="li"
                key={item.produtoId}
                aria-label={`${item.quantidade} × ${item.nome}`}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.5 }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontWeight: 600 }}>
                    {item.nome}
                  </Typography>
                  <TextoSuave>{brlCentavos(paraCentavos(item.preco) * item.quantidade)}</TextoSuave>
                </Box>
                <IconButton aria-label={`Diminuir ${item.nome}`} onClick={() => onSomar(item, -1)}>
                  <RemoveIcon />
                </IconButton>
                <Typography sx={{ minWidth: '2ch', textAlign: 'center' }} aria-hidden>
                  {item.quantidade}
                </Typography>
                <IconButton aria-label={`Aumentar ${item.nome}`} onClick={() => onSomar(item, 1)}>
                  <AddIcon />
                </IconButton>
                <IconButton aria-label={`Remover ${item.nome}`} onClick={() => onRemover(item)}>
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}
        <Divider />
        <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
          <Typography variant="h5" component="p" aria-live="polite">
            Total: {brlCentavos(total)}
          </Typography>
          <Button variant="contained" size="large" disabled={itens.length === 0} onClick={onCobrar}>
            Cobrar
          </Button>
        </LinhaAcoes>
      </Pilha>
    </Paper>
  )
}

interface PropsCobranca {
  itens: ItemCarrinho[]
  contas: OpcoesVenda
  organizacao: Organizacao | null
  onFechar(): void
  onRegistrada(venda: VendaRegistrada, texto: string): void
}

/**
 * Cobrança do carrinho: escolher a forma só a seleciona; a venda é registrada no botão do rodapé
 * ("Confirmar venda de R$ X no crédito" ou, no PIX, "PIX recebido"). Em dinheiro, o valor entregue
 * calcula o troco.
 */
function DialogoCobranca({ itens, contas, organizacao, onFechar, onRegistrada }: PropsCobranca) {
  const theme = useTheme()
  const telaCheia = useMediaQuery(theme.breakpoints.down('sm'))
  const idTitulo = useId()
  const [forma, setForma] = useState<FormaPdv | null>(null)
  const [entregue, setEntregue] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Uma chave por cobrança: toque duplo no botão ou nova tentativa não duplicam a venda.
  const chave = useRef(novaChaveIdempotencia())

  const total = totalDoCarrinho(itens)
  const valorEntregue = forma === 'DINHEIRO' ? lerValor(entregue) : null
  const troco = calcularTroco(valorEntregue, total)
  const entregueInvalido = valorEntregue !== null && (Number.isNaN(valorEntregue) || (troco !== null && troco < 0))
  const nomeForma = forma ? FORMAS_PDV[forma].toLowerCase() : ''
  const resumo = itens.map((i) => `${i.quantidade} × ${i.nome}`).join(', ')

  async function registrar() {
    if (!forma) return
    setEnviando(true)
    setErro(null)
    try {
      const venda = await vendaService.confirmar({
        itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade, precoUnitario: i.preco })),
        pagamentos: [pagamentoPdv(forma, total)],
        refazVendaId: null,
        chaveIdempotencia: chave.current,
      })
      onRegistrada(venda, `${resumo}, ${brlCentavos(total)} no ${nomeForma}`)
    } catch (e) {
      setErro(mensagemDetalhada(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open onClose={enviando ? undefined : onFechar} fullScreen={telaCheia} fullWidth maxWidth="sm" aria-labelledby={idTitulo}>
      <DialogTitle id={idTitulo}>Cobrar {brlCentavos(total)}</DialogTitle>
      <DialogContent>
        <Pilha spacing={2} sx={{ pt: 1 }}>
          {erro && (
            <Aviso tipo="error" titulo="Não foi possível registrar" onFechar={() => setErro(null)}>
              {erro}
            </Aviso>
          )}
          <TextoSuave>{resumo}</TextoSuave>
          <ToggleButtonGroup
            exclusive
            value={forma}
            onChange={(_, valor: FormaPdv | null) => valor && setForma(valor)}
            aria-label="Forma de pagamento"
            disabled={enviando}
            sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}
          >
            {(Object.keys(FORMAS_PDV) as FormaPdv[]).map((f) => {
              const Icone = ICONE_FORMA[f]
              const semConta = (f === 'PIX' && !contas.pix) || (f === 'DINHEIRO' && !contas.dinheiro)
              return (
                <ToggleButton
                  key={f}
                  value={f}
                  disabled={semConta}
                  color="primary"
                  sx={{
                    minHeight: '4.5rem',
                    typography: 'h6',
                    textTransform: 'none',
                    gap: 1,
                    // O grupo em grade: cada botão com a borda inteira e cantos arredondados.
                    '&&': { borderRadius: 1, border: 1, borderColor: 'divider' },
                  }}
                >
                  <Icone />
                  {FORMAS_PDV[f]}
                </ToggleButton>
              )
            })}
          </ToggleButtonGroup>
          {(!contas.pix || !contas.dinheiro) && (
            <TextoSuave>
              {!contas.pix ? 'PIX' : 'Dinheiro'} sem conta de recebimento: peça ao Administrador para definir.
            </TextoSuave>
          )}
          {forma === 'DINHEIRO' && (
            <>
              <CampoValor
                rotulo="Valor entregue (opcional)"
                valor={entregue}
                onAlterar={setEntregue}
                ajuda={
                  entregueInvalido
                    ? Number.isNaN(valorEntregue)
                      ? 'Valor inválido.'
                      : 'O valor entregue é menor que o total.'
                    : 'Para calcular o troco.'
                }
              />
              {troco !== null && troco >= 0 && (
                <Typography variant="h5" component="p" aria-live="polite">
                  Troco: {brlCentavos(troco)}
                </Typography>
              )}
            </>
          )}
          {forma === 'PIX' && <CobrancaPix totalCentavos={total} organizacao={organizacao} />}
        </Pilha>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button startIcon={<ArrowBackIcon />} disabled={enviando} onClick={onFechar}>
          Voltar ao carrinho
        </Button>
        <Button
          variant="contained"
          size="large"
          disabled={!forma || enviando || entregueInvalido}
          onClick={() => void registrar()}
        >
          {enviando
            ? 'Registrando…'
            : forma === 'PIX'
              ? 'PIX recebido'
              : forma
                ? `Confirmar venda de ${brlCentavos(total)} no ${nomeForma}`
                : 'Escolha a forma de pagamento'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/** Última venda do próprio usuário: número, itens, forma e total, com o cancelamento se estiver concluída. */
function DialogoUltimaVenda({ onFechar, onCancelar }: { onFechar(): void; onCancelar(venda: VendaRegistrada): void }) {
  const idTitulo = useId()
  const ultima = useCarregamento(() => vendaService.ultima(), [])
  const venda = ultima.dados
  return (
    <Dialog open onClose={onFechar} fullWidth maxWidth="sm" aria-labelledby={idTitulo}>
      <DialogTitle id={idTitulo}>Última venda</DialogTitle>
      <DialogContent>
        {ultima.carregando && <Carregando />}
        {ultima.erro && (
          <Aviso tipo="error" titulo="Erro">
            {ultima.erro}
          </Aviso>
        )}
        {!ultima.carregando && !ultima.erro && !venda && <TextoSuave>Você ainda não registrou nenhuma venda.</TextoSuave>}
        {venda && (
          <Pilha spacing={1.5}>
            <LinhaAcoes>
              <Typography variant="h6" component="p">
                Venda nº {venda.numero}
              </Typography>
              <StatusVendaTag status={venda.status} />
            </LinhaAcoes>
            <TextoSuave>{formatarDataHora(venda.confirmadaEm)}</TextoSuave>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {venda.itens.map((i) => (
                <li key={i.produtoId}>
                  {i.quantidade} × {i.produtoNome} — {formatarMoeda(i.subtotal)}
                </li>
              ))}
            </Box>
            <Typography>
              {venda.pagamentos.map((p) => `${rotuloPagamento(p)}: ${formatarMoeda(p.valor)}`).join(' · ')}
            </Typography>
            <Typography variant="h5" component="p">
              Total: {formatarMoeda(venda.total)}
            </Typography>
            {venda.status === 'CANCELADA' && (
              <TextoSuave>
                Cancelada{venda.motivoCancelamento ? `: ${venda.motivoCancelamento}` : ''}. Não há outra venda a cancelar
                pelo PDV.
              </TextoSuave>
            )}
          </Pilha>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar}>Fechar</Button>
        {venda?.status === 'CONCLUIDA' && (
          <Button variant="contained" color="error" onClick={() => onCancelar(venda)}>
            Cancelar venda
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

/** QR Code PIX estático com o valor da venda, gerado com a chave cadastrada nos dados da organização. */
function CobrancaPix({ totalCentavos, organizacao }: { totalCentavos: number; organizacao: Organizacao | null }) {
  const [imagem, setImagem] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const payload =
    organizacao?.chavePix && organizacao.cidadePix
      ? gerarPayloadPix({
          chave: organizacao.chavePix,
          nome: organizacao.nomeExibicao,
          cidade: organizacao.cidadePix,
          valorCentavos: totalCentavos,
        })
      : null

  useEffect(() => {
    if (!payload) return
    let ativo = true
    QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2, width: 320 }).then(
      (url) => ativo && setImagem(url),
      () => ativo && setImagem(null),
    )
    return () => {
      ativo = false
    }
  }, [payload])

  if (!payload) {
    return (
      <Aviso tipo="warning" titulo="QR Code indisponível">
        A chave PIX da organização não está cadastrada. Peça ao Administrador para cadastrá-la em Configurações
        › Dados da organização. Confira o PIX de {brlCentavos(totalCentavos)} no app do banco antes de confirmar.
      </Aviso>
    )
  }
  return (
    <Pilha spacing={1} sx={{ alignItems: 'center' }}>
      {imagem ? (
        <Box
          component="img"
          src={imagem}
          alt={`QR Code PIX de ${brlCentavos(totalCentavos)} para ${organizacao?.nomeExibicao}`}
          sx={{ width: '100%', maxWidth: 320, aspectRatio: '1 / 1' }}
        />
      ) : (
        <Carregando />
      )}
      <TextoSuave>Peça ao cliente para ler o QR Code e confirme quando o PIX aparecer na conta.</TextoSuave>
      <Button
        startIcon={<ContentCopyIcon />}
        onClick={() =>
          void navigator.clipboard?.writeText(payload).then(
            () => setCopiado(true),
            () => undefined,
          )
        }
      >
        {copiado ? 'Código copiado' : 'Copiar código PIX'}
      </Button>
    </Pilha>
  )
}
