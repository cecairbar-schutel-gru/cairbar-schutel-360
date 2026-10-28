import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActions from '@mui/material/CardActions'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import GitHubIcon from '@mui/icons-material/GitHub'
import LocalLibraryOutlinedIcon from '@mui/icons-material/LocalLibraryOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import VolunteerActivismOutlinedIcon from '@mui/icons-material/VolunteerActivismOutlined'
import { LogoDurval, SimboloCairbar } from '../components/Logos'
import { formatarData, novidades, REPOSITORIO } from '../conteudo'
import { paleta } from '../theme'
import { useTitulo } from '../useTitulo'

interface Solucao {
  nome: string
  subtitulo: string
  descricao: string
  situacao: string
  marca: ReactNode
  destaques: string[]
  doc: string
}

const solucoes: Solucao[] = [
  {
    nome: 'Comunidade Cairbar',
    subtitulo: 'Identidade digital',
    descricao:
      'Uma única conta para cada pessoa da casa: login, perfil, carteirinha digital e os perfis de acesso usados por todos os sistemas.',
    situacao: 'Em desenvolvimento',
    marca: <SimboloCairbar tamanho={56} />,
    destaques: ['Keycloak', 'Portal "Comunidade Cairbar"', 'Carteirinha no Google Wallet', 'Autocadastro'],
    doc: '/docs/comunidade-cairbar',
  },
  {
    nome: 'DurvalCRM',
    subtitulo: 'Gestão de doações, vendas e finanças',
    descricao:
      'Mensalidades e doações, livraria e cantina, estoque próprio e consignado, editoras, tesouraria, conciliação bancária e fechamento mensal com prestação de contas.',
    situacao: 'Em desenvolvimento',
    marca: <LogoDurval tamanho={56} />,
    destaques: ['12 módulos de negócio', 'Recibos e relatórios em PDF/Excel', 'PDV da cantina', 'Auditoria completa'],
    doc: '/docs/durvalcrm',
  },
  {
    nome: 'Cairbar Booksys',
    subtitulo: 'Biblioteca comunitária',
    descricao:
      'Catálogo público, empréstimos, listas de espera, curadoria e jornadas de leitura para a biblioteca espírita da casa, física e digital.',
    situacao: 'Em planejamento',
    marca: (
      <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center' }}>
        <LocalLibraryOutlinedIcon fontSize="large" />
      </Box>
    ),
    destaques: ['Especificação de produto', 'Infraestrutura pronta', 'Perfis no Keycloak'],
    doc: '/docs/booksys',
  },
]

const principios = [
  {
    icone: <BadgeOutlinedIcon />,
    titulo: 'Uma identidade, vários sistemas',
    texto: 'O Keycloak é a fonte única de identidade. Cada pessoa tem um personId imutável, nunca derivado de CPF, e-mail ou telefone.',
  },
  {
    icone: <LockOutlinedIcon />,
    titulo: 'Privacidade e LGPD',
    texto: 'Dados de negócio ficam nos sistemas de negócio, consentimentos registrados, anonimização de doadores e auditoria só de inserção.',
  },
  {
    icone: <AccessibilityNewIcon />,
    titulo: 'Acessível e mobile-first',
    texto: 'Contraste WCAG AA, navegação por teclado e telas pensadas primeiro para o celular de quem é voluntário.',
  },
  {
    icone: <VolunteerActivismOutlinedIcon />,
    titulo: 'Aberto para outras casas',
    texto: 'Código sob a Licença Apache 2.0, para que outros centros e organizações sem fins lucrativos possam usar e contribuir.',
  },
]

const tecnologias = [
  'React',
  'TypeScript',
  'Material UI',
  'Java 21',
  'Spring Boot',
  'Keycloak',
  'PostgreSQL',
  'Tomcat',
  'nginx',
  'Ansible',
]

function TituloSecao({ sobretitulo, titulo, texto }: { sobretitulo: string; titulo: string; texto?: string }) {
  return (
    <Box sx={{ mb: 4, maxWidth: 720 }}>
      <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>
        {sobretitulo}
      </Typography>
      <Typography variant="h2">{titulo}</Typography>
      {texto && (
        <Typography color="text.secondary" sx={{ mt: 1.5, fontSize: '1.0625rem' }}>
          {texto}
        </Typography>
      )}
    </Box>
  )
}

/** Faixas horizontais do logotipo, como elemento decorativo do topo. */
function Faixas() {
  return (
    <Box aria-hidden sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', gap: 2.5, width: 260, flexShrink: 0 }}>
      {[1, 0.85, 0.7, 0.55].map((opacidade, i) => (
        <Box key={i} sx={{ height: 18, borderRadius: 9, bgcolor: paleta.faixa, opacity: opacidade }} />
      ))}
    </Box>
  )
}

export function Inicio() {
  useTitulo()
  const ultimas = novidades.slice(0, 3)

  return (
    <>
      <Box component="section" sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
          <Stack direction="row" spacing={8} sx={{ alignItems: 'center' }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="overline" color="primary" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
                Uma iniciativa do CE Cairbar Schutel — Guarulhos
              </Typography>
              <Typography variant="h1" sx={{ fontSize: { xs: '2.25rem', md: '3.25rem' }, lineHeight: 1.1 }}>
                Cairbar{' '}
                <Box component="span" sx={{ color: 'primary.main' }}>
                  360
                </Box>
              </Typography>
              <Typography
                variant="h5"
                component="p"
                color="text.secondary"
                sx={{ mt: 2, fontWeight: 400, lineHeight: 1.5, maxWidth: 640 }}
              >
                A plataforma digital aberta do Centro Espírita Cairbar Schutel — Guarulhos: identidade da
                comunidade, gestão de doações e finanças e biblioteca, num só ecossistema construído por voluntários.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 4 }}>
                <Button component={RouterLink} to="/docs" variant="contained" size="large" endIcon={<ArrowForwardIcon />}>
                  Conheça o projeto
                </Button>
                <Button href={REPOSITORIO} target="_blank" rel="noopener noreferrer" variant="outlined" size="large" startIcon={<GitHubIcon />}>
                  Ver o código no GitHub
                </Button>
              </Stack>
            </Box>
            <Faixas />
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" component="section" sx={{ pt: { xs: 6, md: 8 } }}>
        <TituloSecao
          sobretitulo="Soluções"
          titulo="Três sistemas, uma comunidade"
          texto="Cada solução resolve uma parte do dia a dia da casa e todas compartilham a mesma conta, os mesmos perfis de acesso e a mesma identidade visual."
        />
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: 'repeat(auto-fit, minmax(min(18rem, 100%), 1fr))' }}>
          {solucoes.map((s) => (
            <Card key={s.nome} sx={{ display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ height: 4, bgcolor: paleta.faixa }} aria-hidden />
              <CardContent sx={{ flexGrow: 1, p: 3 }}>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2 }}>
                  {s.marca}
                  <Box>
                    <Typography variant="h4" component="h3" sx={{ fontWeight: 700 }}>
                      {s.nome}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {s.subtitulo}
                    </Typography>
                  </Box>
                </Stack>
                <Chip label={s.situacao} size="small" color={s.situacao === 'Em planejamento' ? 'default' : 'primary'} variant="outlined" sx={{ mb: 2 }} />
                <Typography sx={{ mb: 2, lineHeight: 1.6 }}>{s.descricao}</Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  {s.destaques.map((d) => (
                    <Chip key={d} label={d} size="small" sx={{ bgcolor: 'action.hover' }} />
                  ))}
                </Stack>
              </CardContent>
              <CardActions sx={{ px: 3, pb: 3 }}>
                <Button component={RouterLink} to={s.doc} endIcon={<ArrowForwardIcon />}>
                  Saiba mais
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      </Container>

      <Container maxWidth="lg" component="section" sx={{ pt: { xs: 8, md: 10 } }}>
        <TituloSecao sobretitulo="Princípios" titulo="Como construímos" />
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: 'repeat(auto-fit, minmax(min(15rem, 100%), 1fr))' }}>
          {principios.map((p) => (
            <Box key={p.titulo}>
              <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center', mb: 2 }}>
                {p.icone}
              </Box>
              <Typography variant="h5" component="h3" sx={{ fontWeight: 700, mb: 1 }}>
                {p.titulo}
              </Typography>
              <Typography color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {p.texto}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>

      <Container maxWidth="lg" component="section" sx={{ pt: { xs: 8, md: 10 } }}>
        <Box sx={{ display: 'grid', gap: { xs: 6, md: 8 }, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          <Box>
            <TituloSecao sobretitulo="Novidades" titulo="O que mudou recentemente" />
            <Stack spacing={2}>
              {ultimas.map((n) => (
                <Card key={n.slug}>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      {formatarData(n.data)}
                    </Typography>
                    <Typography variant="h5" component="h3" sx={{ fontWeight: 700, mt: 0.5 }}>
                      {n.titulo}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Stack>
            <Button component={RouterLink} to="/novidades" endIcon={<ArrowForwardIcon />} sx={{ mt: 2 }}>
              Todas as novidades
            </Button>
          </Box>
          <Box>
            <TituloSecao sobretitulo="Tecnologia" titulo="Feito com ferramentas abertas" />
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {tecnologias.map((t) => (
                <Chip key={t} label={t} color="primary" variant="outlined" />
              ))}
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 3, lineHeight: 1.6 }}>
              Tudo roda em máquinas virtuais Linux provisionadas com Ansible, sem dependência de serviços pagos.
              Veja os detalhes na{' '}
              <Link component={RouterLink} to="/docs/arquitetura">
                arquitetura
              </Link>
              .
            </Typography>
          </Box>
        </Box>
      </Container>

      <Container maxWidth="lg" component="section" sx={{ pt: { xs: 8, md: 10 } }}>
        <Box
          sx={{
            bgcolor: 'secondary.main',
            color: 'secondary.contrastText',
            borderRadius: 3,
            p: { xs: 4, md: 6 },
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 3,
            alignItems: { md: 'center' },
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ maxWidth: 640 }}>
            <Typography variant="h2" sx={{ color: 'inherit' }}>
              Quer ajudar?
            </Typography>
            <Typography sx={{ mt: 1.5, opacity: 0.9, lineHeight: 1.6 }}>
              Desenvolvedores, designers, testadores e quem conhece a rotina de uma casa espírita são bem-vindos.
              Comece pela página de contribuição.
            </Typography>
          </Box>
          <Button
            component={RouterLink}
            to="/docs/como-contribuir"
            variant="contained"
            size="large"
            sx={{ bgcolor: 'background.paper', color: 'primary.dark', flexShrink: 0, '&:hover': { bgcolor: paleta.fundo } }}
          >
            Como contribuir
          </Button>
        </Box>
      </Container>
    </>
  )
}
