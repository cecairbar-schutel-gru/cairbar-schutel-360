import type { ContasDeRecebimento, MeioPagamento, PagamentoInformado, TipoCartao } from '../../shared/pagamento/regras'

export type TipoProduto = 'LIVRO' | 'CANTINA'
export type StatusVenda = 'CONCLUIDA' | 'CANCELADA'
export type LayoutComprovante = 'A4' | 'TERMICA'

/** Contas de recebimento de cada forma de pagamento (US-SALES-005), definidas pelo Administrador. */
export type OpcoesVenda = ContasDeRecebimento

export interface ProdutoVendavel {
  id: number
  tipo: TipoProduto
  nome: string
  categoria: string | null
  autor: string | null
  isbn: string | null
  /** Preço vigente. */
  preco: number
  disponivel: number
}

export interface ItemCarrinho {
  produtoId: number
  nome: string
  tipo: TipoProduto
  preco: number
  disponivel: number
  quantidade: number
  /** Preço da venda cancelada que está sendo refeita, quando diferente do atual (US-SALES-010). */
  precoAnterior: number | null
}

export interface NovaVenda {
  itens: { produtoId: number; quantidade: number; precoUnitario: number }[]
  pagamentos: PagamentoInformado[]
  refazVendaId: number | null
  chaveIdempotencia: string
}

export interface VendaRegistrada {
  id: number
  numero: number
  total: number
  status: StatusVenda
}

export interface ResumoVenda {
  id: number
  numero: number
  confirmadaEm: string
  vendedorNome: string | null
  total: number
  meios: MeioPagamento[]
  status: StatusVenda
  /** Feita pelo perfil PDV da cantina. */
  pdv: boolean
}

export interface FiltroVendas {
  /** `AAAA-MM-DD`; sem período, o backend usa hoje. */
  de?: string
  ate?: string
  status?: StatusVenda
  /** Só as do PDV da cantina (`true`) ou só as demais (`false`). */
  pdv?: boolean
  numero?: number
}

export interface LoteVendido {
  /** `null` para estoque próprio. */
  remessaId: number | null
  remessaCodigo: string | null
  quantidade: number
  repassePercentual: number | null
  obrigacaoId: number | null
  valorObrigacao: number | null
}

export interface ReferenciaVenda {
  id: number
  numero: number
}

export interface DetalheVenda {
  id: number
  numero: number
  confirmadaEm: string
  vendedorNome: string | null
  /** Feita pelo perfil PDV da cantina: o Tesoureiro também pode cancelá-la. */
  pdv: boolean
  itens: {
    produtoId: number
    produtoNome: string
    tipo: TipoProduto
    quantidade: number
    precoUnitario: number
    subtotal: number
    lotes: LoteVendido[]
  }[]
  /** `tipoCartao`: crédito ou débito no cartão; nulo nas vendas anteriores a 27/10/2026. */
  pagamentos: { meio: MeioPagamento; contaId: number; contaNome: string; valor: number; tipoCartao?: TipoCartao | null }[]
  total: number
  status: StatusVenda
  canceladaEm: string | null
  canceladaPor: string | null
  motivoCancelamento: string | null
  refazVenda: ReferenciaVenda | null
  refeitaComo: ReferenciaVenda | null
  organizacao: { nome: string; cnpj: string; endereco: string; rodape: string }
}

export interface VendaParaRefazer {
  vendaId: number
  numero: number
  itens: {
    produtoId: number
    produtoNome: string
    tipo: TipoProduto
    quantidade: number
    precoAnterior: number
    precoAtual: number
    disponivel: number
    ativo: boolean
  }[]
}

export interface PainelVendedor {
  data: string
  quantidade: number
  totalDinheiro: number
  totalPix: number
  totalCartao: number
  cancelamentos: number
}

export const MINIMO_MOTIVO_CANCELAMENTO = 10
export const MOTIVO_CANCELAMENTO_PDV = 'Cancelada no PDV'
export const SEM_VALOR_FISCAL = 'Documento sem valor fiscal'

export const ROTULO_TIPO: Record<TipoProduto, string> = {
  LIVRO: 'Livro',
  CANTINA: 'Cantina',
}

export const ROTULO_STATUS: Record<StatusVenda, string> = {
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
}
