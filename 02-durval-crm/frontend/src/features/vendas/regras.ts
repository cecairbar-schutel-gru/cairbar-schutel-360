import { ApiError } from '../../shared/api/http'
import { paraCentavos, paraReais, type PagamentoInformado } from '../../shared/pagamento/regras'
import type { ItemCarrinho, ProdutoVendavel } from './types'

export const totalDoCarrinho = (itens: ItemCarrinho[]) =>
  itens.reduce((s, i) => s + paraCentavos(i.preco) * i.quantidade, 0)

export function mensagemLimite(disponivel: number): string {
  return disponivel === 1 ? 'Só 1 disponível.' : `Só ${disponivel} disponíveis.`
}

/** Adiciona 1 unidade (ou soma 1 à linha existente) sem passar do disponível (US-SALES-002). */
export function adicionarAoCarrinho(
  itens: ItemCarrinho[],
  produto: ProdutoVendavel,
): { itens: ItemCarrinho[]; aviso: string | null } {
  const existente = itens.find((i) => i.produtoId === produto.id)
  if (produto.disponivel <= 0) return { itens, aviso: `${produto.nome} está sem estoque.` }
  if (existente) {
    if (existente.quantidade >= produto.disponivel) {
      return { itens, aviso: `${produto.nome}: ${mensagemLimite(produto.disponivel)}` }
    }
    return {
      itens: itens.map((i) =>
        i.produtoId === produto.id
          ? { ...i, quantidade: i.quantidade + 1, disponivel: produto.disponivel, preco: produto.preco }
          : i,
      ),
      aviso: null,
    }
  }
  return {
    itens: [
      ...itens,
      {
        produtoId: produto.id,
        nome: produto.nome,
        tipo: produto.tipo,
        preco: produto.preco,
        disponivel: produto.disponivel,
        quantidade: 1,
        precoAnterior: null,
      },
    ],
    aviso: null,
  }
}

/** Quantidade digitada: inteiro de 1 até o disponível. */
export function validarQuantidade(texto: string, disponivel: number): { quantidade: number | null; erro: string | null } {
  if (!/^\d+$/.test(texto.trim())) return { quantidade: null, erro: 'Informe um número inteiro.' }
  const quantidade = Number(texto.trim())
  if (quantidade < 1) return { quantidade: null, erro: 'Mínimo 1.' }
  if (quantidade > disponivel) return { quantidade: null, erro: mensagemLimite(disponivel) }
  return { quantidade, erro: null }
}

/** Troco do dinheiro: valor entregue menos a parte da venda paga em dinheiro (centavos). */
export function calcularTroco(entregue: number | null, dinheiro: number): number | null {
  if (entregue === null || Number.isNaN(entregue)) return null
  return entregue - dinheiro
}

/**
 * Erros por item vindos da API (campo `itens[<produtoId>]`): estoque insuficiente, preço alterado
 * ou produto inativo.
 */
export function errosPorItem(erro: unknown): Map<number, string> {
  const mapa = new Map<number, string>()
  if (!(erro instanceof ApiError)) return mapa
  for (const e of erro.erros) {
    const id = /^itens\[(\d+)\]$/.exec(e.campo)?.[1]
    if (id) mapa.set(Number(id), e.mensagem)
  }
  return mapa
}

/** Carrinho guardado no navegador até a venda ser confirmada ou descartada (US-SALES-002). */
export interface CarrinhoSalvo {
  itens: ItemCarrinho[]
  refazVenda: { id: number; numero: number } | null
}

const chaveCarrinho = (usuarioId: string) => `durvalcrm.venda.carrinho.${usuarioId}`

export function lerCarrinho(usuarioId: string): CarrinhoSalvo | null {
  try {
    const bruto = localStorage.getItem(chaveCarrinho(usuarioId))
    return bruto ? (JSON.parse(bruto) as CarrinhoSalvo) : null
  } catch {
    return null
  }
}

export function salvarCarrinho(usuarioId: string, carrinho: CarrinhoSalvo): void {
  try {
    if (carrinho.itens.length === 0 && carrinho.refazVenda === null) {
      localStorage.removeItem(chaveCarrinho(usuarioId))
    } else {
      localStorage.setItem(chaveCarrinho(usuarioId), JSON.stringify(carrinho))
    }
  } catch {
    // armazenamento indisponível: o carrinho só não sobrevive à atualização da página
  }
}

export function descartarCarrinho(usuarioId: string): void {
  try {
    localStorage.removeItem(chaveCarrinho(usuarioId))
  } catch {
    // idem
  }
}

// PDV da cantina: o carrinho usa as funções acima; a venda tem uma única forma de pagamento.

/** Crédito e débito entram pelo bruto em Cartão a receber, como toda venda no cartão. */
export type FormaPdv = 'CREDITO' | 'DEBITO' | 'PIX' | 'DINHEIRO'

export const FORMAS_PDV: Record<FormaPdv, string> = {
  CREDITO: 'Crédito',
  DEBITO: 'Débito',
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
}

/** Pagamento único da venda do PDV; entra na conta de recebimento da forma. Crédito e débito levam o tipo. */
export function pagamentoPdv(forma: FormaPdv, totalCentavos: number): PagamentoInformado {
  const valor = paraReais(totalCentavos)
  if (forma === 'PIX' || forma === 'DINHEIRO') return { meio: forma, valor }
  return { meio: 'CARTAO', valor, tipoCartao: forma }
}
