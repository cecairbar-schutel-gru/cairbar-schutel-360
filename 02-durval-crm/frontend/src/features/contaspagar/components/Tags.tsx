import { Chip } from '@mui/material'
import { COR_SITUACAO_PARCELA, ROTULO_SITUACAO_PARCELA } from '../rotulos'
import type { SituacaoParcela } from '../types'

export function SituacaoParcelaTag({ situacao }: { situacao: SituacaoParcela }) {
  return <Chip size="small" variant="outlined" color={COR_SITUACAO_PARCELA[situacao]} label={ROTULO_SITUACAO_PARCELA[situacao]} />
}

/** Quitada: conta única com o vencimento pago (inativa, sem nada mais a pagar). */
export function StatusContaPagarTag({ ativa, quitada }: { ativa: boolean; quitada: boolean }) {
  if (quitada) return <Chip size="small" variant="outlined" color="info" label="Quitada" />
  return <Chip size="small" variant="outlined" color={ativa ? 'success' : 'default'} label={ativa ? 'Ativa' : 'Encerrada'} />
}
