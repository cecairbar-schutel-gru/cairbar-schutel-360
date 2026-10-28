import { variacao } from '../../mocks/bancoFechamento'
import { erroJanela, formatarPercentual, justificativaValida, linkDoItem, participacao, totaisDasContas } from './regras'

describe('regras do fechamento mensal', () => {
  it('janela de fechamento com 1 a 7 dias seguidos (US-CLOSING-014)', () => {
    expect(erroJanela(1, 7)).toBeNull()
    expect(erroJanela(10, 10)).toBeNull()
    expect(erroJanela(1, 8)).toBe('A janela tem no máximo 7 dias.')
    expect(erroJanela(5, 4)).toBe('O último dia não pode ser antes do primeiro.')
  })

  it('exige justificativa de 20 caracteres para reabrir (US-CLOSING-009)', () => {
    expect(justificativaValida('Erro na luz')).toBe(false)
    expect(justificativaValida('   Conta   de luz lançada em dobro   ')).toBe(true)
  })

  it('leva cada item do checklist à tela que o resolve (US-CLOSING-001)', () => {
    expect(linkDoItem('CONCILIACAO', '2026-09')).toBe('/conciliacao')
    expect(linkDoItem('ESTOQUE', '2026-09')).toBe('/estoque/solicitacoes')
    expect(linkDoItem('EDITORAS', '2026-09')).toBe('/editoras/fechamento?mes=2026-09')
  })

  it('destaca variações acima de 20% e de R$ 100,00 (US-CLOSING-013)', () => {
    expect(variacao(1300, 1000)).toEqual({ atual: 1300, anterior: 1000, diferenca: 300, percentual: 30, destaque: true })
    expect(variacao(150, 100).destaque).toBe(false)
    expect(variacao(1150, 1000).destaque).toBe(false)
    expect(variacao(250, 0)).toMatchObject({ percentual: null, destaque: true })
    expect(formatarPercentual(variacao(700, 1000))).toBe('−30,0%')
    expect(formatarPercentual(variacao(250, 0))).toBe('—')
  })

  it('calcula as barras e os totais por conta', () => {
    expect(participacao(450, 1000)).toBe(45)
    expect(participacao(10, 0)).toBe(0)
    const totais = totaisDasContas([
      { contaId: 1, nome: 'Caixa', tipo: 'CAIXA', saldoInicial: 200, entradas: 10.1, saidas: 0, transferenciasEntrada: 0, transferenciasSaida: 50, saldoFinal: 160.1 },
      { contaId: 3, nome: 'Banco', tipo: 'BANCO', saldoInicial: 1000, entradas: 0.2, saidas: 100, transferenciasEntrada: 50, transferenciasSaida: 0, saldoFinal: 950.2 },
    ])
    expect(totais).toMatchObject({ saldoInicial: 1200, entradas: 10.3, saldoFinal: 1110.3 })
  })
})
