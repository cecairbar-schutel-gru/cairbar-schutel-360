import { http, HttpResponse, type HttpHandler } from 'msw'
import type { FiltroVendas, LayoutComprovante, NovaVenda, StatusVenda, TipoProduto } from '../../features/vendas/types'
import { bancoVendas } from '../bancoVendas'
import { exigir, tratar } from './comum'

const VENDEDOR = ['vendedor'] as const
/** Endpoints do PDV da cantina, abertos também ao perfil PDV. */
const PDV = ['vendedor', 'pdv'] as const
const CONSULTA = ['vendedor', 'tesoureiro', 'administrador'] as const
/** Quem cancela cada venda (o PDV, só a própria última; o Tesoureiro, as do PDV) é regra do banco. */
const CANCELAMENTO = ['vendedor', 'pdv', 'tesoureiro', 'administrador'] as const

export const handlersVendas: HttpHandler[] = [
  http.get('*/api/vendas/opcoes', ({ request }) => tratar(() => {
    exigir(request, ...PDV)
    return bancoVendas.opcoes()
  })),
  http.get('*/api/vendas/produtos', ({ request }) =>
    tratar(() => {
      exigir(request, ...PDV)
      const busca = new URL(request.url).searchParams
      return bancoVendas.buscar(busca.get('q') ?? '', (busca.get('tipo') as TipoProduto | null) ?? null)
    }),
  ),
  http.get('*/api/vendas/painel-vendedor', ({ request }) =>
    tratar(() => bancoVendas.painel(exigir(request, ...VENDEDOR))),
  ),
  http.post('*/api/vendas', async ({ request }) => {
    const dados = (await request.json()) as NovaVenda
    return tratar(() => bancoVendas.confirmar(dados, exigir(request, ...PDV)))
  }),
  http.get('*/api/vendas', ({ request }) =>
    tratar(() => {
      const usuario = exigir(request, ...CONSULTA)
      const busca = new URL(request.url).searchParams
      const numero = (chave: string) => (busca.get(chave) ? Number(busca.get(chave)) : undefined)
      const filtro: FiltroVendas = {
        de: busca.get('de') ?? undefined,
        ate: busca.get('ate') ?? undefined,
        status: (busca.get('status') as StatusVenda | null) ?? undefined,
        pdv: busca.get('pdv') === null ? undefined : busca.get('pdv') === 'true',
        numero: numero('numero'),
      }
      return bancoVendas.listar(filtro, usuario)
    }),
  ),
  http.get('*/api/vendas/ultima', ({ request }) =>
    tratar(() => bancoVendas.ultima(exigir(request, ...PDV))),
  ),
  http.get('*/api/vendas/:id/refazer', ({ request, params }) =>
    tratar(() => bancoVendas.paraRefazer(Number(params.id), exigir(request, ...VENDEDOR))),
  ),
  http.get('*/api/vendas/:id/comprovante.pdf', ({ request, params }) => {
    let usuario = null
    const negado = tratar(() => {
      usuario = exigir(request, ...CONSULTA)
      bancoVendas.detalhe(Number(params.id), usuario)
    })
    if (negado.status !== 204 || !usuario) return negado
    const layout = (new URL(request.url).searchParams.get('layout') ?? 'A4') as LayoutComprovante
    const { conteudo, nome } = bancoVendas.pdf(Number(params.id), layout, usuario)
    return new HttpResponse(conteudo.slice().buffer, {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${nome}"` },
    })
  }),
  http.get('*/api/vendas/:id', ({ request, params }) =>
    tratar(() => bancoVendas.detalhe(Number(params.id), exigir(request, ...CONSULTA))),
  ),
  http.post('*/api/vendas/:id/cancelamento', async ({ request, params }) => {
    const { motivo } = (await request.json()) as { motivo: string }
    return tratar(() => bancoVendas.cancelar(Number(params.id), motivo ?? '', exigir(request, ...CANCELAMENTO)))
  }),
]
