import type { ArquivoBaixado } from '../../../shared/api/http'
import type {
  FiltroContagem,
  FiltroEstoqueRelatorio,
  FiltroFluxo,
  FiltroMensalidades,
  FiltroSaldos,
  FiltroVendasRelatorio,
  FiltrosExportacao,
  FluxoCaixa,
  FolhaContagem,
  FormatoExportacao,
  Periodo,
  ReceitasDespesas,
  RelatorioEditoras,
  RelatorioEstoque,
  RelatorioMensalidades,
  RelatorioVendas,
  SaldosPorConta,
  TipoExportacao,
} from '../types'

/** Contrato do módulo Relatórios; só a implementação muda ao integrar o backend. */
export interface RelatorioService {
  fluxoCaixa(filtro: FiltroFluxo): Promise<FluxoCaixa>
  receitasDespesas(periodo: Periodo): Promise<ReceitasDespesas>
  saldos(filtro: FiltroSaldos): Promise<SaldosPorConta>
  mensalidades(filtro: FiltroMensalidades): Promise<RelatorioMensalidades>
  /** O Vendedor recebe as vendas que fez e as do PDV da cantina. */
  vendas(filtro: FiltroVendasRelatorio): Promise<RelatorioVendas>
  estoque(filtro: FiltroEstoqueRelatorio): Promise<RelatorioEstoque>
  contagem(filtro: FiltroContagem): Promise<FolhaContagem>
  editoras(periodo: Periodo): Promise<RelatorioEditoras>
  /** Arquivo com os filtros da tela; a exportação fica registrada na auditoria. */
  exportar(tipo: TipoExportacao, formato: FormatoExportacao, filtros: FiltrosExportacao): Promise<ArquivoBaixado>
}
