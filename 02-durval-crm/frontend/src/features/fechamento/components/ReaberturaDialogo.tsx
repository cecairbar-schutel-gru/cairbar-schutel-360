import { TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { nomeDoMes } from '../../financeiro/regras'
import { justificativaValida, MINIMO_JUSTIFICATIVA } from '../regras'

interface Props {
  mes: string
  onFechar(): void
  onReabrir(justificativa: string): Promise<void>
}

/** US-CLOSING-009: só o Administrador, com justificativa e confirmação. */
export function ReaberturaDialogo({ mes, onFechar, onReabrir }: Props) {
  const [justificativa, setJustificativa] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const tamanho = justificativa.trim().replace(/\s+/g, ' ').length

  async function confirmar() {
    setErro(null)
    setEnviando(true)
    try {
      await onReabrir(justificativa)
    } catch (e) {
      setErro(mensagemDetalhada(e))
      setEnviando(false)
    }
  }

  return (
    <DialogoAcao
      aberto
      titulo={`Reabrir ${nomeDoMes(mes)}`}
      textoConfirmar="Reabrir período"
      perigo
      confirmarDesabilitado={enviando || !justificativaValida(justificativa)}
      onFechar={onFechar}
      onConfirmar={() => void confirmar()}
    >
      <Typography gutterBottom>
        O mês volta a aceitar lançamentos e precisa passar pelo checklist e ser fechado de novo. Todos os usuários verão
        um aviso enquanto ele estiver reaberto; a versão fechada atual do demonstrativo fica guardada.
      </Typography>
      {erro && (
        <Aviso tipo="error" titulo="Não foi possível reabrir">
          {erro}
        </Aviso>
      )}
      <TextField
        label="Justificativa"
        value={justificativa}
        onChange={(e) => setJustificativa(e.target.value)}
        multiline
        minRows={3}
        fullWidth
        required
        sx={{ mt: 2 }}
        helperText={`${tamanho} caracteres (mínimo ${MINIMO_JUSTIFICATIVA})`}
        slotProps={{ htmlInput: { maxLength: 1000 } }}
      />
    </DialogoAcao>
  )
}
