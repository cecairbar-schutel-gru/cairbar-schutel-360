import { describe, expect, it } from 'vitest'
import { formatarMoeda } from '../../shared/formatters/formatadores'
import { erroNovoValor, formatarCnpj, preVisualizar, primeiroMesPermitido, validarCnpj, variacaoPercentual, variaveisDesconhecidas } from './regras'

describe('regras da Administração', () => {
  it('aponta variável desconhecida antes de salvar o modelo (US-ADMIN-003)', () => {
    expect(variaveisDesconhecidas('Olá, {nome}! {doador} {doador} {valor}', ['nome', 'valor'])).toEqual(['{doador}'])
    expect(variaveisDesconhecidas('Sem variáveis', ['nome'])).toEqual([])
  })

  it('pré-visualiza com dados de exemplo', () => {
    expect(preVisualizar('Olá, {nome}! {organizacao} agradece {valor}.', 'CE Cairbar')).toBe(
      `Olá, Maria da Silva! CE Cairbar agradece ${formatarMoeda(100)}.`,
    )
  })

  it('novo valor da mensalidade só a partir do mês seguinte, com motivo e diferente do vigente (US-ADMIN-002)', () => {
    expect(primeiroMesPermitido('2026-12')).toBe('2027-01')
    expect(erroNovoValor(60, '2027-01', 'Reajuste', '2026-10', 50)).toBeNull()
    expect(erroNovoValor(60, '2026-10', 'Reajuste', '2026-10', 50)).toMatch('11/2026')
    expect(erroNovoValor(50, '2027-01', 'Reajuste', '2026-10', 50)).toBe('O valor é igual ao vigente.')
    expect(erroNovoValor(60.001, '2027-01', 'Reajuste', '2026-10', 50)).toBe('Informe o valor em reais e centavos.')
    expect(erroNovoValor(60, '2027-01', 'ok', '2026-10', 50)).toBe('Informe o motivo da alteração.')
    expect(erroNovoValor(null, '2027-01', 'Reajuste', '2026-10', 50)).toBe('Informe um valor maior que zero.')
  })

  it('variação em relação ao mês anterior', () => {
    expect(variacaoPercentual(110, 100)).toBe(10)
    expect(variacaoPercentual(-50, -100)).toBe(50)
    expect(variacaoPercentual(10, 0)).toBeNull()
  })

  it('valida e formata CNPJ', () => {
    expect(validarCnpj('11.222.333/0001-81')).toBe(true)
    expect(validarCnpj('11.222.333/0001-82')).toBe(false)
    expect(validarCnpj('11111111111111')).toBe(false)
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81')
  })
})
