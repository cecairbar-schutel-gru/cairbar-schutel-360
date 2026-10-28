import {
  Box,
  Button,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { mensagemDeErro, mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { LinhaAcoes, Pilha, TituloPagina } from '../../../shared/components/layout'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import {
  brlCentavos,
  contaDoMeio,
  novaChaveIdempotencia,
  resumirPagamento,
  rotuloPagamento,
  VALORES_VAZIOS,
  type ValoresDigitados,
} from '../../../shared/pagamento/regras'
import { BotoesCantina } from '../components/BotoesCantina'
import { BuscaProdutos } from '../components/BuscaProdutos'
import { Carrinho } from '../components/Carrinho'
import { PagamentoVenda } from '../components/PagamentoVenda'
import {
  adicionarAoCarrinho,
  descartarCarrinho,
  errosPorItem,
  lerCarrinho,
  salvarCarrinho,
  totalDoCarrinho,
} from '../regras'
import { vendaService } from '../services'
import type { ItemCarrinho, OpcoesVenda, ProdutoVendavel } from '../types'

/**
 * Nova venda (wireframe 9, Jornada B): carrinho de livros e cantina, pagamento e confirmação. Cada forma de
 * pagamento entra na conta de recebimento definida pelo Administrador.
 */
export function NovaVendaPage() {
  const opcoes = useCarregamento(() => vendaService.opcoes(), [])
  if (opcoes.carregando) return <Carregando linhas={6} />
  if (opcoes.erro || !opcoes.dados) {
    return (
      <Aviso tipo="error" titulo="Erro">
        {opcoes.erro ?? 'Não foi possível carregar as contas de recebimento.'}
      </Aviso>
    )
  }
  return <FormularioVenda opcoes={opcoes.dados} />
}

function FormularioVenda({ opcoes }: { opcoes: OpcoesVenda }) {
  const { usuario } = useAuth()
  const usuarioId = usuario?.id ?? ''
  const navegar = useNavigate()
  const [params, setParams] = useSearchParams()
  const [salvo] = useState(() => lerCarrinho(usuarioId))

  const [itens, setItens] = useState<ItemCarrinho[]>(salvo?.itens ?? [])
  const [refazVenda, setRefazVenda] = useState(salvo?.refazVenda ?? null)
  const [invalidos, setInvalidos] = useState<Set<number>>(new Set())
  const [errosServidor, setErrosServidor] = useState<Map<number, string>>(new Map())
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [valores, setValores] = useState<ValoresDigitados>(VALORES_VAZIOS)
  const [entregue, setEntregue] = useState('')
  const [aba, setAba] = useState(0)
  const [revisando, setRevisando] = useState(false)
  const [descartando, setDescartando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  // Uma chave por tela de venda: clique duplo ou nova tentativa não duplicam a venda.
  const chave = useRef(novaChaveIdempotencia())

  // US-SALES-010: "Refazer" abre um carrinho novo com os itens da venda cancelada.
  const refazerId = params.get('refazer')
  useEffect(() => {
    if (!refazerId) return
    let ativo = true
    vendaService.paraRefazer(Number(refazerId)).then(
      (r) => {
        if (!ativo) return
        const inativos = r.itens.filter((i) => !i.ativo)
        setItens(
          r.itens
            .filter((i) => i.ativo)
            .map((i) => ({
              produtoId: i.produtoId,
              nome: i.produtoNome,
              tipo: i.tipo,
              preco: i.precoAtual,
              disponivel: i.disponivel,
              quantidade: i.quantidade,
              precoAnterior: i.precoAtual !== i.precoAnterior ? i.precoAnterior : null,
            })),
        )
        setRefazVenda({ id: r.vendaId, numero: r.numero })
        setValores(VALORES_VAZIOS)
        setAviso(
          inativos.length > 0
            ? `Ficaram de fora por estarem inativos: ${inativos.map((i) => i.produtoNome).join(', ')}.`
            : null,
        )
        setParams({}, { replace: true })
      },
      (e) => ativo && setErro(mensagemDeErro(e)),
    )
    return () => {
      ativo = false
    }
  }, [refazerId, setParams])

  useEffect(() => {
    salvarCarrinho(usuarioId, { itens, refazVenda })
  }, [usuarioId, itens, refazVenda])

  const total = totalDoCarrinho(itens)
  const resumo = resumirPagamento(total, valores)
  const linhasComProblema = itens.some(
    (i) => invalidos.has(i.produtoId) || i.quantidade > i.disponivel || errosServidor.has(i.produtoId),
  )
  const podeConfirmar =
    itens.length > 0 &&
    !linhasComProblema &&
    resumo.erros.length === 0 &&
    resumo.recebido > 0 &&
    resumo.diferenca === 0

  function limparErroDoItem(produtoId: number) {
    setErrosServidor((m) => {
      if (!m.has(produtoId)) return m
      const novo = new Map(m)
      novo.delete(produtoId)
      return novo
    })
  }

  function adicionar(produto: ProdutoVendavel) {
    const resultado = adicionarAoCarrinho(itens, produto)
    setItens(resultado.itens)
    setAviso(resultado.aviso)
    limparErroDoItem(produto.id)
  }

  /** Depois de um conflito na confirmação, atualiza preço e saldo de cada item no carrinho. */
  async function atualizarItens() {
    const atuais = await Promise.all(
      itens.map((i) => vendaService.buscarProdutos(i.nome, i.tipo).then((r) => r.find((p) => p.id === i.produtoId))),
    )
    setItens((lista) =>
      lista.map((item, n) => {
        const atual = atuais[n]
        if (!atual) return { ...item, disponivel: 0 }
        return {
          ...item,
          preco: atual.preco,
          disponivel: atual.disponivel,
          precoAnterior: atual.preco !== item.preco ? item.preco : item.precoAnterior,
        }
      }),
    )
  }

  async function confirmar() {
    setEnviando(true)
    setErro(null)
    try {
      const registrada = await vendaService.confirmar({
        itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade, precoUnitario: i.preco })),
        pagamentos: resumo.pagamentos,
        refazVendaId: refazVenda?.id ?? null,
        chaveIdempotencia: chave.current,
      })
      descartarCarrinho(usuarioId)
      navegar(`/vendas/${registrada.id}?nova=1`, { replace: true })
    } catch (e) {
      const porItem = errosPorItem(e)
      setErrosServidor(porItem)
      setErro(porItem.size > 0 ? mensagemDeErro(e) : mensagemDetalhada(e))
      setRevisando(false)
      if (porItem.size > 0) void atualizarItens().catch(() => undefined)
    } finally {
      setEnviando(false)
    }
  }

  function descartar() {
    descartarCarrinho(usuarioId)
    setItens([])
    setRefazVenda(null)
    setValores(VALORES_VAZIOS)
    setEntregue('')
    setErrosServidor(new Map())
    setInvalidos(new Set())
    setAviso(null)
    setErro(null)
    setDescartando(false)
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-venda">
      <TituloPagina id="titulo-venda">Nova venda</TituloPagina>

      {refazVenda && (
        <Aviso tipo="info" titulo={`Refazendo a venda nº ${refazVenda.numero}`}>
          Os preços e o estoque são os de agora; os preços que mudaram estão destacados. Informe o pagamento de
          novo.
        </Aviso>
      )}
      {aviso && (
        <Aviso tipo="warning" titulo="Atenção" onFechar={() => setAviso(null)}>
          {aviso}
        </Aviso>
      )}
      {erro && (
        <Aviso tipo="error" titulo="Não foi possível confirmar" onFechar={() => setErro(null)}>
          {erro}
        </Aviso>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 3 }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Tabs value={aba} onChange={(_, v: number) => setAba(v)} aria-label="Como adicionar produtos">
            <Tab label="Buscar produto" id="aba-busca" aria-controls="painel-busca" />
            <Tab label="Cantina" id="aba-cantina" aria-controls="painel-cantina" />
          </Tabs>
          <Box sx={{ pt: 2 }} role="tabpanel" id={aba === 0 ? 'painel-busca' : 'painel-cantina'}
            aria-labelledby={aba === 0 ? 'aba-busca' : 'aba-cantina'}>
            {aba === 0 ? <BuscaProdutos onAdicionar={adicionar} /> : <BotoesCantina onAdicionar={adicionar} />}
          </Box>
        </Paper>

        <Pilha spacing={2}>
          <Typography variant="h5" component="h2">
            Carrinho
          </Typography>
          <Carrinho
            itens={itens}
            errosDoServidor={errosServidor}
            onAlterarQuantidade={(produtoId, quantidade) => {
              setItens((lista) => lista.map((i) => (i.produtoId === produtoId ? { ...i, quantidade } : i)))
              limparErroDoItem(produtoId)
            }}
            onRemover={(produtoId) => {
              setItens((lista) => lista.filter((i) => i.produtoId !== produtoId))
              setInvalidos((s) => new Set([...s].filter((id) => id !== produtoId)))
              limparErroDoItem(produtoId)
            }}
            onValidade={(produtoId, valida) =>
              setInvalidos((s) => {
                const novo = new Set(s)
                if (valida) novo.delete(produtoId)
                else novo.add(produtoId)
                return novo
              })
            }
          />

          <Typography variant="h5" component="h2">
            Pagamento
          </Typography>
          <PagamentoVenda
            total={total}
            valores={valores}
            onAlterar={setValores}
            entregue={entregue}
            onAlterarEntregue={setEntregue}
            contas={opcoes}
            resumo={resumo}
          />

          <LinhaAcoes>
            <Button
              color="error"
              disabled={itens.length === 0 && !refazVenda}
              onClick={() => setDescartando(true)}
            >
              Descartar venda
            </Button>
            <Button variant="contained" size="large" disabled={!podeConfirmar} onClick={() => setRevisando(true)}>
              Finalizar venda
            </Button>
          </LinhaAcoes>
        </Pilha>
      </Box>

      <DialogoAcao
        aberto={revisando}
        titulo={`Confirmar venda de ${formatarMoeda(total / 100)}`}
        textoConfirmar={enviando ? 'Confirmando…' : 'Confirmar venda'}
        confirmarDesabilitado={enviando}
        onFechar={() => setRevisando(false)}
        onConfirmar={() => void confirmar()}
      >
        <Table size="small" aria-label="Revisão da venda">
          <TableBody>
            {itens.map((i) => (
              <TableRow key={i.produtoId}>
                <TableCell>
                  {i.quantidade} × {i.nome}
                </TableCell>
                <TableCell align="right">{formatarMoeda(i.preco * i.quantidade)}</TableCell>
              </TableRow>
            ))}
            {resumo.pagamentos.map((p, n) => (
              <TableRow key={n}>
                <TableCell>
                  {rotuloPagamento(p)} — {contaDoMeio(opcoes, p.meio)}
                </TableCell>
                <TableCell align="right">{formatarMoeda(p.valor)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell>
                <strong>Total</strong>
              </TableCell>
              <TableCell align="right">
                <strong>{brlCentavos(total)}</strong>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </DialogoAcao>

      <DialogoAcao
        aberto={descartando}
        perigo
        titulo="Descartar venda"
        textoConfirmar="Descartar"
        onFechar={() => setDescartando(false)}
        onConfirmar={descartar}
      >
        <Typography>O carrinho e o pagamento informado serão apagados. Nada foi registrado ainda.</Typography>
      </DialogoAcao>
    </Pilha>
  )
}
