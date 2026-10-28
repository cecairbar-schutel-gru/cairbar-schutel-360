import { http, type HttpHandler } from 'msw'
import type { DadosContaPagar, NovoPagamentoConta, SituacaoContas } from '../../features/contaspagar/types'
import { bancoContasPagar } from '../bancoContasPagar'
import { exigir, tratar } from './comum'

const TESOURARIA = ['tesoureiro', 'administrador'] as const

const corpo = async <T>(request: Request) => (await request.json()) as T
const busca = (request: Request) => new URL(request.url).searchParams

/** Mesmo contrato de `ContaPagarController` no backend. */
export const handlersContasPagar: HttpHandler[] = [
  http.get('*/api/contas-pagar/parcelas', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      const b = busca(request)
      return bancoContasPagar.parcelas(b.get('de') ?? '', b.get('ate') ?? '', b.get('incluirVencidas') === 'true')
    }),
  ),
  http.get('*/api/contas-pagar/resumo', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoContasPagar.resumo()
    }),
  ),
  http.post('*/api/contas-pagar/pagamentos', async ({ request }) => {
    const dados = await corpo<NovoPagamentoConta>(request)
    return tratar(() => bancoContasPagar.pagar(dados, exigir(request, ...TESOURARIA)))
  }),
  http.get('*/api/contas-pagar', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoContasPagar.listar((busca(request).get('situacao') as SituacaoContas | null) ?? 'ATIVAS')
    }),
  ),
  http.post('*/api/contas-pagar', async ({ request }) => {
    const dados = await corpo<DadosContaPagar>(request)
    return tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoContasPagar.cadastrar(dados)
    })
  }),
  http.get('*/api/contas-pagar/:id', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoContasPagar.conta(Number(params.id))
    }),
  ),
  http.put('*/api/contas-pagar/:id', async ({ request, params }) => {
    const dados = await corpo<DadosContaPagar>(request)
    return tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoContasPagar.alterar(Number(params.id), dados)
    })
  }),
  http.post('*/api/contas-pagar/:id/encerramento', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoContasPagar.encerrar(Number(params.id))
    }),
  ),
  http.post('*/api/contas-pagar/:id/reativacao', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoContasPagar.reativar(Number(params.id))
    }),
  ),
  http.delete('*/api/contas-pagar/:id', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      bancoContasPagar.excluir(Number(params.id))
    }),
  ),
]
