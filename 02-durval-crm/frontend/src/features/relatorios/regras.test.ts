import { hoje, paraIsoData } from '../../shared/formatters/datas'
import { descreverPeriodo, fechaEstoque, formatarPercentual, larguraDaBarra, lerPeriodo, linkLancamentos, mesDoPeriodo, periodoDoMes } from './regras'

describe('regras dos relatórios', () => {
  it('sem período na URL, vale o mês atual (regra comum dos relatórios)', () => {
    const mes = paraIsoData(hoje()).slice(0, 7)
    expect(lerPeriodo(new URLSearchParams())).toEqual(periodoDoMes(mes))
    expect(lerPeriodo(new URLSearchParams('de=2026-10-10&ate=2026-10-01'))).toEqual(periodoDoMes(mes))
    expect(lerPeriodo(new URLSearchParams('de=2026-10-01&ate=2026-10-15'))).toEqual({ de: '2026-10-01', ate: '2026-10-15' })
    expect(lerPeriodo(new URLSearchParams('mes=2026-02'))).toEqual({ de: '2026-02-01', ate: '2026-02-28' })
  })

  it('descreve o período como mês ou intervalo', () => {
    expect(mesDoPeriodo({ de: '2026-10-01', ate: '2026-10-31' })).toBe('2026-10')
    expect(mesDoPeriodo({ de: '2026-10-01', ate: '2026-10-30' })).toBeNull()
    expect(descreverPeriodo({ de: '2026-10-01', ate: '2026-10-31' })).toBe('Outubro/2026')
    expect(descreverPeriodo({ de: '2026-10-01', ate: '2026-10-15' })).toBe('01/10/2026 a 15/10/2026')
  })

  it('formata a participação e limita a barra', () => {
    expect(formatarPercentual(45.3)).toBe('45,3%')
    expect(formatarPercentual(null)).toBe('—')
    expect(larguraDaBarra(140)).toBe(100)
    expect(larguraDaBarra(-5)).toBe(0)
  })

  it('o drill-down leva os filtros para os lançamentos', () => {
    expect(linkLancamentos({ de: '2026-10-01', ate: '2026-10-31', categoria: 'RECEITAS_VENDAS', contaId: null })).toBe(
      '/financeiro/lancamentos?de=2026-10-01&ate=2026-10-31&categoria=RECEITAS_VENDAS',
    )
  })

  it('confere a linha do estoque: inicial + entradas − saídas + ajustes = final', () => {
    const base = { origem: 'PROPRIO' as const, remessaId: null, remessaCodigo: null, editoraId: null, editoraNome: null }
    expect(fechaEstoque({ ...base, inicial: 30, compra: 5, doacao: 1, remessa: 0, venda: 3, devolucao: 0, baixa: 1, ajuste: -2, fim: 30 })).toBe(true)
    expect(fechaEstoque({ ...base, inicial: 30, compra: 0, doacao: 0, remessa: 0, venda: 3, devolucao: 0, baixa: 0, ajuste: 0, fim: 30 })).toBe(false)
  })
})
