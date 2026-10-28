import { ApiError } from '../../../shared/api/http'

/** Mapa campo -> mensagem a partir de um erro de validação da API. */
export function errosPorCampo(erro: unknown): Record<string, string> {
  if (!(erro instanceof ApiError)) return {}
  return Object.fromEntries(erro.erros.map((e) => [e.campo, e.mensagem]))
}
