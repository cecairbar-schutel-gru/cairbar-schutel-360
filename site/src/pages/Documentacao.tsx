import { NavLink, Navigate, Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Link from '@mui/material/Link'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CodeIcon from '@mui/icons-material/Code'
import { Markdown } from '../components/Markdown'
import { documentos, REPOSITORIO, secoesDocs } from '../conteudo'
import { useTitulo } from '../useTitulo'

export function Documentacao() {
  const { slug } = useParams()
  const navegar = useNavigate()
  const indice = documentos.findIndex((d) => d.slug === slug)
  const doc = documentos[indice]
  useTitulo(doc?.titulo ?? 'Documentação')

  if (!slug) return <Navigate to={`/docs/${documentos[0].slug}`} replace />
  if (!doc) return <Navigate to="/docs" replace />

  const anterior = documentos[indice - 1]
  const proximo = documentos[indice + 1]

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 6 } }}>
      <Box sx={{ display: 'grid', gap: { xs: 3, md: 5 }, gridTemplateColumns: { xs: '1fr', md: '260px minmax(0, 1fr)' } }}>
        {/* Celular: seletor; telas maiores: índice lateral fixo. */}
        <TextField
          select
          label="Página da documentação"
          value={doc.slug}
          onChange={(e) => navegar(`/docs/${e.target.value}`)}
          sx={{ display: { md: 'none' } }}
        >
          {secoesDocs.flatMap((g) => [
            <ListSubheader key={`s-${g.secao}`}>{g.secao}</ListSubheader>,
            ...g.documentos.map((d) => (
              <MenuItem key={d.slug} value={d.slug}>
                {d.titulo}
              </MenuItem>
            )),
          ])}
        </TextField>

        <Box component="nav" aria-label="Índice da documentação" sx={{ display: { xs: 'none', md: 'block' } }}>
          <Box sx={{ position: 'sticky', top: 88 }}>
            {secoesDocs.map((g) => (
              <List
                key={g.secao}
                dense
                subheader={
                  <ListSubheader disableSticky sx={{ bgcolor: 'transparent', fontWeight: 700, lineHeight: 2.5, color: 'text.primary' }}>
                    {g.secao}
                  </ListSubheader>
                }
              >
                {g.documentos.map((d) => (
                  <ListItemButton key={d.slug} component={NavLink} to={`/docs/${d.slug}`} sx={{ borderRadius: 2 }}>
                    <ListItemText primary={d.titulo} />
                  </ListItemButton>
                ))}
              </List>
            ))}
          </Box>
        </Box>

        <Paper component="article" variant="outlined" sx={{ p: { xs: 2.5, sm: 4, md: 5 }, minWidth: 0 }}>
          <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>
            {doc.secao}
          </Typography>
          <Typography variant="h1" sx={{ mb: 1 }}>
            {doc.titulo}
          </Typography>
          {doc.descricao && (
            <Typography variant="h6" component="p" color="text.secondary" sx={{ fontWeight: 400, mb: 3 }}>
              {doc.descricao}
            </Typography>
          )}
          <Markdown>{doc.corpo}</Markdown>

          <Link
            href={`${REPOSITORIO}/blob/main/site/src/content/docs/${doc.slug}.md`}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 2 }}
          >
            <CodeIcon fontSize="small" /> Ver o arquivo desta página no GitHub
          </Link>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 4, justifyContent: 'space-between' }}>
            {anterior ? (
              <Button component={RouterLink} to={`/docs/${anterior.slug}`} startIcon={<ArrowBackIcon />} variant="outlined">
                {anterior.titulo}
              </Button>
            ) : (
              <span />
            )}
            {proximo && (
              <Button component={RouterLink} to={`/docs/${proximo.slug}`} endIcon={<ArrowForwardIcon />} variant="outlined">
                {proximo.titulo}
              </Button>
            )}
          </Stack>
        </Paper>
      </Box>
    </Container>
  )
}
