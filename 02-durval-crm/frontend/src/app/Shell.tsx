import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import LogoutIcon from '@mui/icons-material/Logout'
import MenuIcon from '@mui/icons-material/Menu'
import {
  AppBar,
  Box,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import {
  Link as RouterLink,
  NavLink,
  Outlet,
  useNavigate,
} from 'react-router-dom'
import { useState } from 'react'
import { ROTULO_PAPEL, type Papel } from '../auth'
import { AvisoPeriodosReabertos } from '../features/fechamento/components/AvisoPeriodosReabertos'
import { useAuth } from '../auth/AuthProvider'
import logo from '../shared/assets/logo.png'
import logoWebp from '../shared/assets/logo.webp'
import { SECOES_MENU, type ItemMenu } from './menu'

const LARGURA_MENU = 264

export function Shell() {
  const { usuario, perfilAtivo, trocarPerfil, sair, possuiPapel } = useAuth()
  const navegar = useNavigate()
  const theme = useTheme()
  // Tablet e celular: menu lateral escondido atrás do botão hambúrguer.
  const compacto = useMediaQuery(theme.breakpoints.down('lg'))
  const [menuAberto, setMenuAberto] = useState(false)
  const fecharMenu = () => setMenuAberto(false)
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set())
  const secoes = SECOES_MENU.map((s) => ({
    ...s,
    itens: s.itens.filter((i) => possuiPapel(...i.papeis)),
  })).filter((s) => s.itens.length > 0)

  const alternarGrupo = (titulo: string) =>
    setRecolhidos((atual) => {
      const novo = new Set(atual)
      if (novo.has(titulo)) novo.delete(titulo)
      else novo.add(titulo)
      return novo
    })

  const renderizarItemMenu = (item: ItemMenu) =>
    renderizarItem(item, compacto ? fecharMenu : undefined)

  const menu = (
    <Box component="nav" id="menu-lateral" aria-label="Menu lateral">
      <List sx={{ px: 1 }}>
        {secoes.map(({ titulo, itens }) => {
          if (!titulo) return itens.map(renderizarItemMenu)
          const aberto = !recolhidos.has(titulo)
          const idGrupo = `grupo-menu-${titulo}`
          return (
            <Box component="li" key={titulo} sx={{ listStyle: 'none' }}>
              <ListItemButton
                onClick={() => alternarGrupo(titulo)}
                aria-expanded={aberto}
                aria-controls={idGrupo}
                sx={{ borderRadius: 2, mt: 1, mb: 0.5 }}
              >
                <ListItemText
                  primary={titulo}
                  slotProps={{
                    primary: {
                      variant: 'overline',
                      color: 'text.secondary',
                      sx: { fontWeight: 600, lineHeight: 1.5 },
                    },
                  }}
                />
                {aberto ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </ListItemButton>
              <Collapse in={aberto} timeout="auto">
                <List id={idGrupo} disablePadding aria-label={titulo}>
                  {itens.map(renderizarItemMenu)}
                </List>
              </Collapse>
            </Box>
          )
        })}
      </List>
    </Box>
  )

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <Link
        href="#conteudo-principal"
        sx={(theme) => ({
          position: 'absolute',
          top: theme.spacing(-10),
          left: theme.spacing(1),
          zIndex: theme.zIndex.tooltip,
          p: 1,
          bgcolor: 'background.paper',
          '&:focus': { top: theme.spacing(1) },
        })}
      >
        Pular para o conteúdo
      </Link>
      <AppBar
        position="fixed"
        // Acima do menu fixo; no compacto, a gaveta aberta cobre a barra.
        sx={{
          zIndex: (theme) =>
            compacto ? theme.zIndex.appBar : theme.zIndex.drawer + 1,
        }}
      >
        <Box sx={{ height: 4, bgcolor: 'primary.light' }} aria-hidden />
        <Toolbar sx={{ gap: 1, px: { xs: 1, sm: 2 } }}>
          {compacto && (
            <IconButton
              aria-label="Abrir menu"
              aria-controls="menu-lateral"
              aria-expanded={menuAberto}
              edge="start"
              onClick={() => setMenuAberto(true)}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Box
            component={RouterLink}
            to="/"
            sx={{ display: 'block', lineHeight: 0 }}
          >
            <Box component="picture" sx={{ display: 'block' }}>
              <source srcSet={logoWebp} type="image/webp" />
              <Box
                component="img"
                src={logo}
                alt="CE Cairbar Schutel — início"
                sx={{ height: { xs: 28, sm: 36 }, width: 'auto' }}
              />
            </Box>
          </Box>
          <Divider
            orientation="vertical"
            flexItem
            sx={{ mx: { xs: 0.5, sm: 1 }, my: 1.5 }}
          />
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexGrow: 1,
              minWidth: 0,
            }}
          >
            <Box
              component="img"
              src="/logo-durvalcrm-avatar.png"
              alt=""
              sx={{ height: 32, width: 32, flexShrink: 0 }}
            />
            <Typography
              variant="h6"
              component="p"
              sx={{
                fontSize: '1.125rem',
                display: { xs: 'none', sm: 'block' },
              }}
              noWrap
            >
              DurvalCRM
            </Typography>
          </Box>
          {usuario && usuario.papeis.length > 1 && perfilAtivo && (
            <TextField
              id="seletor-perfil"
              select
              size="small"
              label="Perfil ativo"
              value={perfilAtivo}
              onChange={(e) => trocarPerfil(e.target.value as Papel)}
              slotProps={{ select: { native: true } }}
            >
              {usuario.papeis.map((p) => (
                <option key={p} value={p}>
                  {ROTULO_PAPEL[p]}
                </option>
              ))}
            </TextField>
          )}
          <Typography
            component="span"
            noWrap
            sx={{ display: { xs: 'none', md: 'block' }, maxWidth: 200 }}
          >
            {usuario?.nome}
          </Typography>
          <Tooltip title="Sair">
            <IconButton
              aria-label="Sair"
              edge="end"
              onClick={() => {
                sair()
                navegar('/entrar')
              }}
            >
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Drawer
        variant={compacto ? 'temporary' : 'permanent'}
        anchor="left"
        open={compacto ? menuAberto : true}
        onClose={fecharMenu}
        sx={{
          width: compacto ? undefined : LARGURA_MENU,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: LARGURA_MENU,
            maxWidth: '85vw',
            boxSizing: 'border-box',
          },
        }}
      >
        {compacto ? (
          <Box sx={{ px: 2, pt: 2, pb: 1 }}>
            <Typography variant="subtitle1" component="p" noWrap>
              {usuario?.nome}
            </Typography>
          </Box>
        ) : (
          <Toolbar sx={{ mt: '4px' }} />
        )}
        {menu}
      </Drawer>
      <Box
        component="main"
        id="conteudo-principal"
        tabIndex={-1}
        sx={{
          flexGrow: 1,
          minWidth: 0,
          outline: 'none',
          px: { xs: 2, sm: 3, lg: 4 },
          pb: 6,
        }}
      >
        <Toolbar sx={{ mt: '4px', mb: 3 }} />
        <Box sx={{ maxWidth: 1584, mx: 'auto' }}>
          <AvisoPeriodosReabertos />
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}

function renderizarItem(
  { rotulo, caminho, icone: Icone, exato }: ItemMenu,
  aoEscolher?: () => void,
) {
  return (
    <ListItem key={caminho} disablePadding sx={{ mb: 0.5 }}>
      <ListItemButton
        component={NavLink}
        to={caminho}
        end={exato}
        onClick={aoEscolher}
        sx={{ borderRadius: 2 }}
      >
        <ListItemIcon sx={{ minWidth: 40 }}>
          <Icone />
        </ListItemIcon>
        <ListItemText primary={rotulo} />
      </ListItemButton>
    </ListItem>
  )
}
