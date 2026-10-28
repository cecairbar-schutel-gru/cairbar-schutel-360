import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import PendingIcon from '@mui/icons-material/PendingActions'
import { Box, Button, Chip, LinearProgress, List, ListItem, ListItemIcon, ListItemText, Typography } from '@mui/material'
import { LinkRota } from '../../../shared/components/LinkRota'
import { formatarData, formatarDataHora } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { linkDoItem } from '../regras'
import type { Checklist, ItemChecklist } from '../types'

interface Props {
  checklist: Checklist
  /** Só o Tesoureiro ou o Administrador confirma as liquidações de cartão. */
  podeConfirmarCartao: boolean
  confirmando: boolean
  onConfirmarCartao(): void
}

/**
 * Checklist do fechamento (US-CLOSING-001), no padrão de "Pendências do período" do wireframe 3: cada
 * item com a situação, a contagem e o link para a tela que resolve.
 */
export function ChecklistFechamento({ checklist: c, podeConfirmarCartao, confirmando, onConfirmarCartao }: Props) {
  const progresso = Math.round((c.concluidos / c.itens.length) * 100)
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <LinearProgress
          variant="determinate"
          value={progresso}
          sx={{ flexGrow: 1, height: 8, borderRadius: 1 }}
          aria-label={`Checklist: ${c.concluidos} de ${c.itens.length} itens concluídos`}
        />
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {c.concluidos} de {c.itens.length} concluídos
        </Typography>
      </Box>
      <List aria-label="Itens do checklist">
        {c.itens.map((item) => (
          <ListItem key={item.codigo} divider alignItems="flex-start" disableGutters>
            <ListItemIcon sx={{ mt: 0.5 }}>
              {item.concluido ? <CheckCircleIcon color="success" /> : <PendingIcon color="warning" />}
            </ListItemIcon>
            <ListItemText
              primary={
                <Box component="span" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                  <Typography component="span" variant="subtitle1">
                    {item.titulo}
                  </Typography>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={item.concluido ? 'success' : 'warning'}
                    label={item.concluido ? 'Concluído' : item.codigo === 'CARTAO' ? 'Aguardando confirmação' : `Pendente (${item.pendentes})`}
                  />
                  {!item.concluido && item.responsavel === 'ADMINISTRADOR' && (
                    <Chip size="small" variant="outlined" color="info" label="Aguardando o Administrador" />
                  )}
                </Box>
              }
              secondary={<Detalhes item={item} mes={c.mes} />}
              slotProps={{ secondary: { component: 'div' } }}
            />
            {item.codigo === 'CARTAO' && !item.concluido && podeConfirmarCartao && (
              <Button variant="outlined" size="small" disabled={confirmando} onClick={onConfirmarCartao} sx={{ ml: 2, mt: 0.5, flexShrink: 0 }}>
                Confirmar liquidações
              </Button>
            )}
          </ListItem>
        ))}
      </List>
    </Box>
  )
}

function Detalhes({ item, mes }: { item: ItemChecklist; mes: string }) {
  const link = <LinkRota to={linkDoItem(item.codigo, mes)}>{TEXTO_LINK[item.codigo]}</LinkRota>
  if (item.codigo === 'CARTAO' && item.cartao) {
    const k = item.cartao
    return (
      <>
        <Typography variant="body2" component="span" sx={{ display: 'block' }}>
          Cartão a receber no fim do mês: {formatarMoeda(k.saldoNoFimDoMes)} · última liquidação:{' '}
          {k.ultimaLiquidacao ? formatarData(k.ultimaLiquidacao) : 'nenhuma'}
        </Typography>
        <Typography variant="body2" component="span" sx={{ display: 'block' }}>
          {k.confirmadoPor
            ? `Confirmado por ${k.confirmadoPor} em ${formatarDataHora(k.confirmadoEm)}.`
            : 'Confirme que toda liquidação depositada até o fim do mês foi registrada.'}{' '}
          {link}
        </Typography>
      </>
    )
  }
  return (
    <>
      {item.detalhes.map((d) => (
        <Typography key={d} variant="body2" component="span" sx={{ display: 'block' }}>
          {d}
        </Typography>
      ))}
      {item.concluido && item.detalhes.length === 0 && (
        <Typography variant="body2" component="span" sx={{ display: 'block' }}>
          {TEXTO_OK[item.codigo]}
        </Typography>
      )}
      {!item.concluido && (
        <Typography variant="body2" component="span" sx={{ display: 'block' }}>
          {link}
        </Typography>
      )}
    </>
  )
}

const TEXTO_LINK: Record<ItemChecklist['codigo'], string> = {
  CONCILIACAO: 'Conciliar contas',
  INTENCOES: 'Aprovar gastos',
  ESTOQUE: 'Aprovações de estoque',
  EDITORAS: 'Pagar ou transferir saldos',
  CARTAO: 'Liquidar cartão',
}

const TEXTO_OK: Record<ItemChecklist['codigo'], string> = {
  CONCILIACAO: 'Todas as contas bancárias conciliadas até o último dia do mês.',
  INTENCOES: 'Nenhuma intenção pendente ou divergente.',
  ESTOQUE: 'Nenhum pedido de baixa, preço ou inativação pendente.',
  EDITORAS: 'Saldos das editoras pagos ou transferidos.',
  CARTAO: '',
}
