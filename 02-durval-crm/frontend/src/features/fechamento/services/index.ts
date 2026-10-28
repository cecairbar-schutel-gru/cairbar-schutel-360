import { fechamentoServiceHttp } from './fechamentoServiceHttp'
import type { FechamentoService } from './FechamentoService'

export type { FechamentoService } from './FechamentoService'
export const fechamentoService: FechamentoService = fechamentoServiceHttp
