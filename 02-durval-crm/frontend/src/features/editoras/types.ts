/** Tipos do módulo Editoras (US-PUBLISHER-001 a 010); mesmo contrato de `EditoraController`. */

export type SituacaoEditoras = 'ATIVAS' | 'INATIVAS' | 'TODAS'
/** Situação exibida: encerrada quando todos os itens chegam a zero. */
export type SituacaoRemessa = 'ABERTA' | 'ENCERRADA' | 'CANCELADA'
export type OrigemObrigacao = 'VENDA' | 'BAIXA'
export type StatusObrigacao = 'ABERTA' | 'PARCIALMENTE_PAGA' | 'PAGA' | 'ESTORNADA'
export type MeioPagamentoEditora = 'PIX' | 'TRANSFERENCIA' | 'DINHEIRO'

export const MAXIMO_OBSERVACAO = 500

export interface DadosEditora {
  nome: string
  cnpj: string
  contatoNome: string
  telefone: string
  email: string
  banco: string
  agencia: string
  conta: string
  chavePix: string
  observacoes: string
}

export interface Editora {
  id: number
  nome: string
  /** Só dígitos; nulo nas editoras incluídas antes do cadastro. */
  cnpj: string | null
  contatoNome: string | null
  telefone: string | null
  email: string | null
  banco: string | null
  agencia: string | null
  conta: string | null
  chavePix: string | null
  observacoes: string | null
  ativa: boolean
}

export interface ResumoEditora {
  id: number
  nome: string
  cnpj: string | null
  contatoNome: string | null
  telefone: string | null
  ativa: boolean
  remessasAbertas: number
  saldoDevido: number
}

export interface ResumoRemessa {
  id: number
  codigo: string
  editoraId: number
  editoraNome: string
  /** AAAA-MM-DD */
  recebidaEm: string
  numeroDocumento: string | null
  situacao: SituacaoRemessa
  recebidas: number
  restantes: number
}

export interface DetalheEditora {
  editora: Editora
  possuiRemessas: boolean
  saldoDevido: number
  ultimoPagamento: { data: string; valor: number } | null
  remessasAbertas: ResumoRemessa[]
}

/** Livro do catálogo da editora, com o percentual padrão copiado para a nova remessa. */
export interface TituloConsignado {
  produtoId: number
  nome: string
  autor: string | null
  isbn: string | null
  editoraId: number | null
  repassePadrao: number | null
  ativo: boolean
}

export interface ItemNovaRemessa {
  produtoId: number
  quantidade: number
  /** Nulo usa o padrão do título. */
  repassePercentual: number | null
}

export interface NovaRemessa {
  editoraId: number
  recebidaEm: string
  numeroDocumento: string
  itens: ItemNovaRemessa[]
  /** Pedido de livros aberto que a remessa atende. */
  pedidoId?: number | null
}

export type SituacaoPedido = 'ABERTO' | 'RECEBIDO' | 'CANCELADO'

/** Pedido de novos livros à editora, feito pela Tesouraria; o Vendedor recebe a remessa contra ele. */
export interface ResumoPedido {
  id: number
  editoraId: number
  editoraNome: string
  status: SituacaoPedido
  pedidoEm: string
  pedidoPor: string
  titulos: number
  unidades: number
  remessaId: number | null
  remessaCodigo: string | null
}

/** Conferência por título: `recebida` é nula enquanto o pedido não foi recebido. */
export interface ItemPedidoConferido {
  produtoId: number
  titulo: string
  autor: string | null
  isbn: string | null
  pedida: number
  recebida: number | null
}

export interface DetalhePedido {
  id: number
  editoraId: number
  editoraNome: string
  status: SituacaoPedido
  observacao: string | null
  pedidoEm: string
  pedidoPor: string
  remessaId: number | null
  remessaCodigo: string | null
  canceladoEm: string | null
  canceladoPor: string | null
  motivoCancelamento: string | null
  itens: ItemPedidoConferido[]
}

export interface NovoPedido {
  editoraId: number
  observacao: string
  itens: { produtoId: number; quantidade: number }[]
}

export interface ItemRemessaDetalhado {
  produtoId: number
  titulo: string
  autor: string | null
  isbn: string | null
  recebida: number
  repassePercentual: number
  vendida: number
  devolvida: number
  baixada: number
  ajustes: number
  restante: number
  /** Soma das obrigações não estornadas. */
  obrigacoes: number
}

export interface Organizacao {
  nome: string
  cnpj: string
  endereco: string
  rodape: string
}

export interface ItemDevolvido {
  produtoId: number
  titulo: string
  isbn: string | null
  quantidade: number
}

export interface Devolucao {
  id: number
  remessaId: number
  remessaCodigo: string
  editoraId: number
  editoraNome: string
  editoraCnpj: string | null
  devolvidaEm: string
  observacao: string | null
  registradaEm: string
  registradaPor: string | null
  itens: ItemDevolvido[]
  organizacao: Organizacao
}

export interface DetalheRemessa {
  id: number
  codigo: string
  editoraId: number
  editoraNome: string
  recebidaEm: string
  numeroDocumento: string | null
  situacao: SituacaoRemessa
  registradaEm: string | null
  registradaPor: string | null
  canceladaEm: string | null
  canceladaPor: string | null
  motivoCancelamento: string | null
  itens: ItemRemessaDetalhado[]
  devolucoes: Devolucao[]
  podeCancelar: boolean
  podeDevolver: boolean
}

export interface NovaDevolucao {
  devolvidaEm: string
  observacao: string
  itens: { produtoId: number; quantidade: number }[]
}

export interface ResultadoRemessa {
  id: number
  codigo: string
}

export interface SaldoEditora {
  editoraId: number
  nome: string
  ativa: boolean
  saldoDevido: number
  obrigacaoMaisAntiga: string | null
  ultimoPagamento: string | null
}

export interface QuadroSaldos {
  editoras: SaldoEditora[]
  total: number
}

export interface LinhaObrigacao {
  id: number
  data: string
  origem: OrigemObrigacao
  origemId: number
  /** Número da venda ou da solicitação de baixa. */
  origemNumero: number | null
  remessaCodigo: string
  produtoId: number
  titulo: string
  quantidade: number
  precoUnitario: number
  repassePercentual: number
  valor: number
  valorPago: number
  valorAberto: number
  status: StatusObrigacao
  estornadaEm: string | null
}

export interface LinhaPagamento {
  id: number
  pagoEm: string
  valor: number
  creditoAplicado: number
  contaNome: string
  meio: MeioPagamentoEditora
  observacao: string | null
  registradoPor: string | null
  lancamentoId: number | null
  estornadoEm: string | null
}

export interface SaldoDetalhado {
  editora: Editora
  totalObrigacoes: number
  totalEstornos: number
  totalPagamentos: number
  saldoDevido: number
  creditoDisponivel: number
  obrigacoes: LinhaObrigacao[]
  pagamentos: LinhaPagamento[]
}

export interface LinhaAlocacao {
  obrigacaoId: number
  data: string
  origem: OrigemObrigacao
  origemNumero: number | null
  remessaCodigo: string
  titulo: string
  valorAberto: number
  valorAlocado: number
  restante: number
}

export interface PreviaPagamento {
  saldoDevido: number
  creditoAplicado: number
  valor: number
  alocacoes: LinhaAlocacao[]
  saldoDepois: number
}

export interface NovoPagamento {
  editoraId: number
  pagoEm: string
  valor: number
  contaId: number
  meio: MeioPagamentoEditora
  observacao: string
  chaveIdempotencia: string
}

export interface ResultadoPagamento {
  id: number
  lancamentoId: number | null
  avisos: string[]
}

export interface ReciboPagamento {
  id: number
  editoraId: number
  editoraNome: string
  editoraCnpj: string | null
  pagoEm: string
  valor: number
  creditoAplicado: number
  contaNome: string
  meio: MeioPagamentoEditora
  observacao: string | null
  lancamentoId: number | null
  registradoEm: string
  registradoPor: string | null
  estornadoEm: string | null
  alocacoes: LinhaAlocacao[]
  organizacao: Organizacao
}

export interface TransferenciaSaldo {
  id: number
  editoraId: number
  /** AAAA-MM */
  mes: string
  valor: number
  nota: string
  usuarioSubject: string
  usuarioNome: string | null
  registradaEm: string
}

export interface EstoqueRemessa {
  remessaId: number
  remessaCodigo: string
  produtoId: number
  titulo: string
  inicial: number
  recebida: number
  vendida: number
  devolvida: number
  baixada: number
  outros: number
  fim: number
}

export interface LinhaDevolucao {
  devolucaoId: number
  data: string
  remessaCodigo: string
  titulo: string
  quantidade: number
  observacao: string | null
}

export interface Apuracao {
  organizacao: Organizacao
  editora: Editora
  mes: string
  saldoInicial: number
  transferenciaAnterior: TransferenciaSaldo | null
  obrigacoesVendas: number
  obrigacoesBaixas: number
  estornos: number
  /** Já descontados os pagamentos estornados no mês. */
  pagamentos: number
  saldoFinal: number
  estoque: EstoqueRemessa[]
  vendas: LinhaObrigacao[]
  baixas: LinhaObrigacao[]
  estornadas: LinhaObrigacao[]
  devolucoes: LinhaDevolucao[]
  linhasPagamentos: LinhaPagamento[]
}

export interface ItemFechamento {
  editoraId: number
  nome: string
  saldoNoFimDoMes: number
  situacao: 'PENDENTE' | 'TRANSFERIDA'
  transferencia: TransferenciaSaldo | null
}

export interface FechamentoEditoras {
  mes: string
  editoras: ItemFechamento[]
  concluido: boolean
}
