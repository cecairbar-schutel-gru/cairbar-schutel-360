import { TextField } from '@mui/material'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { TextoSuave } from '../../../shared/components/layout'

/** Diálogo com um texto obrigatório (motivo do cancelamento, nota da transferência). */
export function DialogoTexto({
  aberto,
  titulo,
  descricao,
  rotulo,
  textoConfirmar,
  valor,
  erro,
  perigo,
  onAlterar,
  onFechar,
  onConfirmar,
}: {
  aberto: boolean
  titulo: string
  descricao: string
  rotulo: string
  textoConfirmar: string
  valor: string
  erro: string | null
  perigo?: boolean
  onAlterar(valor: string): void
  onFechar(): void
  onConfirmar(): void
}) {
  return (
    <DialogoAcao
      aberto={aberto}
      titulo={titulo}
      textoConfirmar={textoConfirmar}
      perigo={perigo}
      confirmarDesabilitado={!valor.trim()}
      onFechar={onFechar}
      onConfirmar={onConfirmar}
    >
      <TextoSuave>{descricao}</TextoSuave>
      <TextField
        label={rotulo}
        value={valor}
        onChange={(e) => onAlterar(e.target.value)}
        required
        fullWidth
        multiline
        minRows={2}
        error={!!erro}
        helperText={erro ?? ' '}
        sx={{ mt: 2 }}
        slotProps={{ htmlInput: { maxLength: 500 } }}
      />
    </DialogoAcao>
  )
}
