import { TextField } from '@mui/material'
import { useState } from 'react'
import { mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { Pilha } from '../../../shared/components/layout'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { vendaService } from '../services'
import { MINIMO_MOTIVO_CANCELAMENTO, type DetalheVenda } from '../types'

/**
 * US-SALES-009: motivo obrigatório; a venda original é preservada e tudo é estornado. No PDV o motivo
 * já vem preenchido ("Cancelada no PDV") e pode ser editado (US-SALES-022).
 */
export function CancelarVendaModal({
  venda,
  motivoInicial = '',
  onFechar,
  onCancelada,
}: {
  venda: Pick<DetalheVenda, 'id' | 'numero' | 'total'>
  motivoInicial?: string
  onFechar(): void
  onCancelada(): void
}) {
  const [motivo, setMotivo] = useState(motivoInicial)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const curto = motivo.trim().length < MINIMO_MOTIVO_CANCELAMENTO

  async function confirmar() {
    setEnviando(true)
    setErro(null)
    try {
      await vendaService.cancelar(venda.id, motivo.trim())
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
      rotulo={`Venda nº ${venda.numero} · ${formatarMoeda(venda.total)}`}
      titulo="Cancelar venda"
      textoConfirmar="Cancelar venda"
      confirmarDesabilitado={curto || enviando}
      onFechar={onFechar}
      onConfirmar={() => void confirmar()}
    >
      <Pilha spacing={2}>
        <Aviso tipo="warning" titulo="Estorno">
          As contas recebem estorno, o estoque volta (os consignados para as mesmas remessas) e as
          obrigações com editoras são estornadas. A venda original é mantida. Para corrigir, use “Refazer venda”
          depois.
        </Aviso>
        {erro && (
          <Aviso tipo="error" titulo="Não foi possível cancelar">
            {erro}
          </Aviso>
        )}
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
