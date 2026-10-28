import { vendaServiceHttp } from './vendaServiceHttp'
import type { VendaService } from './VendaService'

export type { VendaService } from './VendaService'
export const vendaService: VendaService = vendaServiceHttp
