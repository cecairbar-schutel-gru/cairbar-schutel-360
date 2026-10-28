import type {
  Checklist,
  DemonstrativoMensal,
  HistoricoPeriodo,
  PainelFechamento,
  PeriodoReaberto,
  ResumoPeriodo,
  SituacaoJanela,
} from '../types'

/** Contrato do módulo Fechamento mensal; só a implementação muda ao integrar o backend. */
export interface FechamentoService {
  painel(): Promise<PainelFechamento>
  periodos(): Promise<ResumoPeriodo[]>
  checklist(mes: string): Promise<Checklist>
  /** Item 5: o Tesoureiro confirma que toda liquidação depositada até o fim do mês foi registrada. */
  confirmarCartao(mes: string): Promise<Checklist>
  /** 409 `CHECKLIST_PENDENTE`, `PERIODO_FORA_DE_ORDEM`, `PERIODO_EM_ANDAMENTO` ou `FORA_DA_JANELA_FECHAMENTO`. */
  fechar(mes: string, nota: string): Promise<HistoricoPeriodo>
  /** Só o Administrador; só o mês fechado mais recente; justificativa com 20 caracteres ou mais. */
  reabrir(mes: string, justificativa: string): Promise<HistoricoPeriodo>
  historico(mes: string): Promise<HistoricoPeriodo>
  /** Sem versão: a vigente (gravada, se fechado; senão, preliminar). */
  demonstrativo(mes: string, versao?: number): Promise<DemonstrativoMensal>
  /** US-CLOSING-014: Tesoureiro ou Administrador. */
  janela(): Promise<SituacaoJanela>
  /** 422 com mais de 7 dias, fim antes do início ou dia fora de 1 a 28. */
  alterarJanela(diaInicio: number, diaFim: number): Promise<SituacaoJanela>
  /** Aviso para todos os perfis. */
  reabertos(): Promise<PeriodoReaberto[]>
}
