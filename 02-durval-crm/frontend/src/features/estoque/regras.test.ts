import { diferencaPercentual, formatarPercentual, loteSugerido, validarIsbn } from './regras'

describe('regras do estoque', () => {
  it('valida ISBN-10 e ISBN-13 pelo dígito verificador', () => {
    expect(validarIsbn('978-85-7328-786-8')).toBe(true)
    expect(validarIsbn('0-8044-2957-x')).toBe(true)
    expect(validarIsbn('9788573287869')).toBe(false)
    expect(validarIsbn('12345')).toBe(false)
  })

  it('pré-seleciona o lote pela ordem de saída, pulando os sem saldo disponível', () => {
    const lote = (remessaId: number | null, quantidade: number, aguardandoBaixa = 0) => ({
      remessaId,
      remessaCodigo: remessaId ? `R-000${remessaId}` : null,
      recebidaEm: null,
      quantidade,
      aguardandoBaixa,
      repassePercentual: null,
    })
    expect(loteSugerido([lote(null, 0), lote(1, 2, 2), lote(2, 5)])?.remessaId).toBe(2)
    expect(loteSugerido([lote(null, 0)])).toBeNull()
  })

  it('calcula e formata a diferença de preço', () => {
    expect(diferencaPercentual(3.5, 4.2)).toBe(20)
    expect(formatarPercentual(20)).toBe('+20,0%')
    expect(formatarPercentual(diferencaPercentual(5, 4.5))).toBe('−10,0%')
  })
})
