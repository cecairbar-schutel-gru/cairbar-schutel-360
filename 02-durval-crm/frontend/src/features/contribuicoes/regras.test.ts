import { lerValor, mensagemDeFalta, resumirPagamento } from './regras'

describe('regras de pagamento (US-CONTRIB-004)', () => {
  it('lê valores em reais e rejeita mais de duas casas ou negativos', () => {
    expect(lerValor('70')).toBe(7000)
    expect(lerValor('70,5')).toBe(7050)
    expect(lerValor('1.234,56')).toBe(123456)
    expect(lerValor('R$ 10,00')).toBe(1000)
    expect(lerValor('')).toBeNull()
    expect(lerValor('10,005')).toBeNaN()
    expect(lerValor('-5')).toBeNaN()
  })

  it('soma PIX e cartão e mostra o excedente do exemplo da história', () => {
    const resumo = resumirPagamento(10000, {
      dinheiro: '',
      pix: '70,00',
      cartao: '50,00',
      tipoCartao: 'CREDITO',
    })
    expect(resumo.erros).toEqual([])
    expect(resumo.recebido).toBe(12000)
    expect(resumo.diferenca).toBe(2000)
    expect(resumo.pagamentos).toEqual([
      { meio: 'PIX', valor: 70 },
      { meio: 'CARTAO', valor: 50, tipoCartao: 'CREDITO' },
    ])
  })

  it('exige crédito ou débito quando há valor em cartão', () => {
    const resumo = resumirPagamento(5000, { dinheiro: '', pix: '', cartao: '50,00', tipoCartao: '' })
    expect(resumo.erros).toEqual(['Informe se o cartão é de crédito ou de débito.'])
    // O valor continua no recebido: a falta não aparece por engano.
    expect(resumo.diferenca).toBe(0)
  })

  it('aponta a falta', () => {
    const resumo = resumirPagamento(10000, {
      dinheiro: '30',
      pix: '40',
      cartao: '',
      tipoCartao: '',
    })
    expect(resumo.erros).toEqual([])
    expect(resumo.diferenca).toBe(-3000)
    expect(mensagemDeFalta(3000).replace(/\u00a0/g, ' ')).toBe(
      'Faltam R$ 30,00 no valor recebido. Remova uma competência ou ajuste os valores.',
    )
  })
})
