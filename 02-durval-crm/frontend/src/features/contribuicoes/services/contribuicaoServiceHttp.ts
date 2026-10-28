import { baixarArquivo, requisitar } from '../../../shared/api/http'
import type { ContribuicaoService } from './ContribuicaoService'

export const contribuicaoServiceHttp: ContribuicaoService = {
  opcoesPagamento: () => requisitar('/contribuicoes/opcoes-pagamento'),
  registrar: (dados) =>
    requisitar('/contribuicoes', { metodo: 'POST', corpo: dados }),
  obterRecibo: (id, segundaVia) =>
    requisitar(`/contribuicoes/${id}/recibo`, {
      consulta: { segundaVia: segundaVia ? 'true' : undefined },
    }),
  baixarReciboPdf: (id, layout, segundaVia) =>
    baixarArquivo(`/contribuicoes/${id}/recibo.pdf`, {
      layout,
      segundaVia: segundaVia ? 'true' : undefined,
    }),
  localizarPorRecibo: (numero) =>
    requisitar(`/contribuicoes/recibos/${encodeURIComponent(numero)}`),
  registrarMensagemPreparada: (id, canal) =>
    requisitar(`/contribuicoes/${id}/mensagens`, {
      metodo: 'POST',
      corpo: { canal },
    }),
  cancelar: (id, motivo) =>
    requisitar(`/contribuicoes/${id}/cancelamento`, {
      metodo: 'POST',
      corpo: { motivo },
    }),
  historico: (doadorId, ano) =>
    requisitar(`/doadores/${doadorId}/contribuicoes`, { consulta: { ano } }),
  painelOperador: () => requisitar('/contribuicoes/painel-operador'),
  situacaoGeracao: () => requisitar('/contribuicoes/geracao-competencias'),
}
