import { intencaoServiceHttp } from './intencaoServiceHttp'
import type { IntencaoService } from './IntencaoService'

export type { IntencaoService } from './IntencaoService'
export const intencaoService: IntencaoService = intencaoServiceHttp
