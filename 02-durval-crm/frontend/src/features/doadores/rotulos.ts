import type {
  MotivoDuplicidade,
  StatusDoador,
  ValorConsentimento,
} from './types'

export const ROTULO_STATUS: Record<StatusDoador, string> = {
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
  ANONIMIZADO: 'Anonimizado',
}

export const ROTULO_CONSENTIMENTO: Record<ValorConsentimento, string> = {
  SIM: 'Sim',
  NAO: 'Não',
  NAO_INFORMADO: 'Não informado',
}

export const ROTULO_DUPLICIDADE: Record<MotivoDuplicidade, string> = {
  TELEFONE: 'Mesmo telefone',
  EMAIL: 'Mesmo e-mail',
  NOME_SIMILAR: 'Nome muito parecido',
}
