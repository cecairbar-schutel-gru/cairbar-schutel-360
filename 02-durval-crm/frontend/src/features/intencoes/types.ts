/** Situações da intenção de gasto (devplan/07-expense-requests). */
export type StatusIntencao =
  | 'PENDENTE'
  | 'APROVADA'
  | 'AGUARDANDO_RECEBIMENTO'
  | 'DIVERGENTE'
  | 'RECEBIDA'
  | 'REJEITADA'
  | 'CANCELADA'

/** Cartão não é meio de pagamento de despesas; dinheiro sai de um caixa, os demais de um banco. */
export type MeioPagamentoGasto = 'DINHEIRO' | 'PIX' | 'TRANSFERENCIA' | 'BOLETO'

export const MAXIMO_ANEXOS = 5
export const MAXIMO_ANEXO_BYTES = 10 * 1024 * 1024
export const MAXIMO_TEXTO = 1000

/** Categoria-mãe (`categoriaPai` nulo) ou subcategoria de despesa disponível. */
export interface CategoriaOpcao {
  codigo: string
  nome: string
  categoriaPai: string | null
  nomeCompleto: string
  compraCantina: boolean
}

export interface OpcoesIntencao {
  categorias: CategoriaOpcao[]
  produtos: { id: number; nome: string; categoria: string | null }[]
  /** Só para quem aprova. */
  contas: { id: number; nome: string; tipo: 'CAIXA' | 'BANCO'; saldo: number }[]
}

export interface ItemCompra {
  produtoId: number
  produtoNome: string
  quantidade: number
  quantidadeRecebida: number | null
}

export interface ResumoIntencao {
  id: number
  criadaEm: string
  solicitanteNome: string | null
  descricao: string
  categoria: string
  categoriaNome: string
  valorSolicitado: number
  valorAprovado: number | null
  status: StatusIntencao
  statusAlteradoEm: string
  anexos: number
  itens: ItemCompra[]
  /** Só em "Minhas intenções": a situação mudou depois da última visita. */
  novidade: boolean
}

export interface Aprovacao {
  valor: number
  categoria: string
  categoriaNome: string
  meio: MeioPagamentoGasto
  contaId: number
  contaNome: string
  data: string
  nota: string | null
  lancamentoId: number | null
}

export interface InfoAnexo {
  ordem: number
  nome: string
  tipo: string
  tamanho: number
}

export interface EventoIntencao {
  tipo: string
  usuario: string | null
  em: string
  descricao: string
}

export interface DetalheIntencao {
  id: number
  descricao: string
  categoria: string
  categoriaNome: string
  valorSolicitado: number
  justificativa: string
  status: StatusIntencao
  solicitanteNome: string | null
  criadaEm: string
  statusAlteradoEm: string
  compraCantina: boolean
  itens: ItemCompra[]
  aprovacao: Aprovacao | null
  decididaPorNome: string | null
  decididaEm: string | null
  motivoRejeicao: string | null
  recebidaPorNome: string | null
  recebidaEm: string | null
  divergencia: string | null
  canceladaPorNome: string | null
  canceladaEm: string | null
  motivoCancelamento: string | null
  anexos: InfoAnexo[]
  historico: EventoIntencao[]
  /** Só para quem decide: o que a subcategoria já gastou no mês corrente. */
  gastoNoMes: number | null
  acoes: { decidir: boolean; resolverDivergencia: boolean; retirar: boolean; receber: boolean; copiar: boolean }
}

export interface AnexoEnviado {
  nome: string
  tipo: string
  conteudoBase64: string
}

export interface ItemQuantidade {
  produtoId: number
  quantidade: number
}

export interface NovaIntencao {
  descricao: string
  categoria: string
  valor: number
  justificativa: string
  itens: ItemQuantidade[]
  anexos: AnexoEnviado[]
}

export interface DadosAprovacao {
  valor: number
  categoria: string
  meio: MeioPagamentoGasto
  contaId: number
  data: string
  nota: string
}

export interface ResultadoAcao {
  id: number
  status: StatusIntencao
  lancamentoId: number | null
  avisos: string[]
}

export interface Contadores {
  pendentes: number
  divergentes: number
  aguardandoRecebimento: number
}

export type FiltroFila = 'PENDENTE' | 'DIVERGENTE' | 'TODAS'
