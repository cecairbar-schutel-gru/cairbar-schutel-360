import { http, HttpResponse, type HttpHandler } from 'msw'
import type { DadosAprovacao, FiltroFila, ItemQuantidade, NovaIntencao, StatusIntencao } from '../../features/intencoes/types'
import { bancoIntencoes } from '../bancoIntencoes'
import { ErroNegocio } from '../erroNegocio'
import { exigir, tratar } from './comum'

const TODOS = ['vendedor', 'tesoureiro', 'administrador'] as const
const FORMULARIOS = ['vendedor', 'tesoureiro', 'administrador'] as const
const TESOURARIA = ['tesoureiro', 'administrador'] as const

const corpo = async <T>(request: Request) => (await request.json()) as T
const busca = (request: Request) => new URL(request.url).searchParams

/** Mesmo contrato de `IntencaoGastoController` no backend. */
export const handlersIntencoes: HttpHandler[] = [
  http.get('*/api/intencoes-gasto/opcoes', ({ request }) => tratar(() => bancoIntencoes.opcoes(exigir(request, ...FORMULARIOS)))),
  http.post('*/api/intencoes-gasto', async ({ request }) => {
    const dados = await corpo<NovaIntencao>(request)
    return tratar(() => bancoIntencoes.criar(dados, exigir(request, 'vendedor')))
  }),
  http.get('*/api/intencoes-gasto/minhas', ({ request }) =>
    tratar(() => bancoIntencoes.minhas(exigir(request, 'vendedor'), (busca(request).get('status') as StatusIntencao | null) ?? undefined)),
  ),
  http.post('*/api/intencoes-gasto/minhas/visita', ({ request }) =>
    tratar(() => {
      bancoIntencoes.registrarVisita(exigir(request, 'vendedor'))
    }),
  ),
  http.get('*/api/intencoes-gasto/contadores', ({ request }) =>
    tratar(() => {
      exigir(request, 'vendedor', ...TESOURARIA)
      return bancoIntencoes.contadores()
    }),
  ),
  http.get('*/api/intencoes-gasto/recebimentos', ({ request }) =>
    tratar(() => {
      exigir(request, 'vendedor')
      return bancoIntencoes.recebimentos()
    }),
  ),
  http.get('*/api/intencoes-gasto', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoIntencoes.fila((busca(request).get('status') as FiltroFila | null) ?? 'PENDENTE')
    }),
  ),
  http.get('*/api/intencoes-gasto/:id/anexos/:ordem', ({ request, params }) => {
    try {
      const a = bancoIntencoes.anexo(Number(params.id), Number(params.ordem), exigir(request, ...TODOS))
      const bytes = Uint8Array.from(atob(a.conteudoBase64), (c) => c.charCodeAt(0))
      return new HttpResponse(bytes, { headers: { 'Content-Type': a.tipo, 'Content-Disposition': `inline; filename="${a.nome}"` } })
    } catch (erro) {
      if (erro instanceof ErroNegocio) {
        return HttpResponse.json({ codigo: erro.codigo, mensagem: erro.message, erros: erro.erros }, { status: erro.status })
      }
      throw erro
    }
  }),
  http.get('*/api/intencoes-gasto/:id', ({ request, params }) =>
    tratar(() => bancoIntencoes.detalhe(Number(params.id), exigir(request, ...TODOS))),
  ),
  http.post('*/api/intencoes-gasto/:id/retirada', async ({ request, params }) => {
    const { motivo } = await corpo<{ motivo: string }>(request)
    return tratar(() => bancoIntencoes.retirar(Number(params.id), motivo, exigir(request, 'vendedor')))
  }),
  http.post('*/api/intencoes-gasto/:id/aprovacao', async ({ request, params }) => {
    const dados = await corpo<DadosAprovacao>(request)
    return tratar(() => bancoIntencoes.aprovar(Number(params.id), dados, exigir(request, ...TESOURARIA)))
  }),
  http.post('*/api/intencoes-gasto/:id/rejeicao', async ({ request, params }) => {
    const { motivo } = await corpo<{ motivo: string }>(request)
    return tratar(() => bancoIntencoes.rejeitar(Number(params.id), motivo, exigir(request, ...TESOURARIA)))
  }),
  http.post('*/api/intencoes-gasto/:id/recebimento', async ({ request, params }) => {
    const { itens, divergencia } = await corpo<{ itens: ItemQuantidade[]; divergencia: string }>(request)
    return tratar(() => bancoIntencoes.receber(Number(params.id), itens ?? [], divergencia, exigir(request, 'vendedor')))
  }),
  http.post('*/api/intencoes-gasto/:id/correcao', async ({ request, params }) => {
    const { itens, valor, motivo } = await corpo<{ itens: ItemQuantidade[]; valor: number | null; motivo: string }>(request)
    return tratar(() => bancoIntencoes.corrigir(Number(params.id), itens ?? [], valor, motivo, exigir(request, ...TESOURARIA)))
  }),
  http.post('*/api/intencoes-gasto/:id/cancelamento', async ({ request, params }) => {
    const { motivo } = await corpo<{ motivo: string }>(request)
    return tratar(() => bancoIntencoes.cancelarDivergente(Number(params.id), motivo, exigir(request, ...TESOURARIA)))
  }),
]
