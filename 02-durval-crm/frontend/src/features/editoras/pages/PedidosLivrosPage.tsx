import AddIcon from '@mui/icons-material/Add'
import { Button, MenuItem, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField } from '@mui/material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarData } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { SituacaoPedidoTag } from '../components/Tags'
import { editoraService } from '../services'
import type { SituacaoPedido } from '../types'

const POR_PAGINA = 10

/**
 * Pedidos de novos livros às editoras (Tesouraria): situação de cada pedido e a remessa que o atendeu.
 * Consignado não gera despesa; o Vendedor recebe a remessa contra o pedido.
 */
export function PedidosLivrosPage() {
  const navegar = useNavigate()
  const [editoraId, setEditoraId] = useState<number | ''>('')
  const [situacao, setSituacao] = useState<SituacaoPedido | ''>('')
  const [pagina, setPagina] = useState(0)
  const editoras = useCarregamento(() => editoraService.listar('TODAS'), [])
  const pedidos = useCarregamento(
    () => editoraService.pedidos({ editoraId: editoraId || undefined, situacao: situacao || undefined }),
    [editoraId, situacao],
  )
  const lista = pedidos.dados ?? []
  return (
    <Pilha component="section" aria-labelledby="titulo-pedidos-livros">
      <LinkRota to="/editoras">Voltar às editoras</LinkRota>
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <TituloPagina id="titulo-pedidos-livros">Pedidos de livros</TituloPagina>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navegar('/editoras/pedidos/novo')}>
          Novo pedido
        </Button>
      </LinhaAcoes>
      <GradeForm role="search" aria-label="Filtrar pedidos">
        <TextField select label="Editora" value={editoraId} onChange={(e) => { setEditoraId(Number(e.target.value) || ''); setPagina(0) }}>
          <MenuItem value="">Todas</MenuItem>
          {(editoras.dados ?? []).map((e) => (
            <MenuItem key={e.id} value={e.id}>
              {e.nome}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Situação" value={situacao} onChange={(e) => { setSituacao(e.target.value as SituacaoPedido | ''); setPagina(0) }}>
          <MenuItem value="">Todas</MenuItem>
          <MenuItem value="ABERTO">Aguardando entrega</MenuItem>
          <MenuItem value="RECEBIDO">Recebidos</MenuItem>
          <MenuItem value="CANCELADO">Cancelados</MenuItem>
        </TextField>
      </GradeForm>
      {pedidos.carregando && <Carregando />}
      {pedidos.erro && <Aviso tipo="error" titulo="Erro">{pedidos.erro}</Aviso>}
      {!pedidos.carregando && !pedidos.erro && lista.length === 0 && <TextoSuave>Nenhum pedido encontrado.</TextoSuave>}
      {lista.length > 0 && (
        <>
          <Table size="small" aria-label="Pedidos de livros">
            <TableHead>
              <TableRow>
                <TableCell>Pedido</TableCell>
                <TableCell>Editora</TableCell>
                <TableCell>Pedido em</TableCell>
                <TableCell>Pedido por</TableCell>
                <TableCell align="right">Títulos</TableCell>
                <TableCell align="right">Unidades</TableCell>
                <TableCell>Remessa</TableCell>
                <TableCell>Situação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lista.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA).map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>
                    <LinkRota to={`/editoras/pedidos/${p.id}`}>Nº {p.id}</LinkRota>
                  </TableCell>
                  <TableCell>{p.editoraNome}</TableCell>
                  <TableCell>{formatarData(p.pedidoEm)}</TableCell>
                  <TableCell>{p.pedidoPor}</TableCell>
                  <TableCell align="right">{p.titulos}</TableCell>
                  <TableCell align="right">{p.unidades}</TableCell>
                  <TableCell>
                    {p.remessaId ? <LinkRota to={`/editoras/remessas/${p.remessaId}`}>{p.remessaCodigo}</LinkRota> : '—'}
                  </TableCell>
                  <TableCell>
                    <SituacaoPedidoTag situacao={p.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={lista.length}
            page={pagina}
            onPageChange={(_, n) => setPagina(n)}
            rowsPerPage={POR_PAGINA}
            rowsPerPageOptions={[POR_PAGINA]}
          />
        </>
      )}
    </Pilha>
  )
}
