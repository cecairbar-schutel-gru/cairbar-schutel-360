import { relatorioServiceHttp } from './relatorioServiceHttp'
import type { RelatorioService } from './RelatorioService'

export type { RelatorioService } from './RelatorioService'
export const relatorioService: RelatorioService = relatorioServiceHttp
