import { requisitar } from '../../../shared/api/http'
import type { FechamentoService } from './FechamentoService'

export const fechamentoServiceHttp: FechamentoService = {
  painel: () => requisitar('/fechamentos/painel'),
  periodos: () => requisitar('/fechamentos'),
  checklist: (mes) => requisitar(`/fechamentos/${mes}/checklist`),
  confirmarCartao: (mes) => requisitar(`/fechamentos/${mes}/cartao`, { metodo: 'POST' }),
  fechar: (mes, nota) => requisitar(`/fechamentos/${mes}/fechamento`, { metodo: 'POST', corpo: { nota } }),
  reabrir: (mes, justificativa) =>
    requisitar(`/fechamentos/${mes}/reabertura`, { metodo: 'POST', corpo: { justificativa } }),
  historico: (mes) => requisitar(`/fechamentos/${mes}/historico`),
  demonstrativo: (mes, versao) => requisitar(`/fechamentos/${mes}/demonstrativo`, { consulta: { versao } }),
  janela: () => requisitar('/fechamentos/janela'),
  alterarJanela: (diaInicio, diaFim) =>
    requisitar('/fechamentos/janela', { metodo: 'PUT', corpo: { diaInicio, diaFim } }),
  reabertos: () => requisitar('/fechamentos/reabertos'),
}
