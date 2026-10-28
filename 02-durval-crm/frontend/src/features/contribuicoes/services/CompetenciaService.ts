import { requisitar } from '../../../shared/api/http'
import type { Competencia, PainelCompetencias } from '../types'

/** Contrato de consulta de competências (módulo Contribuições, US-CONTRIB-002). */
export interface CompetenciaService {
  listarPorDoador(doadorId: number): Promise<Competencia[]>
  /** Pendentes, próximos 12 meses e histórico recente; `completo` inclui as mais antigas. */
  painel(doadorId: number, completo?: boolean): Promise<PainelCompetencias>
}

export const competenciaService: CompetenciaService = {
  listarPorDoador: (doadorId) => requisitar(`/doadores/${doadorId}/competencias`),
  painel: (doadorId, completo = false) =>
    requisitar(`/doadores/${doadorId}/competencias/painel`, {
      consulta: { completo: completo ? 'true' : undefined },
    }),
}
