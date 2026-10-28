import type { ArquivoBaixado } from '../../../shared/api/http'
import type {
  Categoria,
  ContaFinanceira,
  ContasRecebimento,
  Correcao,
  DadosConta,
  DetalheLancamento,
  FiltroLancamentos,
  NovaLiquidacao,
  NovaTransferencia,
  NovoLancamentoManual,
  PaginaLancamentos,
  PainelTesoureiro,
  QuadroSaldos,
  SaldoCartaoAReceber,
  ResultadoEstorno,
  ResultadoLancamento,
} from '../types'

/** Contrato do módulo Financeiro; só a implementação muda ao integrar o backend. */
export interface FinanceiroService {
  contas(): Promise<ContaFinanceira[]>
  conta(id: number): Promise<ContaFinanceira>
  cadastrarConta(dados: DadosConta): Promise<ContaFinanceira>
  alterarConta(id: number, dados: DadosConta): Promise<ContaFinanceira>
  inativarConta(id: number): Promise<ContaFinanceira>
  reativarConta(id: number): Promise<ContaFinanceira>
  excluirConta(id: number): Promise<void>
  /** Sem data: saldos de agora. */
  saldos(data?: string): Promise<QuadroSaldos>
  categorias(): Promise<Categoria[]>
  transferir(dados: NovaTransferencia): Promise<ResultadoLancamento>
  /** Saldo atual de Cartão a receber por tipo (crédito, débito, não informado). */
  cartaoAReceber(): Promise<SaldoCartaoAReceber>
  liquidarCartao(dados: NovaLiquidacao): Promise<ResultadoLancamento>
  lancarManual(dados: NovoLancamentoManual): Promise<ResultadoLancamento>
  /** `pagina` começa em zero; 50 por página. */
  lancamentos(filtro: FiltroLancamentos, pagina: number): Promise<PaginaLancamentos>
  lancamento(id: number): Promise<DetalheLancamento>
  baixarAnexo(id: number): Promise<ArquivoBaixado>
  estornar(id: number, motivo: string, correcao: Correcao | null): Promise<ResultadoEstorno>
  reclassificar(id: number, ordem: number, categoria: string, motivo: string): Promise<DetalheLancamento>
  contasRecebimento(): Promise<ContasRecebimento>
  /** Só o Administrador; `null` deixa a forma sem conta. */
  definirContasRecebimento(dinheiroContaId: number | null, pixContaId: number | null): Promise<ContasRecebimento>
  painelTesoureiro(): Promise<PainelTesoureiro>
}
