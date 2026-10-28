import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link as RouterLink, useLocation } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import GitHubIcon from '@mui/icons-material/GitHub'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import MenuIcon from '@mui/icons-material/Menu'
import NewReleasesOutlinedIcon from '@mui/icons-material/NewReleasesOutlined'
import { REPOSITORIO } from '../conteudo'
import { paleta } from '../theme'
import { LogoCairbar } from './Logos'

const itens = [
  { to: '/', rotulo: 'Início', icone: <HomeOutlinedIcon /> },
  { to: '/docs', rotulo: 'Documentação', icone: <MenuBookOutlinedIcon /> },
  { to: '/novidades', rotulo: 'Novidades', icone: <NewReleasesOutlinedIcon /> },
]

const ocultoVisualmente = {
  position: 'absolute',
  left: -9999,
  '&:focus': { left: 16, top: 16, zIndex: 2000, bgcolor: 'background.paper', p: 1 },
} as const

export function Layout() {
  const [menuAberto, setMenuAberto] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    setMenuAberto(false)
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Link href="#conteudo" sx={ocultoVisualmente}>
        Pular para o conteúdo
      </Link>

      <AppBar position="sticky">
        <Box sx={{ height: 4, bgcolor: paleta.faixa }} aria-hidden />
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ gap: 2 }}>
            <Box
              component={RouterLink}
              to="/"
              aria-label="Cairbar 360 — início"
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none', color: 'inherit', minWidth: 0 }}
            >
              <LogoCairbar altura={34} />
              <Divider orientation="vertical" flexItem sx={{ my: 1.5, display: { xs: 'none', sm: 'block' } }} />
              <Typography
                component="span"
                sx={{ fontWeight: 700, fontSize: '1.125rem', color: 'primary.dark', whiteSpace: 'nowrap', display: { xs: 'none', sm: 'block' } }}
              >
                Cairbar 360
              </Typography>
            </Box>

            <Box sx={{ flexGrow: 1 }} />

            <Stack component="nav" aria-label="Menu principal" direction="row" spacing={0.5} sx={{ display: { xs: 'none', md: 'flex' } }}>
              {itens.map((item) => (
                <Button
                  key={item.to}
                  component={NavLink}
                  to={item.to}
                  end={item.to === '/'}
                  color="inherit"
                  sx={{ '&.active': { color: 'primary.main', bgcolor: 'action.selected' } }}
                >
                  {item.rotulo}
                </Button>
              ))}
              <Button
                href={REPOSITORIO}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                startIcon={<GitHubIcon />}
                sx={{ ml: 1 }}
              >
                GitHub
              </Button>
            </Stack>

            <IconButton
              edge="end"
              aria-label="Abrir menu"
              aria-expanded={menuAberto}
              onClick={() => setMenuAberto(true)}
              sx={{ display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer anchor="right" open={menuAberto} onClose={() => setMenuAberto(false)}>
        <Box component="nav" aria-label="Menu principal" sx={{ width: 264, pt: 2 }}>
          <List sx={{ px: 1 }}>
            {itens.map((item) => (
              <ListItem key={item.to} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton component={NavLink} to={item.to} end={item.to === '/'} sx={{ borderRadius: 2 }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>{item.icone}</ListItemIcon>
                  <ListItemText primary={item.rotulo} />
                </ListItemButton>
              </ListItem>
            ))}
            <Divider sx={{ my: 1 }} />
            <ListItem disablePadding>
              <ListItemButton component="a" href={REPOSITORIO} target="_blank" rel="noopener noreferrer" sx={{ borderRadius: 2 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <GitHubIcon />
                </ListItemIcon>
                <ListItemText primary="Código no GitHub" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      <Box component="main" id="conteudo" tabIndex={-1} sx={{ flexGrow: 1, outline: 'none' }}>
        <Outlet />
      </Box>

      <Box component="footer" sx={{ bgcolor: 'secondary.main', color: 'secondary.contrastText', mt: 8 }}>
        <Box sx={{ height: 4, bgcolor: paleta.faixa }} aria-hidden />
        <Container maxWidth="lg" sx={{ py: 5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} sx={{ justifyContent: 'space-between' }}>
            <Box sx={{ maxWidth: 420 }}>
              <Typography variant="h6" component="p" sx={{ fontWeight: 700 }}>
                Cairbar 360
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, opacity: 0.85 }}>
                Plataforma digital aberta do Centro Espírita Cairbar Schutel — Guarulhos, feita por
                voluntários para servir à comunidade.
              </Typography>
            </Box>
            <Stack component="nav" aria-label="Rodapé" spacing={1}>
              {itens.map((item) => (
                <Link key={item.to} component={RouterLink} to={item.to} color="inherit">
                  {item.rotulo}
                </Link>
              ))}
              <Link href={REPOSITORIO} target="_blank" rel="noopener noreferrer" color="inherit">
                Código-fonte
              </Link>
            </Stack>
          </Stack>
          <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.2)' }} />
          <Typography variant="body2" sx={{ opacity: 0.85 }}>
            Código aberto sob a{' '}
            <Link href={`${REPOSITORIO}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer" color="inherit" underline="always">
              Licença Apache 2.0
            </Link>
            .
          </Typography>
        </Container>
      </Box>
    </Box>
  )
}
