import { contasPagarServiceHttp } from './contasPagarServiceHttp'
import type { ContasPagarService } from './ContasPagarService'

export type { ContasPagarService } from './ContasPagarService'
export const contasPagarService: ContasPagarService = contasPagarServiceHttp
