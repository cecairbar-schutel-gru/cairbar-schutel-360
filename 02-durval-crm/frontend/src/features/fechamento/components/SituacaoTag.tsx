import { Chip } from '@mui/material'
import { COR_SITUACAO, ROTULO_SITUACAO } from '../rotulos'
import type { SituacaoPeriodo } from '../types'

export function SituacaoTag({ situacao }: { situacao: SituacaoPeriodo }) {
  return <Chip size="small" variant="outlined" color={COR_SITUACAO[situacao]} label={ROTULO_SITUACAO[situacao]} />
}
