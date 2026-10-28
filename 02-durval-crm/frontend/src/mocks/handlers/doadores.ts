import { http, type HttpHandler } from 'msw'
import type {
  AnonimizacaoDoador,
  AtualizacaoDoador,
  CadastroRapido,
  DadosDuplicidade,
  InativacaoDoador,
  ReativacaoDoador,
} from '../../features/doadores/types'
import { bancoDoadores } from '../bancoDoadores'
import { exigir, tratar } from './comum'

const OPERACAO = ['operador', 'administrador'] as const
const ADMIN = ['administrador'] as const

export const handlersDoadores: HttpHandler[] = [
  http.get('*/api/doadores/busca', ({ request }) =>
    tratar(() => {
      exigir(request, ...OPERACAO)
      return bancoDoadores.buscar(new URL(request.url).searchParams.get('q') ?? '')
    }),
  ),
  http.get('*/api/doadores/aniversariantes', ({ request }) =>
    tratar(() => {
      exigir(request, ...OPERACAO)
      const params = new URL(request.url).searchParams
      return bancoDoadores.listarAniversariantes(params.get('de') ?? '', params.get('ate') ?? '')
    }),
  ),
  http.post('*/api/doadores/duplicatas', async ({ request }) => {
    const dados = (await request.json()) as DadosDuplicidade
    return tratar(() => {
      exigir(request, ...OPERACAO)
      return bancoDoadores.verificarDuplicatas(dados)
    })
  }),
  http.post('*/api/doadores', async ({ request }) => {
    const dados = (await request.json()) as CadastroRapido
    return tratar(() => bancoDoadores.cadastrarRapido(dados, exigir(request, ...OPERACAO).nome))
  }),
  http.get('*/api/doadores/:id', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...OPERACAO)
      return bancoDoadores.obter(Number(params.id))
    }),
  ),
  http.put('*/api/doadores/:id', async ({ request, params }) => {
    const dados = (await request.json()) as AtualizacaoDoador
    return tratar(() => bancoDoadores.atualizar(Number(params.id), dados, exigir(request, ...OPERACAO).nome))
  }),
  http.post('*/api/doadores/:id/inativacao', async ({ request, params }) => {
    const dados = (await request.json()) as InativacaoDoador
    return tratar(() => bancoDoadores.inativar(Number(params.id), dados, exigir(request, ...ADMIN).nome))
  }),
  http.post('*/api/doadores/:id/reativacao', async ({ request, params }) => {
    const dados = (await request.json()) as ReativacaoDoador
    return tratar(() => bancoDoadores.reativar(Number(params.id), dados, exigir(request, ...ADMIN).nome))
  }),
  http.post('*/api/doadores/:id/anonimizacao', async ({ request, params }) => {
    const dados = (await request.json()) as AnonimizacaoDoador
    return tratar(() => bancoDoadores.anonimizar(Number(params.id), dados, exigir(request, ...ADMIN).nome))
  }),
  http.get('*/api/doadores/:id/notas', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...OPERACAO)
      return bancoDoadores.listarNotas(Number(params.id))
    }),
  ),
  http.post('*/api/doadores/:id/notas', async ({ request, params }) => {
    const { texto } = (await request.json()) as { texto: string }
    return tratar(() => bancoDoadores.adicionarNota(Number(params.id), texto, exigir(request, ...OPERACAO).nome))
  }),
  http.get('*/api/doadores/:id/competencias', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...OPERACAO)
      return bancoDoadores.listarCompetencias(Number(params.id))
    }),
  ),
  http.get('*/api/enderecos/cep/:cep', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...OPERACAO)
      return bancoDoadores.consultarCep(String(params.cep))
    }),
  ),
]
