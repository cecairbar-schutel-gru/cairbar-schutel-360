import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import AssignmentIcon from '@mui/icons-material/Assignment'
import BarChartIcon from '@mui/icons-material/BarChart'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import PieChartIcon from '@mui/icons-material/PieChart'
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import StorefrontIcon from '@mui/icons-material/Storefront'
import { Card, CardActionArea, CardContent, Typography } from '@mui/material'
import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import type { Papel } from '../../../auth'
import { useAuth } from '../../../auth/AuthProvider'
import { GradeForm, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { mesAtual } from '../regras'

interface ItemRelatorio {
  titulo: string
  descricao: string
  caminho: string
  icone: ComponentType
  papeis: Papel[]
}

const TESOURARIA: Papel[] = ['tesoureiro', 'administrador']
const VENDAS_E_ESTOQUE: Papel[] = ['vendedor', 'tesoureiro', 'administrador']

/** Relatórios do mapa de telas (Spec §6); a Tesouraria vê todos, o Vendedor vendas e estoque. */
const RELATORIOS: ItemRelatorio[] = [
  { titulo: 'Prestação de contas mensal', descricao: 'Demonstrativo consolidado do mês com a comparação ao mês anterior.', caminho: `/fechamento/${mesAtual()}/demonstrativo`, icone: AssignmentIcon, papeis: TESOURARIA },
  { titulo: 'Fluxo de caixa', descricao: 'De onde veio e para onde foi o dinheiro: entradas, saídas e transferências por dia, semana ou mês.', caminho: '/relatorios/fluxo-caixa', icone: CompareArrowsIcon, papeis: TESOURARIA },
  { titulo: 'Receitas e despesas por categoria', descricao: 'O plano de contas com o total de cada categoria e subcategoria e o resultado.', caminho: '/relatorios/receitas-despesas', icone: PieChartIcon, papeis: TESOURARIA },
  { titulo: 'Saldos por conta', descricao: 'Saldo inicial e final de cada caixa e banco, ou o saldo em uma data.', caminho: '/relatorios/saldos', icone: AccountBalanceWalletIcon, papeis: TESOURARIA },
  { titulo: 'Mensalidades', descricao: 'Competências pagas e pendentes, recebimentos e doadores com 3 ou mais pendências.', caminho: '/relatorios/mensalidades', icone: ReceiptLongIcon, papeis: TESOURARIA },
  { titulo: 'Vendas', descricao: 'Vendas de livros e cantina por forma de pagamento, produto e caixa.', caminho: '/relatorios/vendas', icone: StorefrontIcon, papeis: VENDAS_E_ESTOQUE },
  { titulo: 'Estoque', descricao: 'Saldo inicial, entradas, saídas, ajustes e saldo final de cada produto; baixas por motivo.', caminho: '/relatorios/estoque', icone: Inventory2Icon, papeis: VENDAS_E_ESTOQUE },
  { titulo: 'Folha de contagem', descricao: 'Produtos com a quantidade do sistema e a coluna "Contado" para o inventário físico.', caminho: '/relatorios/estoque/contagem', icone: PlaylistAddCheckIcon, papeis: VENDAS_E_ESTOQUE },
  { titulo: 'Acertos com editoras', descricao: 'Quanto se deve e quanto se pagou a cada editora no período.', caminho: '/relatorios/editoras', icone: MenuBookIcon, papeis: TESOURARIA },
]

export function RelatoriosPage() {
  const { possuiPapel } = useAuth()
  const itens = RELATORIOS.filter((r) => possuiPapel(...r.papeis))
  return (
    <Pilha component="section" aria-labelledby="titulo-relatorios">
      <TituloPagina id="titulo-relatorios">Relatórios</TituloPagina>
      <TextoSuave>
        Valores em regime de caixa (pela data do recebimento ou pagamento), com cancelamentos já descontados. Todo
        relatório pode ser exportado para Excel e PDF com os filtros aplicados.
      </TextoSuave>
      <GradeForm as="ul" sx={{ listStyle: 'none', p: 0, m: 0 }} aria-label="Relatórios disponíveis">
        {itens.map(({ titulo, descricao, caminho, icone: Icone }) => (
          <li key={caminho}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardActionArea component={Link} to={caminho} sx={{ height: '100%' }}>
                <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  <Icone />
                  <div>
                    <Typography variant="h6" component="h2">
                      {titulo}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {descricao}
                    </Typography>
                  </div>
                </CardContent>
              </CardActionArea>
            </Card>
          </li>
        ))}
      </GradeForm>
      {itens.length === 0 && <TextoSuave>Seu perfil não tem relatórios: o resumo do dia está no painel.</TextoSuave>}
      <TextoSuave>
        <BarChartIcon fontSize="inherit" sx={{ verticalAlign: 'middle', mr: 0.5 }} aria-hidden />
        Cada total leva aos lançamentos, vendas ou movimentos que o formam.
      </TextoSuave>
    </Pilha>
  )
}
