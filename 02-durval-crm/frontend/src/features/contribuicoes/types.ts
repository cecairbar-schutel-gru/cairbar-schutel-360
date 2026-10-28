import type { ContasDeRecebimento, MeioPagamento, PagamentoInformado, TipoCartao } from '../../shared/pagamento/regras'

export {
  ROTULO_MEIO,
  type Conta,
  type MeioPagamento,
  type PagamentoInformado,
} from '../../shared/pagamento/regras'

export type StatusCompetencia = 'PENDENTE' | 'PAGA' | 'CANCELADA'

export interface Competencia {
  /** `AAAA-MM`. */
  competencia: string
  valor: number
  status: StatusCompetencia
  dataPagamento: string | null
  numeroRecibo: string | null
}

/** `FUTURA`: mês ainda não gerado, gravado só se for pago antecipadamente. */
export type SituacaoCompetencia = StatusCompetencia | 'FUTURA'

export interface ItemCompetencia {
  competencia: string
  valor: number
  situacao: SituacaoCompetencia
  atrasada: boolean
  selecionavel: boolean
  dataPagamento: string | null
  numeroRecibo: string | null
  contribuicaoId: number | null
}

export interface PainelCompetencias {
  quantidadePendentes: number
  totalPendente: number
  /** Valor cobrado nas competências futuras (vigente na data do pagamento). */
  mensalidadeAtual: number
  itens: ItemCompetencia[]
  possuiMaisAntigas: boolean
}

export type TipoContribuicao =
  | 'MENSALIDADE'
  | 'DOACAO_EXTRAORDINARIA'
  | 'DOACAO_ANONIMA'
export type StatusContribuicao = 'REGISTRADA' | 'CANCELADA'
export type LayoutRecibo = 'A4' | 'TERMICA'
export type CanalAgradecimento = 'WHATSAPP' | 'EMAIL'

/** Contas de recebimento de cada forma de pagamento (US-CONTRIB-004), definidas pelo Administrador. */
export type OpcoesPagamento = ContasDeRecebimento

export interface NovaContribuicao {
  doadorId: number | null
  anonima: boolean
  competencias: string[]
  valorDoacao: number
  pagamentos: PagamentoInformado[]
  observacao: string
  chaveIdempotencia: string
}

export interface ContribuicaoRegistrada {
  id: number
  numeroRecibo: string
  tipo: TipoContribuicao
  total: number
  status: StatusContribuicao
}

export interface Pagamento {
  meio: MeioPagamento
  contaId: number
  contaNome: string
  valor: number
  /** Crédito ou débito no cartão; nulo nos registros anteriores a 27/10/2026. */
  tipoCartao?: TipoCartao | null
}

export interface Recibo {
  contribuicaoId: number
  numero: string
  recebidaEm: string
  tipo: TipoContribuicao
  doadorId: number | null
  doadorNome: string
  competencias: { mes: string; valor: number }[]
  valorDoacao: number
  pagamentos: Pagamento[]
  total: number
  observacao: string | null
  operadorNome: string
  status: StatusContribuicao
  canceladaEm: string | null
  motivoCancelamento: string | null
  segundaVia: boolean
  organizacao: {
    nome: string
    cnpj: string
    endereco: string
    rodape: string
  }
}

export interface ItemHistorico {
  id: number
  recebidaEm: string
  numeroRecibo: string
  tipo: TipoContribuicao
  competencias: string[]
  valorDoacao: number
  total: number
  meios: MeioPagamento[]
  status: StatusContribuicao
  motivoCancelamento: string | null
}

export interface HistoricoContribuicoes {
  ano: number
  anosDisponiveis: number[]
  /** Exclui as canceladas. */
  totalNoAno: number
  itens: ItemHistorico[]
}

export interface PainelOperador {
  data: string
  quantidade: number
  totalDinheiro: number
  totalPix: number
  totalCartao: number
  ultimas: {
    id: number
    recebidaEm: string
    numeroRecibo: string
    tipo: TipoContribuicao
    doadorNome: string
    total: number
    status: StatusContribuicao
  }[]
}

export interface SituacaoGeracao {
  mes: string
  estado: 'CONCLUIDA' | 'FALHA' | 'AGUARDANDO'
  tentativas: number
  ultimaTentativa: string | null
  erro: string | null
}

export const LIMITE_OBSERVACAO = 200
export const MINIMO_MOTIVO_CANCELAMENTO = 10
export const NOME_ANONIMO = 'Doação anônima'

export const ROTULO_TIPO: Record<TipoContribuicao, string> = {
  MENSALIDADE: 'Mensalidade',
  DOACAO_EXTRAORDINARIA: 'Doação extraordinária',
  DOACAO_ANONIMA: 'Doação anônima',
}
