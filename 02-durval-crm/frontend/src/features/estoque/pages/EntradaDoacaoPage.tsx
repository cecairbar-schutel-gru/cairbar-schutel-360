import DeleteIcon from '@mui/icons-material/Delete'
import {
  Autocomplete,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useAuth } from '../../../auth/AuthProvider'
import { mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarDataHora } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { ModalMotivo } from '../components/ModalMotivo'
import { estoqueService } from '../services'
import { MAXIMO_OBSERVACAO, type ItemEstoque, type ResumoEntradaDoacao } from '../types'

interface Linha {
  produto: ItemEstoque
  quantidade: string
}

/**
 * Entrada por doação (US-INVENTORY-006): livros e produtos da cantina entram na hora como estoque
 * próprio, sem lançamento financeiro. O Administrador cancela enquanto as unidades estão no estoque.
 */
export function EntradaDoacaoPage() {
  const { possuiPapel } = useAuth()
  const [termo, setTermo] = useState('')
  const q = useDebounce(termo.trim())
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [cancelando, setCancelando] = useState<ResumoEntradaDoacao | null>(null)
  const encontrados = useCarregamento(
    () => (q.length >= 2 ? estoqueService.listar({ q, situacao: 'ATIVOS' }) : Promise.resolve([])),
    [q],
  )
  const entradas = useCarregamento(() => estoqueService.entradasDoacao(), [])

  const validas = linhas.length > 0 && linhas.every((l) => Number(l.quantidade) > 0 && Number.isInteger(Number(l.quantidade)))

  function adicionar(produto: ItemEstoque | null) {
    if (!produto || linhas.some((l) => l.produto.id === produto.id)) return
    setLinhas((ls) => [...ls, { produto, quantidade: '1' }])
    setTermo('')
  }

  async function registrar() {
    setEnviando(true)
    setErro(null)
    setSucesso(null)
    try {
      const r = await estoqueService.registrarDoacao({
        itens: linhas.map((l) => ({ produtoId: l.produto.id, quantidade: Number(l.quantidade) })),
        observacao: observacao.trim(),
      })
      setSucesso(`Entrada nº ${r.id} registrada. O estoque já foi atualizado.`)
      setLinhas([])
      setObservacao('')
      entradas.recarregar()
    } catch (e) {
      setErro(mensagemDetalhada(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-doacao">
      <LinkRota to="/estoque">Voltar ao estoque</LinkRota>
      <TituloPagina id="titulo-doacao">Entrada por doação</TituloPagina>
      <TextoSuave>
        Os produtos doados entram como estoque próprio, prontos para vender. Não há lançamento financeiro. A
        entrada de compras é feita pelo recebimento da intenção de gasto aprovada.
      </TextoSuave>
      {sucesso && (
        <Aviso tipo="success" titulo="Entrada registrada" onFechar={() => setSucesso(null)}>
          {sucesso}
        </Aviso>
      )}
      {erro && (
        <Aviso tipo="error" titulo="Não foi possível registrar">
          {erro}
        </Aviso>
      )}

      <Autocomplete
        options={encontrados.dados ?? []}
        getOptionLabel={(p) => `${p.nome}${p.tipo === 'LIVRO' ? ' (livro)' : p.categoria ? ` (${p.categoria})` : ''}`}
        filterOptions={(x) => x}
        inputValue={termo}
        onInputChange={(_, v, motivo) => motivo !== 'reset' && setTermo(v)}
        value={null}
        onChange={(_, p) => adicionar(p)}
        noOptionsText={q.length < 2 ? 'Digite ao menos 2 letras' : 'Nenhum produto ativo encontrado'}
        loading={encontrados.carregando}
        loadingText="Buscando…"
        renderInput={(params) => <TextField {...params} label="Adicionar produto (nome, título, autor ou ISBN)" />}
      />

      {linhas.length === 0 ? (
        <TextoSuave>Nenhum produto adicionado.</TextoSuave>
      ) : (
        <Table size="small" aria-label="Produtos doados">
          <TableHead>
            <TableRow>
              <TableCell>Produto</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell align="right">Saldo atual</TableCell>
              <TableCell>Quantidade</TableCell>
              <TableCell align="right">Remover</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {linhas.map((l, i) => (
              <TableRow key={l.produto.id}>
                <TableCell>{l.produto.nome}</TableCell>
                <TableCell>{l.produto.tipo === 'LIVRO' ? 'Livro' : 'Cantina'}</TableCell>
                <TableCell align="right">{l.produto.saldo}</TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    label={`Quantidade de ${l.produto.nome}`}
                    value={l.quantidade}
                    onChange={(e) => {
                      const valor = e.target.value.replace(/\D/g, '')
                      setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, quantidade: valor } : x)))
                    }}
                    error={!(Number(l.quantidade) > 0)}
                    slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton aria-label={`Remover ${l.produto.nome}`} onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <TextField
        label="Doador ou observação (opcional)"
        value={observacao}
        onChange={(e) => setObservacao(e.target.value.slice(0, MAXIMO_OBSERVACAO))}
        helperText={`${observacao.length}/${MAXIMO_OBSERVACAO}`}
      />
      <LinhaAcoes>
        <Button variant="contained" disabled={!validas || enviando} onClick={() => void registrar()}>
          Registrar entrada
        </Button>
      </LinhaAcoes>

      <Typography variant="h5" component="h2">
        Entradas recentes
      </Typography>
      {entradas.carregando && <Carregando />}
      {entradas.dados && entradas.dados.length === 0 && <TextoSuave>Nenhuma entrada por doação ainda.</TextoSuave>}
      {entradas.dados && entradas.dados.length > 0 && (
        <Table size="small" aria-label="Entradas por doação">
          <TableHead>
            <TableRow>
              <TableCell>Nº</TableCell>
              <TableCell>Data/hora</TableCell>
              <TableCell>Itens</TableCell>
              <TableCell>Observação</TableCell>
              <TableCell>Registrada por</TableCell>
              <TableCell>Situação</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entradas.dados.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.id}</TableCell>
                <TableCell>{formatarDataHora(e.registradaEm)}</TableCell>
                <TableCell>{e.itens.map((i) => `${i.quantidade} × ${i.produtoNome}`).join(', ')}</TableCell>
                <TableCell>{e.observacao ?? '—'}</TableCell>
                <TableCell>{e.registradaPorNome ?? '—'}</TableCell>
                <TableCell>
                  {e.canceladaEm ? (
                    `Cancelada por ${e.canceladaPorNome ?? '—'}: ${e.motivoCancelamento ?? ''}`
                  ) : possuiPapel('administrador') ? (
                    <Button size="small" color="error" disabled={!e.cancelavel} onClick={() => setCancelando(e)}>
                      {e.cancelavel ? 'Cancelar' : 'Unidades já saíram'}
                    </Button>
                  ) : (
                    'Registrada'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {cancelando && (
        <ModalMotivo
          titulo="Cancelar entrada por doação"
          rotulo={`Entrada nº ${cancelando.id}`}
          textoConfirmar="Cancelar entrada"
          perigo
          onFechar={() => setCancelando(null)}
          onConfirmar={async (motivo) => {
            await estoqueService.cancelarDoacao(cancelando.id, motivo)
            setCancelando(null)
            setSucesso(`Entrada nº ${cancelando.id} cancelada: as unidades saíram do estoque com movimento de estorno.`)
            entradas.recarregar()
          }}
        >
          <TextoSuave>O movimento original é mantido e um estorno retira as unidades do estoque próprio.</TextoSuave>
        </ModalMotivo>
      )}
    </Pilha>
  )
}
