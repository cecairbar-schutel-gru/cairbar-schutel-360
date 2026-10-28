import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import {
  Button,
  InputAdornment,
  MenuItem,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
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
import { formatarData } from '../../../shared/formatters/datas'
import { apenasDigitos, formatarMoeda, formatarTelefone } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { normalizarTexto } from '../../../shared/text/texto'
import { SituacaoRemessaTag, StatusEditoraTag } from '../components/Tags'
import { formatarCnpj } from '../regras'
import { editoraService } from '../services'
import type { SituacaoEditoras, SituacaoRemessa } from '../types'

const POR_PAGINA = 10

function ListaEditoras({ tesouraria }: { tesouraria: boolean }) {
  const [termo, setTermo] = useState('')
  const [situacao, setSituacao] = useState<SituacaoEditoras>('ATIVAS')
  const [pagina, setPagina] = useState(0)
  const editoras = useCarregamento(() => editoraService.listar(situacao), [situacao])

  const busca = normalizarTexto(termo)
  const digitos = apenasDigitos(termo)
  const lista = (editoras.dados ?? []).filter(
    (e) => !busca || normalizarTexto(e.nome).includes(busca) || (digitos.length > 0 && (e.cnpj ?? '').includes(digitos)),
  )
  return (
    <>
      <GradeForm role="search" aria-label="Filtrar editoras">
        <TextField
          label="Buscar por nome ou CNPJ"
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value)
            setPagina(0)
          }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
        />
        <TextField select label="Situação" value={situacao} onChange={(e) => setSituacao(e.target.value as SituacaoEditoras)}>
          <MenuItem value="ATIVAS">Ativas</MenuItem>
          <MenuItem value="INATIVAS">Inativas</MenuItem>
          <MenuItem value="TODAS">Todas</MenuItem>
        </TextField>
      </GradeForm>
      {editoras.carregando && <Carregando />}
      {editoras.erro && <Aviso tipo="error" titulo="Erro">{editoras.erro}</Aviso>}
      {!editoras.carregando && !editoras.erro && lista.length === 0 && <TextoSuave>Nenhuma editora encontrada.</TextoSuave>}
      {lista.length > 0 && (
        <>
          <Table size="small" aria-label="Editoras">
            <TableHead>
              <TableRow>
                <TableCell>Editora</TableCell>
                <TableCell>CNPJ</TableCell>
                <TableCell>Contato</TableCell>
                <TableCell align="right">Remessas abertas</TableCell>
                {tesouraria && <TableCell align="right">Saldo devido</TableCell>}
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lista.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA).map((e) => (
                <TableRow key={e.id} hover>
                  <TableCell>
                    <LinkRota to={`/editoras/${e.id}`}>{e.nome}</LinkRota>
                  </TableCell>
                  <TableCell>{formatarCnpj(e.cnpj)}</TableCell>
                  <TableCell>
                    {e.contatoNome ?? '—'}
                    {e.telefone && (
                      <Typography variant="body2" color="text.secondary">
                        {formatarTelefone(e.telefone)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">{e.remessasAbertas}</TableCell>
                  {tesouraria && <TableCell align="right">{formatarMoeda(e.saldoDevido)}</TableCell>}
                  <TableCell>
                    <StatusEditoraTag ativa={e.ativa} />
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
    </>
  )
}

function ListaRemessas() {
  const [editoraId, setEditoraId] = useState<number | ''>('')
  const [situacao, setSituacao] = useState<SituacaoRemessa | ''>('')
  const [pagina, setPagina] = useState(0)
  const editoras = useCarregamento(() => editoraService.listar('TODAS'), [])
  const remessas = useCarregamento(
    () => editoraService.remessas({ editoraId: editoraId || undefined, situacao: situacao || undefined }),
    [editoraId, situacao],
  )
  const lista = remessas.dados ?? []
  return (
    <>
      <GradeForm role="search" aria-label="Filtrar remessas">
        <TextField select label="Editora" value={editoraId} onChange={(e) => { setEditoraId(Number(e.target.value) || ''); setPagina(0) }}>
          <MenuItem value="">Todas</MenuItem>
          {(editoras.dados ?? []).map((e) => (
            <MenuItem key={e.id} value={e.id}>
              {e.nome}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Situação" value={situacao} onChange={(e) => { setSituacao(e.target.value as SituacaoRemessa | ''); setPagina(0) }}>
          <MenuItem value="">Todas</MenuItem>
          <MenuItem value="ABERTA">Abertas</MenuItem>
          <MenuItem value="ENCERRADA">Encerradas</MenuItem>
          <MenuItem value="CANCELADA">Canceladas</MenuItem>
        </TextField>
      </GradeForm>
      {remessas.carregando && <Carregando />}
      {remessas.erro && <Aviso tipo="error" titulo="Erro">{remessas.erro}</Aviso>}
      {!remessas.carregando && !remessas.erro && lista.length === 0 && <TextoSuave>Nenhuma remessa encontrada.</TextoSuave>}
      {lista.length > 0 && (
        <>
          <Table size="small" aria-label="Remessas">
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Editora</TableCell>
                <TableCell>Recebida em</TableCell>
                <TableCell>Documento</TableCell>
                <TableCell align="right">Recebidas</TableCell>
                <TableCell align="right">Restantes</TableCell>
                <TableCell>Situação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lista.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA).map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <LinkRota to={`/editoras/remessas/${r.id}`}>{r.codigo}</LinkRota>
                  </TableCell>
                  <TableCell>{r.editoraNome}</TableCell>
                  <TableCell>{formatarData(r.recebidaEm)}</TableCell>
                  <TableCell>{r.numeroDocumento ?? '—'}</TableCell>
                  <TableCell align="right">{r.recebidas}</TableCell>
                  <TableCell align="right">{r.restantes}</TableCell>
                  <TableCell>
                    <SituacaoRemessaTag situacao={r.situacao} />
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
    </>
  )
}

/**
 * Editoras (US-PUBLISHER-001 e 003), no padrão do wireframe 10: abas de editoras e de remessas,
 * busca, filtros, tabela com status e paginação.
 */
export function EditorasPage() {
  const { possuiPapel } = useAuth()
  const navegar = useNavigate()
  const [parametros, setParametros] = useSearchParams()
  const aba = parametros.get('aba') === 'remessas' ? 'remessas' : 'editoras'
  // Cadastro e remessas são do Vendedor; saldos e pagamentos, da Tesouraria. O Administrador faz tudo.
  const cadastro = possuiPapel('vendedor', 'administrador')
  const tesouraria = possuiPapel('tesoureiro', 'administrador')
  return (
    <Pilha component="section" aria-labelledby="titulo-editoras">
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <TituloPagina id="titulo-editoras">Editoras</TituloPagina>
        <LinhaAcoes>
          {tesouraria && (
            <Button variant="outlined" onClick={() => navegar('/editoras/pedidos')}>
              Pedidos de livros
            </Button>
          )}
          {tesouraria && (
            <Button variant="outlined" onClick={() => navegar('/editoras/saldos')}>
              Saldos e pagamentos
            </Button>
          )}
          {cadastro && (
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => navegar('/editoras/nova')}>
              Nova editora
            </Button>
          )}
          {cadastro && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navegar('/editoras/remessas/nova')}>
              Registrar remessa
            </Button>
          )}
        </LinhaAcoes>
      </LinhaAcoes>
      <Tabs
        value={aba}
        onChange={(_, v: string) => setParametros(v === 'remessas' ? { aba: 'remessas' } : {}, { replace: true })}
        aria-label="Editoras ou remessas"
      >
        <Tab value="editoras" label="Editoras" />
        <Tab value="remessas" label="Remessas" />
      </Tabs>
      {aba === 'editoras' ? <ListaEditoras tesouraria={tesouraria} /> : <ListaRemessas />}
    </Pilha>
  )
}
