import { apenasDigitos } from '../../shared/formatters/formatadores'

const PESOS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
const PESOS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

function digito(d: string, pesos: number[]): number {
  const soma = pesos.reduce((s, p, i) => s + Number(d[i]) * p, 0)
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

/** CNPJ com dígitos verificadores (mesma regra do backend). */
export function validarCnpj(valor: string): boolean {
  const d = apenasDigitos(valor)
  if (d.length !== 14 || new Set(d).size === 1) return false
  return digito(d, PESOS_1) === Number(d[12]) && digito(d, PESOS_2) === Number(d[13])
}

/** 12.345.678/0001-95 */
export function formatarCnpj(valor: string | null | undefined): string {
  if (!valor) return '—'
  const d = apenasDigitos(valor)
  if (d.length !== 14) return valor
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/** Percentual de repasse válido: 0 a 100, até duas casas. */
export function percentualValido(valor: number): boolean {
  return Number.isFinite(valor) && valor >= 0 && valor <= 100 && Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6
}

/** "AAAA-MM" do mês anterior ou seguinte. */
export function deslocarMes(mes: string, delta: number): string {
  const [a, m] = mes.split('-').map(Number)
  const data = new Date(a, m - 1 + delta, 1)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** "outubro/2026" */
export function nomeDoMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return `${MESES[m - 1]}/${a}`
}
