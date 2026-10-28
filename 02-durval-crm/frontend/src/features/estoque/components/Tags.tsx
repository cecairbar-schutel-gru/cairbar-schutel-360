import { Chip } from '@mui/material'
import { ROTULO_STATUS_SOLICITACAO } from '../rotulos'
import type { StatusSolicitacao } from '../types'

export function StatusProdutoTag({ ativo }: { ativo: boolean }) {
  return <Chip size="small" variant="outlined" color={ativo ? 'success' : 'default'} label={ativo ? 'Ativo' : 'Inativo'} />
}

const COR_STATUS = { PENDENTE: 'warning', APROVADA: 'success', REJEITADA: 'error', CANCELADA: 'default' } as const

export function StatusSolicitacaoTag({ status }: { status: StatusSolicitacao }) {
  return <Chip size="small" variant="outlined" color={COR_STATUS[status]} label={ROTULO_STATUS_SOLICITACAO[status]} />
}
