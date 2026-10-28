import { Link as RouterLink } from 'react-router-dom'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import { useTitulo } from '../useTitulo'

export function NaoEncontrada() {
  useTitulo('Página não encontrada')
  return (
    <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
      <Typography variant="h1">Página não encontrada</Typography>
      <Typography color="text.secondary" sx={{ mt: 2, mb: 4 }}>
        O endereço pode ter mudado ou a página ainda não foi escrita.
      </Typography>
      <Button component={RouterLink} to="/" variant="contained">
        Voltar ao início
      </Button>
    </Container>
  )
}
