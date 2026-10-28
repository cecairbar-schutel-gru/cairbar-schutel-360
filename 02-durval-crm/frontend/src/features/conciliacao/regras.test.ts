import { describe, expect, it } from 'vitest'
import {
  diferencaZerada,
  FILTRO_VAZIO,
  filtrarLancamentos,
  situacaoDaLinha,
  sugerirPares,
  lerSaldo,
  somar,
} from './regras'
import type { ItemConciliacao } from './types'

const item = (
  id: number,
  data: string,
  descricao: string,
  valor: number,
  marcado = false,
): ItemConciliacao => ({
  id,
  data,
  descricao,
  origemTipo: 'MANUAL',
  origemId: null,
  natureza: valor > 0 ? 'RECEITA' : 'DESPESA',
  valor,
  estornaLancamentoId: null,
  estornadoPorId: null,
  corrigeLancamentoId: null,
  podeCorrigir: true,
  marcado,
  marcadoPor: null,
  marcadoEm: null,
  adicionado: false,
})

const itens = [
  item(1, '2026-10-05', 'Conta de energia', -100, true),
  item(2, '2026-10-10', 'Depósito do caixa', 50),
  item(3, '2026-10-14', 'PIX do bazar', 30),
]

describe('filtros da sessão (US-RECONCILIATION-003)', () => {
  it('filtra por período, valor absoluto, texto sem acento e esconde os marcados', () => {
    expect(
      filtrarLancamentos(itens, {
        ...FILTRO_VAZIO,
        de: '2026-10-06',
        ate: '2026-10-14',
      }).map((l) => l.id),
    ).toEqual([2, 3])
    expect(
      filtrarLancamentos(itens, { ...FILTRO_VAZIO, valor: '100,00' }).map(
        (l) => l.id,
      ),
    ).toEqual([1])
    expect(
      filtrarLancamentos(itens, { ...FILTRO_VAZIO, texto: 'deposito' }).map(
        (l) => l.id,
      ),
    ).toEqual([2])
    expect(
      filtrarLancamentos(itens, { ...FILTRO_VAZIO, texto: '3' }).map(
        (l) => l.id,
      ),
    ).toEqual([3])
    expect(
      filtrarLancamentos(itens, {
        ...FILTRO_VAZIO,
        mostrarMarcados: false,
      }).map((l) => l.id),
    ).toEqual([2, 3])
  })
})

describe('valores', () => {
  it('lê o saldo do extrato, inclusive negativo', () => {
    expect(lerSaldo('1.234,56')).toBe(1234.56)
    expect(lerSaldo('-55,00')).toBe(-55)
    expect(lerSaldo('')).toBeNull()
    expect(lerSaldo('abc')).toBeNaN()
  })

  it('soma em centavos e reconhece a diferença zerada', () => {
    expect(
      somar([item(1, '2026-10-01', 'a', 0.1), item(2, '2026-10-01', 'b', 0.2)]),
    ).toBe(0.3)
    expect(diferencaZerada(0.1 + 0.2 - 0.3)).toBe(true)
    expect(diferencaZerada(-0.01)).toBe(false)
  })

  it('sugere o par de mesmo valor com a data mais próxima, um lançamento por linha (igual ao backend)', () => {
    const m = (id: number, dia: number, valor: number) => ({
      id,
      data: `2026-10-${String(dia).padStart(2, '0')}`,
      valor,
    })
    const pares = sugerirPares(
      [m(1, 5, -100), m(2, 10, 50), m(3, 10, 50), m(4, 12, -7.9), m(5, 14, 30)],
      [
        m(11, 3, -100),
        m(12, 6, -100),
        m(13, 9, 50),
        m(14, 10, 50),
        m(15, 2, -7.9),
        m(16, 13, -30),
      ],
    )
    expect(Object.fromEntries(pares)).toEqual({ 1: 12, 2: 14, 3: 13 })
  })

  it('classifica a linha do extrato', () => {
    const linha = {
      id: 1,
      data: '2026-10-10',
      descricao: 'x',
      valor: 1,
      identificador: null,
      lancamentoId: null,
      conferidaPor: null,
      conferidaEm: null,
      sugestaoId: null,
    }
    expect(situacaoDaLinha(linha, '2026-10-15')).toBe('SEM_LANCAMENTO')
    expect(situacaoDaLinha({ ...linha, sugestaoId: 3 }, '2026-10-15')).toBe(
      'SUGESTAO',
    )
    expect(situacaoDaLinha({ ...linha, lancamentoId: 3 }, '2026-10-05')).toBe(
      'CONFERIDA',
    )
    expect(situacaoDaLinha(linha, '2026-10-05')).toBe('FORA_DO_PERIODO')
  })
})
