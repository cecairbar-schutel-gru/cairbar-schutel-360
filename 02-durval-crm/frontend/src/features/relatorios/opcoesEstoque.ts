import { editoraService } from '../editoras/services'
import { estoqueService } from '../estoque/services'

export interface OpcoesFiltroEstoque {
  editoras: { id: number; nome: string }[]
  categorias: string[]
}

/**
 * Editoras e categorias para os filtros do relatório de estoque. O catálogo (`/estoque/opcoes`) é do
 * Vendedor e do Administrador; para a Tesouraria, as editoras vêm do cadastro de Editoras e as
 * categorias, dos produtos da cantina.
 */
export async function opcoesFiltroEstoque(podeVerCatalogo: boolean): Promise<OpcoesFiltroEstoque> {
  if (podeVerCatalogo) return estoqueService.opcoes()
  const [editoras, produtos] = await Promise.all([editoraService.listar('TODAS'), estoqueService.listar({ tipo: 'CANTINA' })])
  const categorias = [...new Set(produtos.map((p) => p.categoria).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return { editoras: editoras.map((e) => ({ id: e.id, nome: e.nome })), categorias }
}
