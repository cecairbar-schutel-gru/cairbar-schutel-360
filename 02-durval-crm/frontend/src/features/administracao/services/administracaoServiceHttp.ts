import { baixarArquivo, requisitar } from '../../../shared/api/http'
import type { FiltroAuditoria } from '../types'
import type { AdministracaoService } from './AdministracaoService'

const filtros = (f: FiltroAuditoria) => ({ ...f })

export const administracaoServiceHttp: AdministracaoService = {
  painel: () => requisitar('/administracao/painel'),
  usuarios: () => requisitar('/administracao/usuarios'),
  mensalidade: () => requisitar('/administracao/mensalidade'),
  agendarMensalidade: (dados) => requisitar('/administracao/mensalidade/agendamento', { metodo: 'POST', corpo: dados }),
  alterarAgendamento: (dados) => requisitar('/administracao/mensalidade/agendamento', { metodo: 'PUT', corpo: dados }),
  cancelarAgendamento: () => requisitar('/administracao/mensalidade/agendamento', { metodo: 'DELETE' }),
  modelos: () => requisitar('/administracao/modelos-mensagem'),
  salvarModelo: (tipo, textos) => requisitar(`/administracao/modelos-mensagem/${tipo}`, { metodo: 'PUT', corpo: textos }),
  planoDeContas: () => requisitar('/administracao/plano-contas'),
  criarCategoria: (dados) => requisitar('/administracao/plano-contas', { metodo: 'POST', corpo: dados }),
  renomearCategoria: (codigo, nome) =>
    requisitar(`/administracao/plano-contas/${encodeURIComponent(codigo)}`, { metodo: 'PUT', corpo: { nome } }),
  inativarCategoria: (codigo) =>
    requisitar(`/administracao/plano-contas/${encodeURIComponent(codigo)}/inativacao`, { metodo: 'POST' }),
  reativarCategoria: (codigo) =>
    requisitar(`/administracao/plano-contas/${encodeURIComponent(codigo)}/reativacao`, { metodo: 'POST' }),
  excluirCategoria: (codigo) => requisitar(`/administracao/plano-contas/${encodeURIComponent(codigo)}`, { metodo: 'DELETE' }),
  organizacao: () => requisitar('/administracao/organizacao'),
  salvarOrganizacao: (dados) => requisitar('/administracao/organizacao', { metodo: 'PUT', corpo: dados }),
  logo: async () => {
    const { conteudo } = await baixarArquivo('/administracao/organizacao/logo', undefined, 'image/png, image/jpeg')
    return conteudo.size > 0 ? conteudo : null
  },
  auditoria: (filtro, pagina) => requisitar('/auditoria', { consulta: { ...filtros(filtro), pagina } }),
  opcoesAuditoria: () => requisitar('/auditoria/opcoes'),
  historico: (entidade, id) =>
    requisitar(`/auditoria/entidades/${encodeURIComponent(entidade)}/${encodeURIComponent(String(id))}`),
  registrarSessao: (evento) => requisitar('/auditoria/sessao', { metodo: 'POST', corpo: { evento } }),
  importacoes: () => requisitar('/administracao/importacoes'),
  modeloImportacao: (tipo) => baixarArquivo(`/administracao/importacoes/modelos/${tipo}`, undefined, 'text/csv'),
  previaImportacao: (envio) => requisitar('/administracao/importacoes/previa', { metodo: 'POST', corpo: envio }),
  importar: (envio, decisoes) => requisitar('/administracao/importacoes', { metodo: 'POST', corpo: { ...envio, decisoes } }),
  desfazerImportacao: (id) => requisitar(`/administracao/importacoes/${id}/desfazer`, { metodo: 'POST' }),
}
