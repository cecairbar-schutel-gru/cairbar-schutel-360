import { estoqueServiceHttp } from './estoqueServiceHttp'
import type { EstoqueService } from './EstoqueService'

export type { EstoqueService } from './EstoqueService'
export const estoqueService: EstoqueService = estoqueServiceHttp
