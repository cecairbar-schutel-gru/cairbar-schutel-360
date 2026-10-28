import { baixarArquivo, requisitar } from '../../../shared/api/http'
import type { FinanceiroService } from './FinanceiroService'

export const financeiroServiceHttp: FinanceiroService = {
  contas: () => requisitar('/financeiro/contas'),
  conta: (id) => requisitar(`/financeiro/contas/${id}`),
  cadastrarConta: (dados) => requisitar('/financeiro/contas', { metodo: 'POST', corpo: dados }),
  alterarConta: (id, dados) => requisitar(`/financeiro/contas/${id}`, { metodo: 'PUT', corpo: dados }),
  inativarConta: (id) => requisitar(`/financeiro/contas/${id}/inativacao`, { metodo: 'POST' }),
  reativarConta: (id) => requisitar(`/financeiro/contas/${id}/reativacao`, { metodo: 'POST' }),
  excluirConta: (id) => requisitar(`/financeiro/contas/${id}`, { metodo: 'DELETE' }),
  saldos: (data) => requisitar('/financeiro/saldos', { consulta: { data } }),
  categorias: () => requisitar('/financeiro/categorias'),
  transferir: (dados) => requisitar('/financeiro/transferencias', { metodo: 'POST', corpo: dados }),
  cartaoAReceber: () => requisitar('/financeiro/cartao-a-receber'),
  liquidarCartao: (dados) => requisitar('/financeiro/liquidacoes-cartao', { metodo: 'POST', corpo: dados }),
  lancarManual: (dados) => requisitar('/financeiro/lancamentos', { metodo: 'POST', corpo: dados }),
  lancamentos: (filtro, pagina) => requisitar('/financeiro/lancamentos', { consulta: { ...filtro, pagina } }),
  lancamento: (id) => requisitar(`/financeiro/lancamentos/${id}`),
  baixarAnexo: (id) => baixarArquivo(`/financeiro/lancamentos/${id}/anexo`, undefined, '*/*'),
  estornar: (id, motivo, correcao) =>
    requisitar(`/financeiro/lancamentos/${id}/estorno`, { metodo: 'POST', corpo: { motivo, correcao } }),
  reclassificar: (id, ordem, categoria, motivo) =>
    requisitar(`/financeiro/lancamentos/${id}/reclassificacao`, {
      metodo: 'POST',
      corpo: { ordem, categoria, motivo },
    }),
  contasRecebimento: () => requisitar('/financeiro/contas-recebimento'),
  definirContasRecebimento: (dinheiroContaId, pixContaId) =>
    requisitar('/financeiro/contas-recebimento', { metodo: 'PUT', corpo: { dinheiroContaId, pixContaId } }),
  painelTesoureiro: () => requisitar('/financeiro/painel-tesoureiro'),
}
