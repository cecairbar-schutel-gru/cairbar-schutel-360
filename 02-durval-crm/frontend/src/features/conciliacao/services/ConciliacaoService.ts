import type { ResultadoLancamento } from '../../financeiro/types'
import type {
  ContaParaConciliar,
  ImportacaoExtrato,
  NovoLancamentoConciliacao,
  ParExtrato,
  ResumoConciliacao,
  SessaoConciliacao,
} from '../types'

/** Contrato do módulo Conciliação bancária; só a implementação muda ao integrar o backend. */
export interface ConciliacaoService {
  contas(): Promise<ContaParaConciliar[]>
  /** 409 `CONCILIACAO_EM_ANDAMENTO` se a conta já tem sessão aberta. */
  iniciar(
    contaId: number,
    dataFim: string,
    saldoExtrato: number,
  ): Promise<SessaoConciliacao>
  sessao(id: number): Promise<SessaoConciliacao>
  alterarExtrato(
    id: number,
    dataFim: string,
    saldoExtrato: number,
  ): Promise<SessaoConciliacao>
  /** Grava na hora; devolve a sessão com o resumo atualizado. */
  marcar(
    id: number,
    lancamentoIds: number[],
    marcado: boolean,
  ): Promise<SessaoConciliacao>
  adicionarLancamento(
    id: number,
    dados: NovoLancamentoConciliacao,
  ): Promise<ResultadoLancamento>
  /** Extrato lido no navegador; ficam as linhas do período da sessão e substitui o importado antes. */
  importarExtrato(
    id: number,
    dados: ImportacaoExtrato,
  ): Promise<SessaoConciliacao>
  /** Confirma pares linha → lançamento: o lançamento fica marcado. */
  confirmarPares(id: number, pares: ParExtrato[]): Promise<SessaoConciliacao>
  /** Desfaz o par da linha e desmarca o lançamento. */
  desfazerPar(id: number, linhaId: number): Promise<SessaoConciliacao>
  concluir(id: number): Promise<SessaoConciliacao>
  /** Sessões concluídas; sem conta, de todas. */
  historico(contaId?: number): Promise<ResumoConciliacao[]>
}
