import { Card, CardActionArea, CardContent, Typography } from '@mui/material'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { PainelAdministradorPage } from '../features/administracao/pages/PainelAdministradorPage'
import { PainelOperadorPage } from '../features/contribuicoes/pages/PainelOperadorPage'
import { PainelTesoureiroPage } from '../features/financeiro/pages/PainelTesoureiroPage'
import { PainelVendedorPage } from '../features/vendas/pages/PainelVendedorPage'
import { GradeForm, Pilha, TituloPagina } from '../shared/components/layout'
import { ITENS_MENU } from './menu'

export function HomePage() {
  const { usuario, perfilAtivo, possuiPapel } = useAuth()
  if (perfilAtivo === 'operador') return <PainelOperadorPage />
  if (perfilAtivo === 'vendedor') return <PainelVendedorPage />
  // O perfil PDV só opera o PDV da cantina: abre direto nele.
  if (perfilAtivo === 'pdv') return <Navigate to="/vendas/pdv" replace />
  if (perfilAtivo === 'tesoureiro') return <PainelTesoureiroPage />
  if (perfilAtivo === 'administrador') return <PainelAdministradorPage />
  const itens = ITENS_MENU.filter(
    (i) => i.caminho !== '/' && possuiPapel(...i.papeis),
  )
  return (
    <Pilha component="section">
      <TituloPagina>Olá, {usuario?.nome}</TituloPagina>
      {itens.length === 0 ? (
        <Typography>
          As telas do seu perfil serão disponibilizadas nas próximas fases.
        </Typography>
      ) : (
        <GradeForm>
          {itens.map(({ rotulo, caminho, icone: Icone }) => (
            <Card key={caminho} variant="outlined">
              <CardActionArea component={Link} to={caminho}>
                <CardContent
                  sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
                >
                  <Icone />
                  <Typography variant="h6" component="span">
                    {rotulo}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </GradeForm>
      )}
    </Pilha>
  )
}
