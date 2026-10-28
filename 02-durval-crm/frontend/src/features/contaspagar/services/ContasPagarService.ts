import type {
  ContaPagar,
  DadosContaPagar,
  DetalheContaPagar,
  NovoPagamentoConta,
  Parcela,
  ResultadoPagamentoConta,
  ResumoContaPagar,
  ResumoContasPagar,
  SituacaoContas,
} from '../types'

/** Contas a pagar da Tesouraria (mesmo contrato de `ContaPagarController` no backend). */
export interface ContasPagarService {
  listar(situacao: SituacaoContas): Promise<ResumoContaPagar[]>
  conta(id: number): Promise<DetalheContaPagar>
  cadastrar(dados: DadosContaPagar): Promise<ContaPagar>
  alterar(id: number, dados: DadosContaPagar): Promise<ContaPagar>
  encerrar(id: number): Promise<ContaPagar>
  reativar(id: number): Promise<ContaPagar>
  excluir(id: number): Promise<void>
  /** Vencimentos do período (AAAA-MM-DD); com `incluirVencidas`, também os vencidos de antes. */
  parcelas(de: string, ate: string, incluirVencidas: boolean): Promise<Parcela[]>
  resumo(): Promise<ResumoContasPagar>
  pagar(dados: NovoPagamentoConta): Promise<ResultadoPagamentoConta>
}
