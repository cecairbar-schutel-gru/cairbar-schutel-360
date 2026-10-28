import type { LoteDetalhado } from './types'

/** ISBN-10 ou ISBN-13 com dígito verificador válido (hífens e espaços ignorados). */
export function validarIsbn(valor: string): boolean {
  const v = compactarIsbn(valor)
  if (/^\d{13}$/.test(v)) {
    const soma = [...v.slice(0, 12)].reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? 1 : 3), 0)
    return (10 - (soma % 10)) % 10 === Number(v[12])
  }
  if (/^\d{9}[\dX]$/.test(v)) {
    const soma = [...v].reduce((s, d, i) => s + (d === 'X' ? 10 : Number(d)) * (10 - i), 0)
    return soma % 11 === 0
  }
  return false
}

export function compactarIsbn(valor: string): string {
  return valor.replace(/[\s-]/g, '').toUpperCase()
}

/** Unidades do lote que ainda podem entrar num novo pedido de baixa. */
export function disponivelParaBaixa(lote: LoteDetalhado): number {
  return Math.max(0, lote.quantidade - lote.aguardandoBaixa)
}

/**
 * Lote pré-selecionado no pedido de baixa (US-INVENTORY-007): a ordem de saída das vendas — o
 * estoque próprio, depois as remessas da mais antiga para a mais nova (FIFO).
 */
export function loteSugerido(lotes: LoteDetalhado[]): LoteDetalhado | null {
  return lotes.find((l) => disponivelParaBaixa(l) > 0) ?? null
}

export function rotuloLote(lote: Pick<LoteDetalhado, 'remessaId' | 'remessaCodigo'>): string {
  return lote.remessaId === null ? 'Estoque próprio' : `Remessa ${lote.remessaCodigo}`
}

/** Variação percentual com uma casa (ex.: 3,50 → 4,20 = +20,0%). */
export function diferencaPercentual(atual: number, novo: number): number {
  return Math.round(((novo - atual) / atual) * 1000) / 10
}

export function formatarPercentual(valor: number): string {
  const texto = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    Math.abs(valor),
  )
  return `${valor > 0 ? '+' : valor < 0 ? '−' : ''}${texto}%`
}

/** Lê uma foto JPG/PNG como Base64 (sem o prefixo `data:`). */
export function lerComoBase64(arquivo: Blob): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader()
    leitor.onload = () => resolver(String(leitor.result).replace(/^data:[^,]*,/, ''))
    leitor.onerror = () => rejeitar(new Error('Não foi possível ler a foto.'))
    leitor.readAsDataURL(arquivo)
  })
}
