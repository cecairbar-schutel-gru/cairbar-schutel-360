import ClearIcon from '@mui/icons-material/Clear'
import SearchIcon from '@mui/icons-material/Search'
import {
  Button,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material'
import { useState } from 'react'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { vendaService } from '../services'
import { ROTULO_TIPO, type ProdutoVendavel } from '../types'

const MINIMO_BUSCA = 2

/** Busca única por nome, título, autor ou ISBN (US-SALES-002); sem saldo aparece desabilitado. */
export function BuscaProdutos({ onAdicionar }: { onAdicionar(produto: ProdutoVendavel): void }) {
  const [termo, setTermo] = useState('')
  const aplicado = useDebounce(termo.trim(), 250)
  const ativa = aplicado.length >= MINIMO_BUSCA
  const { dados, carregando, erro } = useCarregamento(
    () => (ativa ? vendaService.buscarProdutos(aplicado) : Promise.resolve([])),
    [aplicado, ativa],
  )

  return (
    <Pilha spacing={2}>
      <TextField
        type="search"
        label="Buscar produto por nome, título, autor ou ISBN"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: termo && (
              <InputAdornment position="end">
                <IconButton aria-label="Limpar busca" edge="end" onClick={() => setTermo('')}>
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      {ativa && carregando && <Carregando />}
      {ativa && erro && (
        <Aviso tipo="error" titulo="Erro na busca">
          {erro}
        </Aviso>
      )}
      {ativa && !carregando && dados?.length === 0 && <TextoSuave>Nenhum produto ativo encontrado.</TextoSuave>}
      {ativa && dados && dados.length > 0 && (
        <TableContainer>
          <Table size="small" aria-label="Produtos encontrados">
            <TableHead>
              <TableRow>
                <TableCell>Produto</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell align="right">Preço</TableCell>
                <TableCell align="right">Disponível</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {dados.map((p) => {
                const semSaldo = p.disponivel <= 0
                return (
                  <TableRow key={p.id} sx={semSaldo ? { '& td': { color: 'text.disabled' } } : undefined}>
                    <TableCell>
                      {p.nome}
                      {p.autor && <TextoSuave>{p.autor}</TextoSuave>}
                    </TableCell>
                    <TableCell>{ROTULO_TIPO[p.tipo]}</TableCell>
                    <TableCell align="right">{formatarMoeda(p.preco)}</TableCell>
                    <TableCell align="right">{semSaldo ? 'Sem estoque' : p.disponivel}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        disabled={semSaldo}
                        aria-label={`Adicionar ${p.nome}`}
                        onClick={() => onAdicionar(p)}
                      >
                        Adicionar
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Pilha>
  )
}
