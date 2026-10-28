import { baixarArquivo, requisitar } from '../../../shared/api/http'
import type { DetalheVenda } from '../types'
import type { VendaService } from './VendaService'

export const vendaServiceHttp: VendaService = {
  opcoes: () => requisitar('/vendas/opcoes'),
  buscarProdutos: (q, tipo) => requisitar('/vendas/produtos', { consulta: { q, tipo } }),
  confirmar: (dados) => requisitar('/vendas', { metodo: 'POST', corpo: dados }),
  listar: ({ pdv, ...filtro }) =>
    requisitar('/vendas', { consulta: { ...filtro, pdv: pdv === undefined ? undefined : String(pdv) } }),
  detalhe: (id) => requisitar(`/vendas/${id}`),
  ultima: async () => (await requisitar<DetalheVenda | undefined>('/vendas/ultima')) ?? null,
  baixarComprovantePdf: (id, layout) => baixarArquivo(`/vendas/${id}/comprovante.pdf`, { layout }),
  cancelar: (id, motivo) =>
    requisitar(`/vendas/${id}/cancelamento`, { metodo: 'POST', corpo: { motivo } }),
  paraRefazer: (id) => requisitar(`/vendas/${id}/refazer`),
  painelVendedor: () => requisitar('/vendas/painel-vendedor'),
}
