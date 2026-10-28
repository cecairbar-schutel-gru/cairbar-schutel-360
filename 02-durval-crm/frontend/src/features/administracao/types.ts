import type { Papel } from '../../auth'
import type { TipoCategoria } from '../financeiro/types'

export type TipoModelo = 'AGRADECIMENTO' | 'ANIVERSARIO'
export type TipoImportacao = 'FINANCEIRO' | 'DOADORES'

export interface Autor {
  subject: string
  nome: string | null
  em: string
}

// US-ADMIN-021

export interface MesReceitasDespesas {
  /** AAAA-MM */
  mes: string
  receitas: number
  despesas: number
  vendas: number
}

export interface PainelAdministrador {
  mes: string
  doadoresAtivos: number
  vendasNoMes: number
  vendasMesAnterior: number
  resultadoNoMes: number
  resultadoMesAnterior: number
  /** Últimos 6 meses, do mais antigo ao atual. */
  receitasDespesas: MesReceitasDespesas[]
  mensalidadeAgendada: ValorMensalidade | null
}

// US-ADMIN-001

export interface UsuarioIdentidade {
  id: string
  usuario: string
  nome: string
  email: string | null
  papeis: Papel[]
  habilitado: boolean
  ultimoLogin: string | null
  linkConsole: string
}

export interface ListaUsuarios {
  configurado: boolean
  erro: string | null
  usuarios: UsuarioIdentidade[]
}

// US-ADMIN-002

export interface ValorMensalidade {
  id: number
  valor: number
  /** AAAA-MM */
  vigenteDe: string
  motivo: string | null
  autor: Autor
}

export interface SituacaoMensalidade {
  vigente: ValorMensalidade
  agendada: ValorMensalidade | null
  /** Do mais recente ao mais antigo, inclusive o agendado. */
  historico: ValorMensalidade[]
  mesAtual: string
}

export interface NovoValorMensalidade {
  valor: number
  vigenteDe: string
  motivo: string
}

// US-ADMIN-003

export interface ModeloMensagem {
  tipo: TipoModelo
  whatsapp: string
  emailAssunto: string
  emailCorpo: string
  /** Variáveis aceitas, sem chaves ("nome", "valor"...). */
  variaveis: string[]
  atualizadoPor: string | null
  atualizadoEm: string | null
}

export interface TextosModelo {
  whatsapp: string
  emailAssunto: string
  emailCorpo: string
}

// US-ADMIN-004

export interface CategoriaPlano {
  codigo: string
  nome: string
  tipo: TipoCategoria
  categoriaPai: string | null
  sistema: boolean
  ativa: boolean
  emUso: boolean
}

export interface CategoriaComSubcategorias {
  categoria: CategoriaPlano
  subcategorias: CategoriaPlano[]
}

export interface NovaCategoria {
  nome: string
  tipo?: TipoCategoria
  categoriaPai?: string
}

// US-ADMIN-005

export type TipoChavePix = 'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA'

export const ROTULO_TIPO_CHAVE_PIX: Record<TipoChavePix, string> = {
  CPF: 'CPF',
  CNPJ: 'CNPJ',
  EMAIL: 'E-mail',
  TELEFONE: 'Telefone',
  ALEATORIA: 'Chave aleatória',
}

export interface Organizacao {
  razaoSocial: string
  nomeExibicao: string
  cnpj: string | null
  endereco: string | null
  telefone: string | null
  email: string | null
  temLogo: boolean
  rodapeRecibo: string | null
  /** Sem chave, o PDV da cantina não mostra o QR Code PIX. */
  tipoChavePix: TipoChavePix | null
  chavePix: string | null
  /** Cidade exigida pelo BR Code (até 15 caracteres sem acentos). */
  cidadePix: string | null
  fusoHorario: string
  /** Ainda valem os dados da instalação. */
  padrao: boolean
  atualizadoPor: string | null
  atualizadoEm: string | null
}

export interface DadosOrganizacao {
  razaoSocial: string
  nomeExibicao: string
  cnpj: string
  endereco: string
  telefone: string
  email: string
  rodapeRecibo: string
  tipoChavePix: TipoChavePix | ''
  chavePix: string
  cidadePix: string
  /** Novo logotipo em Base64; nulo mantém o atual. */
  logo: { conteudo: string; tipo: string } | null
  removerLogo: boolean
}

// US-ADMIN-009

export interface EventoAuditoria {
  id: number
  em: string
  autorSubject: string
  autorNome: string | null
  perfil: Papel | null
  ip: string | null
  acao: string
  entidade: string
  entidadeId: string
  detalhes: Record<string, unknown>
}

export interface PaginaAuditoria {
  itens: EventoAuditoria[]
  pagina: number
  temMais: boolean
}

export interface FiltroAuditoria {
  de?: string
  ate?: string
  usuario?: string
  acao?: string
  entidade?: string
  entidadeId?: string
}

export interface OpcoesAuditoria {
  acoes: string[]
  entidades: string[]
}

// US-ADMIN-012

export interface ErroLinha {
  linha: number
  coluna: string | null
  mensagem: string
}

export interface TotalImportacao {
  nome: string
  receitas: number
  despesas: number
  linhas: number
}

export interface DuplicataLinha {
  linha: number
  nome: string
  possiveis: { id: number; nome: string; motivos: string[] }[]
}

export interface PreviaImportacao {
  tipo: TipoImportacao
  arquivo: string
  linhas: number
  erros: ErroLinha[]
  totaisPorConta: TotalImportacao[]
  totaisPorCategoria: TotalImportacao[]
  mesesAFechar: string[]
  duplicatas: DuplicataLinha[]
  /** Linhas de doador válidas. */
  doadores: number
  /** Competências pendentes que serão criadas. */
  competencias: number
}

export type DecisaoDuplicata = 'IMPORTAR' | 'IGNORAR'

export interface EnvioImportacao {
  tipo: TipoImportacao
  arquivo: string
  /** Base64 */
  conteudo: string
}

export interface Importacao {
  id: number
  tipo: TipoImportacao
  arquivo: string
  usuario: string | null
  registradaEm: string
  linhasTotal: number
  linhasImportadas: number
  mesesFechados: string[]
  situacao: 'CONCLUIDA' | 'DESFEITA'
  podeDesfazer: boolean
  desfeitaPor: string | null
  desfeitaEm: string | null
}
