import { requisitar } from '../../../shared/api/http'
import type { ContasPagarService } from './ContasPagarService'

const BASE = '/contas-pagar'

export const contasPagarServiceHttp: ContasPagarService = {
  listar: (situacao) => requisitar(BASE, { consulta: { situacao } }),
  conta: (id) => requisitar(`${BASE}/${id}`),
  cadastrar: (dados) => requisitar(BASE, { metodo: 'POST', corpo: dados }),
  alterar: (id, dados) => requisitar(`${BASE}/${id}`, { metodo: 'PUT', corpo: dados }),
  encerrar: (id) => requisitar(`${BASE}/${id}/encerramento`, { metodo: 'POST' }),
  reativar: (id) => requisitar(`${BASE}/${id}/reativacao`, { metodo: 'POST' }),
  excluir: (id) => requisitar(`${BASE}/${id}`, { metodo: 'DELETE' }),
  parcelas: (de, ate, incluirVencidas) =>
    requisitar(`${BASE}/parcelas`, { consulta: { de, ate, incluirVencidas: String(incluirVencidas) } }),
  resumo: () => requisitar(`${BASE}/resumo`),
  pagar: (dados) => requisitar(`${BASE}/pagamentos`, { metodo: 'POST', corpo: dados }),
}
