import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

interface Props {
  aberto: boolean
  titulo: string
  rotulo?: string
  textoConfirmar: string
  perigo?: boolean
  confirmarDesabilitado?: boolean
  onFechar(): void
  onConfirmar(): void
  children: ReactNode
}

/**
 * Primeiro campo marcado como inválido (`aria-invalid`). Num select, o input marcado fica oculto: o foco
 * vai para o combobox visível do mesmo campo.
 */
function primeiroCampoInvalido(raiz: HTMLElement): HTMLElement | null {
  for (const campo of raiz.querySelectorAll<HTMLElement>('[aria-invalid="true"]')) {
    if (campo.getAttribute('aria-hidden') !== 'true' && campo.tabIndex >= 0) return campo
    const visivel = campo.closest('.MuiInputBase-root')?.querySelector<HTMLElement>('[role="combobox"]')
    if (visivel) return visivel
  }
  return null
}

/**
 * Diálogo modal com ações "Cancelar" e confirmar. Se a confirmação deixar algum campo inválido, rola
 * até o primeiro e o foca, para o erro não ficar abaixo da dobra.
 */
export function DialogoAcao({
  aberto,
  titulo,
  rotulo,
  textoConfirmar,
  perigo,
  confirmarDesabilitado,
  onFechar,
  onConfirmar,
  children,
}: Props) {
  const idTitulo = useId()
  const conteudo = useRef<HTMLDivElement>(null)
  const [tentativas, setTentativas] = useState(0)

  // Roda depois da renderização com os erros da validação feita no clique em confirmar.
  useEffect(() => {
    if (tentativas === 0 || !conteudo.current) return
    const campo = primeiroCampoInvalido(conteudo.current)
    campo?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    campo?.focus({ preventScroll: true })
  }, [tentativas])

  return (
    <Dialog
      open={aberto}
      onClose={onFechar}
      aria-labelledby={idTitulo}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle id={idTitulo}>
        {rotulo && (
          <Typography
            component="span"
            variant="overline"
            color="text.secondary"
            sx={{ display: 'block' }}
          >
            {rotulo}
          </Typography>
        )}
        {titulo}
      </DialogTitle>
      <DialogContent>
        {/* Espaço para o rótulo flutuante do primeiro campo não ser cortado. */}
        <Box ref={conteudo} sx={{ pt: 1 }}>
          {children}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar}>Cancelar</Button>
        <Button
          variant="contained"
          color={perigo ? 'error' : 'primary'}
          disabled={confirmarDesabilitado}
          onClick={() => {
            onConfirmar()
            setTentativas((n) => n + 1)
          }}
        >
          {textoConfirmar}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
