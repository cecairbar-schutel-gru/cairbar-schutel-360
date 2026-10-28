import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import RemoveIcon from '@mui/icons-material/Remove'
import {
  Box,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { TextoSuave } from '../../../shared/components/layout'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { paraReais } from '../../../shared/pagamento/regras'
import { mensagemLimite, totalDoCarrinho, validarQuantidade } from '../regras'
import { ROTULO_TIPO, type ItemCarrinho } from '../types'

interface Props {
  itens: ItemCarrinho[]
  /** Mensagens por produto vindas da confirmação (sem saldo, preço alterado, inativo). */
  errosDoServidor: Map<number, string>
  onAlterarQuantidade(produtoId: number, quantidade: number): void
  onRemover(produtoId: number): void
  onValidade(produtoId: number, valida: boolean): void
}

function semChave(registro: Record<number, string>, chave: number): Record<number, string> {
  const copia = { ...registro }
  delete copia[chave]
  return copia
}

/** Carrinho (US-SALES-002): produto, quantidade, preço unitário vigente, subtotal e total. */
export function Carrinho({ itens, errosDoServidor, onAlterarQuantidade, onRemover, onValidade }: Props) {
  // Texto digitado por linha enquanto for inválido (ex.: acima do disponível).
  const [digitado, setDigitado] = useState<Record<number, string>>({})
  const [avisos, setAvisos] = useState<Record<number, string>>({})

  if (itens.length === 0) return <TextoSuave>O carrinho está vazio. Busque um produto ou toque num item da cantina.</TextoSuave>

  function digitar(item: ItemCarrinho, texto: string) {
    const { quantidade, erro } = validarQuantidade(texto, item.disponivel)
    if (quantidade !== null) {
      setDigitado((d) => semChave(d, item.produtoId))
      onValidade(item.produtoId, true)
      onAlterarQuantidade(item.produtoId, quantidade)
    } else {
      setDigitado((d) => ({ ...d, [item.produtoId]: texto }))
      onValidade(item.produtoId, false)
    }
    setAvisos((a) => ({ ...a, [item.produtoId]: erro ?? '' }))
  }

  function somar(item: ItemCarrinho, delta: number) {
    const nova = item.quantidade + delta
    if (nova > item.disponivel) {
      setAvisos((a) => ({ ...a, [item.produtoId]: mensagemLimite(item.disponivel) }))
      return
    }
    if (nova < 1) return
    setDigitado((d) => semChave(d, item.produtoId))
    setAvisos((a) => ({ ...a, [item.produtoId]: '' }))
    onValidade(item.produtoId, true)
    onAlterarQuantidade(item.produtoId, nova)
  }

  return (
    <TableContainer>
      <Table size="small" aria-label="Carrinho">
        <TableHead>
          <TableRow>
            <TableCell>Produto</TableCell>
            <TableCell align="right">Preço</TableCell>
            <TableCell align="center">Quantidade</TableCell>
            <TableCell align="right">Subtotal</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {itens.map((item) => {
            const acimaDoSaldo = item.quantidade > item.disponivel
            const mensagem =
              errosDoServidor.get(item.produtoId) ||
              avisos[item.produtoId] ||
              (acimaDoSaldo ? mensagemLimite(item.disponivel) : '')
            const idMensagem = `carrinho-msg-${item.produtoId}`
            return (
              <TableRow
                key={item.produtoId}
                aria-invalid={mensagem ? true : undefined}
                sx={mensagem ? { bgcolor: 'action.hover' } : undefined}
              >
                <TableCell>
                  <Typography component="span">{item.nome}</Typography>{' '}
                  <Chip size="small" variant="outlined" label={ROTULO_TIPO[item.tipo]} />
                  {item.precoAnterior !== null && (
                    <Typography variant="body2" color="warning.dark">
                      Preço mudou: era {formatarMoeda(item.precoAnterior)}
                    </Typography>
                  )}
                  {mensagem && (
                    <Typography id={idMensagem} variant="body2" color="error" role="alert">
                      {mensagem}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">{formatarMoeda(item.preco)}</TableCell>
                <TableCell align="center">
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                    <IconButton size="small" aria-label={`Diminuir ${item.nome}`} onClick={() => somar(item, -1)}>
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                    <TextField
                      size="small"
                      value={digitado[item.produtoId] ?? String(item.quantidade)}
                      onChange={(e) => digitar(item, e.target.value)}
                      error={Boolean(mensagem)}
                      slotProps={{
                        htmlInput: {
                          inputMode: 'numeric',
                          'aria-label': `Quantidade de ${item.nome}`,
                          'aria-describedby': mensagem ? idMensagem : undefined,
                          size: 3,
                          style: { textAlign: 'center' },
                        },
                      }}
                      sx={{ width: '4.5rem' }}
                    />
                    <IconButton size="small" aria-label={`Aumentar ${item.nome}`} onClick={() => somar(item, 1)}>
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </TableCell>
                <TableCell align="right">{formatarMoeda(item.preco * item.quantidade)}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Remover">
                    <IconButton aria-label={`Remover ${item.nome}`} onClick={() => onRemover(item.produtoId)}>
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>
              <Typography sx={{ fontWeight: 600 }}>Total</Typography>
            </TableCell>
            <TableCell align="right">
              <Typography sx={{ fontWeight: 600 }} data-testid="total-carrinho">
                {formatarMoeda(paraReais(totalDoCarrinho(itens)))}
              </Typography>
            </TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </TableContainer>
  )
}
