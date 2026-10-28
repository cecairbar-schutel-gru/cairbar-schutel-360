import { baixarArquivo, requisitar } from '../../../shared/api/http'
import type { EstoqueService } from './EstoqueService'

export const estoqueServiceHttp: EstoqueService = {
  listar: (filtro) =>
    requisitar('/estoque/produtos', {
      consulta: { ...filtro, somenteSemSaldo: filtro.somenteSemSaldo ? 'true' : undefined },
    }),
  opcoes: () => requisitar('/estoque/opcoes'),
  similares: (nome, tipo, excetoId) => requisitar('/estoque/produtos/similares', { consulta: { nome, tipo, excetoId } }),
  detalhe: (id) => requisitar(`/estoque/produtos/${id}`),
  movimentos: (id, filtro) => requisitar(`/estoque/produtos/${id}/movimentos`, { consulta: { ...filtro } }),
  cadastrarLivro: (dados) => requisitar('/estoque/livros', { metodo: 'POST', corpo: dados }),
  atualizarLivro: (id, dados) => requisitar(`/estoque/livros/${id}`, { metodo: 'PUT', corpo: dados }),
  alterarPrecoLivro: (id, preco, motivo) =>
    requisitar(`/estoque/livros/${id}/preco`, { metodo: 'POST', corpo: { preco, motivo } }),
  cadastrarCantina: (dados) => requisitar('/estoque/cantina', { metodo: 'POST', corpo: dados }),
  corrigirCantina: (id, dados) => requisitar(`/estoque/cantina/${id}`, { metodo: 'PUT', corpo: dados }),
  inativar: (id, motivo) => requisitar(`/estoque/produtos/${id}/inativacao`, { metodo: 'POST', corpo: { motivo } }),
  reativar: (id) => requisitar(`/estoque/produtos/${id}/reativacao`, { metodo: 'POST' }),
  excluir: (id) => requisitar(`/estoque/produtos/${id}`, { metodo: 'DELETE' }),
  ajustar: (id, dados) => requisitar(`/estoque/produtos/${id}/ajuste`, { metodo: 'POST', corpo: dados }),
  entradasDoacao: () => requisitar('/estoque/entradas-doacao'),
  registrarDoacao: (dados) => requisitar('/estoque/entradas-doacao', { metodo: 'POST', corpo: dados }),
  cancelarDoacao: (id, motivo) =>
    requisitar(`/estoque/entradas-doacao/${id}/cancelamento`, { metodo: 'POST', corpo: { motivo } }),
  solicitacoes: (filtro) =>
    requisitar('/estoque/solicitacoes', { consulta: { status: filtro.status, minhas: filtro.minhas ? 'true' : undefined } }),
  baixarFoto: (id) => baixarArquivo(`/estoque/solicitacoes/${id}/foto`, undefined, 'image/jpeg, image/png, application/json'),
  solicitarBaixa: (dados) => requisitar('/estoque/solicitacoes/baixa', { metodo: 'POST', corpo: dados }),
  solicitarPreco: (produtoId, novoPreco, motivo) =>
    requisitar('/estoque/solicitacoes/preco', { metodo: 'POST', corpo: { produtoId, novoPreco, motivo } }),
  solicitarInativacao: (produtoId, motivo) =>
    requisitar('/estoque/solicitacoes/inativacao', { metodo: 'POST', corpo: { produtoId, motivo } }),
  cancelarSolicitacao: (id) => requisitar(`/estoque/solicitacoes/${id}/cancelamento`, { metodo: 'POST' }),
  aprovar: (id) => requisitar(`/estoque/solicitacoes/${id}/aprovacao`, { metodo: 'POST' }),
  rejeitar: (id, motivo) => requisitar(`/estoque/solicitacoes/${id}/rejeicao`, { metodo: 'POST', corpo: { motivo } }),
}
