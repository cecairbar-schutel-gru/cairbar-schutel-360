import { authService } from '../../auth'

export interface ErroCampo {
  campo: string
  mensagem: string
}

export class ApiError extends Error {
  readonly status: number
  readonly codigo: string
  readonly erros: ErroCampo[]

  constructor(status: number, codigo: string, mensagem: string, erros: ErroCampo[] = []) {
    super(mensagem)
    this.name = 'ApiError'
    this.status = status
    this.codigo = codigo
    this.erros = erros
  }
}

interface OpcoesRequisicao {
  metodo?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  corpo?: unknown
  consulta?: Record<string, string | number | undefined | null>
}

function url(caminho: string, consulta: OpcoesRequisicao['consulta']): string {
  const params = new URLSearchParams()
  for (const [chave, valor] of Object.entries(consulta ?? {})) {
    if (valor !== undefined && valor !== null && valor !== '') params.set(chave, String(valor))
  }
  const query = params.size > 0 ? `?${params.toString()}` : ''
  return `${window.location.origin}/api${caminho}${query}`
}

let perfilAtivo: string | null = null

/** Perfil em uso, enviado em `X-Perfil-Ativo` e registrado na auditoria (US-ADMIN-009). */
export function definirPerfilAtivo(perfil: string | null): void {
  perfilAtivo = perfil
}

async function cabecalhos(aceita: string, comCorpo: boolean): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Accept: aceita }
  const token = await authService.obterToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (perfilAtivo) headers['X-Perfil-Ativo'] = perfilAtivo
  if (comCorpo) headers['Content-Type'] = 'application/json'
  return headers
}

export async function requisitar<T>(
  caminho: string,
  { metodo = 'GET', corpo, consulta }: OpcoesRequisicao = {},
): Promise<T> {
  const resposta = await fetch(url(caminho, consulta), {
    method: metodo,
    headers: await cabecalhos('application/json', corpo !== undefined),
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  })
  await exigirSucesso(resposta)
  if (resposta.status === 204) return undefined as T
  return (await resposta.json()) as T
}

export interface ArquivoBaixado {
  conteudo: Blob
  nome: string
}

/** GET de um arquivo (ex.: PDF ou foto); o nome vem do `Content-Disposition`. */
export async function baixarArquivo(
  caminho: string,
  consulta?: OpcoesRequisicao['consulta'],
  aceita = 'application/pdf, application/json',
): Promise<ArquivoBaixado> {
  const resposta = await fetch(url(caminho, consulta), {
    headers: await cabecalhos(aceita, false),
  })
  await exigirSucesso(resposta)
  const disposicao = resposta.headers.get('Content-Disposition') ?? ''
  const nome = /filename="?([^";]+)"?/.exec(disposicao)?.[1] ?? 'arquivo'
  return { conteudo: await resposta.blob(), nome }
}

/** Dispara o download no navegador. */
export function salvarArquivo({ conteudo, nome }: ArquivoBaixado): void {
  const endereco = URL.createObjectURL(conteudo)
  const link = document.createElement('a')
  link.href = endereco
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(endereco)
}

async function exigirSucesso(resposta: Response): Promise<void> {
  if (!resposta.ok) {
    let dados: { codigo?: string; mensagem?: string; erros?: ErroCampo[] } = {}
    try {
      dados = await resposta.json()
    } catch {
      // resposta sem corpo JSON
    }
    throw new ApiError(
      resposta.status,
      dados.codigo ?? 'ERRO',
      dados.mensagem ?? 'Não foi possível concluir a operação.',
      dados.erros ?? [],
    )
  }
}

export function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : 'Erro inesperado.'
}

/** Mensagem do erro da API, com o detalhe por campo quando houver. */
export function mensagemDetalhada(erro: unknown): string {
  if (erro instanceof ApiError && erro.erros.length > 0) {
    return erro.erros.map((e) => e.mensagem).join(' ')
  }
  return mensagemDeErro(erro)
}
