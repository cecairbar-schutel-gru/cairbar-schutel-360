import type { ArquivoBaixado } from '../../../shared/api/http'
import type {
  CanalAgradecimento,
  ContribuicaoRegistrada,
  HistoricoContribuicoes,
  LayoutRecibo,
  NovaContribuicao,
  OpcoesPagamento,
  PainelOperador,
  Recibo,
  SituacaoGeracao,
} from '../types'

/** Contrato do módulo Contribuições; só a implementação muda ao integrar o backend. */
export interface ContribuicaoService {
  opcoesPagamento(): Promise<OpcoesPagamento>
  registrar(dados: NovaContribuicao): Promise<ContribuicaoRegistrada>
  obterRecibo(id: number, segundaVia: boolean): Promise<Recibo>
  baixarReciboPdf(
    id: number,
    layout: LayoutRecibo,
    segundaVia: boolean,
  ): Promise<ArquivoBaixado>
  localizarPorRecibo(numero: string): Promise<{ id: number }>
  registrarMensagemPreparada(
    id: number,
    canal: CanalAgradecimento,
  ): Promise<void>
  cancelar(id: number, motivo: string): Promise<ContribuicaoRegistrada>
  historico(doadorId: number, ano?: number): Promise<HistoricoContribuicoes>
  painelOperador(): Promise<PainelOperador>
  situacaoGeracao(): Promise<SituacaoGeracao>
}
