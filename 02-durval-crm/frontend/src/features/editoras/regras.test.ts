import { deslocarMes, formatarCnpj, nomeDoMes, percentualValido, validarCnpj } from './regras'

describe('regras das editoras', () => {
  it('valida o CNPJ pelos dígitos verificadores', () => {
    expect(validarCnpj('11.222.333/0001-81')).toBe(true)
    expect(validarCnpj('11222333000182')).toBe(false)
    expect(validarCnpj('11111111111111')).toBe(false)
    expect(validarCnpj('123')).toBe(false)
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81')
    expect(formatarCnpj(null)).toBe('—')
  })

  it('aceita percentual de repasse de 0 a 100 com até duas casas', () => {
    expect(percentualValido(0)).toBe(true)
    expect(percentualValido(35.5)).toBe(true)
    expect(percentualValido(100)).toBe(true)
    expect(percentualValido(100.01)).toBe(false)
    expect(percentualValido(-1)).toBe(false)
    expect(percentualValido(33.333)).toBe(false)
  })

  it('navega entre meses', () => {
    expect(deslocarMes('2026-01', -1)).toBe('2025-12')
    expect(deslocarMes('2026-12', 1)).toBe('2027-01')
    expect(nomeDoMes('2026-10')).toBe('outubro/2026')
  })
})
