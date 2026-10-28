import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import AssessmentIcon from '@mui/icons-material/Assessment'
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn'
import BalanceIcon from '@mui/icons-material/Balance'
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard'
import DashboardIcon from '@mui/icons-material/Dashboard'
import EventNoteIcon from '@mui/icons-material/EventNote'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import LocalCafeIcon from '@mui/icons-material/LocalCafe'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import PeopleIcon from '@mui/icons-material/People'
import PaymentsIcon from '@mui/icons-material/Payments'
import PointOfSaleIcon from '@mui/icons-material/PointOfSale'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import RequestQuoteIcon from '@mui/icons-material/RequestQuote'
import SettingsIcon from '@mui/icons-material/Settings'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import StorefrontIcon from '@mui/icons-material/Storefront'
import type { ComponentType } from 'react'
import type { Papel } from '../auth'

export interface ItemMenu {
  rotulo: string
  caminho: string
  papeis: Papel[]
  icone: ComponentType
  /** Ativo só no caminho exato (não nas sub-rotas). */
  exato?: boolean
}

/** Seção do menu lateral; com `titulo`, vira um grupo recolhível. */
export interface SecaoMenu {
  titulo?: string
  itens: ItemMenu[]
}

/**
 * Menu por papel, conforme a matriz de permissões (US-AUTH-002), agrupado por
 * área: Painel, Tesouraria, Operação, Vendas e Configurações. Além do Painel,
 * o Operador só acessa as telas do grupo Operação.
 */
export const SECOES_MENU: SecaoMenu[] = [
  {
    itens: [
      {
        rotulo: 'Painel',
        caminho: '/',
        papeis: ['operador', 'vendedor', 'tesoureiro', 'administrador'],
        icone: DashboardIcon,
        exato: true,
      },
    ],
  },
  {
    titulo: 'Tesouraria',
    itens: [
      {
        rotulo: 'Financeiro',
        caminho: '/financeiro',
        papeis: ['tesoureiro', 'administrador'],
        icone: AccountBalanceIcon,
      },
      {
        rotulo: 'Contas a pagar',
        caminho: '/contas-pagar',
        papeis: ['tesoureiro', 'administrador'],
        icone: EventNoteIcon,
      },
      {
        rotulo: 'Conciliação',
        caminho: '/conciliacao',
        papeis: ['tesoureiro', 'administrador'],
        icone: BalanceIcon,
      },
      {
        rotulo: 'Fechamento mensal',
        caminho: '/fechamento',
        papeis: ['tesoureiro', 'administrador'],
        icone: EventAvailableIcon,
      },
      {
        rotulo: 'Aprovar gastos',
        caminho: '/intencoes-gasto/aprovacao',
        papeis: ['tesoureiro', 'administrador'],
        icone: AssignmentTurnedInIcon,
      },
      {
        rotulo: 'Pedidos de livros',
        caminho: '/editoras/pedidos',
        papeis: ['tesoureiro', 'administrador'],
        icone: ShoppingCartIcon,
      },
      {
        rotulo: 'Plano de contas',
        caminho: '/administracao/plano-contas',
        papeis: ['tesoureiro'],
        icone: AccountTreeIcon,
      },
      {
        rotulo: 'Relatórios',
        caminho: '/relatorios',
        papeis: ['vendedor', 'tesoureiro', 'administrador'],
        icone: AssessmentIcon,
      },
    ],
  },
  {
    titulo: 'Operação',
    itens: [
      {
        rotulo: 'Doadores',
        caminho: '/doadores',
        papeis: ['operador', 'administrador'],
        icone: PeopleIcon,
      },
      {
        rotulo: 'Receber contribuição',
        caminho: '/contribuicoes/nova',
        papeis: ['operador'],
        icone: PaymentsIcon,
      },
      {
        rotulo: 'Recibos',
        caminho: '/contribuicoes',
        papeis: ['operador', 'tesoureiro', 'administrador'],
        icone: ReceiptLongIcon,
        exato: true,
      },
      {
        rotulo: 'Aniversariantes',
        caminho: '/aniversariantes',
        papeis: ['operador', 'administrador'],
        icone: CardGiftcardIcon,
      },
    ],
  },
  {
    titulo: 'Vendas',
    itens: [
      {
        rotulo: 'Nova venda',
        caminho: '/vendas/nova',
        papeis: ['vendedor'],
        icone: PointOfSaleIcon,
      },
      {
        rotulo: 'PDV da cantina',
        caminho: '/vendas/pdv',
        papeis: ['vendedor', 'pdv'],
        icone: LocalCafeIcon,
      },
      {
        rotulo: 'Vendas',
        caminho: '/vendas',
        papeis: ['vendedor', 'tesoureiro', 'administrador'],
        icone: StorefrontIcon,
        exato: true,
      },
      {
        rotulo: 'Receber doação',
        caminho: '/contribuicoes/anonima',
        papeis: ['vendedor'],
        icone: PaymentsIcon,
      },
      {
        rotulo: 'Estoque',
        caminho: '/estoque',
        papeis: ['vendedor', 'tesoureiro', 'administrador'],
        icone: Inventory2Icon,
      },
      {
        rotulo: 'Editoras',
        caminho: '/editoras',
        papeis: ['vendedor', 'tesoureiro', 'administrador'],
        icone: MenuBookIcon,
        exato: true,
      },
      {
        rotulo: 'Aprovações de estoque',
        caminho: '/estoque/solicitacoes',
        papeis: ['administrador'],
        icone: FactCheckIcon,
      },
      {
        rotulo: 'Intenções de gasto',
        caminho: '/intencoes-gasto',
        papeis: ['vendedor'],
        icone: RequestQuoteIcon,
        exato: true,
      },
      {
        rotulo: 'Receber compras',
        caminho: '/intencoes-gasto/recebimentos',
        papeis: ['vendedor'],
        icone: LocalShippingIcon,
      },
    ],
  },
  {
    itens: [
      {
        rotulo: 'Configurações',
        caminho: '/administracao',
        papeis: ['tesoureiro', 'administrador'],
        icone: SettingsIcon,
      },
    ],
  },
]

export const ITENS_MENU: ItemMenu[] = SECOES_MENU.flatMap((s) => s.itens)
