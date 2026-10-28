import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { Alert, Button, CircularProgress, ListItemText, Menu, MenuItem, Snackbar } from '@mui/material'
import { useId, useState } from 'react'
import { mensagemDeErro, salvarArquivo, type ArquivoBaixado } from '../api/http'

export type FormatoArquivo = 'PDF' | 'XLSX'

/**
 * "Exportar" com Excel e PDF (wireframe 12, US-REPORT-021). O arquivo sai com os filtros aplicados
 * na tela; quem gera é o servidor, que também registra a exportação na auditoria.
 */
export function BotaoExportar({ exportar, desabilitado }: { exportar: (formato: FormatoArquivo) => Promise<ArquivoBaixado>; desabilitado?: boolean }) {
  const id = useId()
  const [ancora, setAncora] = useState<HTMLElement | null>(null)
  const aberto = ancora !== null
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function gerar(formato: FormatoArquivo) {
    setAncora(null)
    setGerando(true)
    setErro(null)
    try {
      salvarArquivo(await exportar(formato))
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
    setGerando(false)
  }

  return (
    <>
      <Button
        variant="contained"
        endIcon={gerando ? <CircularProgress size={16} color="inherit" aria-hidden /> : <ArrowDropDownIcon />}
        onClick={(e) => setAncora(e.currentTarget)}
        disabled={gerando || desabilitado}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? `${id}-menu` : undefined}
        data-nao-imprimir
      >
        {gerando ? 'Gerando…' : 'Exportar'}
      </Button>
      <Menu id={`${id}-menu`} anchorEl={ancora} open={aberto} onClose={() => setAncora(null)}>
        <MenuItem onClick={() => gerar('XLSX')}>
          <ListItemText primary="Excel (.xlsx)" secondary="Uma linha por registro, com totais" />
        </MenuItem>
        <MenuItem onClick={() => gerar('PDF')}>
          <ListItemText primary="PDF" secondary="Com cabeçalho, filtros e páginas numeradas" />
        </MenuItem>
      </Menu>
      <Snackbar open={erro !== null} autoHideDuration={8000} onClose={() => setErro(null)}>
        <Alert severity="error" variant="filled" onClose={() => setErro(null)}>
          Não foi possível exportar: {erro}
        </Alert>
      </Snackbar>
    </>
  )
}
