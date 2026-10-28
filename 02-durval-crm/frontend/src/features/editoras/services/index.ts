import { editoraServiceHttp } from './editoraServiceHttp'
import type { EditoraService } from './EditoraService'

export type { EditoraService } from './EditoraService'
export const editoraService: EditoraService = editoraServiceHttp
