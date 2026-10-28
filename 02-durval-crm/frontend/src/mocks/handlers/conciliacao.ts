import { http, type HttpHandler } from 'msw'
import type {
  ImportacaoExtrato,
  NovoLancamentoConciliacao,
  ParExtrato,
} from '../../features/conciliacao/types'
import { bancoConciliacoes } from '../bancoConciliacoes'
import { exigir, tratar } from './comum'

const TESOURARIA = ['tesoureiro', 'administrador'] as const
const corpo = async <T>(request: Request) => (await request.json()) as T

export const handlersConciliacao: HttpHandler[] = [
  http.get('*/api/conciliacoes/contas', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoConciliacoes.contas()
    }),
  ),
  http.post('*/api/conciliacoes', async ({ request }) => {
    const d = await corpo<{
      contaId: number
      dataFim: string
      saldoExtrato: number
    }>(request)
    return tratar(() =>
      bancoConciliacoes.iniciar(
        exigir(request, ...TESOURARIA),
        d.contaId,
        d.dataFim,
        d.saldoExtrato,
      ),
    )
  }),
  http.get('*/api/conciliacoes', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      const conta = new URL(request.url).searchParams.get('contaId')
      return bancoConciliacoes.historico(conta ? Number(conta) : undefined)
    }),
  ),
  http.get('*/api/conciliacoes/:id', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoConciliacoes.sessao(Number(params.id))
    }),
  ),
  http.put('*/api/conciliacoes/:id/extrato', async ({ request, params }) => {
    const d = await corpo<{ dataFim: string; saldoExtrato: number }>(request)
    return tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoConciliacoes.alterarExtrato(
        Number(params.id),
        d.dataFim,
        d.saldoExtrato,
      )
    })
  }),
  http.post('*/api/conciliacoes/:id/marcacoes', async ({ request, params }) => {
    const d = await corpo<{ lancamentoIds: number[]; marcado: boolean }>(
      request,
    )
    return tratar(() =>
      bancoConciliacoes.marcar(
        exigir(request, ...TESOURARIA),
        Number(params.id),
        d.lancamentoIds ?? [],
        d.marcado !== false,
      ),
    )
  }),
  http.post(
    '*/api/conciliacoes/:id/lancamentos',
    async ({ request, params }) => {
      const d = await corpo<NovoLancamentoConciliacao>(request)
      return tratar(() =>
        bancoConciliacoes.adicionarLancamento(
          exigir(request, ...TESOURARIA),
          Number(params.id),
          d,
        ),
      )
    },
  ),
  http.put(
    '*/api/conciliacoes/:id/extrato/linhas',
    async ({ request, params }) => {
      const d = await corpo<ImportacaoExtrato>(request)
      return tratar(() =>
        bancoConciliacoes.importarExtrato(
          exigir(request, ...TESOURARIA),
          Number(params.id),
          d,
        ),
      )
    },
  ),
  http.post(
    '*/api/conciliacoes/:id/extrato/pares',
    async ({ request, params }) => {
      const d = await corpo<{ pares: ParExtrato[] }>(request)
      return tratar(() =>
        bancoConciliacoes.confirmarPares(
          exigir(request, ...TESOURARIA),
          Number(params.id),
          d.pares ?? [],
        ),
      )
    },
  ),
  http.delete(
    '*/api/conciliacoes/:id/extrato/linhas/:linhaId/par',
    ({ request, params }) =>
      tratar(() => {
        exigir(request, ...TESOURARIA)
        return bancoConciliacoes.desfazerPar(
          Number(params.id),
          Number(params.linhaId),
        )
      }),
  ),
  http.post('*/api/conciliacoes/:id/conclusao', ({ request, params }) =>
    tratar(() =>
      bancoConciliacoes.concluir(
        exigir(request, ...TESOURARIA),
        Number(params.id),
      ),
    ),
  ),
]
