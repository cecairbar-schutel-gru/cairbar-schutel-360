import { http, HttpResponse, type HttpHandler } from 'msw'
import type { Papel, Usuario } from '../../auth'
import type { TipoConta } from '../../features/financeiro/types'
import type { Agrupamento, TipoExportacao } from '../../features/relatorios/types'
import { bancoRelatorios } from '../bancoRelatorios'
import { exportarRelatorio } from '../exportacaoRelatorios'
import { exigir, tratar } from './comum'

const TESOURARIA: Papel[] = ['tesoureiro', 'administrador']
const VENDAS_E_ESTOQUE: Papel[] = ['vendedor', 'tesoureiro', 'administrador']

/** Quem vê cada relatório (e exporta): Tesouraria todos; Vendedor vendas e estoque; Operador nenhum. */
const PAPEIS_EXPORTACAO: Record<TipoExportacao, Papel[]> = {
  'fluxo-caixa': TESOURARIA,
  'receitas-despesas': TESOURARIA,
  saldos: TESOURARIA,
  mensalidades: TESOURARIA,
  vendas: VENDAS_E_ESTOQUE,
  estoque: VENDAS_E_ESTOQUE,
  'contagem-estoque': VENDAS_E_ESTOQUE,
  editoras: TESOURARIA,
  demonstrativo: TESOURARIA,
  'apuracao-editora': TESOURARIA,
  conciliacao: TESOURARIA,
  lancamentos: TESOURARIA,
}

const parametros = (request: Request) => new URL(request.url).searchParams
const texto = (q: URLSearchParams, k: string) => q.get(k) || undefined
const numero = (q: URLSearchParams, k: string) => (q.get(k) ? Number(q.get(k)) : undefined)

export const handlersRelatorios: HttpHandler[] = [
  http.get('*/api/relatorios/fluxo-caixa', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      const q = parametros(request)
      return bancoRelatorios.fluxoCaixa({
        de: texto(q, 'de'),
        ate: texto(q, 'ate'),
        agrupamento: texto(q, 'agrupamento') as Agrupamento | undefined,
        contaId: numero(q, 'contaId'),
        tipoConta: texto(q, 'tipoConta') as TipoConta | undefined,
      })
    }),
  ),
  http.get('*/api/relatorios/receitas-despesas', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      const q = parametros(request)
      return bancoRelatorios.receitasDespesas({ de: texto(q, 'de'), ate: texto(q, 'ate') })
    }),
  ),
  http.get('*/api/relatorios/saldos', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      const q = parametros(request)
      return bancoRelatorios.saldos({ de: texto(q, 'de'), ate: texto(q, 'ate'), data: texto(q, 'data') })
    }),
  ),
  http.get('*/api/relatorios/mensalidades', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      const q = parametros(request)
      return bancoRelatorios.mensalidades({
        competenciaDe: texto(q, 'competenciaDe'),
        competenciaAte: texto(q, 'competenciaAte'),
        de: texto(q, 'de'),
        ate: texto(q, 'ate'),
      })
    }),
  ),
  http.get('*/api/relatorios/vendas', ({ request }) =>
    tratar(() => {
      const usuario = exigir(request, ...VENDAS_E_ESTOQUE)
      const q = parametros(request)
      return bancoRelatorios.vendas(usuario, { de: texto(q, 'de'), ate: texto(q, 'ate') })
    }),
  ),
  http.get('*/api/relatorios/estoque/contagem', ({ request }) =>
    tratar(() => {
      exigir(request, ...VENDAS_E_ESTOQUE)
      const q = parametros(request)
      return bancoRelatorios.contagem({
        tipo: texto(q, 'tipo') as 'LIVRO' | 'CANTINA' | undefined,
        categoria: texto(q, 'categoria'),
        editoraId: numero(q, 'editoraId'),
      })
    }),
  ),
  http.get('*/api/relatorios/estoque', ({ request }) =>
    tratar(() => {
      exigir(request, ...VENDAS_E_ESTOQUE)
      const q = parametros(request)
      return bancoRelatorios.estoque({
        de: texto(q, 'de'),
        ate: texto(q, 'ate'),
        tipo: texto(q, 'tipo') as 'LIVRO' | 'CANTINA' | undefined,
        categoria: texto(q, 'categoria'),
        editoraId: numero(q, 'editoraId'),
        somenteComMovimento: q.get('somenteComMovimento') === 'true',
      })
    }),
  ),
  http.get('*/api/relatorios/editoras', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      const q = parametros(request)
      return bancoRelatorios.editoras({ de: texto(q, 'de'), ate: texto(q, 'ate') })
    }),
  ),
  http.get('*/api/relatorios/exportacoes/:tipo', ({ request, params }) => {
    const tipo = String(params.tipo) as TipoExportacao
    let arquivo: ReturnType<typeof exportarRelatorio> | null = null
    const negado = tratar(() => {
      const papeis = PAPEIS_EXPORTACAO[tipo]
      if (!papeis) throw new Error(`Exportação desconhecida: ${tipo}`)
      const usuario: Usuario = exigir(request, ...papeis)
      arquivo = exportarRelatorio(tipo, parametros(request), usuario)
    })
    if (negado.status !== 204 || !arquivo) return negado
    const { conteudo, nome, tipoConteudo } = arquivo as ReturnType<typeof exportarRelatorio>
    return new HttpResponse(conteudo.slice().buffer, {
      headers: { 'Content-Type': tipoConteudo, 'Content-Disposition': `attachment; filename="${nome}"` },
    })
  }),
]
