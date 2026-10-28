import AccountTreeIcon from '@mui/icons-material/AccountTree'
import BusinessIcon from '@mui/icons-material/Business'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import ForumIcon from '@mui/icons-material/Forum'
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts'
import PaymentsIcon from '@mui/icons-material/Payments'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { Card, CardActionArea, CardContent, Typography } from '@mui/material'
import { styled } from '@mui/material/styles'
import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import type { Papel } from '../../../auth'
import { useAuth } from '../../../auth/AuthProvider'
import { Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'

const Grade = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(18rem, 100%), 1fr))',
  gap: theme.spacing(2),
}))

const ADMIN: Papel[] = ['administrador']

const ITENS: { rotulo: string; descricao: string; caminho: string; icone: ComponentType; papeis: Papel[] }[] = [
  { rotulo: 'Janela de fechamento', descricao: 'Dias de cada mês (até 7) em que o mês anterior pode ser fechado.', caminho: '/administracao/fechamento', icone: EventAvailableIcon, papeis: ['tesoureiro', 'administrador'] },
  { rotulo: 'Usuários', descricao: 'Quem tem quais papéis no Keycloak (só leitura).', caminho: '/administracao/usuarios', icone: ManageAccountsIcon, papeis: ADMIN },
  { rotulo: 'Valor da mensalidade', descricao: 'Valor vigente, histórico e alteração para os meses seguintes.', caminho: '/administracao/mensalidade', icone: PaymentsIcon, papeis: ADMIN },
  { rotulo: 'Modelos de mensagem', descricao: 'Textos de agradecimento e de aniversário (WhatsApp e e-mail).', caminho: '/administracao/mensagens', icone: ForumIcon, papeis: ADMIN },
  { rotulo: 'Plano de contas', descricao: 'Categorias e subcategorias de receitas e despesas.', caminho: '/administracao/plano-contas', icone: AccountTreeIcon, papeis: ADMIN },
  { rotulo: 'Dados da organização', descricao: 'Razão social, CNPJ, contatos, logotipo e rodapé dos recibos.', caminho: '/administracao/organizacao', icone: BusinessIcon, papeis: ADMIN },
  { rotulo: 'Auditoria', descricao: 'Quem fez o quê, quando e por quê, com filtros.', caminho: '/administracao/auditoria', icone: FactCheckIcon, papeis: ADMIN },
  { rotulo: 'Importação do histórico', descricao: 'Histórico financeiro e lista de doadores a partir de planilhas.', caminho: '/administracao/importacao', icone: UploadFileIcon, papeis: ADMIN },
]

/**
 * Configurações (menu do wireframe 4; US-ADMIN-001 a 005, 009 e 012). O Tesoureiro vê só a janela de
 * fechamento (US-CLOSING-014).
 */
export function ConfiguracoesPage() {
  const { perfilAtivo } = useAuth()
  const itens = ITENS.filter((i) => perfilAtivo !== null && i.papeis.includes(perfilAtivo))
  return (
    <Pilha component="section" aria-labelledby="titulo-configuracoes">
      <TituloPagina id="titulo-configuracoes">Configurações</TituloPagina>
      <TextoSuave>Usuários e papéis são mantidos no Keycloak; o restante é mantido aqui.</TextoSuave>
      <Grade>
        {itens.map(({ rotulo, descricao, caminho, icone: Icone }) => (
          <Card key={caminho} variant="outlined">
            <CardActionArea component={Link} to={caminho} sx={{ height: '100%' }}>
              <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <Icone />
                <div>
                  <Typography variant="h6" component="h2">
                    {rotulo}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {descricao}
                  </Typography>
                </div>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Grade>
    </Pilha>
  )
}
