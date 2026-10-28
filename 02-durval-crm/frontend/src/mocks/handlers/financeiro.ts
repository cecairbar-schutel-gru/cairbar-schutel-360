import { http, HttpResponse, type HttpHandler } from 'msw'
import type {
  Correcao,
  DadosConta,
  FiltroLancamentos,
  NaturezaLancamento,
  NovaLiquidacao,
  NovaTransferencia,
  NovoLancamentoManual,
  OrigemLancamento,
  PainelTesoureiro,
  TipoConta,
} from '../../features/financeiro/types'
import { hoje, paraIsoData } from '../../shared/formatters/datas'
import { bancoConciliacoes } from '../bancoConciliacoes'
import { bancoDoadores } from '../bancoDoadores'
import { bancoFechamento } from '../bancoFechamento'
import { bancoFinanceiro } from '../bancoFinanceiro'
import { bancoIntencoes } from '../bancoIntencoes'
import { ErroNegocio } from '../erroNegocio'
import { exigir, tratar } from './comum'

const TESOURARIA = ['tesoureiro', 'administrador'] as const
const TESOUREIRO = ['tesoureiro'] as const
const ADMINISTRADOR = ['administrador'] as const

/** Fora do Administrador, só contas bancárias (US-FINANCIAL-001). */
function exigirTipoPermitido(papeis: readonly string[], tipo: TipoConta) {
  if (tipo !== 'BANCO' && !papeis.includes('administrador')) {
    throw new ErroNegocio(409, 'SO_CONTA_BANCARIA', 'O Tesoureiro cadastra e altera só contas bancárias; caixas ficam com o Administrador.')
  }
}

const busca = (request: Request) => new URL(request.url).searchParams
const numero = (valor: string | null) => (valor ? Number(valor) : undefined)
const corpo = async <T>(request: Request) => (await request.json()) as T

/** Mesma regra do adapter do módulo Contribuições no backend. */
function mensalidadesDoMes(): PainelTesoureiro['mensalidades'] {
  const mes = paraIsoData(hoje()).slice(0, 7)
  let previsto = 0
  let recebido = 0
  let pendente = 0
  let pendenteAnterior = 0
  for (const c of bancoDoadores.todasAsCompetencias()) {
    const valor = Math.round(c.valor * 100)
    if (c.competencia === mes && c.status !== 'CANCELADA') previsto += valor
    if (c.competencia === mes && c.status === 'PAGA') recebido += valor
    if (c.competencia === mes && c.status === 'PENDENTE') pendente += valor
    if (c.competencia < mes && c.status === 'PENDENTE') pendenteAnterior += valor
  }
  return { previsto: previsto / 100, recebido: recebido / 100, pendente: pendente / 100, pendenteAnterior: pendenteAnterior / 100 }
}

export const handlersFinanceiro: HttpHandler[] = [
  http.get('*/api/financeiro/contas', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoFinanceiro.contas()
    }),
  ),
  http.get('*/api/financeiro/contas/:id', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoFinanceiro.conta(Number(params.id))
    }),
  ),
  http.post('*/api/financeiro/contas', async ({ request }) => {
    const dados = await corpo<DadosConta>(request)
    return tratar(() => {
      exigirTipoPermitido(exigir(request, ...TESOURARIA).papeis, dados.tipo)
      return bancoFinanceiro.cadastrarConta(dados)
    })
  }),
  http.put('*/api/financeiro/contas/:id', async ({ request, params }) => {
    const dados = await corpo<DadosConta>(request)
    return tratar(() => {
      exigirTipoPermitido(exigir(request, ...TESOURARIA).papeis, bancoFinanceiro.conta(Number(params.id)).tipo)
      return bancoFinanceiro.alterarConta(Number(params.id), dados)
    })
  }),
  http.post('*/api/financeiro/contas/:id/inativacao', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...ADMINISTRADOR)
      return bancoFinanceiro.inativarConta(Number(params.id))
    }),
  ),
  http.post('*/api/financeiro/contas/:id/reativacao', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...ADMINISTRADOR)
      return bancoFinanceiro.reativarConta(Number(params.id))
    }),
  ),
  http.delete('*/api/financeiro/contas/:id', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...ADMINISTRADOR)
      bancoFinanceiro.excluirConta(Number(params.id))
    }),
  ),
  http.get('*/api/financeiro/contas-recebimento', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoFinanceiro.contasRecebimento()
    }),
  ),
  http.put('*/api/financeiro/contas-recebimento', async ({ request }) => {
    const d = await corpo<{ dinheiroContaId: number | null; pixContaId: number | null }>(request)
    return tratar(() => {
      exigir(request, ...ADMINISTRADOR)
      return bancoFinanceiro.definirContasRecebimento(d.dinheiroContaId ?? null, d.pixContaId ?? null)
    })
  }),
  http.get('*/api/financeiro/saldos', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoFinanceiro.saldos(busca(request).get('data') ?? undefined)
    }),
  ),
  http.get('*/api/financeiro/categorias', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoFinanceiro.categorias()
    }),
  ),
  http.post('*/api/financeiro/transferencias', async ({ request }) => {
    const dados = await corpo<NovaTransferencia>(request)
    return tratar(() => {
      const usuario = exigir(request, ...TESOUREIRO)
      return bancoFinanceiro.transferir(usuario, dados)
    })
  }),
  http.get('*/api/financeiro/cartao-a-receber', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoFinanceiro.cartaoAReceber()
    }),
  ),
  http.post('*/api/financeiro/liquidacoes-cartao', async ({ request }) => {
    const dados = await corpo<NovaLiquidacao>(request)
    return tratar(() => {
      const usuario = exigir(request, ...TESOUREIRO)
      return bancoFinanceiro.liquidarCartao(usuario, dados)
    })
  }),
  http.post('*/api/financeiro/lancamentos', async ({ request }) => {
    const dados = await corpo<NovoLancamentoManual>(request)
    return tratar(() => {
      const usuario = exigir(request, ...TESOUREIRO)
      return bancoFinanceiro.lancarManual(usuario, dados)
    })
  }),
  http.get('*/api/financeiro/lancamentos', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      const b = busca(request)
      const filtro: FiltroLancamentos = {
        contaId: numero(b.get('contaId')),
        de: b.get('de') ?? undefined,
        ate: b.get('ate') ?? undefined,
        natureza: (b.get('natureza') as NaturezaLancamento | null) ?? undefined,
        categoria: b.get('categoria') ?? undefined,
        origem: (b.get('origem') as OrigemLancamento | null) ?? undefined,
        texto: b.get('texto') ?? undefined,
        valor: numero(b.get('valor')),
      }
      return bancoFinanceiro.lancamentos(filtro, numero(b.get('pagina')) ?? 0)
    }),
  ),
  http.get('*/api/financeiro/lancamentos/:id/anexo', ({ request, params }) => {
    try {
      exigir(request, ...TESOURARIA)
      const a = bancoFinanceiro.anexo(Number(params.id))
      const bytes = Uint8Array.from(atob(a.conteudoBase64), (c) => c.charCodeAt(0))
      return new HttpResponse(bytes, {
        headers: { 'Content-Type': a.tipo, 'Content-Disposition': `attachment; filename="${a.nome}"` },
      })
    } catch (erro) {
      if (erro instanceof ErroNegocio) {
        return HttpResponse.json({ codigo: erro.codigo, mensagem: erro.message, erros: erro.erros }, { status: erro.status })
      }
      throw erro
    }
  }),
  http.get('*/api/financeiro/lancamentos/:id', ({ request, params }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return bancoFinanceiro.lancamento(Number(params.id))
    }),
  ),
  http.post('*/api/financeiro/lancamentos/:id/estorno', async ({ request, params }) => {
    const { motivo, correcao } = await corpo<{ motivo: string; correcao: Correcao | null }>(request)
    return tratar(() => {
      const usuario = exigir(request, ...TESOURARIA)
      return bancoFinanceiro.estornar(usuario, Number(params.id), motivo ?? '', correcao)
    })
  }),
  http.post('*/api/financeiro/lancamentos/:id/reclassificacao', async ({ request, params }) => {
    const d = await corpo<{ ordem: number; categoria: string; motivo: string }>(request)
    return tratar(() => {
      const usuario = exigir(request, ...TESOURARIA)
      return bancoFinanceiro.reclassificar(usuario, Number(params.id), d.ordem, d.categoria, d.motivo ?? '')
    })
  }),
  http.get('*/api/financeiro/painel-tesoureiro', ({ request }) =>
    tratar(() => {
      exigir(request, ...TESOURARIA)
      return {
        ...bancoFinanceiro.painelTesoureiro(
          mensalidadesDoMes(),
          bancoIntencoes.contadores().pendentes,
          bancoConciliacoes.conciliadasAte(),
        ),
        periodo: bancoFechamento.situacao(),
      }
    }),
  ),
]
