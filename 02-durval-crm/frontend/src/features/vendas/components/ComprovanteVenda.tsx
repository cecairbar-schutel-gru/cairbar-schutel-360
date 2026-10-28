import {
  Box,
  Card,
  CardContent,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import logo from '../../../shared/assets/ce_cairbar_logo.png'
import { TextoSuave } from '../../../shared/components/layout'
import { formatarDataHora } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { rotuloPagamento } from '../../../shared/pagamento/regras'
import { SEM_VALOR_FISCAL, type DetalheVenda } from '../types'

/** Comprovante de venda (US-SALES-008), com o mesmo conteúdo do PDF. */
export function ComprovanteVenda({ venda }: { venda: DetalheVenda }) {
  const cancelada = venda.status === 'CANCELADA'
  return (
    <Card variant="outlined" sx={{ position: 'relative', overflow: 'hidden', maxWidth: '40rem' }}>
      {cancelada && (
        <Typography
          aria-hidden
          sx={(theme) => ({
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: 'rotate(-30deg)',
            fontSize: '5rem',
            fontWeight: 700,
            color: theme.palette.error.main,
            opacity: 0.15,
            pointerEvents: 'none',
          })}
        >
          CANCELADA
        </Typography>
      )}
      <CardContent>
        <Box component="img" src={logo} alt="" sx={{ width: '12rem', display: 'block', mx: 'auto', mb: 2 }} />
        <Typography variant="subtitle1" component="p" sx={{ fontWeight: 600 }}>
          {venda.organizacao.nome}
        </Typography>
        {venda.organizacao.cnpj && <TextoSuave>CNPJ {venda.organizacao.cnpj}</TextoSuave>}
        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" component="h2">
          Comprovante de venda nº {venda.numero}
        </Typography>
        <Typography sx={{ fontWeight: 600 }}>{SEM_VALOR_FISCAL}</Typography>
        {cancelada && (
          <Typography color="error" sx={{ fontWeight: 600 }}>
            CANCELADA em {formatarDataHora(venda.canceladaEm)}. Motivo: {venda.motivoCancelamento}
          </Typography>
        )}
        <TextoSuave>
          {formatarDataHora(venda.confirmadaEm)}
        </TextoSuave>
        <Table size="small" aria-label="Itens do comprovante" sx={{ mt: 1 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ pl: 0 }}>Item</TableCell>
              <TableCell align="right">Qtd</TableCell>
              <TableCell align="right">Unitário</TableCell>
              <TableCell align="right" sx={{ pr: 0 }}>
                Subtotal
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {venda.itens.map((i) => (
              <TableRow key={i.produtoId}>
                <TableCell sx={{ pl: 0 }}>{i.produtoNome}</TableCell>
                <TableCell align="right">{i.quantidade}</TableCell>
                <TableCell align="right">{formatarMoeda(i.precoUnitario)}</TableCell>
                <TableCell align="right" sx={{ pr: 0 }}>
                  {formatarMoeda(i.subtotal)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={3} sx={{ pl: 0 }}>
                <strong>Total</strong>
              </TableCell>
              <TableCell align="right" sx={{ pr: 0 }}>
                <strong>{formatarMoeda(venda.total)}</strong>
              </TableCell>
            </TableRow>
            {venda.pagamentos.map((p, i) => (
              <TableRow key={i}>
                <TableCell colSpan={3} sx={{ pl: 0 }}>
                  {rotuloPagamento(p)}
                </TableCell>
                <TableCell align="right" sx={{ pr: 0 }}>
                  {formatarMoeda(p.valor)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TextoSuave>Vendedor: {venda.vendedorNome ?? '—'}</TextoSuave>
      </CardContent>
    </Card>
  )
}
