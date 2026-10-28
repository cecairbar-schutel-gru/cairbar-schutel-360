import { conciliacaoServiceHttp } from './conciliacaoServiceHttp'
import type { ConciliacaoService } from './ConciliacaoService'

export type { ConciliacaoService } from './ConciliacaoService'
export const conciliacaoService: ConciliacaoService = conciliacaoServiceHttp
