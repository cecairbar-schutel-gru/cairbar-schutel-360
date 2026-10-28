import { baixarArquivo, requisitar } from '../../../shared/api/http'
import type { IntencaoService } from './IntencaoService'

const BASE = '/intencoes-gasto'

export const intencaoServiceHttp: IntencaoService = {
  opcoes: () => requisitar(`${BASE}/opcoes`),
  criar: (dados) => requisitar(BASE, { metodo: 'POST', corpo: dados }),
  minhas: (status) => requisitar(`${BASE}/minhas`, { consulta: { status } }),
  registrarVisita: () => requisitar(`${BASE}/minhas/visita`, { metodo: 'POST' }),
  fila: (filtro) => requisitar(BASE, { consulta: { status: filtro } }),
  contadores: () => requisitar(`${BASE}/contadores`),
  recebimentos: () => requisitar(`${BASE}/recebimentos`),
  intencao: (id) => requisitar(`${BASE}/${id}`),
  baixarAnexo: (id, ordem) => baixarArquivo(`${BASE}/${id}/anexos/${ordem}`, undefined, '*/*'),
  retirar: (id, motivo) => requisitar(`${BASE}/${id}/retirada`, { metodo: 'POST', corpo: { motivo } }),
  aprovar: (id, dados) => requisitar(`${BASE}/${id}/aprovacao`, { metodo: 'POST', corpo: dados }),
  rejeitar: (id, motivo) => requisitar(`${BASE}/${id}/rejeicao`, { metodo: 'POST', corpo: { motivo } }),
  receber: (id, itens, divergencia) =>
    requisitar(`${BASE}/${id}/recebimento`, { metodo: 'POST', corpo: { itens, divergencia } }),
  corrigir: (id, itens, valor, motivo) =>
    requisitar(`${BASE}/${id}/correcao`, { metodo: 'POST', corpo: { itens, valor, motivo } }),
  cancelar: (id, motivo) => requisitar(`${BASE}/${id}/cancelamento`, { metodo: 'POST', corpo: { motivo } }),
}
