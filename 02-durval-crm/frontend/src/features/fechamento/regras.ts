import type { CodigoItem, SaldoContaMes, Variacao } from './types'

/** Disparado ao fechar ou reabrir um período, para o aviso de período reaberto se atualizar. */
export const EVENTO_PERIODOS = 'durvalcrm:periodos-alterados'

/** US-CLOSING-009: justificativa da reabertura com pelo menos 20 caracteres. */
export const MINIMO_JUSTIFICATIVA = 20

export function justificativaValida(texto: string): boolean {
  const t = texto.trim().replace(/\s+/g, ' ')
  return t.length >= MINIMO_JUSTIFICATIVA && t.length <= 1000
}

/** US-CLOSING-014: janela de 1 a 7 dias seguidos, entre os dias 1 e 28 (existem em todo mês). */
export const MAXIMO_DIAS_JANELA = 7
export const ULTIMO_DIA_JANELA = 28

/** O erro da janela escolhida, no campo do último dia; nulo quando ela é válida. */
export function erroJanela(diaInicio: number, diaFim: number): string | null {
  if (diaFim < diaInicio) return 'O último dia não pode ser antes do primeiro.'
  if (diaFim - diaInicio + 1 > MAXIMO_DIAS_JANELA) return `A janela tem no máximo ${MAXIMO_DIAS_JANELA} dias.`
  return null
}

/** Tela que resolve cada item do checklist (o fechamento não aprova nada). */
export function linkDoItem(codigo: CodigoItem, mes: string): string {
  switch (codigo) {
    case 'CONCILIACAO':
      return '/conciliacao'
    case 'INTENCOES':
      return '/intencoes-gasto/aprovacao'
    case 'ESTOQUE':
      return '/estoque/solicitacoes'
    case 'EDITORAS':
      return `/editoras/fechamento?mes=${mes}`
    case 'CARTAO':
      return '/financeiro/liquidacao-cartao'
  }
}

/** Participação da linha no total (0 a 100), para as barras do wireframe 12. */
export function participacao(valor: number, total: number): number {
  if (total <= 0 || valor <= 0) return 0
  return Math.min(100, Math.round((valor / total) * 100))
}

/** "+12,5%" / "−30,0%" / "—" (sem valor no mês anterior). */
export function formatarPercentual(v: Variacao): string {
  if (v.percentual === null) return '—'
  const texto = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(v.percentual))
  return `${v.percentual > 0 ? '+' : v.percentual < 0 ? '−' : ''}${texto}%`
}

/** Soma das colunas da tabela de saldos por conta. */
export function totaisDasContas(contas: SaldoContaMes[]): Omit<SaldoContaMes, 'contaId' | 'nome' | 'tipo'> {
  const somar = (f: (c: SaldoContaMes) => number) => Math.round(contas.reduce((s, c) => s + Math.round(f(c) * 100), 0)) / 100
  return {
    saldoInicial: somar((c) => c.saldoInicial),
    entradas: somar((c) => c.entradas),
    saidas: somar((c) => c.saidas),
    transferenciasEntrada: somar((c) => c.transferenciasEntrada),
    transferenciasSaida: somar((c) => c.transferenciasSaida),
    saldoFinal: somar((c) => c.saldoFinal),
  }
}

/** "2026-09" → "09/2026", como no aviso de período reaberto. */
export function mesCurto(mes: string): string {
  const [a, m] = mes.split('-')
  return `${m}/${a}`
}
