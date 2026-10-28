import type { TipoImportacao, TipoModelo } from './types'

export const ROTULO_MODELO: Record<TipoModelo, string> = {
  AGRADECIMENTO: 'Agradecimento de contribuição',
  ANIVERSARIO: 'Felicitação de aniversário',
}

export const ROTULO_IMPORTACAO: Record<TipoImportacao, string> = {
  FINANCEIRO: 'Histórico financeiro',
  DOADORES: 'Doadores',
}

const ACOES: Record<string, string> = {
  LOGIN: 'Entrada no sistema',
  LOGOUT: 'Saída do sistema',
  DOADOR_CADASTRADO: 'Doador cadastrado',
  DOADOR_IMPORTADO: 'Doador importado',
  DOADOR_ATUALIZADO: 'Doador atualizado',
  DOADOR_INATIVADO: 'Doador inativado',
  DOADOR_REATIVADO: 'Doador reativado',
  DOADOR_ANONIMIZADO: 'Doador anonimizado',
  DUPLICATA_DESCARTADA: 'Duplicata descartada',
  CONTRIBUICAO_REGISTRADA: 'Contribuição registrada',
  CONTRIBUICAO_CANCELADA: 'Contribuição cancelada',
  AGRADECIMENTO_PREPARADO: 'Agradecimento preparado',
  COMPETENCIAS_GERADAS: 'Competências geradas',
  VENDA_CONFIRMADA: 'Venda confirmada',
  VENDA_CANCELADA: 'Venda cancelada',
  LANCAMENTO_ADICIONADO: 'Lançamento registrado',
  LANCAMENTO_ESTORNADO: 'Lançamento estornado',
  LANCAMENTO_RECLASSIFICADO: 'Lançamento reclassificado',
  INTENCAO_GASTO_CRIADA: 'Intenção de gasto criada',
  INTENCAO_GASTO_APROVADA: 'Intenção de gasto aprovada',
  INTENCAO_GASTO_REJEITADA: 'Intenção de gasto rejeitada',
  PERIODO_FECHADO: 'Período fechado',
  PERIODO_REABERTO: 'Período reaberto',
  RELATORIO_EXPORTADO: 'Relatório exportado',
  MENSALIDADE_AGENDADA: 'Novo valor da mensalidade agendado',
  MENSALIDADE_AGENDAMENTO_ALTERADO: 'Agendamento da mensalidade alterado',
  MENSALIDADE_AGENDAMENTO_CANCELADO: 'Agendamento da mensalidade cancelado',
  MODELO_MENSAGEM_ALTERADO: 'Modelo de mensagem alterado',
  CATEGORIA_CRIADA: 'Categoria criada',
  CATEGORIA_RENOMEADA: 'Categoria renomeada',
  CATEGORIA_INATIVADA: 'Categoria inativada',
  CATEGORIA_REATIVADA: 'Categoria reativada',
  CATEGORIA_EXCLUIDA: 'Categoria excluída',
  ORGANIZACAO_ALTERADA: 'Dados da organização alterados',
  IMPORTACAO_CONCLUIDA: 'Importação concluída',
  IMPORTACAO_DESFEITA: 'Importação desfeita',
}

const ENTIDADES: Record<string, string> = {
  DOADOR: 'Doador',
  CONTRIBUICAO: 'Contribuição',
  VENDA: 'Venda',
  PRODUTO: 'Produto',
  SOLICITACAO_ESTOQUE: 'Solicitação de estoque',
  LancamentoFinanceiro: 'Lançamento',
  ContaFinanceira: 'Conta',
  IntencaoGasto: 'Intenção de gasto',
  Editora: 'Editora',
  Remessa: 'Remessa',
  PagamentoEditora: 'Pagamento a editora',
  Conciliacao: 'Conciliação',
  Periodo: 'Período',
  Relatorio: 'Relatório',
  Mensalidade: 'Mensalidade',
  ModeloMensagem: 'Modelo de mensagem',
  Categoria: 'Plano de contas',
  Organizacao: 'Organização',
  Importacao: 'Importação',
  Sessao: 'Sessão',
  GERACAO_COMPETENCIAS: 'Geração de competências',
  FechamentoCaixa: 'Fechamento de caixa',
  ContasRecebimento: 'Contas de recebimento',
}

/** "PRODUTO_INATIVADO" → "Produto inativado" quando não há rótulo próprio. */
function humanizar(codigo: string): string {
  const texto = codigo.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase()
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export const rotuloAcao = (acao: string) => ACOES[acao] ?? humanizar(acao)
export const rotuloEntidade = (entidade: string) => ENTIDADES[entidade] ?? humanizar(entidade)
