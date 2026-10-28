import { TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { nomeDoMes } from '../../financeiro/regras'

interface Props {
  mes: string
  onFechar(): void
  onFecharPeriodo(nota: string): Promise<void>
}

/** US-CLOSING-008: confirmação com nota opcional. */
export function FecharPeriodoDialogo({ mes, onFechar, onFecharPeriodo }: Props) {
  const [nota, setNota] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    setErro(null)
    setEnviando(true)
    try {
      await onFecharPeriodo(nota)
    } catch (e) {
      setErro(mensagemDetalhada(e))
      setEnviando(false)
    }
  }

  return (
    <DialogoAcao
      aberto
      titulo={`Fechar ${nomeDoMes(mes)}`}
      textoConfirmar="Fechar período"
      confirmarDesabilitado={enviando}
      onFechar={onFechar}
      onConfirmar={() => void confirmar()}
    >
      <Typography gutterBottom>
        Depois de fechado, nenhum lançamento, movimento, conciliação ou reclassificação poderá ser datado neste mês.
        Cancelamentos e correções do que aconteceu nele entram na data de hoje. Os saldos por conta e o demonstrativo
        ficam gravados. Só o Administrador pode reabrir.
      </Typography>
      {erro && (
        <Aviso tipo="error" titulo="Não foi possível fechar">
          {erro}
        </Aviso>
      )}
      <TextField
        label="Nota do fechamento (opcional)"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        multiline
        minRows={2}
        fullWidth
        sx={{ mt: 2 }}
        slotProps={{ htmlInput: { maxLength: 1000 } }}
      />
    </DialogoAcao>
  )
}
