import AddIcon from '@mui/icons-material/Add'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import SearchIcon from '@mui/icons-material/Search'
import {
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarDataDoInstante } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { StatusProdutoTag } from '../components/Tags'
import { useAcoesProduto, type ProdutoComAcoes } from '../components/useAcoesProduto'
import { estoqueService } from '../services'
import type { ItemEstoque, SituacaoCatalogo, TipoProduto } from '../types'

const POR_PAGINA = 10

/** Menu "…" de ações de uma linha. */
function MenuAcoes({ produto, acoes }: { produto: ItemEstoque; acoes: ReturnType<typeof useAcoesProduto>['acoes'] }) {
  const [ancora, setAncora] = useState<HTMLElement | null>(null)
  const lista = acoes(produto as ProdutoComAcoes)
  return (
    <>
      <IconButton aria-label={`Ações de ${produto.nome}`} onClick={(e) => setAncora(e.currentTarget)}>
        <MoreHorizIcon />
      </IconButton>
      <Menu anchorEl={ancora} open={ancora !== null} onClose={() => setAncora(null)}>
        {lista.map((a) => (
          <MenuItem
            key={a.rotulo}
            onClick={() => {
              setAncora(null)
              a.executar()
            }}
          >
            {a.rotulo}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

/**
 * Estoque (wireframe 10, US-INVENTORY-009): abas da cantina e dos livros, busca, filtros, saldo
 * com "aguardando baixa", última entrada, status e ações por produto.
 */
export function EstoquePage() {
  const { possuiPapel } = useAuth()
  const navegar = useNavigate()
  const [parametros, setParametros] = useSearchParams()
  const tipo: TipoProduto = parametros.get('aba') === 'livros' ? 'LIVRO' : 'CANTINA'
  const [termo, setTermo] = useState('')
  const [categoria, setCategoria] = useState('')
  const [situacao, setSituacao] = useState<SituacaoCatalogo>('ATIVOS')
  const [semSaldo, setSemSaldo] = useState(false)
  const [pagina, setPagina] = useState(0)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const q = useDebounce(termo.trim())
  const estoquista = possuiPapel('vendedor', 'administrador')
  const admin = possuiPapel('administrador')

  const itens = useCarregamento(
    () => estoqueService.listar({ tipo, q, categoria: categoria || undefined, situacao, somenteSemSaldo: semSaldo }),
    [tipo, q, categoria, situacao, semSaldo],
  )
  const opcoes = useCarregamento(() => (estoquista ? estoqueService.opcoes() : Promise.resolve(null)), [estoquista])
  const { acoes, modal } = useAcoesProduto((m) => {
    setMensagem(m)
    itens.recarregar()
  })

  function trocarAba(nova: TipoProduto) {
    setPagina(0)
    setCategoria('')
    setParametros(nova === 'LIVRO' ? { aba: 'livros' } : {}, { replace: true })
  }

  const lista = itens.dados ?? []
  const livros = tipo === 'LIVRO'
  return (
    <Pilha component="section" aria-labelledby="titulo-estoque">
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <TituloPagina id="titulo-estoque">Estoque</TituloPagina>
        <LinhaAcoes>
          {estoquista && (
            <Button variant="outlined" onClick={() => navegar('/estoque/solicitacoes')}>
              {admin ? 'Aprovações' : 'Minhas solicitações'}
            </Button>
          )}
          {estoquista && (
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => navegar(`/estoque/produtos/novo?tipo=${tipo}`)}>
              {livros ? 'Novo título' : 'Novo produto'}
            </Button>
          )}
          {estoquista && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navegar('/estoque/entrada-doacao')}>
              Registrar entrada
            </Button>
          )}
        </LinhaAcoes>
      </LinhaAcoes>

      {mensagem && (
        <Aviso tipo="success" titulo="Pronto" onFechar={() => setMensagem(null)}>
          {mensagem}
        </Aviso>
      )}

      <Tabs value={tipo} onChange={(_, v: TipoProduto) => trocarAba(v)} aria-label="Tipo de produto">
        <Tab value="CANTINA" label="Produtos da cantina" />
        <Tab value="LIVRO" label="Livros consignados" />
      </Tabs>

      <GradeForm role="search" aria-label="Filtrar estoque">
        <TextField
          label={livros ? 'Buscar por título, autor ou ISBN' : 'Buscar produto'}
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value)
            setPagina(0)
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            },
          }}
        />
        {!livros && (
          <TextField select label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <MenuItem value="">Todas</MenuItem>
            {(opcoes.dados?.categorias ?? []).map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </TextField>
        )}
        <TextField select label="Situação" value={situacao} onChange={(e) => setSituacao(e.target.value as SituacaoCatalogo)}>
          <MenuItem value="ATIVOS">Ativos</MenuItem>
          <MenuItem value="INATIVOS">Inativos</MenuItem>
          <MenuItem value="TODOS">Todos</MenuItem>
        </TextField>
        <FormControlLabel
          control={<Switch checked={semSaldo} onChange={(e) => setSemSaldo(e.target.checked)} />}
          label="Somente sem saldo"
        />
      </GradeForm>

      {itens.carregando && <Carregando />}
      {itens.erro && (
        <Aviso tipo="error" titulo="Erro">
          {itens.erro}
        </Aviso>
      )}
      {!itens.carregando && !itens.erro && lista.length === 0 && <TextoSuave>Nenhum produto encontrado.</TextoSuave>}
      {lista.length > 0 && (
        <>
          <TableContainer>
            <Table size="small" aria-label={livros ? 'Livros' : 'Produtos da cantina'}>
              <TableHead>
                <TableRow>
                  <TableCell>{livros ? 'Título' : 'Produto'}</TableCell>
                  <TableCell align="right">Preço</TableCell>
                  <TableCell align="right">Saldo</TableCell>
                  {livros && <TableCell align="right">Próprio</TableCell>}
                  {livros && <TableCell align="right">Consignado</TableCell>}
                  <TableCell>Última entrada</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lista.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA).map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      <LinkRota to={`/estoque/produtos/${p.id}`}>{p.nome}</LinkRota>
                      <Typography variant="body2" color="text.secondary">
                        {livros ? [p.autor, p.editoraNome].filter(Boolean).join(' · ') : p.categoria}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{formatarMoeda(p.preco)}</TableCell>
                    <TableCell align="right">
                      {p.saldo}
                      {p.aguardandoBaixa > 0 && (
                        <Chip
                          size="small"
                          color="warning"
                          variant="outlined"
                          label={`${p.aguardandoBaixa} aguardando baixa`}
                          sx={{ ml: 1 }}
                        />
                      )}
                    </TableCell>
                    {livros && <TableCell align="right">{p.saldoProprio}</TableCell>}
                    {livros && <TableCell align="right">{p.saldoConsignado}</TableCell>}
                    <TableCell>{formatarDataDoInstante(p.ultimaEntrada)}</TableCell>
                    <TableCell>
                      <StatusProdutoTag ativo={p.ativo} />
                    </TableCell>
                    <TableCell align="right">
                      <MenuAcoes produto={p} acoes={acoes} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
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
      {modal}
    </Pilha>
  )
}
