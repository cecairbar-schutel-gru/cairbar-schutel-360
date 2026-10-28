export type StatusDoador = 'ATIVO' | 'INATIVO' | 'ANONIMIZADO'
export type ValorConsentimento = 'SIM' | 'NAO' | 'NAO_INFORMADO'
export type TipoTelefone = 'CELULAR' | 'FIXO'
export type DecisaoPendencias = 'MANTER' | 'CANCELAR'

export interface Telefone {
  tipo: TipoTelefone
  /** Somente dígitos, com DDD. */
  numero: string
  principal: boolean
}

export interface Email {
  endereco: string
  principal: boolean
}

export interface Endereco {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
}

export interface Consentimento {
  valor: ValorConsentimento
  registradoEm: string | null
  registradoPor: string | null
}

export interface Doador {
  id: number
  nome: string
  cpf: string | null
  dataNascimento: string | null
  status: StatusDoador
  telefones: Telefone[]
  emails: Email[]
  endereco: Endereco | null
  consentimentoWhatsapp: Consentimento
  consentimentoEmail: Consentimento
  criadoEm: string
  inativadoEm: string | null
  motivoInativacao: string | null
}

export interface ResumoDoador {
  id: number
  nome: string
  telefonePrincipal: string | null
  emailPrincipal: string | null
  status: StatusDoador
  competenciasPendentes: number
}

export interface DadosDuplicidade {
  nome: string
  telefone: string
  email: string
}

export type MotivoDuplicidade = 'TELEFONE' | 'EMAIL' | 'NOME_SIMILAR'

export interface PossivelDuplicata {
  doador: ResumoDoador
  motivos: MotivoDuplicidade[]
}

export interface CadastroRapido extends DadosDuplicidade {
  consentimentoWhatsapp: ValorConsentimento
  consentimentoEmail: ValorConsentimento
  /** Doadores sinalizados como possível duplicata e descartados pelo Operador ("é outra pessoa"). */
  duplicatasDescartadas: number[]
}

export interface AtualizacaoDoador {
  nome: string
  cpf: string
  dataNascimento: string
  telefones: Telefone[]
  emails: Email[]
  endereco: Endereco | null
  consentimentoWhatsapp: ValorConsentimento
  consentimentoEmail: ValorConsentimento
}

export interface InativacaoDoador {
  motivo: string
  pendencias: DecisaoPendencias
}

export interface ReativacaoDoador {
  motivo: string
}

export interface AnonimizacaoDoador {
  motivo: string
  nomeConfirmacao: string
  /** Obrigatório quando o doador ainda está ativo. */
  pendencias?: DecisaoPendencias
}

export interface NotaDoador {
  id: number
  texto: string
  autor: string
  criadaEm: string
}

export interface Aniversariante {
  doadorId: number
  nome: string
  /** Próxima ocorrência do aniversário dentro do período (AAAA-MM-DD). */
  dataAniversario: string
  idadeACompletar: number
  consentimentoWhatsapp: ValorConsentimento
  consentimentoEmail: ValorConsentimento
  telefonePrincipal: string | null
  emailPrincipal: string | null
}

export interface ResultadoAniversariantes {
  itens: Aniversariante[]
  /** Doadores ativos sem data de nascimento. */
  semDataNascimento: number
}

export const LIMITE_NOTA = 500
export const MINIMO_BUSCA = 3
