import type { ArquivoBaixado } from '../../../shared/api/http'
import type {
  DadosCantina,
  DadosLivro,
  DetalheProduto,
  EntradaRegistrada,
  FiltroEstoque,
  FiltroMovimentos,
  FiltroSolicitacoes,
  ItemEstoque,
  LinhaMovimento,
  NovaBaixa,
  NovaEntradaDoacao,
  OpcoesCatalogo,
  ProdutoCadastrado,
  ProdutoSimilar,
  ResultadoAjuste,
  ResumoEntradaDoacao,
  ResumoSolicitacao,
  SolicitacaoRegistrada,
  TipoProduto,
} from '../types'

/** Contrato do módulo Estoque; só a implementação muda ao integrar o backend. */
export interface EstoqueService {
  listar(filtro: FiltroEstoque): Promise<ItemEstoque[]>
  opcoes(): Promise<OpcoesCatalogo>
  similares(nome: string, tipo: TipoProduto, excetoId?: number): Promise<ProdutoSimilar[]>
  detalhe(id: number): Promise<DetalheProduto>
  movimentos(id: number, filtro: FiltroMovimentos): Promise<LinhaMovimento[]>
  cadastrarLivro(dados: DadosLivro): Promise<ProdutoCadastrado>
  atualizarLivro(id: number, dados: DadosLivro): Promise<ProdutoCadastrado>
  alterarPrecoLivro(id: number, preco: number, motivo: string): Promise<ProdutoCadastrado>
  cadastrarCantina(dados: DadosCantina): Promise<ProdutoCadastrado>
  corrigirCantina(id: number, dados: DadosCantina): Promise<ProdutoCadastrado>
  inativar(id: number, motivo: string): Promise<ProdutoCadastrado>
  reativar(id: number): Promise<ProdutoCadastrado>
  excluir(id: number): Promise<void>
  ajustar(id: number, dados: { remessaId: number | null; quantidadeContada: number; motivo: string }): Promise<ResultadoAjuste>
  entradasDoacao(): Promise<ResumoEntradaDoacao[]>
  registrarDoacao(dados: NovaEntradaDoacao): Promise<EntradaRegistrada>
  cancelarDoacao(id: number, motivo: string): Promise<EntradaRegistrada>
  solicitacoes(filtro: FiltroSolicitacoes): Promise<ResumoSolicitacao[]>
  baixarFoto(id: number): Promise<ArquivoBaixado>
  solicitarBaixa(dados: NovaBaixa): Promise<SolicitacaoRegistrada>
  solicitarPreco(produtoId: number, novoPreco: number, motivo: string): Promise<SolicitacaoRegistrada>
  solicitarInativacao(produtoId: number, motivo: string): Promise<SolicitacaoRegistrada>
  cancelarSolicitacao(id: number): Promise<SolicitacaoRegistrada>
  aprovar(id: number): Promise<SolicitacaoRegistrada>
  rejeitar(id: number, motivo: string): Promise<SolicitacaoRegistrada>
}
