import { http, HttpResponse, type HttpHandler } from 'msw'
import type {
  DadosCantina,
  DadosLivro,
  FiltroEstoque,
  NovaBaixa,
  NovaEntradaDoacao,
  SituacaoCatalogo,
  StatusSolicitacao,
  TipoMovimento,
  TipoProduto,
} from '../../features/estoque/types'
import { bancoEstoque } from '../bancoEstoque'
import { exigir, tratar } from './comum'

const CONSULTA = ['vendedor', 'tesoureiro', 'administrador'] as const
const ESTOQUISTA = ['vendedor', 'administrador'] as const
const ADMINISTRADOR = ['administrador'] as const

const busca = (request: Request) => new URL(request.url).searchParams
const motivo = async (request: Request) => ((await request.json()) as { motivo?: string }).motivo ?? ''

export const handlersEstoque: HttpHandler[] = [
  http.get('*/api/estoque/produtos/similares', ({ request }) =>
    tratar(() => {
      exigir(request, ...ESTOQUISTA)
      const b = busca(request)
      return bancoEstoque.similares(b.get('nome') ?? '', (b.get('tipo') as TipoProduto | null) ?? null, b.get('excetoId') ? Number(b.get('excetoId')) : null)
    }),
  ),
  http.get('*/api/estoque/produtos', ({ request }) =>
    tratar(() => {
      exigir(request, ...CONSULTA)
      const b = busca(request)
      const filtro: FiltroEstoque = {
        tipo: (b.get('tipo') as TipoProduto | null) ?? undefined,
        categoria: b.get('categoria') ?? undefined,
        q: b.get('q') ?? undefined,
        somenteSemSaldo: b.get('somenteSemSaldo') === 'true',
        situacao: (b.get('situacao') as SituacaoCatalogo | null) ?? undefined,
      }
      return bancoEstoque.listar(filtro)
    }),
  ),
  http.get('*/api/estoque/opcoes', ({ request }) =>
    tratar(() => {
      exigir(request, ...ESTOQUISTA)
      return bancoEstoque.opcoes()
    }),
  ),
  http.get('*/api/estoque/produtos/:id/movimentos', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...CONSULTA)
      const b = busca(request)
      return bancoEstoque.movimentos(Number(params.id), {
        de: b.get('de') ?? undefined,
        ate: b.get('ate') ?? undefined,
        tipo: (b.get('tipo') as TipoMovimento | null) ?? undefined,
      })
    }),
  ),
  http.get('*/api/estoque/produtos/:id', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...CONSULTA)
      return bancoEstoque.detalhe(Number(params.id))
    }),
  ),
  http.post('*/api/estoque/livros', async ({ request }) => {
    const dados = (await request.json()) as DadosLivro
    return tratar(() => {
      exigir(request, ...ADMINISTRADOR)
      return bancoEstoque.cadastrarLivro(dados)
    })
  }),
  http.put('*/api/estoque/livros/:id', async ({ request, params }) => {
    const dados = (await request.json()) as DadosLivro
    return tratar(() => {
      exigir(request, ...ADMINISTRADOR)
      return bancoEstoque.atualizarLivro(Number(params.id), dados)
    })
  }),
  http.post('*/api/estoque/livros/:id/preco', async ({ request, params }) => {
    const { preco, motivo: texto } = (await request.json()) as { preco: number; motivo: string }
    return tratar(() => bancoEstoque.alterarPrecoLivro(Number(params.id), preco, texto, exigir(request, ...ADMINISTRADOR)))
  }),
  http.post('*/api/estoque/cantina', async ({ request }) => {
    const dados = (await request.json()) as DadosCantina
    return tratar(() => {
      exigir(request, ...ESTOQUISTA)
      return bancoEstoque.cadastrarCantina(dados)
    })
  }),
  http.put('*/api/estoque/cantina/:id', async ({ request, params }) => {
    const dados = (await request.json()) as DadosCantina
    return tratar(() => bancoEstoque.corrigirCantina(Number(params.id), dados, exigir(request, ...ESTOQUISTA)))
  }),
  http.post('*/api/estoque/produtos/:id/inativacao', async ({ request, params }) => {
    const texto = await motivo(request)
    return tratar(() => {
      exigir(request, ...ADMINISTRADOR)
      return bancoEstoque.inativar(Number(params.id), texto)
    })
  }),
  http.post('*/api/estoque/produtos/:id/reativacao', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...ADMINISTRADOR)
      return bancoEstoque.reativar(Number(params.id))
    }),
  ),
  http.delete('*/api/estoque/produtos/:id', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...ADMINISTRADOR)
      bancoEstoque.excluir(Number(params.id))
    }),
  ),
  http.post('*/api/estoque/produtos/:id/ajuste', async ({ request, params }) => {
    const dados = (await request.json()) as { remessaId: number | null; quantidadeContada: number; motivo: string }
    return tratar(() => bancoEstoque.ajustar(Number(params.id), dados, exigir(request, ...ADMINISTRADOR)))
  }),
  http.get('*/api/estoque/entradas-doacao', ({ request }) =>
    tratar(() => {
      exigir(request, ...ESTOQUISTA)
      return bancoEstoque.entradasDoacao()
    }),
  ),
  http.post('*/api/estoque/entradas-doacao', async ({ request }) => {
    const dados = (await request.json()) as NovaEntradaDoacao
    return tratar(() => bancoEstoque.registrarDoacao(dados, exigir(request, ...ESTOQUISTA)))
  }),
  http.post('*/api/estoque/entradas-doacao/:id/cancelamento', async ({ request, params }) => {
    const texto = await motivo(request)
    return tratar(() => bancoEstoque.cancelarDoacao(Number(params.id), texto, exigir(request, ...ADMINISTRADOR)))
  }),
  http.get('*/api/estoque/solicitacoes/:id/foto', ({ request, params }) => {
    let foto = null
    const negado = tratar(() => {
      foto = bancoEstoque.foto(Number(params.id), exigir(request, ...ESTOQUISTA))
    })
    if (negado.status !== 204 || !foto) return negado
    const { conteudoBase64, tipo } = foto as { conteudoBase64: string; tipo: string }
    const bytes = Uint8Array.from(atob(conteudoBase64), (c) => c.charCodeAt(0))
    return new HttpResponse(bytes.buffer, {
      headers: { 'Content-Type': tipo, 'Content-Disposition': `inline; filename="foto-${params.id}"` },
    })
  }),
  http.get('*/api/estoque/solicitacoes', ({ request }) =>
    tratar(() => {
      const usuario = exigir(request, ...ESTOQUISTA)
      const b = busca(request)
      return bancoEstoque.solicitacoes(
        { status: (b.get('status') as StatusSolicitacao | null) ?? undefined, minhas: b.get('minhas') === 'true' },
        usuario,
      )
    }),
  ),
  http.post('*/api/estoque/solicitacoes/baixa', async ({ request }) => {
    const dados = (await request.json()) as NovaBaixa
    return tratar(() => bancoEstoque.solicitarBaixa(dados, exigir(request, ...ESTOQUISTA)))
  }),
  http.post('*/api/estoque/solicitacoes/preco', async ({ request }) => {
    const dados = (await request.json()) as { produtoId: number; novoPreco: number; motivo: string }
    return tratar(() => bancoEstoque.solicitarPreco(dados.produtoId, dados.novoPreco, dados.motivo, exigir(request, ...ESTOQUISTA)))
  }),
  http.post('*/api/estoque/solicitacoes/inativacao', async ({ request }) => {
    const dados = (await request.json()) as { produtoId: number; motivo: string }
    return tratar(() => bancoEstoque.solicitarInativacao(dados.produtoId, dados.motivo, exigir(request, ...ESTOQUISTA)))
  }),
  http.post('*/api/estoque/solicitacoes/:id/cancelamento', ({ request, params }) =>
    tratar(() => bancoEstoque.cancelarSolicitacao(Number(params.id), exigir(request, ...ESTOQUISTA))),
  ),
  http.post('*/api/estoque/solicitacoes/:id/aprovacao', ({ request, params }) =>
    tratar(() => bancoEstoque.aprovar(Number(params.id), exigir(request, ...ADMINISTRADOR))),
  ),
  http.post('*/api/estoque/solicitacoes/:id/rejeicao', async ({ request, params }) => {
    const texto = await motivo(request)
    return tratar(() => bancoEstoque.rejeitar(Number(params.id), texto, exigir(request, ...ADMINISTRADOR)))
  }),
]
