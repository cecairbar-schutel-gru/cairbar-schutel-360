import { Chip } from '@mui/material'
import {
  COR_SITUACAO_PEDIDO,
  COR_SITUACAO_REMESSA,
  COR_STATUS_OBRIGACAO,
  ROTULO_SITUACAO_PEDIDO,
  ROTULO_SITUACAO_REMESSA,
  ROTULO_STATUS_OBRIGACAO,
} from '../rotulos'
import type { SituacaoPedido, SituacaoRemessa, StatusObrigacao } from '../types'

export function StatusEditoraTag({ ativa }: { ativa: boolean }) {
  return <Chip size="small" variant="outlined" color={ativa ? 'success' : 'default'} label={ativa ? 'Ativa' : 'Inativa'} />
}

export function SituacaoRemessaTag({ situacao }: { situacao: SituacaoRemessa }) {
  return <Chip size="small" variant="outlined" color={COR_SITUACAO_REMESSA[situacao]} label={ROTULO_SITUACAO_REMESSA[situacao]} />
}

export function SituacaoPedidoTag({ situacao }: { situacao: SituacaoPedido }) {
  return <Chip size="small" variant="outlined" color={COR_SITUACAO_PEDIDO[situacao]} label={ROTULO_SITUACAO_PEDIDO[situacao]} />
}

export function StatusObrigacaoTag({ status }: { status: StatusObrigacao }) {
  return <Chip size="small" variant="outlined" color={COR_STATUS_OBRIGACAO[status]} label={ROTULO_STATUS_OBRIGACAO[status]} />
}
