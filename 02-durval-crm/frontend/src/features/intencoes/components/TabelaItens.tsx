import { Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import type { ItemCompra } from '../types'

/** Produtos da compra da cantina: pedido e, depois da conferência, o recebido lado a lado (US-EXPENSE-007). */
export function TabelaItens({ itens, rotulo = 'Itens da compra' }: { itens: ItemCompra[]; rotulo?: string }) {
  const comRecebido = itens.some((i) => i.quantidadeRecebida !== null)
  return (
    <Table size="small" aria-label={rotulo}>
      <TableHead>
        <TableRow>
          <TableCell>Produto</TableCell>
          <TableCell align="right">Quantidade aprovada</TableCell>
          {comRecebido && <TableCell align="right">Recebida</TableCell>}
        </TableRow>
      </TableHead>
      <TableBody>
        {itens.map((i) => (
          <TableRow key={i.produtoId}>
            <TableCell>{i.produtoNome}</TableCell>
            <TableCell align="right">{i.quantidade}</TableCell>
            {comRecebido && (
              <TableCell align="right">
                <Typography
                  component="span"
                  variant="inherit"
                  color={i.quantidadeRecebida !== i.quantidade ? 'error' : undefined}
                  sx={{ fontWeight: i.quantidadeRecebida !== i.quantidade ? 600 : undefined }}
                >
                  {i.quantidadeRecebida ?? '—'}
                </Typography>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
