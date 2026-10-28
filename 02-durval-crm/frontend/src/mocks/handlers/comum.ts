import { HttpResponse } from 'msw'
import type { Papel, Usuario } from '../../auth'
import { usuarioDoToken } from '../../auth/authSimulado'
import { ErroNegocio } from '../erroNegocio'

export function usuarioDe(request: Request): Usuario {
  const cabecalho = request.headers.get('Authorization')
  const usuario = usuarioDoToken(cabecalho?.replace('Bearer ', ''))
  if (!usuario) throw new ErroNegocio(401, 'NAO_AUTENTICADO', 'Sessão expirada. Entre novamente.')
  return usuario
}

/** `@PreAuthorize` do backend: responde só "pode acessar o endpoint?". */
export function exigir(request: Request, ...papeis: Papel[]): Usuario {
  const usuario = usuarioDe(request)
  if (!usuario.papeis.some((p) => papeis.includes(p))) {
    throw new ErroNegocio(403, 'ACESSO_NEGADO', 'Você não tem permissão para esta operação.')
  }
  return usuario
}

export function tratar<T>(operacao: () => T): Response {
  try {
    const resultado = operacao()
    return resultado === undefined ? new HttpResponse(null, { status: 204 }) : HttpResponse.json(resultado as object)
  } catch (erro) {
    if (erro instanceof ErroNegocio) {
      return HttpResponse.json(
        { codigo: erro.codigo, mensagem: erro.message, erros: erro.erros },
        { status: erro.status },
      )
    }
    throw erro
  }
}
