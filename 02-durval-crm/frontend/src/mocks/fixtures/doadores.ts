import type { StatusCompetencia } from '../../features/contribuicoes/types'
import type { Consentimento, Endereco, StatusDoador, Telefone, Email } from '../../features/doadores/types'

export interface SementeDoador {
  nome: string
  cpf: string | null
  /** Deslocamento em dias a partir de hoje para o aniversário; `null` = sem data. */
  aniversarioEmDias: number | null
  idade: number
  status: StatusDoador
  telefones: Telefone[]
  emails: Email[]
  endereco: Endereco | null
  whatsapp: Consentimento['valor']
  email: Consentimento['valor']
  /** Meses atrás (0 = mês atual) das competências e seus status. */
  competencias: { mesesAtras: number; status: StatusCompetencia }[]
  motivoInativacao?: string
}

const cel = (numero: string, principal = true): Telefone => ({ tipo: 'CELULAR', numero, principal })
const mail = (endereco: string): Email => ({ endereco, principal: true })

export const SEMENTES_DOADORES: SementeDoador[] = [
  {
    nome: 'João da Silva',
    cpf: '52998224725',
    aniversarioEmDias: 0,
    idade: 41,
    status: 'ATIVO',
    telefones: [cel('11987654321')],
    emails: [mail('joao.silva@exemplo.com.br')],
    endereco: {
      cep: '01310100',
      logradouro: 'Avenida Paulista',
      numero: '1000',
      complemento: '',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      uf: 'SP',
    },
    whatsapp: 'SIM',
    email: 'SIM',
    competencias: [
      { mesesAtras: 2, status: 'PAGA' },
      { mesesAtras: 1, status: 'PENDENTE' },
      { mesesAtras: 0, status: 'PENDENTE' },
    ],
  },
  {
    nome: 'Maria Aparecida Souza',
    cpf: '16899535009',
    aniversarioEmDias: 3,
    idade: 63,
    status: 'ATIVO',
    telefones: [cel('11976543210')],
    emails: [mail('maria.souza@exemplo.com.br')],
    endereco: null,
    whatsapp: 'SIM',
    email: 'NAO',
    competencias: [
      { mesesAtras: 2, status: 'PENDENTE' },
      { mesesAtras: 1, status: 'PENDENTE' },
      { mesesAtras: 0, status: 'PENDENTE' },
    ],
  },
  {
    nome: 'José Carlos Pereira',
    cpf: null,
    aniversarioEmDias: 12,
    idade: 55,
    status: 'ATIVO',
    telefones: [{ tipo: 'FIXO', numero: '1133334444', principal: true }],
    emails: [],
    endereco: null,
    whatsapp: 'NAO_INFORMADO',
    email: 'NAO_INFORMADO',
    competencias: [{ mesesAtras: 0, status: 'PAGA' }],
  },
  {
    nome: 'Ana Beatriz Lima',
    cpf: '11144477735',
    aniversarioEmDias: 40,
    idade: 29,
    status: 'ATIVO',
    telefones: [cel('21999887766')],
    emails: [mail('ana.lima@exemplo.com.br')],
    endereco: null,
    whatsapp: 'NAO',
    email: 'SIM',
    competencias: [{ mesesAtras: 0, status: 'PENDENTE' }],
  },
  {
    nome: 'Carlos Eduardo Ramos',
    cpf: null,
    aniversarioEmDias: null,
    idade: 0,
    status: 'ATIVO',
    telefones: [cel('31988776655')],
    emails: [],
    endereco: null,
    whatsapp: 'SIM',
    email: 'NAO_INFORMADO',
    competencias: [{ mesesAtras: 0, status: 'PAGA' }],
  },
  {
    nome: 'Fernanda Oliveira',
    cpf: '39053344705',
    aniversarioEmDias: 7,
    idade: 36,
    status: 'ATIVO',
    telefones: [cel('41997766554')],
    emails: [mail('fernanda.oliveira@exemplo.com.br')],
    endereco: null,
    whatsapp: 'SIM',
    email: 'SIM',
    competencias: [
      { mesesAtras: 1, status: 'PAGA' },
      { mesesAtras: 0, status: 'PENDENTE' },
    ],
  },
  {
    nome: 'Joana Silva Santos',
    cpf: null,
    aniversarioEmDias: null,
    idade: 0,
    status: 'ATIVO',
    telefones: [cel('11955443322')],
    emails: [],
    endereco: null,
    whatsapp: 'NAO_INFORMADO',
    email: 'NAO_INFORMADO',
    competencias: [{ mesesAtras: 0, status: 'PENDENTE' }],
  },
  {
    nome: 'Pedro Henrique Alves',
    cpf: null,
    aniversarioEmDias: 20,
    idade: 47,
    status: 'INATIVO',
    telefones: [cel('11944332211')],
    emails: [mail('pedro.alves@exemplo.com.br')],
    endereco: null,
    whatsapp: 'SIM',
    email: 'NAO_INFORMADO',
    competencias: [
      { mesesAtras: 4, status: 'PAGA' },
      { mesesAtras: 3, status: 'CANCELADA' },
      { mesesAtras: 2, status: 'CANCELADA' },
    ],
    motivoInativacao: 'Mudou de cidade e pediu para interromper as contribuições.',
  },
]
