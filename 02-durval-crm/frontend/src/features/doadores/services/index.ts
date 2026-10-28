import { doadorServiceHttp } from './doadorServiceHttp'
import type { DoadorService } from './DoadorService'

export type { DoadorService } from './DoadorService'
export const doadorService: DoadorService = doadorServiceHttp
