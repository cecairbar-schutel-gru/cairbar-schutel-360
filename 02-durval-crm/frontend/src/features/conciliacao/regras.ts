import {
  lerValor,
  paraCentavos,
  paraReais,
} from '../../shared/pagamento/regras'
import type { TipoCategoria } from '../financeiro/types'
import type { ItemConciliacao, LinhaDoExtrato } from './types'

/** Categorias típicas do lançamento ausente (US-RECONCILIATION-005). */
export const CATEGORIA_SUGERIDA: Record<
  TipoCategoria,
  { codigo: string; nome: string }
> = {
  DESPESA: {
    codigo: 'OUTRAS_DESPESAS.TAXAS_BANCARIAS',
    nome: 'Outras despesas › Taxas bancárias',
  },
  RECEITA: {
    codigo: 'OUTRAS_RECEITAS.OUTRAS_ENTRADAS',
    nome: 'Outras receitas › Outras entradas',
  },
}

export interface FiltroSessao {
  de: string
  ate: string
  /** Valor digitado; compara o valor absoluto. */
  valor: string
  texto: string
  mostrarMarcados: boolean
}

export const FILTRO_VAZIO: FiltroSessao = {
  de: '',
  ate: '',
  valor: '',
  texto: '',
  mostrarMarcados: true,
}

const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/** Filtros da lista (US-RECONCILIATION-003): período, valor, texto e "Mostrar marcados". */
export function filtrarLancamentos(
  itens: ItemConciliacao[],
  f: FiltroSessao,
): ItemConciliacao[] {
  const centavos = lerValor(f.valor)
  const valor = centavos === null || Number.isNaN(centavos) ? null : centavos
  const texto = normalizar(f.texto)
  return itens.filter(
    (l) =>
      (f.mostrarMarcados || !l.marcado) &&
      (!f.de || l.data >= f.de) &&
      (!f.ate || l.data <= f.ate) &&
      (valor === null || Math.abs(paraCentavos(l.valor)) === valor) &&
      (!texto ||
        normalizar(l.descricao).includes(texto) ||
        String(l.id) === texto),
  )
}

/** Saldo do extrato digitado; a conta bancária pode estar negativa ("-150,00"). */
export function lerSaldo(texto: string): number | null {
  const limpo = texto.trim()
  const negativo = limpo.startsWith('-')
  const centavos = lerValor(negativo ? limpo.slice(1) : limpo)
  if (centavos === null) return null
  if (Number.isNaN(centavos)) return Number.NaN
  return paraReais(negativo ? -centavos : centavos)
}

/** Distância máxima, em dias, entre a linha do extrato e o lançamento sugerido. */
export const TOLERANCIA_DIAS = 3

interface Movimento {
  id: number
  data: string
  valor: number
}

const dias = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000,
  )
const porDataEId = (a: Movimento, b: Movimento) =>
  a.data.localeCompare(b.data) || a.id - b.id

/**
 * Sugestões linha do extrato → lançamento (mesmo cálculo do backend): mesmo valor e até
 * {@link TOLERANCIA_DIAS} dias, a menor distância primeiro e, no empate, o lançamento mais antigo.
 * Cada lançamento entra em um par só.
 */
export function sugerirPares(
  linhas: Movimento[],
  lancamentos: Movimento[],
): Map<number, number> {
  const ordenadas = [...linhas].sort(porDataEId)
  const candidatos = [...lancamentos].sort(porDataEId)
  const pares = new Map<number, number>()
  const usados = new Set<number>()
  for (let d = 0; d <= TOLERANCIA_DIAS; d++) {
    for (const linha of ordenadas) {
      if (pares.has(linha.id)) continue
      const achado = candidatos.find(
        (l) =>
          !usados.has(l.id) &&
          paraCentavos(l.valor) === paraCentavos(linha.valor) &&
          Math.abs(dias(linha.data, l.data)) === d,
      )
      if (achado) {
        pares.set(linha.id, achado.id)
        usados.add(achado.id)
      }
    }
  }
  return pares
}

/** Diferença zerada, sem resíduo de ponto flutuante. */
export const diferencaZerada = (diferenca: number) =>
  paraCentavos(diferenca) === 0

/** Soma dos movimentos, em reais (centavos inteiros na conta). */
export const somar = (itens: { valor: number }[]) =>
  paraReais(itens.reduce((s, l) => s + paraCentavos(l.valor), 0))

/** Situação da linha do extrato importado na sessão. */
export type SituacaoLinha =
  'CONFERIDA' | 'SUGESTAO' | 'SEM_LANCAMENTO' | 'FORA_DO_PERIODO'

export function situacaoDaLinha(
  l: LinhaDoExtrato,
  dataFim: string,
): SituacaoLinha {
  if (l.lancamentoId !== null) return 'CONFERIDA'
  if (l.data > dataFim) return 'FORA_DO_PERIODO'
  return l.sugestaoId !== null ? 'SUGESTAO' : 'SEM_LANCAMENTO'
}
