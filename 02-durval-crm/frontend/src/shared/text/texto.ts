/** Minúsculas, sem acentos e com espaços normalizados. */
export function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function trigramas(valor: string): Set<string> {
  const conjunto = new Set<string>()
  for (const palavra of normalizarTexto(valor).split(' ').filter(Boolean)) {
    const p = `  ${palavra} `
    for (let i = 0; i < p.length - 2; i++) conjunto.add(p.slice(i, i + 3))
  }
  return conjunto
}

/** Similaridade de trigramas (0–1), no mesmo espírito do `pg_trgm.similarity`. */
export function similaridade(a: string, b: string): number {
  const ta = trigramas(a)
  const tb = trigramas(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let comuns = 0
  for (const t of ta) if (tb.has(t)) comuns++
  return comuns / (ta.size + tb.size - comuns)
}
