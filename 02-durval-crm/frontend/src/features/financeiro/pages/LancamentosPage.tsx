import SearchIcon from '@mui/icons-material/Search'
import {
  Button,
  Chip,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { BotaoExportar } from '../../../shared/components/BotaoExportar'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarData, hoje, paraIsoData } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { lerValor, paraReais } from '../../../shared/pagamento/regras'
import { NaturezaTag, Valor } from '../components/Tags'
import { linkDaOrigem, ROTULO_NATUREZA, ROTULO_ORIGEM } from '../rotulos'
import { relatorioService } from '../../relatorios/services'
import { financeiroService } from '../services'
import type { FiltroLancamentos, ItemLancamento, NaturezaLancamento, OrigemLancamento, PaginaLancamentos } from '../types'

const inicioDoMes = () => `${paraIsoData(hoje()).slice(0, 8)}01`

interface Campos {
  contaId: number | ''
  de: string
  ate: string
  natureza: NaturezaLancamento | ''
  categoria: string
  origem: OrigemLancamento | ''
  texto: string
  valor: string
}

function paraFiltro(c: Campos): FiltroLancamentos {
  const centavos = lerValor(c.valor)
  return {
    contaId: c.contaId === '' ? undefined : c.contaId,
    de: c.de || undefined,
    ate: c.ate || undefined,
    natureza: c.natureza || undefined,
    categoria: c.categoria || undefined,
    origem: c.origem || undefined,
    texto: c.texto.trim() || undefined,
    valor: centavos === null || Number.isNaN(centavos) ? undefined : paraReais(centavos),
  }
}

/**
 * Lançamentos (US-FINANCIAL-005): filtros por conta, período, tipo, categoria, origem, texto e
 * valor; com uma conta, saldo anterior, saldo depois de cada lançamento e saldo final. 50 por vez.
 */
export function LancamentosPage() {
  const { perfilAtivo } = useAuth()
  const navegar = useNavigate()
  const [parametros] = useSearchParams()
  // Drill-down dos relatórios (US-REPORT): conta, período, tipo e categoria chegam pela URL.
  const contaInicial = parametros.get('contaId')
  const naturezaInicial = parametros.get('natureza') ?? ''
  const inicial: Campos = {
    contaId: contaInicial ? Number(contaInicial) : '',
    de: parametros.get('de') ?? inicioDoMes(),
    ate: parametros.get('ate') ?? paraIsoData(hoje()),
    natureza: naturezaInicial in ROTULO_NATUREZA ? (naturezaInicial as NaturezaLancamento) : '',
    categoria: parametros.get('categoria') ?? '',
    origem: '',
    texto: '',
    valor: '',
  }
  const [campos, setCampos] = useState<Campos>(inicial)
  const [filtro, setFiltro] = useState<FiltroLancamentos>(() => paraFiltro(inicial))
  // Páginas seguintes ("Carregar mais") valem só para o filtro com que foram buscadas.
  const [mais, setMais] = useState<{ filtro: FiltroLancamentos; paginas: PaginaLancamentos[] }>({ filtro, paginas: [] })
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erroMais, setErroMais] = useState<string | null>(null)
  const primeiraPagina = useCarregamento(() => financeiroService.lancamentos(filtro, 0), [filtro])
  const contas = useCarregamento(() => financeiroService.contas(), [])
  const categorias = useCarregamento(() => financeiroService.categorias(), [])
  const alterar = (parcial: Partial<Campos>) => setCampos((c) => ({ ...c, ...parcial }))
  const paginas = primeiraPagina.dados ? [primeiraPagina.dados, ...(mais.filtro === filtro ? mais.paginas : [])] : []
  const carregando = primeiraPagina.carregando || carregandoMais
  const erro = primeiraPagina.erro ?? erroMais

  async function carregarMais() {
    setCarregandoMais(true)
    setErroMais(null)
    try {
      const proxima = await financeiroService.lancamentos(filtro, paginas.length)
      setMais((m) => ({ filtro, paginas: [...(m.filtro === filtro ? m.paginas : []), proxima] }))
    } catch (e) {
      setErroMais(mensagemDeErro(e))
    }
    setCarregandoMais(false)
  }

  function aplicar(e: FormEvent) {
    e.preventDefault()
    setFiltro(paraFiltro(campos))
  }

  const primeira = paginas[0]
  const ultima = paginas[paginas.length - 1]
  const itens = paginas.flatMap((p) => p.itens)
  const conta = primeira?.conta ?? null
  const bancaria = conta?.tipo === 'BANCO'
  return (
    <Pilha component="section" aria-labelledby="titulo-lancamentos">
      <LinkRota to="/financeiro">Voltar ao Financeiro</LinkRota>
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <TituloPagina id="titulo-lancamentos">Lançamentos</TituloPagina>
        {perfilAtivo === 'tesoureiro' && (
          <Button variant="contained" onClick={() => navegar('/financeiro/lancamentos/novo')}>
            Lançamento manual
          </Button>
        )}
      </LinhaAcoes>

      <Pilha component="form" role="search" aria-label="Filtrar lançamentos" onSubmit={aplicar} spacing={2}>
        <GradeForm>
          <TextField select label="Conta" value={campos.contaId} onChange={(e) => alterar({ contaId: e.target.value === '' ? '' : Number(e.target.value) })}>
            <MenuItem value="">Todas</MenuItem>
            {(contas.dados ?? []).map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.nome}
              </MenuItem>
            ))}
          </TextField>
          <TextField type="date" label="De" value={campos.de} onChange={(e) => alterar({ de: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }} />
          <TextField type="date" label="Até" value={campos.ate} onChange={(e) => alterar({ ate: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }} />
          <TextField select label="Tipo" value={campos.natureza} onChange={(e) => alterar({ natureza: e.target.value as NaturezaLancamento | '' })}>
            <MenuItem value="">Todos</MenuItem>
            {(Object.keys(ROTULO_NATUREZA) as NaturezaLancamento[]).map((n) => (
              <MenuItem key={n} value={n}>
                {ROTULO_NATUREZA[n]}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Categoria" value={campos.categoria} onChange={(e) => alterar({ categoria: e.target.value })}>
            <MenuItem value="">Todas</MenuItem>
            {(categorias.dados ?? []).map((c) => (
              <MenuItem key={c.codigo} value={c.codigo} sx={{ pl: c.categoriaPai ? 4 : 2 }}>
                {c.nome}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Origem" value={campos.origem} onChange={(e) => alterar({ origem: e.target.value as OrigemLancamento | '' })}>
            <MenuItem value="">Todas</MenuItem>
            {(Object.keys(ROTULO_ORIGEM) as OrigemLancamento[]).map((o) => (
              <MenuItem key={o} value={o}>
                {ROTULO_ORIGEM[o]}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Texto na descrição" value={campos.texto} onChange={(e) => alterar({ texto: e.target.value })} />
          <TextField label="Valor" value={campos.valor} onChange={(e) => alterar({ valor: e.target.value })}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
        </GradeForm>
        <LinhaAcoes>
          <Button type="submit" variant="outlined" startIcon={<SearchIcon />}>
            Filtrar
          </Button>
          <BotaoExportar exportar={(formato) => relatorioService.exportar('lancamentos', formato, { ...filtro })} />
        </LinhaAcoes>
      </Pilha>

      {erro && (
        <Aviso tipo="error" titulo="Erro">
          {erro}
        </Aviso>
      )}
      {conta && primeira.saldoAnterior !== null && (
        <Typography>
          {conta.nome}: saldo anterior ao período <Valor valor={primeira.saldoAnterior} negrito />
        </Typography>
      )}
      {!carregando && !erro && itens.length === 0 && <TextoSuave>Nenhum lançamento encontrado.</TextoSuave>}
      {itens.length > 0 && (
        <TableContainer>
          <Table size="small" aria-label="Lançamentos encontrados">
            <TableHead>
              <TableRow>
                <TableCell>Data</TableCell>
                <TableCell>Descrição</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Categoria</TableCell>
                <TableCell>Origem</TableCell>
                {!conta && <TableCell>Contas</TableCell>}
                <TableCell align="right">Valor</TableCell>
                {conta && <TableCell align="right">Saldo</TableCell>}
                {bancaria && <TableCell>Conciliação</TableCell>}
                <TableCell>Usuário</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {itens.map((l) => (
                <Linha key={l.id} item={l} comConta={!!conta} bancaria={bancaria} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {carregando && <Carregando />}
      {ultima?.temMais && !carregando && (
        <LinhaAcoes>
          <Button variant="outlined" onClick={() => void carregarMais()}>
            Carregar mais 50
          </Button>
        </LinhaAcoes>
      )}
      {conta && ultima && !ultima.temMais && ultima.saldoFinal !== null && (
        <Typography>
          Saldo final do período: <Valor valor={ultima.saldoFinal} negrito />
        </Typography>
      )}
    </Pilha>
  )
}

function Linha({ item: l, comConta, bancaria }: { item: ItemLancamento; comConta: boolean; bancaria: boolean }) {
  const origem = linkDaOrigem(l.origemTipo, l.origemId)
  const marcado = l.estornadoPorId !== null || l.estornaLancamentoId !== null
  return (
    <TableRow hover sx={marcado ? { '& td': { color: 'text.secondary' } } : undefined}>
      <TableCell>{formatarData(l.data)}</TableCell>
      <TableCell>
        <LinkRota to={`/financeiro/lancamentos/${l.id}`}>{l.descricao}</LinkRota>
        {l.estornadoPorId !== null && (
          <Chip size="small" variant="outlined" color="error" label={`Estornado pelo nº ${l.estornadoPorId}`} sx={{ ml: 1 }} />
        )}
        {l.estornaLancamentoId !== null && (
          <Chip size="small" variant="outlined" label={`Estorno do nº ${l.estornaLancamentoId}`} sx={{ ml: 1 }} />
        )}
        {l.corrigeLancamentoId !== null && (
          <Chip size="small" variant="outlined" color="info" label={`Corrige o nº ${l.corrigeLancamentoId}`} sx={{ ml: 1 }} />
        )}
      </TableCell>
      <TableCell>
        <NaturezaTag natureza={l.natureza} />
      </TableCell>
      <TableCell>{l.categorias.join(', ') || '—'}</TableCell>
      <TableCell>
        {origem ? <LinkRota to={origem}>{ROTULO_ORIGEM[l.origemTipo]}</LinkRota> : ROTULO_ORIGEM[l.origemTipo]}
      </TableCell>
      {!comConta && <TableCell>{l.contas.join(l.natureza === 'TRANSFERENCIA' ? ' → ' : ', ')}</TableCell>}
      <TableCell align="right">
        <Valor valor={l.valor} />
      </TableCell>
      {comConta && (
        <TableCell align="right">
          <Valor valor={l.saldoApos} />
        </TableCell>
      )}
      {bancaria && <TableCell>{l.conciliado ? 'Conciliado' : 'Pendente'}</TableCell>}
      <TableCell>{l.usuario}</TableCell>
    </TableRow>
  )
}
