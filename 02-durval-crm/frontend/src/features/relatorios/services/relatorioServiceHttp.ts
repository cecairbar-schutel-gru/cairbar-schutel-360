import { baixarArquivo, requisitar } from '../../../shared/api/http'
import type { RelatorioService } from './RelatorioService'

type Consulta = Record<string, string | number | undefined | null>

/** Booleanos viram texto; `false` não é enviado. */
function consulta(filtros: object): Consulta {
  const c: Consulta = {}
  for (const [chave, valor] of Object.entries(filtros)) {
    c[chave] = typeof valor === 'boolean' ? (valor ? 'true' : undefined) : (valor as Consulta[string])
  }
  return c
}

const TIPOS_ARQUIVO = 'application/pdf, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json'

export const relatorioServiceHttp: RelatorioService = {
  fluxoCaixa: (f) => requisitar('/relatorios/fluxo-caixa', { consulta: consulta(f) }),
  receitasDespesas: (p) => requisitar('/relatorios/receitas-despesas', { consulta: consulta(p) }),
  saldos: (f) => requisitar('/relatorios/saldos', { consulta: consulta(f) }),
  mensalidades: (f) => requisitar('/relatorios/mensalidades', { consulta: consulta(f) }),
  vendas: (f) => requisitar('/relatorios/vendas', { consulta: consulta(f) }),
  estoque: (f) => requisitar('/relatorios/estoque', { consulta: consulta(f) }),
  contagem: (f) => requisitar('/relatorios/estoque/contagem', { consulta: consulta(f) }),
  editoras: (p) => requisitar('/relatorios/editoras', { consulta: consulta(p) }),
  exportar: (tipo, formato, filtros) =>
    baixarArquivo(`/relatorios/exportacoes/${tipo}`, { ...consulta(filtros), formato }, TIPOS_ARQUIVO),
}
