const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatarMoeda(valor: number): string {
  return moeda.format(valor)
}

export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

export function formatarTelefone(valor: string | null | undefined): string {
  if (!valor) return '—'
  const d = apenasDigitos(valor)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return valor
}

export function formatarCpf(valor: string | null | undefined): string {
  if (!valor) return '—'
  const d = apenasDigitos(valor)
  if (d.length !== 11) return valor
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function formatarCep(valor: string | null | undefined): string {
  if (!valor) return ''
  const d = apenasDigitos(valor)
  if (d.length !== 8) return valor
  return `${d.slice(0, 5)}-${d.slice(5)}`
}
