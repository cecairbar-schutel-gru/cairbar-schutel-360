import type {
  Apuracao,
  DadosEditora,
  DetalheEditora,
  DetalhePedido,
  DetalheRemessa,
  Devolucao,
  Editora,
  FechamentoEditoras,
  NovaDevolucao,
  NovaRemessa,
  NovoPagamento,
  NovoPedido,
  PreviaPagamento,
  QuadroSaldos,
  ReciboPagamento,
  ResultadoPagamento,
  ResultadoRemessa,
  ResumoEditora,
  ResumoPedido,
  ResumoRemessa,
  SaldoDetalhado,
  SituacaoEditoras,
  SituacaoPedido,
  SituacaoRemessa,
  TituloConsignado,
  TransferenciaSaldo,
} from '../types'

/** Contrato do módulo Editoras; só a implementação muda ao integrar o backend. */
export interface EditoraService {
  listar(situacao: SituacaoEditoras): Promise<ResumoEditora[]>
  editora(id: number): Promise<DetalheEditora>
  cadastrar(dados: DadosEditora): Promise<Editora>
  alterar(id: number, dados: DadosEditora): Promise<Editora>
  inativar(id: number): Promise<Editora>
  reativar(id: number): Promise<Editora>
  excluir(id: number): Promise<void>
  titulos(editoraId: number): Promise<TituloConsignado[]>
  remessas(filtro: { editoraId?: number; situacao?: SituacaoRemessa }): Promise<ResumoRemessa[]>
  registrarRemessa(dados: NovaRemessa): Promise<ResultadoRemessa>
  remessa(id: number): Promise<DetalheRemessa>
  cancelarRemessa(id: number, motivo: string): Promise<ResultadoRemessa>
  pedidos(filtro: { editoraId?: number; situacao?: SituacaoPedido }): Promise<ResumoPedido[]>
  pedido(id: number): Promise<DetalhePedido>
  pedir(dados: NovoPedido): Promise<DetalhePedido>
  cancelarPedido(id: number, motivo: string): Promise<DetalhePedido>
  devolver(remessaId: number, dados: NovaDevolucao): Promise<Devolucao>
  devolucao(id: number): Promise<Devolucao>
  saldos(): Promise<QuadroSaldos>
  saldo(editoraId: number): Promise<SaldoDetalhado>
  /** `mes`: AAAA-MM. */
  apuracao(editoraId: number, mes: string): Promise<Apuracao>
  previa(editoraId: number, valor: number): Promise<PreviaPagamento>
  pagar(dados: NovoPagamento): Promise<ResultadoPagamento>
  recibo(id: number): Promise<ReciboPagamento>
  fechamento(mes: string): Promise<FechamentoEditoras>
  transferirSaldo(editoraId: number, mes: string, nota: string): Promise<TransferenciaSaldo>
}
