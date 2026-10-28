import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Markdown } from '../components/Markdown'
import { formatarData, novidades } from '../conteudo'
import { useTitulo } from '../useTitulo'

/** Linha do tempo com as mudanças do projeto (`src/content/novidades/`). */
export function Novidades() {
  useTitulo('Novidades')
  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>
        Histórico de mudanças
      </Typography>
      <Typography variant="h1" sx={{ mb: 1 }}>
        Novidades
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 5 }}>
        O que mudou no Cairbar 360, do mais recente para o mais antigo.
      </Typography>

      <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {novidades.map((n, i) => (
          <Box
            component="li"
            key={n.slug}
            id={n.slug}
            sx={{
              position: 'relative',
              pl: { xs: 3, sm: 4 },
              pb: 5,
              borderLeft: 2,
              borderColor: i === novidades.length - 1 ? 'transparent' : 'primary.light',
              ml: 1,
            }}
          >
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                left: -9,
                top: 2,
                width: 16,
                height: 16,
                borderRadius: '50%',
                bgcolor: 'background.paper',
                border: 3,
                borderColor: 'primary.main',
              }}
            />
            <Typography component="time" dateTime={n.data} variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              {formatarData(n.data)}
            </Typography>
            <Typography variant="h3" component="h2" sx={{ mt: 0.5, mb: 1 }}>
              {n.titulo}
            </Typography>
            {n.projetos.length > 0 && (
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 2 }}>
                {n.projetos.map((p) => (
                  <Chip key={p} label={p} size="small" color="primary" variant="outlined" />
                ))}
              </Stack>
            )}
            <Box sx={{ '& > :last-child': { mb: 0 } }}>
              <Markdown>{n.corpo}</Markdown>
            </Box>
          </Box>
        ))}
      </Box>
    </Container>
  )
}
