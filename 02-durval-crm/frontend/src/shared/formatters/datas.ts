const FUSO = 'America/Sao_Paulo'

const DIA_MS = 24 * 60 * 60 * 1000
/** Dias inteiros entre o relógio do servidor e o do navegador (data simulada de DEV). */
let deslocamentoDias = 0

/** Data atual; centralizada para facilitar testes com relógio simulado. */
export function hoje(): Date {
  return new Date(Date.now() + deslocamentoDias * DIA_MS)
}

/** Alinha `hoje()` ao "hoje" do servidor (`AAAA-MM-DD`), mantendo a hora do navegador. */
export function alinharHojeAoServidor(hojeServidor: string) {
  const local = dePartesIso(paraIsoData(new Date()))
  deslocamentoDias = Math.round((dePartesIso(hojeServidor).getTime() - local.getTime()) / DIA_MS)
}

export function paraIsoData(data: Date): string {
  const a = data.getFullYear()
  const m = String(data.getMonth() + 1).padStart(2, '0')
  const d = String(data.getDate()).padStart(2, '0')
  return `${a}-${m}-${d}`
}

export function dePartesIso(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(a, m - 1, d)
}

/** dd/mm/aaaa a partir de `AAAA-MM-DD` (sem deslocamento de fuso). */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

/** dd/mm/aaaa hh:mm a partir de um instante ISO. */
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: FUSO,
  })
    .format(new Date(iso))
    .replace(',', '')
}

/** dd/mm/aaaa do dia em que um instante ISO ocorreu, no fuso da organização. */
export function formatarDataDoInstante(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: FUSO }).format(new Date(iso))
}

/** `AAAA-MM` -> `mm/aaaa`. */
export function formatarCompetencia(competencia: string): string {
  const [a, m] = competencia.split('-')
  return `${m}/${a}`
}

/** dia/mês de uma data `AAAA-MM-DD`. */
export function formatarDiaMes(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}`
}
