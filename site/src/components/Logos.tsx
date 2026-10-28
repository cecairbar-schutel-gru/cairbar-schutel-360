import Box, { type BoxProps } from '@mui/material/Box'
import logoPng from '../assets/logo-cecairbar.png'
import logoWebp from '../assets/logo-cecairbar.webp'
import simboloPng from '../assets/simbolo-cecairbar.png'
import logoDurval from '../assets/logo-durvalcrm.png'

/** Logotipo horizontal do CE Cairbar Schutel Guarulhos. */
export function LogoCairbar({ altura, sx }: { altura: number; sx?: BoxProps['sx'] }) {
  return (
    <Box component="picture" sx={{ display: 'block', lineHeight: 0, ...sx }}>
      <source srcSet={logoWebp} type="image/webp" />
      <Box
        component="img"
        src={logoPng}
        alt="CE Cairbar Schutel Guarulhos"
        sx={{ height: altura, width: 'auto', maxWidth: '100%' }}
      />
    </Box>
  )
}

/** Só o símbolo das faixas (usado pela Comunidade Cairbar). */
export function SimboloCairbar({ tamanho, sx }: { tamanho: number; sx?: BoxProps['sx'] }) {
  return (
    <Box
      component="img"
      src={simboloPng}
      alt="Símbolo do CE Cairbar Schutel"
      sx={{ width: tamanho, height: tamanho, display: 'block', ...sx }}
    />
  )
}

/** Avatar circular do DurvalCRM. */
export function LogoDurval({ tamanho, sx }: { tamanho: number; sx?: BoxProps['sx'] }) {
  return (
    <Box
      component="img"
      src={logoDurval}
      alt="Logotipo do DurvalCRM"
      sx={{ width: tamanho, height: tamanho, borderRadius: '50%', display: 'block', ...sx }}
    />
  )
}
