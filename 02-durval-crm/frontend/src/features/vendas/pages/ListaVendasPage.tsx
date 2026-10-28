import SearchIcon from '@mui/icons-material/Search'
import {
  Button,
  Chip,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
} from '@mui/material'
import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarDataHora, hoje, paraIsoData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { ROTULO_MEIO } from '../../../shared/pagamento/regras'
import { StatusVendaTag } from '../components/StatusVendaTag'
import { vendaService } from '../services'
import type { FiltroVendas, StatusVenda } from '../types'

const POR_PAGINA = 20

/** Lista de vendas (US-SALES-011): as do Vendedor (tesouraria: todas), por padrão as de hoje. */
export function ListaVendasPage() {
  const { possuiPapel } = useAuth()
  const navegar = useNavigate()
  const dia = paraIsoData(hoje())
  // Drill-down do relatório de vendas (US-REPORT-006): período e situação pela URL.
  const [parametros] = useSearchParams()
  const deInicial = parametros.get('de') ?? dia
  const ateInicial = parametros.get('ate') ?? dia
  const statusInicial = parametros.get('status') === 'CANCELADA' || parametros.get('status') === 'CONCLUIDA'
    ? (parametros.get('status') as StatusVenda) : undefined
  const [de, setDe] = useState(deInicial)
  const [ate, setAte] = useState(ateInicial)
  const [status, setStatus] = useState<StatusVenda | ''>(statusInicial ?? '')
  const [origem, setOrigem] = useState<'' | 'PDV' | 'OUTRAS'>('')
  const [numero, setNumero] = useState('')
  const [filtro, setFiltro] = useState<FiltroVendas>({ de: deInicial, ate: ateInicial, status: statusInicial })
  const [pagina, setPagina] = useState(0)
  const vendas = useCarregamento(() => vendaService.listar(filtro), [filtro])

  function aplicar(evento: FormEvent) {
    evento.preventDefault()
    const n = numero.trim()
    setPagina(0)
    setFiltro({
      ...(n ? { numero: Number(n) } : { de: de || undefined, ate: ate || undefined }),
      status: status === '' ? undefined : status,
      pdv: origem === '' ? undefined : origem === 'PDV',
    })
  }

  const lista = vendas.dados ?? []
  return (
    <Pilha component="section" aria-labelledby="titulo-vendas">
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <TituloPagina id="titulo-vendas">Vendas</TituloPagina>
        {possuiPapel('vendedor') && (
          <Button variant="contained" onClick={() => navegar('/vendas/nova')}>
            Nova venda
          </Button>
        )}
      </LinhaAcoes>

      <Pilha component="form" role="search" aria-label="Filtrar vendas" onSubmit={aplicar} spacing={2}>
        <GradeForm>
          <TextField type="date" label="De" value={de} onChange={(e) => setDe(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }} disabled={numero.trim() !== ''} />
          <TextField type="date" label="Até" value={ate} onChange={(e) => setAte(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }} disabled={numero.trim() !== ''} />
          <TextField select label="Situação" value={status} onChange={(e) => setStatus(e.target.value as StatusVenda | '')}>
            <MenuItem value="">Todas</MenuItem>
            <MenuItem value="CONCLUIDA">Concluídas</MenuItem>
            <MenuItem value="CANCELADA">Canceladas</MenuItem>
          </TextField>
          <TextField select label="Origem" value={origem} onChange={(e) => setOrigem(e.target.value as typeof origem)}>
            <MenuItem value="">Todas</MenuItem>
            <MenuItem value="PDV">PDV da cantina</MenuItem>
            <MenuItem value="OUTRAS">Fora do PDV</MenuItem>
          </TextField>
          <TextField
            label="Número da venda"
            value={numero}
            onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
            helperText="Com número, o período é ignorado."
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          />
        </GradeForm>
        <LinhaAcoes>
          <Button type="submit" variant="outlined" startIcon={<SearchIcon />}>
            Filtrar
          </Button>
        </LinhaAcoes>
      </Pilha>

      {vendas.carregando && <Carregando />}
      {vendas.erro && <Aviso tipo="error" titulo="Erro">{vendas.erro}</Aviso>}
      {!vendas.carregando && !vendas.erro && lista.length === 0 && <TextoSuave>Nenhuma venda encontrada.</TextoSuave>}
      {lista.length > 0 && (
        <>
          <Table size="small" aria-label="Vendas encontradas">
            <TableHead>
              <TableRow>
                <TableCell>Nº</TableCell>
                <TableCell>Data/hora</TableCell>
                <TableCell>Vendedor</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Formas</TableCell>
                <TableCell>Situação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lista.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA).map((v) => (
                <TableRow key={v.id} hover>
                  <TableCell>
                    <LinkRota to={`/vendas/${v.id}`}>{v.numero}</LinkRota>
                  </TableCell>
                  <TableCell>{formatarDataHora(v.confirmadaEm)}</TableCell>
                  <TableCell>
                    {v.vendedorNome ?? '—'}
                    {v.pdv && <Chip size="small" label="PDV" sx={{ ml: 1 }} />}
                  </TableCell>
                  <TableCell align="right">{formatarMoeda(v.total)}</TableCell>
                  <TableCell>{v.meios.map((m) => ROTULO_MEIO[m]).join(', ')}</TableCell>
                  <TableCell>
                    <StatusVendaTag status={v.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={lista.length}
            page={pagina}
            onPageChange={(_, p) => setPagina(p)}
            rowsPerPage={POR_PAGINA}
            rowsPerPageOptions={[POR_PAGINA]}
          />
        </>
      )}
    </Pilha>
  )
}
