import type { TipoConta } from '../financeiro/types'
import { hoje, paraIsoData } from '../../shared/formatters/datas'
import { deslocarMes } from '../editoras/regras'
import { nomeDoMes } from '../financeiro/regras'
import type { Agrupamento, LinhaEstoque, MotivoBaixaRelatorio, Periodo } from './types'

export const ROTULO_AGRUPAMENTO: Record<Agrupamento, string> = { DIA: 'Por dia', SEMANA: 'Por semana', MES: 'Por mês' }
export const ROTULO_GRUPO_CONTAS: Record<TipoConta, string> = { CAIXA: 'Caixas', BANCO: 'Bancos', CARTAO_A_RECEBER: 'Cartão a receber' }
export const ROTULO_MOTIVO: Record<MotivoBaixaRelatorio, string> = { VENCIMENTO: 'Vencimento', DANO: 'Dano', EXTRAVIO: 'Extravio' }

const DATA = /^\d{4}-\d{2}-\d{2}$/
const MES = /^\d{4}-(0[1-9]|1[0-2])$/

export function mesAtual(): string {
  return paraIsoData(hoje()).slice(0, 7)
}

export function ultimoDia(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return paraIsoData(new Date(a, m, 0))
}

export function periodoDoMes(mes: string): Periodo {
  return { de: `${mes}-01`, ate: ultimoDia(mes) }
}

/** O mês, quando o período é exatamente um mês inteiro. */
export function mesDoPeriodo(p: Periodo): string | null {
  const mes = p.de.slice(0, 7)
  return p.de === `${mes}-01` && p.ate === ultimoDia(mes) ? mes : null
}

/** "Outubro/2026" ou "01/10/2026 a 15/10/2026". */
export function descreverPeriodo(p: Periodo): string {
  const mes = mesDoPeriodo(p)
  if (mes) return nomeDoMes(mes)
  const br = (d: string) => d.split('-').reverse().join('/')
  return p.de === p.ate ? br(p.de) : `${br(p.de)} a ${br(p.ate)}`
}

/** Período da URL (`de`/`ate`); sem ele, ou inválido, o mês atual (regra comum dos relatórios). */
export function lerPeriodo(parametros: URLSearchParams): Periodo {
  const de = parametros.get('de') ?? ''
  const ate = parametros.get('ate') ?? ''
  if (DATA.test(de) && DATA.test(ate) && de <= ate) return { de, ate }
  const mes = parametros.get('mes') ?? ''
  return periodoDoMes(MES.test(mes) ? mes : mesAtual())
}

/** Os 24 meses mais recentes, do atual para trás (seletor de mês do wireframe 12). */
export function mesesRecentes(quantidade = 24): string[] {
  const atual = mesAtual()
  return Array.from({ length: quantidade }, (_, i) => deslocarMes(atual, -i))
}

/** "45,3%" ou "—" (sem total). */
export function formatarPercentual(valor: number | null): string {
  if (valor === null) return '—'
  return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(valor)}%`
}

/** Valor da barra de participação (0 a 100); negativos e nulos ficam em zero. */
export function larguraDaBarra(percentual: number | null): number {
  if (percentual === null || percentual <= 0) return 0
  return Math.min(100, percentual)
}

function comConsulta(caminho: string, consulta: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(consulta)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  return q.size > 0 ? `${caminho}?${q.toString()}` : caminho
}

/** Drill-down para os lançamentos (US-FINANCIAL-005) que formam um total. */
export function linkLancamentos(filtro: { de: string; ate: string; categoria?: string; contaId?: number | null; natureza?: string }): string {
  return comConsulta('/financeiro/lancamentos', filtro)
}

/** Drill-down para a lista de vendas (US-SALES-011). */
export function linkVendas(filtro: { de: string; ate: string; status?: string }): string {
  return comConsulta('/vendas', filtro)
}

/** Drill-down para o histórico de movimentos do produto (US-INVENTORY-010). */
export function linkMovimentos(produtoId: number, p: Periodo): string {
  return comConsulta(`/estoque/produtos/${produtoId}`, { de: p.de, ate: p.ate })
}

export function linkRelatorio(caminho: string, filtros: Record<string, string | number | boolean | undefined | null>): string {
  return comConsulta(caminho, Object.fromEntries(Object.entries(filtros).map(([k, v]) => [k, typeof v === 'boolean' ? (v ? 'true' : undefined) : v])))
}

/** inicial + entradas − saídas + ajustes = final (conferência das linhas do relatório de estoque). */
export function fechaEstoque(l: LinhaEstoque): boolean {
  return l.inicial + l.compra + l.doacao + l.remessa - l.venda - l.devolucao - l.baixa + l.ajuste === l.fim
}

/** "Consignado R-2026-0001 (Editora Luz)" ou "Próprio". */
export function descreverOrigem(l: LinhaEstoque): string {
  if (l.origem !== 'CONSIGNADO') return 'Próprio'
  return `Consignado ${l.remessaCodigo ?? ''}${l.editoraNome ? ` (${l.editoraNome})` : ''}`.trim()
}
