/**
 * Histórico do valor da mensalidade simulado (US-ADMIN-002): o valor de um mês é o do último registro
 * vigente até ele. Mantido pela Administração; lido pelas competências e contribuições simuladas.
 */
export interface ValorMensalidadeMock {
  id: number
  valor: number
  /** AAAA-MM */
  vigenteDe: string
  motivo: string | null
  autor: { subject: string; nome: string | null; em: string }
}

const inicial = (): ValorMensalidadeMock[] => [
  {
    id: 1,
    valor: 50,
    vigenteDe: '2025-01',
    motivo: 'Valor da instalação',
    autor: { subject: 'sistema', nome: 'Sistema', em: '2025-01-01T03:00:00.000Z' },
  },
]

/** Do mais antigo ao mais recente. */
export const VALORES_MENSALIDADE: ValorMensalidadeMock[] = inicial()

export function reiniciarValoresMensalidade(): void {
  VALORES_MENSALIDADE.length = 0
  VALORES_MENSALIDADE.push(...inicial())
}

export function valorMensalidade(mes: string): number {
  const ordenados = [...VALORES_MENSALIDADE].sort((a, b) => a.vigenteDe.localeCompare(b.vigenteDe))
  let escolhido = ordenados[0]
  for (const v of ordenados) if (v.vigenteDe <= mes) escolhido = v
  return escolhido.valor
}
