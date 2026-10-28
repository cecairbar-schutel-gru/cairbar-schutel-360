import { requisitar } from '../../../shared/api/http'
import type { ConciliacaoService } from './ConciliacaoService'

export const conciliacaoServiceHttp: ConciliacaoService = {
  contas: () => requisitar('/conciliacoes/contas'),
  iniciar: (contaId, dataFim, saldoExtrato) =>
    requisitar('/conciliacoes', {
      metodo: 'POST',
      corpo: { contaId, dataFim, saldoExtrato },
    }),
  sessao: (id) => requisitar(`/conciliacoes/${id}`),
  alterarExtrato: (id, dataFim, saldoExtrato) =>
    requisitar(`/conciliacoes/${id}/extrato`, {
      metodo: 'PUT',
      corpo: { dataFim, saldoExtrato },
    }),
  marcar: (id, lancamentoIds, marcado) =>
    requisitar(`/conciliacoes/${id}/marcacoes`, {
      metodo: 'POST',
      corpo: { lancamentoIds, marcado },
    }),
  adicionarLancamento: (id, dados) =>
    requisitar(`/conciliacoes/${id}/lancamentos`, {
      metodo: 'POST',
      corpo: dados,
    }),
  importarExtrato: (id, dados) =>
    requisitar(`/conciliacoes/${id}/extrato/linhas`, {
      metodo: 'PUT',
      corpo: dados,
    }),
  confirmarPares: (id, pares) =>
    requisitar(`/conciliacoes/${id}/extrato/pares`, {
      metodo: 'POST',
      corpo: { pares },
    }),
  desfazerPar: (id, linhaId) =>
    requisitar(`/conciliacoes/${id}/extrato/linhas/${linhaId}/par`, {
      metodo: 'DELETE',
    }),
  concluir: (id) =>
    requisitar(`/conciliacoes/${id}/conclusao`, { metodo: 'POST' }),
  historico: (contaId) =>
    requisitar('/conciliacoes', { consulta: { contaId } }),
}
