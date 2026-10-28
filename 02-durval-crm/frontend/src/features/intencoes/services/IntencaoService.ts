import type { ArquivoBaixado } from '../../../shared/api/http'
import type {
  Contadores,
  DadosAprovacao,
  DetalheIntencao,
  FiltroFila,
  ItemQuantidade,
  NovaIntencao,
  OpcoesIntencao,
  ResultadoAcao,
  ResumoIntencao,
  StatusIntencao,
} from '../types'

/** Contrato do módulo Intenções de gasto; só a implementação muda ao integrar o backend. */
export interface IntencaoService {
  opcoes(): Promise<OpcoesIntencao>
  criar(dados: NovaIntencao): Promise<ResultadoAcao>
  minhas(status?: StatusIntencao): Promise<ResumoIntencao[]>
  /** Marca a visita a "Minhas intenções" (destaque do que mudou depois). */
  registrarVisita(): Promise<void>
  fila(filtro: FiltroFila): Promise<ResumoIntencao[]>
  contadores(): Promise<Contadores>
  recebimentos(): Promise<ResumoIntencao[]>
  intencao(id: number): Promise<DetalheIntencao>
  baixarAnexo(id: number, ordem: number): Promise<ArquivoBaixado>
  retirar(id: number, motivo: string): Promise<ResultadoAcao>
  aprovar(id: number, dados: DadosAprovacao): Promise<ResultadoAcao>
  rejeitar(id: number, motivo: string): Promise<ResultadoAcao>
  receber(id: number, itens: ItemQuantidade[], divergencia: string): Promise<ResultadoAcao>
  /** `valor` nulo: o valor pago não mudou. */
  corrigir(id: number, itens: ItemQuantidade[], valor: number | null, motivo: string): Promise<ResultadoAcao>
  cancelar(id: number, motivo: string): Promise<ResultadoAcao>
}
