import { http, type HttpHandler } from 'msw'
import type {
  DadosEditora,
  NovaDevolucao,
  NovaRemessa,
  NovoPagamento,
  NovoPedido,
  SituacaoEditoras,
  SituacaoPedido,
  SituacaoRemessa,
} from '../../features/editoras/types'
import { bancoEditoras } from '../bancoEditoras'
import { exigir, tratar } from './comum'

const TESOURARIA = ['tesoureiro', 'administrador'] as const
/** Cadastro, remessas e devoluções são do Vendedor; a Tesouraria consulta. */
const CONSULTA = ['vendedor', 'tesoureiro', 'administrador'] as const
const CADASTRO = ['vendedor', 'administrador'] as const

const corpo = async <T>(request: Request) => (await request.json()) as T
const busca = (request: Request) => new URL(request.url).searchParams

/** Mesmo contrato de `EditoraController` no backend. */
export const handlersEditoras: HttpHandler[] = [
  http.get('*/api/editoras/saldos', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoEditoras.saldos()
    }),
  ),
  http.get('*/api/editoras/fechamento', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoEditoras.fechamento(busca(request).get('mes') ?? '')
    }),
  ),
  http.post('*/api/editoras/transferencias-saldo', async ({ request }) => {
    const dados = await corpo<{ editoraId: number; mes: string; nota: string }>(request)
    return tratar(() => bancoEditoras.transferir(dados, exigir(request, 'tesoureiro')))
  }),
  http.get('*/api/editoras/remessas', ({ request }) =>
    tratar(() => {
      exigir(request, ...CONSULTA)
      const editoraId = busca(request).get('editoraId')
      const situacao = busca(request).get('situacao') as SituacaoRemessa | null
      return bancoEditoras.remessas({ editoraId: editoraId ? Number(editoraId) : undefined, situacao: situacao ?? undefined })
    }),
  ),
  http.post('*/api/editoras/remessas', async ({ request }) => {
    const dados = await corpo<NovaRemessa>(request)
    return tratar(() => bancoEditoras.registrarRemessa(dados, exigir(request, ...CADASTRO)))
  }),
  http.get('*/api/editoras/remessas/:id', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...CONSULTA)
      return bancoEditoras.remessa(Number(params.id))
    }),
  ),
  http.post('*/api/editoras/remessas/:id/cancelamento', async ({ request, params }) => {
    const { motivo } = await corpo<{ motivo: string }>(request)
    return tratar(() => bancoEditoras.cancelarRemessa(Number(params.id), motivo, exigir(request, ...CADASTRO)))
  }),
  http.get('*/api/editoras/pedidos', ({ request }) =>
    tratar(() => {
      exigir(request, ...CONSULTA)
      const editoraId = busca(request).get('editoraId')
      const situacao = busca(request).get('situacao') as SituacaoPedido | null
      return bancoEditoras.pedidos({ editoraId: editoraId ? Number(editoraId) : undefined, situacao: situacao ?? undefined })
    }),
  ),
  http.post('*/api/editoras/pedidos', async ({ request }) => {
    const dados = await corpo<NovoPedido>(request)
    return tratar(() => bancoEditoras.pedir(dados, exigir(request, ...TESOURARIA)))
  }),
  http.get('*/api/editoras/pedidos/:id', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...CONSULTA)
      return bancoEditoras.pedido(Number(params.id))
    }),
  ),
  http.post('*/api/editoras/pedidos/:id/cancelamento', async ({ request, params }) => {
    const { motivo } = await corpo<{ motivo: string }>(request)
    return tratar(() => bancoEditoras.cancelarPedido(Number(params.id), motivo, exigir(request, ...TESOURARIA)))
  }),
  http.post('*/api/editoras/remessas/:id/devolucoes', async ({ request, params }) => {
    const dados = await corpo<NovaDevolucao>(request)
    return tratar(() => bancoEditoras.devolver(Number(params.id), dados, exigir(request, ...CADASTRO)))
  }),
  http.get('*/api/editoras/devolucoes/:id', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...CONSULTA)
      return bancoEditoras.devolucao(Number(params.id))
    }),
  ),
  http.get('*/api/editoras/pagamentos/previa', ({ request }) =>
    tratar(() => {
      exigir(request, 'tesoureiro')
      return bancoEditoras.previa(Number(busca(request).get('editoraId')), Number(busca(request).get('valor')))
    }),
  ),
  http.post('*/api/editoras/pagamentos', async ({ request }) => {
    const dados = await corpo<NovoPagamento>(request)
    return tratar(() => bancoEditoras.pagar(dados, exigir(request, 'tesoureiro')))
  }),
  http.get('*/api/editoras/pagamentos/:id', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoEditoras.recibo(Number(params.id))
    }),
  ),
  http.get('*/api/editoras', ({ request }) =>
    tratar(() => {
      exigir(request, ...CONSULTA)
      return bancoEditoras.listar((busca(request).get('situacao') as SituacaoEditoras | null) ?? 'ATIVAS')
    }),
  ),
  http.post('*/api/editoras', async ({ request }) => {
    const dados = await corpo<DadosEditora>(request)
    return tratar(() => {
      exigir(request, ...CADASTRO)
      return bancoEditoras.cadastrar(dados)
    })
  }),
  http.get('*/api/editoras/:id/titulos', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...CONSULTA)
      return bancoEditoras.titulos(Number(params.id))
    }),
  ),
  http.get('*/api/editoras/:id/saldo', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoEditoras.saldo(Number(params.id))
    }),
  ),
  http.get('*/api/editoras/:id/apuracao', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoEditoras.apuracao(Number(params.id), busca(request).get('mes') ?? '')
    }),
  ),
  http.post('*/api/editoras/:id/inativacao', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...CADASTRO)
      return bancoEditoras.inativar(Number(params.id))
    }),
  ),
  http.post('*/api/editoras/:id/reativacao', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...CADASTRO)
      return bancoEditoras.reativar(Number(params.id))
    }),
  ),
  http.get('*/api/editoras/:id', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...CONSULTA)
      return bancoEditoras.detalhe(Number(params.id))
    }),
  ),
  http.put('*/api/editoras/:id', async ({ request, params }) => {
    const dados = await corpo<DadosEditora>(request)
    return tratar(() => {
      exigir(request, ...CADASTRO)
      return bancoEditoras.alterar(Number(params.id), dados)
    })
  }),
  http.delete('*/api/editoras/:id', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...CADASTRO)
      bancoEditoras.excluir(Number(params.id))
    }),
  ),
]
