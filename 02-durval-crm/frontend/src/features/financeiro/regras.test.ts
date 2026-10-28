import { describe, expect, it } from 'vitest'
import {
  categoriasMae,
  erroAnexo,
  erroLiquidacao,
  liquidoDaLiquidacao,
  subcategorias,
} from './regras'
import type { Categoria } from './types'

const cat = (codigo: string, tipo: 'RECEITA' | 'DESPESA', pai: string | null, permiteManual = true): Categoria => ({
  codigo,
  nome: codigo,
  tipo,
  categoriaPai: pai,
  nomeCompleto: codigo,
  ativa: true,
  permiteManual,
})

describe('liquidação de cartão (US-FINANCIAL-004)', () => {
  it('calcula o líquido sem erro de ponto flutuante', () => {
    expect(liquidoDaLiquidacao(600, 18)).toBe(582)
    expect(liquidoDaLiquidacao(0.3, 0.1)).toBe(0.2)
  })

  it('bloqueia bruto acima do saldo de Cartão a receber e taxa inválida', () => {
    expect(erroLiquidacao(600, 18, 1000)).toBeNull()
    expect(erroLiquidacao(450, 10, 400)).toEqual({
      campo: 'bruto',
      mensagem: 'O bruto de R$ 450,00 excede o saldo de Cartão a receber de R$ 400,00.',
    })
    expect(erroLiquidacao(100, 100, 400)?.campo).toBe('taxa')
    expect(erroLiquidacao(100, -1, 400)?.campo).toBe('taxa')
    expect(erroLiquidacao(100, 0, 400)).toBeNull()
  })
})

describe('demais regras', () => {
  it('monta categoria → subcategoria só com as que passam no filtro', () => {
    const lista = [
      cat('DESPESAS_COMERCIAIS', 'DESPESA', null),
      cat('DESPESAS_COMERCIAIS.TAXAS_CARTAO', 'DESPESA', 'DESPESAS_COMERCIAIS', false),
      cat('DESPESAS_OPERACIONAIS', 'DESPESA', null),
      cat('DESPESAS_OPERACIONAIS.AGUA', 'DESPESA', 'DESPESAS_OPERACIONAIS'),
      cat('OUTRAS_RECEITAS', 'RECEITA', null),
      cat('OUTRAS_RECEITAS.OUTRAS', 'RECEITA', 'OUTRAS_RECEITAS'),
    ]
    const manual = (c: Categoria) => c.permiteManual
    expect(categoriasMae(lista, 'DESPESA', manual).map((c) => c.codigo)).toEqual(['DESPESAS_OPERACIONAIS'])
    expect(subcategorias(lista, 'DESPESAS_OPERACIONAIS', manual).map((c) => c.codigo)).toEqual(['DESPESAS_OPERACIONAIS.AGUA'])
  })

  it('aceita anexo PDF, JPG ou PNG de até 5 MB', () => {
    expect(erroAnexo(new File(['%PDF'], 'a.pdf', { type: 'application/pdf' }))).toBeNull()
    expect(erroAnexo(new File(['x'], 'a.txt', { type: 'text/plain' }))).toBe('O anexo deve ser PDF, JPG ou PNG.')
  })
})
