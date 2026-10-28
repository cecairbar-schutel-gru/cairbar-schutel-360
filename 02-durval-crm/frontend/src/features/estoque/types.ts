import type { TipoProduto } from '../vendas/types'

export type { TipoProduto }
export type SituacaoCatalogo = 'ATIVOS' | 'INATIVOS' | 'TODOS'
export type MotivoBaixa = 'VENCIMENTO' | 'DANO' | 'EXTRAVIO'
export type TipoSolicitacao = 'BAIXA' | 'PRECO' | 'INATIVACAO'
export type StatusSolicitacao = 'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'CANCELADA'
export type TipoMovimento =
  | 'VENDA'
  | 'CANCELAMENTO_VENDA'
  | 'ENTRADA_COMPRA'
  | 'ENTRADA_DOACAO'
  | 'ENTRADA_REMESSA'
  | 'DEVOLUCAO_EDITORA'
  | 'BAIXA_VENCIMENTO'
  | 'BAIXA_DANO'
  | 'BAIXA_EXTRAVIO'
  | 'AJUSTE'
  | 'ESTORNO'

export const MAXIMO_OBSERVACAO = 200
export const MAXIMO_JUSTIFICATIVA = 500
export const MAXIMO_FOTO_BYTES = 5 * 1024 * 1024

/** Linha da tela Estoque (wireframe 10, US-INVENTORY-009). */
export interface ItemEstoque {
  id: number
  tipo: TipoProduto
  nome: string
  categoria: string | null
  autor: string | null
  isbn: string | null
  editoraNome: string | null
  preco: number
  ativo: boolean
  saldo: number
  saldoProprio: number
  saldoConsignado: number
  /** Unidades em pedidos de baixa pendentes; continuam vendáveis. */
  aguardandoBaixa: number
  ultimaEntrada: string | null
}

export interface FiltroEstoque {
  tipo?: TipoProduto
  categoria?: string
  q?: string
  somenteSemSaldo?: boolean
  situacao?: SituacaoCatalogo
}

export interface LoteDetalhado {
  /** Nulo = estoque próprio. */
  remessaId: number | null
  remessaCodigo: string | null
  recebidaEm: string | null
  quantidade: number
  aguardandoBaixa: number
  repassePercentual: number | null
}

export interface AlteracaoPreco {
  produtoId: number
  precoAnterior: number
  precoNovo: number
  alteradoEm: string
  /** Nulo quando o Administrador alterou direto (livros). */
  solicitadoPor: string | null
  aprovadoPor: string
  motivo: string
}

export interface DetalheProduto {
  id: number
  tipo: TipoProduto
  nome: string
  categoria: string | null
  autor: string | null
  isbn: string | null
  editoraId: number | null
  editoraNome: string | null
  preco: number
  repassePadrao: number | null
  ativo: boolean
  saldo: number
  aguardandoBaixa: number
  lotes: LoteDetalhado[]
  historicoPrecos: AlteracaoPreco[]
  ultimaVenda: string | null
  /** Com movimento, remessa, venda ou solicitação: não pode ser excluído. */
  possuiHistorico: boolean
  precoPendente: boolean
  inativacaoPendente: boolean
}

export interface LinhaMovimento {
  id: number
  ocorridoEm: string
  tipo: TipoMovimento
  quantidade: number
  remessaId: number | null
  remessaCodigo: string | null
  usuarioNome: string | null
  referenciaTipo: string | null
  referenciaId: number | null
  estornaMovimentoId: number | null
  estornado: boolean
  saldoApos: number
}

export interface FiltroMovimentos {
  de?: string
  ate?: string
  tipo?: TipoMovimento
}

export interface ProdutoSimilar {
  id: number
  nome: string
  categoria: string | null
  ativo: boolean
}

export interface OpcoesCatalogo {
  editoras: { id: number; nome: string }[]
  categorias: string[]
}

export interface ProdutoCadastrado {
  id: number
  tipo: TipoProduto
  nome: string
  categoria: string | null
  autor: string | null
  isbn: string | null
  editoraId: number | null
  preco: number
  repassePadrao: number | null
  ativo: boolean
}

export interface DadosLivro {
  titulo: string
  autor: string
  isbn: string
  editoraId: number | null
  repassePadrao: number | null
  /** Só no cadastro; depois muda por "Alterar preço". */
  preco?: number | null
}

export interface DadosCantina {
  nome: string
  categoria: string
  preco?: number | null
}

export interface NovaEntradaDoacao {
  itens: { produtoId: number; quantidade: number }[]
  observacao: string
}

export interface EntradaRegistrada {
  id: number
  registradaEm: string
  cancelada: boolean
}

export interface ResumoEntradaDoacao {
  id: number
  registradaEm: string
  registradaPorNome: string | null
  observacao: string | null
  itens: { produtoId: number; produtoNome: string; quantidade: number }[]
  canceladaEm: string | null
  canceladaPorNome: string | null
  motivoCancelamento: string | null
  /** Enquanto todas as unidades ainda estão no estoque próprio. */
  cancelavel: boolean
}

export interface FotoEnviada {
  conteudoBase64: string
  tipo: string
}

export interface NovaBaixa {
  produtoId: number
  remessaId: number | null
  quantidade: number
  motivo: MotivoBaixa
  justificativa: string
  foto: FotoEnviada | null
}

export interface ResumoSolicitacao {
  id: number
  tipo: TipoSolicitacao
  produtoId: number
  produtoNome: string
  produtoTipo: TipoProduto
  remessaId: number | null
  remessaCodigo: string | null
  quantidade: number | null
  motivoBaixa: MotivoBaixa | null
  justificativa: string
  /** Preço atual do produto. */
  precoVigente: number
  novoPreco: number | null
  diferencaPercentual: number | null
  temFoto: boolean
  status: StatusSolicitacao
  solicitanteNome: string | null
  solicitadaEm: string
  decididaPorNome: string | null
  decididaEm: string | null
  motivoDecisao: string | null
  autoAprovada: boolean
  /** Saldo do lote (baixa) ou do produto (inativação). */
  saldoAtual: number
  ultimaVenda: string | null
}

export interface FiltroSolicitacoes {
  status?: StatusSolicitacao
  /** Mesmo para o Administrador, só as próprias. */
  minhas?: boolean
}

export interface SolicitacaoRegistrada {
  id: number
  tipo: TipoSolicitacao
  status: StatusSolicitacao
  autoAprovada: boolean
}

export interface ResultadoAjuste {
  saldoAnterior: number
  quantidadeContada: number
  diferenca: number
  tipo: TipoMovimento
  solicitacaoId: number | null
}
