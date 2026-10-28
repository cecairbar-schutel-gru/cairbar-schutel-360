import { financeiroServiceHttp } from './financeiroServiceHttp'
import type { FinanceiroService } from './FinanceiroService'

export type { FinanceiroService } from './FinanceiroService'
export const financeiroService: FinanceiroService = financeiroServiceHttp
