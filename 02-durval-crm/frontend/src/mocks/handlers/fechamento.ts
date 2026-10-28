import { http, type HttpHandler } from 'msw'
import { bancoFechamento } from '../bancoFechamento'
import { exigir, tratar, usuarioDe } from './comum'

const TESOURARIA = ['tesoureiro', 'administrador'] as const
const corpo = async <T>(request: Request): Promise<T> => {
  try {
    return (await request.json()) as T
  } catch {
    return {} as T
  }
}

export const handlersFechamento: HttpHandler[] = [
  http.get('*/api/fechamentos/painel', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoFechamento.painel()
    }),
  ),
  http.get('*/api/fechamentos/janela', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoFechamento.janela()
    }),
  ),
  http.put('*/api/fechamentos/janela', async ({ request }) => {
    const d = await corpo<{ diaInicio?: number; diaFim?: number }>(request)
    return tratar(() => bancoFechamento.alterarJanela(exigir(request, ...TESOURARIA), d.diaInicio, d.diaFim))
  }),
  http.get('*/api/fechamentos/reabertos', ({ request }) =>
    tratar(() => {
      usuarioDe(request)
      return bancoFechamento.reabertos()
    }),
  ),
  http.get('*/api/fechamentos', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoFechamento.periodos()
    }),
  ),
  http.get('*/api/fechamentos/:mes/checklist', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoFechamento.checklist(String(params.mes))
    }),
  ),
  http.post('*/api/fechamentos/:mes/cartao', ({ request, params }) =>
    tratar(() => bancoFechamento.confirmarCartao(exigir(request, ...TESOURARIA), String(params.mes))),
  ),
  http.post('*/api/fechamentos/:mes/fechamento', async ({ request, params }) => {
    const d = await corpo<{ nota?: string }>(request)
    return tratar(() => bancoFechamento.fechar(exigir(request, ...TESOURARIA), String(params.mes), d.nota ?? ''))
  }),
  http.post('*/api/fechamentos/:mes/reabertura', async ({ request, params }) => {
    const d = await corpo<{ justificativa?: string }>(request)
    return tratar(() => bancoFechamento.reabrir(exigir(request, 'administrador'), String(params.mes), d.justificativa ?? ''))
  }),
  http.get('*/api/fechamentos/:mes/historico', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoFechamento.historico(String(params.mes))
    }),
  ),
  http.get('*/api/fechamentos/:mes/demonstrativo', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      const versao = new URL(request.url).searchParams.get('versao')
      return bancoFechamento.demonstrativo(String(params.mes), versao ? Number(versao) : undefined)
    }),
  ),
]
