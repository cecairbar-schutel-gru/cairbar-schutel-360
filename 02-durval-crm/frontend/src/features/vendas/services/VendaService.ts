import type { ArquivoBaixado } from '../../../shared/api/http'
import type {
  DetalheVenda,
  FiltroVendas,
  LayoutComprovante,
  NovaVenda,
  OpcoesVenda,
  PainelVendedor,
  ProdutoVendavel,
  ResumoVenda,
  TipoProduto,
  VendaParaRefazer,
  VendaRegistrada,
} from '../types'

/** Contrato do módulo Vendas; só a implementação muda ao integrar o backend. */
export interface VendaService {
  opcoes(): Promise<OpcoesVenda>
  buscarProdutos(termo: string, tipo?: TipoProduto): Promise<ProdutoVendavel[]>
  confirmar(dados: NovaVenda): Promise<VendaRegistrada>
  listar(filtro: FiltroVendas): Promise<ResumoVenda[]>
  detalhe(id: number): Promise<DetalheVenda>
  /** Última venda registrada pelo próprio usuário (PDV); `null` se ele ainda não vendeu. */
  ultima(): Promise<DetalheVenda | null>
  baixarComprovantePdf(id: number, layout: LayoutComprovante): Promise<ArquivoBaixado>
  cancelar(id: number, motivo: string): Promise<VendaRegistrada>
  paraRefazer(id: number): Promise<VendaParaRefazer>
  painelVendedor(): Promise<PainelVendedor>
}
