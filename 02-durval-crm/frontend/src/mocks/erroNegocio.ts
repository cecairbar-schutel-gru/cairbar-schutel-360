import type { ErroCampo } from '../shared/api/http'

/** Erro de regra de negócio ou validação lançado pelos stores mock. */
export class ErroNegocio extends Error {
  readonly status: number
  readonly codigo: string
  readonly erros: ErroCampo[]

  constructor(status: number, codigo: string, mensagem: string, erros: ErroCampo[] = []) {
    super(mensagem)
    this.status = status
    this.codigo = codigo
    this.erros = erros
  }
}
