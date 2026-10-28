import { http, HttpResponse, type HttpHandler } from 'msw'
import type { Papel, Usuario } from '../../auth'
import type { DadosOrganizacao, DecisaoDuplicata, EnvioImportacao, NovaCategoria, NovoValorMensalidade, TextosModelo, TipoImportacao, TipoModelo } from '../../features/administracao/types'
import { bancoAdministracao } from '../bancoAdministracao'
import { exigir, tratar, usuarioDe } from './comum'

const ADMIN = 'administrador'
const corpo = async <T>(request: Request): Promise<T> => {
  try {
    return (await request.json()) as T
  } catch {
    return {} as T
  }
}

/** Perfil em uso enviado pelo frontend (`X-Perfil-Ativo`), aceito só se o usuário tiver o papel. */
function perfil(request: Request, usuario: Usuario): Papel | null {
  const p = request.headers.get('X-Perfil-Ativo') as Papel | null
  return p && usuario.papeis.includes(p) ? p : null
}

function comPerfil<T>(request: Request, papeis: Papel[], operacao: (u: Usuario, p: Papel | null) => T): Response {
  return tratar(() => {
    const u = exigir(request, ...papeis)
    return operacao(u, perfil(request, u))
  })
}

export const handlersAdministracao: HttpHandler[] = [
  http.get('*/api/administracao/painel', ({ request }) => comPerfil(request, [ADMIN], () => bancoAdministracao.painel())),
  http.get('*/api/administracao/usuarios', ({ request }) => comPerfil(request, [ADMIN], () => bancoAdministracao.usuarios())),

  http.get('*/api/administracao/mensalidade', ({ request }) =>
    comPerfil(request, [ADMIN, 'tesoureiro'], () => bancoAdministracao.mensalidade()),
  ),
  http.post('*/api/administracao/mensalidade/agendamento', async ({ request }) => {
    const d = await corpo<NovoValorMensalidade>(request)
    return comPerfil(request, [ADMIN], (u, p) => bancoAdministracao.agendar(u, p, d))
  }),
  http.put('*/api/administracao/mensalidade/agendamento', async ({ request }) => {
    const d = await corpo<NovoValorMensalidade>(request)
    return comPerfil(request, [ADMIN], (u, p) => bancoAdministracao.alterarAgendamento(u, p, d))
  }),
  http.delete('*/api/administracao/mensalidade/agendamento', ({ request }) =>
    comPerfil(request, [ADMIN], (u, p) => bancoAdministracao.cancelarAgendamento(u, p)),
  ),

  http.get('*/api/administracao/modelos-mensagem', ({ request }) =>
    comPerfil(request, ['operador', ADMIN], () => bancoAdministracao.modelos()),
  ),
  http.put('*/api/administracao/modelos-mensagem/:tipo', async ({ request, params }) => {
    const d = await corpo<TextosModelo>(request)
    return comPerfil(request, [ADMIN], (u, p) => bancoAdministracao.salvarModelo(u, p, String(params.tipo) as TipoModelo, d))
  }),

  http.get('*/api/administracao/plano-contas', ({ request }) =>
    comPerfil(request, ['tesoureiro', ADMIN], () => bancoAdministracao.planoDeContas()),
  ),
  http.post('*/api/administracao/plano-contas', async ({ request }) => {
    const d = await corpo<NovaCategoria>(request)
    const resposta = comPerfil(request, [ADMIN], (u, p) => bancoAdministracao.criarCategoria(u, p, d))
    return resposta.status === 200 ? new HttpResponse(resposta.body, { status: 201, headers: resposta.headers }) : resposta
  }),
  http.put('*/api/administracao/plano-contas/:codigo', async ({ request, params }) => {
    const d = await corpo<{ nome?: string }>(request)
    return comPerfil(request, [ADMIN], (u, p) => bancoAdministracao.renomearCategoria(u, p, String(params.codigo), d.nome ?? ''))
  }),
  http.post('*/api/administracao/plano-contas/:codigo/inativacao', ({ request, params }) =>
    comPerfil(request, [ADMIN], (u, p) => bancoAdministracao.inativarCategoria(u, p, String(params.codigo))),
  ),
  http.post('*/api/administracao/plano-contas/:codigo/reativacao', ({ request, params }) =>
    comPerfil(request, [ADMIN], (u, p) => bancoAdministracao.reativarCategoria(u, p, String(params.codigo))),
  ),
  http.delete('*/api/administracao/plano-contas/:codigo', ({ request, params }) =>
    comPerfil(request, [ADMIN], (u, p) => bancoAdministracao.excluirCategoria(u, p, String(params.codigo))),
  ),

  http.get('*/api/administracao/organizacao/logo', ({ request }) => {
    usuarioDe(request)
    const logo = bancoAdministracao.logo()
    return logo
      ? new HttpResponse(logo.conteudo, { headers: { 'Content-Type': logo.tipo } })
      : new HttpResponse(null, { status: 204 })
  }),
  http.get('*/api/administracao/organizacao', ({ request }) =>
    tratar(() => {
      usuarioDe(request)
      return bancoAdministracao.organizacao()
    }),
  ),
  http.put('*/api/administracao/organizacao', async ({ request }) => {
    const d = await corpo<DadosOrganizacao>(request)
    return comPerfil(request, [ADMIN], (u, p) => bancoAdministracao.salvarOrganizacao(u, p, d))
  }),

  http.get('*/api/administracao/importacoes', ({ request }) =>
    comPerfil(request, [ADMIN], () => bancoAdministracao.importacoes()),
  ),
  http.get('*/api/administracao/importacoes/modelos/:tipo', ({ request, params }) => {
    exigir(request, ADMIN)
    const tipo = String(params.tipo) as TipoImportacao
    const nome = tipo === 'FINANCEIRO' ? 'modelo-historico-financeiro.csv' : 'modelo-doadores.csv'
    return new HttpResponse(bancoAdministracao.modeloImportacao(tipo), {
      headers: { 'Content-Type': 'text/csv; charset=UTF-8', 'Content-Disposition': `attachment; filename="${nome}"` },
    })
  }),
  http.post('*/api/administracao/importacoes/previa', async ({ request }) => {
    const d = await corpo<EnvioImportacao>(request)
    return comPerfil(request, [ADMIN], () => bancoAdministracao.previa(d))
  }),
  http.post('*/api/administracao/importacoes/:id/desfazer', ({ request, params }) =>
    comPerfil(request, [ADMIN], (u, p) => bancoAdministracao.desfazer(u, p, Number(params.id))),
  ),
  http.post('*/api/administracao/importacoes', async ({ request }) => {
    const d = await corpo<EnvioImportacao & { decisoes?: Record<number, DecisaoDuplicata> }>(request)
    const resposta = comPerfil(request, [ADMIN], (u, p) => bancoAdministracao.importar(u, p, d, d.decisoes ?? {}))
    return resposta.status === 200 ? new HttpResponse(resposta.body, { status: 201, headers: resposta.headers }) : resposta
  }),

  http.get('*/api/auditoria/opcoes', ({ request }) => comPerfil(request, [ADMIN], () => bancoAdministracao.opcoes())),
  http.get('*/api/auditoria/entidades/:entidade/:id', ({ request, params }) =>
    comPerfil(request, ['operador', 'vendedor', 'tesoureiro', ADMIN], () =>
      bancoAdministracao.historico(String(params.entidade), String(params.id)),
    ),
  ),
  http.post('*/api/auditoria/sessao', async ({ request }) => {
    const d = await corpo<{ evento?: string }>(request)
    return tratar(() => {
      const u = usuarioDe(request)
      if (d.evento === 'LOGIN' || d.evento === 'LOGOUT') bancoAdministracao.registrar(u, perfil(request, u), d.evento, 'Sessao', u.id)
      return undefined
    })
  }),
  http.get('*/api/auditoria', ({ request }) =>
    comPerfil(request, [ADMIN], () => {
      const q = new URL(request.url).searchParams
      const filtro = Object.fromEntries(['de', 'ate', 'usuario', 'acao', 'entidade', 'entidadeId'].map((k) => [k, q.get(k) ?? undefined]))
      return bancoAdministracao.auditoria(filtro, Number(q.get('pagina') ?? 1))
    }),
  ),
]
