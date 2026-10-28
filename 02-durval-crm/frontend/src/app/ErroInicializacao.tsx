import { Box, Button } from '@mui/material'
import { Aviso } from '../shared/components/Aviso'

/** O backend ou o Keycloak não responderam ao abrir o sistema. */
export function ErroInicializacao() {
  return (
    <Box component="main" sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh', p: 3 }}>
      <Box sx={{ width: 'min(32rem, 100%)' }}>
        <Aviso tipo="error" titulo="Não foi possível abrir o DurvalCRM">
          O serviço de acesso não respondeu. Tente de novo em alguns instantes.
        </Aviso>
        <Button variant="contained" sx={{ mt: 2 }} onClick={() => window.location.reload()}>
          Tentar de novo
        </Button>
      </Box>
    </Box>
  )
}
