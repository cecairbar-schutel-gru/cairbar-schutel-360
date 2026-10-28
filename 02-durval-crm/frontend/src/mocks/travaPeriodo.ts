import { ErroNegocio } from './erroNegocio'

/**
 * Espelho do `PeriodoFinanceiroPort` do backend (US-CLOSING-008): a trava única dos meses fechados,
 * consultada pelos lançamentos, pela conciliação e pelas remessas e devoluções. Mantida pelo banco
 * simulado do Fechamento mensal.
 */
const fechados = new Set<string>()

export const travaPeriodo = {
  estaFechado(mes: string): boolean {
    return fechados.has(mes)
  },

  /** Código PERIODO_FECHADO (409) se a data (`AAAA-MM-DD` ou `AAAA-MM`) cai num mês fechado. */
  exigirAberto(data: string | null | undefined): void {
    if (!data) return
    const mes = data.slice(0, 7)
    if (!fechados.has(mes)) return
    const [a, m] = mes.split('-')
    throw new ErroNegocio(409, 'PERIODO_FECHADO', `O mês de ${m}/${a} está fechado. Use uma data do período aberto ou peça ao Administrador a reabertura.`)
  },

  fechar(mes: string): void {
    fechados.add(mes)
  },

  abrir(mes: string): void {
    fechados.delete(mes)
  },

  reiniciar(): void {
    fechados.clear()
  },
}
