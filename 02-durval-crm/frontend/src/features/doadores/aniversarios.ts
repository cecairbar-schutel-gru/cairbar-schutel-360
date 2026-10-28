import { paraIsoData } from '../../shared/formatters/datas'

export type FiltroAniversario = 'HOJE' | 'SEMANA' | 'MES' | 'PROXIMO_MES'

export const ROTULO_FILTRO_ANIVERSARIO: Record<FiltroAniversario, string> = {
  HOJE: 'Hoje',
  SEMANA: 'Esta semana',
  MES: 'Este mês',
  PROXIMO_MES: 'Próximo mês',
}

/** Intervalo `[de, ate]` (AAAA-MM-DD). A semana vai de domingo a sábado. */
export function intervaloDoFiltro(
  filtro: FiltroAniversario,
  referencia: Date,
): { de: string; ate: string } {
  const a = referencia.getFullYear()
  const m = referencia.getMonth()
  const d = referencia.getDate()
  switch (filtro) {
    case 'HOJE':
      return { de: paraIsoData(referencia), ate: paraIsoData(referencia) }
    case 'SEMANA': {
      const dia = referencia.getDay()
      return {
        de: paraIsoData(new Date(a, m, d - dia)),
        ate: paraIsoData(new Date(a, m, d - dia + 6)),
      }
    }
    case 'MES':
      return {
        de: paraIsoData(new Date(a, m, 1)),
        ate: paraIsoData(new Date(a, m + 1, 0)),
      }
    case 'PROXIMO_MES':
      return {
        de: paraIsoData(new Date(a, m + 1, 1)),
        ate: paraIsoData(new Date(a, m + 2, 0)),
      }
  }
}
