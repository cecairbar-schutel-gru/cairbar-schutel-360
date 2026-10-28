import type { ArquivoBaixado } from '../../../shared/api/http'
import type {
  CategoriaComSubcategorias,
  CategoriaPlano,
  DadosOrganizacao,
  DecisaoDuplicata,
  EnvioImportacao,
  EventoAuditoria,
  FiltroAuditoria,
  Importacao,
  ListaUsuarios,
  ModeloMensagem,
  NovaCategoria,
  NovoValorMensalidade,
  OpcoesAuditoria,
  Organizacao,
  PaginaAuditoria,
  PainelAdministrador,
  PreviaImportacao,
  SituacaoMensalidade,
  TextosModelo,
  TipoImportacao,
  TipoModelo,
} from '../types'

/** Contrato do módulo Administração (US-ADMIN); só a implementação muda ao integrar o backend. */
export interface AdministracaoService {
  /** US-ADMIN-021 (wireframe 4). */
  painel(): Promise<PainelAdministrador>
  /** US-ADMIN-001: só leitura; usuários e papéis são mantidos no Keycloak. */
  usuarios(): Promise<ListaUsuarios>

  mensalidade(): Promise<SituacaoMensalidade>
  /** 409 `AGENDAMENTO_EXISTENTE`. */
  agendarMensalidade(dados: NovoValorMensalidade): Promise<SituacaoMensalidade>
  /** 409 `SEM_AGENDAMENTO` quando o mês dele já começou. */
  alterarAgendamento(dados: NovoValorMensalidade): Promise<SituacaoMensalidade>
  cancelarAgendamento(): Promise<SituacaoMensalidade>

  modelos(): Promise<ModeloMensagem[]>
  /** 422 com variável desconhecida. */
  salvarModelo(tipo: TipoModelo, textos: TextosModelo): Promise<ModeloMensagem>

  planoDeContas(): Promise<CategoriaComSubcategorias[]>
  criarCategoria(dados: NovaCategoria): Promise<CategoriaPlano>
  renomearCategoria(codigo: string, nome: string): Promise<CategoriaPlano>
  /** 409 `CATEGORIA_SISTEMA`; devolve a categoria e as subcategorias inativadas com ela. */
  inativarCategoria(codigo: string): Promise<CategoriaPlano[]>
  reativarCategoria(codigo: string): Promise<CategoriaPlano>
  /** 409 `CATEGORIA_EM_USO`, `CATEGORIA_SISTEMA` ou `CATEGORIA_COM_SUBCATEGORIAS`. */
  excluirCategoria(codigo: string): Promise<void>

  organizacao(): Promise<Organizacao>
  salvarOrganizacao(dados: DadosOrganizacao): Promise<Organizacao>
  /** Nulo enquanto vale o logotipo da instalação. */
  logo(): Promise<Blob | null>

  auditoria(filtro: FiltroAuditoria, pagina: number): Promise<PaginaAuditoria>
  opcoesAuditoria(): Promise<OpcoesAuditoria>
  /** Histórico de uma entidade, do mais recente ao mais antigo. */
  historico(entidade: string, id: string | number): Promise<EventoAuditoria[]>
  registrarSessao(evento: 'LOGIN' | 'LOGOUT'): Promise<void>

  importacoes(): Promise<Importacao[]>
  modeloImportacao(tipo: TipoImportacao): Promise<ArquivoBaixado>
  previaImportacao(envio: EnvioImportacao): Promise<PreviaImportacao>
  /** 422 com erro em alguma linha; 409 `DUPLICATAS_SEM_DECISAO`. */
  importar(envio: EnvioImportacao, decisoes: Record<number, DecisaoDuplicata>): Promise<Importacao>
  /** 409 `IMPORTACAO_COM_MOVIMENTOS`. */
  desfazerImportacao(id: number): Promise<Importacao>
}
