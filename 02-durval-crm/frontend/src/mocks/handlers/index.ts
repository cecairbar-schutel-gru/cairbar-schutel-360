import { handlersAdministracao } from './administracao'
import { handlersConciliacao } from './conciliacao'
import { handlersContasPagar } from './contasPagar'
import { handlersContribuicoes } from './contribuicoes'
import { handlersDoadores } from './doadores'
import { handlersEditoras } from './editoras'
import { handlersEstoque } from './estoque'
import { handlersFechamento } from './fechamento'
import { handlersFinanceiro } from './financeiro'
import { handlersIntencoes } from './intencoes'
import { handlersRelatorios } from './relatorios'
import { handlersVendas } from './vendas'

export const handlers = [...handlersContribuicoes, ...handlersDoadores, ...handlersVendas, ...handlersEstoque, ...handlersFinanceiro, ...handlersIntencoes, ...handlersEditoras, ...handlersConciliacao, ...handlersFechamento, ...handlersRelatorios, ...handlersAdministracao, ...handlersContasPagar]
