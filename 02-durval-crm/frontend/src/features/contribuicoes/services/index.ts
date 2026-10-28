import { contribuicaoServiceHttp } from './contribuicaoServiceHttp'
import type { ContribuicaoService } from './ContribuicaoService'

export type { ContribuicaoService } from './ContribuicaoService'
export { competenciaService } from './CompetenciaService'
export const contribuicaoService: ContribuicaoService = contribuicaoServiceHttp
