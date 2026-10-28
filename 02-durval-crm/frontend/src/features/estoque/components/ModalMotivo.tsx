import { TextField } from '@mui/material'
import { useState, type ReactNode } from 'react'
import { mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { Pilha } from '../../../shared/components/layout'

interface Props {
  titulo: string
  rotulo?: string
  textoConfirmar: string
  rotuloCampo?: string
  perigo?: boolean
  /** Bloqueia a confirmação (ex.: inativar produto da cantina com saldo). */
  bloqueado?: boolean
  children?: ReactNode
  onFechar(): void
  onConfirmar(motivo: string): Promise<void>
}

/** Diálogo com motivo obrigatório: rejeições, cancelamentos e inativações. */
export function ModalMotivo({ titulo, rotulo, textoConfirmar, rotuloCampo = 'Motivo', perigo, bloqueado, children, onFechar, onConfirmar }: Props) {
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function confirmar() {
    setEnviando(true)
    setErro(null)
    try {
      await onConfirmar(motivo.trim())
    } catch (e) {
      setErro(mensagemDetalhada(e))
      setEnviando(false)
    }
  }

  return (
    <DialogoAcao
      aberto
      perigo={perigo}
      rotulo={rotulo}
      titulo={titulo}
      textoConfirmar={textoConfirmar}
      confirmarDesabilitado={bloqueado || !motivo.trim() || enviando}
      onFechar={onFechar}
      onConfirmar={() => void confirmar()}
    >
      <Pilha spacing={2}>
        {children}
        {erro && (
          <Aviso tipo="error" titulo="Não foi possível concluir">
            {erro}
          </Aviso>
        )}
        <TextField
          label={rotuloCampo}
          required
          multiline
          minRows={2}
          value={motivo}
          disabled={bloqueado}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </Pilha>
    </DialogoAcao>
  )
}
