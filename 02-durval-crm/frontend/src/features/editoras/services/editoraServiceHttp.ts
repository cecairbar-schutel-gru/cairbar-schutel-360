import { requisitar } from '../../../shared/api/http'
import type { EditoraService } from './EditoraService'

const BASE = '/editoras'

export const editoraServiceHttp: EditoraService = {
  listar: (situacao) => requisitar(BASE, { consulta: { situacao } }),
  editora: (id) => requisitar(`${BASE}/${id}`),
  cadastrar: (dados) => requisitar(BASE, { metodo: 'POST', corpo: dados }),
  alterar: (id, dados) => requisitar(`${BASE}/${id}`, { metodo: 'PUT', corpo: dados }),
  inativar: (id) => requisitar(`${BASE}/${id}/inativacao`, { metodo: 'POST' }),
  reativar: (id) => requisitar(`${BASE}/${id}/reativacao`, { metodo: 'POST' }),
  excluir: (id) => requisitar(`${BASE}/${id}`, { metodo: 'DELETE' }),
  titulos: (editoraId) => requisitar(`${BASE}/${editoraId}/titulos`),
  remessas: (filtro) => requisitar(`${BASE}/remessas`, { consulta: { ...filtro } }),
  registrarRemessa: (dados) => requisitar(`${BASE}/remessas`, { metodo: 'POST', corpo: dados }),
  remessa: (id) => requisitar(`${BASE}/remessas/${id}`),
  cancelarRemessa: (id, motivo) => requisitar(`${BASE}/remessas/${id}/cancelamento`, { metodo: 'POST', corpo: { motivo } }),
  pedidos: (filtro) => requisitar(`${BASE}/pedidos`, { consulta: { ...filtro } }),
  pedido: (id) => requisitar(`${BASE}/pedidos/${id}`),
  pedir: (dados) => requisitar(`${BASE}/pedidos`, { metodo: 'POST', corpo: dados }),
  cancelarPedido: (id, motivo) => requisitar(`${BASE}/pedidos/${id}/cancelamento`, { metodo: 'POST', corpo: { motivo } }),
  devolver: (remessaId, dados) => requisitar(`${BASE}/remessas/${remessaId}/devolucoes`, { metodo: 'POST', corpo: dados }),
  devolucao: (id) => requisitar(`${BASE}/devolucoes/${id}`),
  saldos: () => requisitar(`${BASE}/saldos`),
  saldo: (editoraId) => requisitar(`${BASE}/${editoraId}/saldo`),
  apuracao: (editoraId, mes) => requisitar(`${BASE}/${editoraId}/apuracao`, { consulta: { mes } }),
  previa: (editoraId, valor) => requisitar(`${BASE}/pagamentos/previa`, { consulta: { editoraId, valor } }),
  pagar: (dados) => requisitar(`${BASE}/pagamentos`, { metodo: 'POST', corpo: dados }),
  recibo: (id) => requisitar(`${BASE}/pagamentos/${id}`),
  fechamento: (mes) => requisitar(`${BASE}/fechamento`, { consulta: { mes } }),
  transferirSaldo: (editoraId, mes, nota) =>
    requisitar(`${BASE}/transferencias-saldo`, { metodo: 'POST', corpo: { editoraId, mes, nota } }),
}
