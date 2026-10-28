import { TextField } from '@mui/material'
import { useState } from 'react'
import { Aviso } from '../../../shared/components/Aviso'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { Pilha } from '../../../shared/components/layout'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { mensagemDetalhada } from '../regras'
import { contribuicaoService } from '../services'
import { MINIMO_MOTIVO_CANCELAMENTO, type Recibo } from '../types'

/** US-CONTRIB-011: motivo obrigatório; o original é preservado e os lançamentos estornados. */
export function CancelarContribuicaoModal({
  recibo,
  onFechar,
  onCancelada,
}: {
  recibo: Recibo
  onFechar(): void
  onCancelada(): void
}) {
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const curto = motivo.trim().length < MINIMO_MOTIVO_CANCELAMENTO

  async function confirmar() {
    setEnviando(true)
    setErro(null)
    try {
      await contribuicaoService.cancelar(recibo.contribuicaoId, motivo.trim())
      onCancelada()
    } catch (e) {
      setErro(mensagemDetalhada(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <DialogoAcao
      aberto
      perigo
      rotulo={`Recibo nº ${recibo.numero} · ${formatarMoeda(recibo.total)}`}
      titulo="Cancelar contribuição"
      textoConfirmar="Cancelar contribuição"
      confirmarDesabilitado={curto || enviando}
      onFechar={onFechar}
      onConfirmar={() => void confirmar()}
    >
      <Pilha spacing={2}>
        <Aviso tipo="warning" titulo="Estorno">
          Os lançamentos serão estornados e as competências voltarão a ficar pendentes. O registro
          original é mantido. Para corrigir, registre de novo pelo fluxo normal.
        </Aviso>
        {erro && <Aviso tipo="error" titulo="Não foi possível cancelar">{erro}</Aviso>}
        <TextField
          label="Motivo"
          required
          multiline
          minRows={2}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          helperText={`Mínimo de ${MINIMO_MOTIVO_CANCELAMENTO} caracteres.`}
        />
      </Pilha>
    </DialogoAcao>
  )
}
