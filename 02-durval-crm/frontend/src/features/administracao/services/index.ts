import { administracaoServiceHttp } from './administracaoServiceHttp'
import type { AdministracaoService } from './AdministracaoService'

export type { AdministracaoService } from './AdministracaoService'
export const administracaoService: AdministracaoService = administracaoServiceHttp
