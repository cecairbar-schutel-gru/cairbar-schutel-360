import { apenasDigitos } from '../formatters/formatadores'

export function validarCpf(valor: string): boolean {
  const cpf = apenasDigitos(valor)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const digito = (tamanho: number) => {
    let soma = 0
    for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (tamanho + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10])
}

/** Telefone brasileiro: 10 ou 11 dígitos com DDD; celular (11) começa com 9. */
export function validarTelefone(valor: string): boolean {
  const d = apenasDigitos(valor)
  if (d.length !== 10 && d.length !== 11) return false
  if (d[0] === '0' || d[1] === '0') return false
  if (d.length === 11) return d[2] === '9'
  return d[2] >= '2' && d[2] <= '9'
}

export function validarEmail(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor.trim())
}

export function validarCep(valor: string): boolean {
  return apenasDigitos(valor).length === 8
}
