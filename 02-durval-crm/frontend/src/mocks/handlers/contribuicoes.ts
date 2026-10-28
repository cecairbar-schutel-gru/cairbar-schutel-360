import { http, HttpResponse, type HttpHandler } from 'msw'
import type { CanalAgradecimento, LayoutRecibo, NovaContribuicao } from '../../features/contribuicoes/types'
import { bancoContribuicoes } from '../bancoContribuicoes'
import { exigir, tratar } from './comum'

const OPERADOR = ['operador'] as const
/** O Vendedor recebe só doações anônimas e vê só os recibos que emitiu. */
const RECEBIMENTO = ['operador', 'vendedor'] as const
const RECIBO = ['operador', 'vendedor', 'tesoureiro', 'administrador'] as const
const TESOURARIA = ['tesoureiro', 'administrador'] as const
const CONSULTA_DOADOR = ['operador', 'administrador'] as const

export const handlersContribuicoes: HttpHandler[] = [
  http.get('*/api/doadores/:id/competencias/painel', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...CONSULTA_DOADOR)
      const completo = new URL(request.url).searchParams.get('completo') === 'true'
      return bancoContribuicoes.painel(Number(params.id), completo)
    }),
  ),
  http.get('*/api/doadores/:id/contribuicoes', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...CONSULTA_DOADOR)
      const ano = new URL(request.url).searchParams.get('ano')
      return bancoContribuicoes.historico(Number(params.id), ano ? Number(ano) : null)
    }),
  ),
  http.get('*/api/contribuicoes/opcoes-pagamento', ({ request }) =>
    tratar(() => {
      exigir(request, ...RECEBIMENTO)
      return bancoContribuicoes.opcoes()
    }),
  ),
  http.get('*/api/contribuicoes/painel-operador', ({ request }) =>
    tratar(() => bancoContribuicoes.painelOperador(exigir(request, ...OPERADOR))),
  ),
  http.get('*/api/contribuicoes/geracao-competencias', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoContribuicoes.situacaoGeracao()
    }),
  ),
  http.get('*/api/contribuicoes/recibos/:numero', ({ request, params }) =>
    tratar(() => {
      return bancoContribuicoes.localizarPorRecibo(String(params.numero), exigir(request, ...RECIBO))
    }),
  ),
  http.post('*/api/contribuicoes', async ({ request }) => {
    const dados = (await request.json()) as NovaContribuicao
    return tratar(() => bancoContribuicoes.registrar(dados, exigir(request, ...RECEBIMENTO)))
  }),
  http.get('*/api/contribuicoes/:id/recibo', ({ request, params }) =>
    tratar(() => {
      bancoContribuicoes.exigirVisivel(Number(params.id), exigir(request, ...RECIBO))
      const segundaVia = new URL(request.url).searchParams.get('segundaVia') === 'true'
      return bancoContribuicoes.recibo(Number(params.id), segundaVia)
    }),
  ),
  http.get('*/api/contribuicoes/:id/recibo.pdf', ({ request, params }) => {
    const negado = tratar(() => {
      bancoContribuicoes.exigirVisivel(Number(params.id), exigir(request, ...RECIBO))
    })
    if (negado.status !== 204) return negado
    const busca = new URL(request.url).searchParams
    const { conteudo, nome } = bancoContribuicoes.pdf(
      Number(params.id),
      (busca.get('layout') ?? 'A4') as LayoutRecibo,
      busca.get('segundaVia') === 'true',
    )
    return new HttpResponse(conteudo.slice().buffer, {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${nome}"` },
    })
  }),
  http.post('*/api/contribuicoes/:id/mensagens', async ({ request, params }) => {
    const { canal } = (await request.json()) as { canal: CanalAgradecimento }
    return tratar(() => {
      exigir(request, ...OPERADOR)
      bancoContribuicoes.registrarMensagem(Number(params.id), canal)
    })
  }),
  http.post('*/api/contribuicoes/:id/cancelamento', async ({ request, params }) => {
    const { motivo } = (await request.json()) as { motivo: string }
    return tratar(() => {
      const usuario = exigir(request, ...TESOURARIA)
      return bancoContribuicoes.cancelar(Number(params.id), motivo ?? '', usuario)
    })
  }),
]
