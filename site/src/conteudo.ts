/**
 * Carrega os arquivos Markdown de `src/content/`. Para publicar algo novo basta criar
 * o arquivo: não há índice a manter.
 *
 * - `content/docs/<slug>.md` → página em /docs/<slug>
 * - `content/novidades/<AAAA-MM-DD>-<slug>.md` → item em /novidades (mais recente primeiro)
 *
 * Cada arquivo começa com um cabeçalho entre linhas `---`, com pares `chave: valor`.
 */

export const REPOSITORIO = 'https://github.com/cecairbar-schutel-gru/cairbar-schutel-360'

type Cabecalho = Record<string, string>

function separar(bruto: string): { cabecalho: Cabecalho; corpo: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(bruto)
  if (!m) return { cabecalho: {}, corpo: bruto }
  const cabecalho: Cabecalho = {}
  for (const linha of m[1].split(/\r?\n/)) {
    const i = linha.indexOf(':')
    if (i > 0) cabecalho[linha.slice(0, i).trim()] = linha.slice(i + 1).trim()
  }
  return { cabecalho, corpo: bruto.slice(m[0].length) }
}

function slugDe(caminho: string) {
  return caminho.split('/').pop()!.replace(/\.md$/, '')
}

export interface Documento {
  slug: string
  titulo: string
  descricao: string
  secao: string
  ordem: number
  corpo: string
}

const brutosDocs = import.meta.glob<string>('./content/docs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export const documentos: Documento[] = Object.entries(brutosDocs)
  .map(([caminho, bruto]) => {
    const { cabecalho, corpo } = separar(bruto)
    const slug = slugDe(caminho)
    return {
      slug,
      titulo: cabecalho.titulo ?? slug,
      descricao: cabecalho.descricao ?? '',
      secao: cabecalho.secao ?? 'Geral',
      ordem: Number(cabecalho.ordem ?? 999),
      corpo,
    }
  })
  .sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, 'pt-BR'))

/** Documentos agrupados pela seção, na ordem do primeiro documento de cada uma. */
export const secoesDocs: { secao: string; documentos: Documento[] }[] = documentos.reduce(
  (acc, doc) => {
    const grupo = acc.find((g) => g.secao === doc.secao)
    if (grupo) grupo.documentos.push(doc)
    else acc.push({ secao: doc.secao, documentos: [doc] })
    return acc
  },
  [] as { secao: string; documentos: Documento[] }[],
)

export interface Novidade {
  slug: string
  titulo: string
  data: string
  projetos: string[]
  corpo: string
}

const brutosNovidades = import.meta.glob<string>('./content/novidades/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export const novidades: Novidade[] = Object.entries(brutosNovidades)
  .map(([caminho, bruto]) => {
    const { cabecalho, corpo } = separar(bruto)
    const slug = slugDe(caminho)
    return {
      slug,
      titulo: cabecalho.titulo ?? slug,
      data: cabecalho.data ?? slug.slice(0, 10),
      projetos: (cabecalho.projetos ?? '')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
      corpo,
    }
  })
  .sort((a, b) => b.data.localeCompare(a.data) || b.slug.localeCompare(a.slug))

const formatoData = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** `2026-10-28` → `28 de outubro de 2026`. */
export function formatarData(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? iso : formatoData.format(d)
}
