import SearchIcon from '@mui/icons-material/Search'
import {
  Button,
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
import { useParams, useSearchParams } from 'react-router-dom'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { Indicador } from '../../../shared/components/Indicador'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarData, formatarDataDoInstante, formatarDataHora } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { StatusProdutoTag } from '../components/Tags'
import { useAcoesProduto } from '../components/useAcoesProduto'
import { rotuloLote } from '../regras'
import { quantidadeComSinal, ROTULO_MOVIMENTO, rotuloReferencia } from '../rotulos'
import { estoqueService } from '../services'
import type { DetalheProduto, FiltroMovimentos, LinhaMovimento, TipoMovimento } from '../types'
import { BotaoHistorico } from '../../administracao/components/HistoricoAuditoria'

function Referencia({ m }: { m: LinhaMovimento }) {
  if (m.referenciaTipo === 'VENDA' && m.referenciaId !== null) {
    return <LinkRota to={`/vendas/${m.referenciaId}`}>Venda (ver)</LinkRota>
  }
  return <>{rotuloReferencia(m.referenciaTipo, m.referenciaId)}</>
}

/** Histórico de movimentos (US-INVENTORY-010) com saldo após cada um e filtros por período e tipo. */
function HistoricoMovimentos({ produtoId, versao }: { produtoId: number; versao: number }) {
  // Drill-down do relatório de estoque (US-REPORT-007): o período chega pela URL.
  const [parametros] = useSearchParams()
  const [de, setDe] = useState(parametros.get('de') ?? '')
  const [ate, setAte] = useState(parametros.get('ate') ?? '')
  const [tipo, setTipo] = useState<TipoMovimento | ''>('')
  const [filtro, setFiltro] = useState<FiltroMovimentos>({ de: parametros.get('de') || undefined, ate: parametros.get('ate') || undefined })
  const movimentos = useCarregamento(() => estoqueService.movimentos(produtoId, filtro), [produtoId, filtro, versao])

  function aplicar(e: FormEvent) {
    e.preventDefault()
    setFiltro({ de: de || undefined, ate: ate || undefined, tipo: tipo || undefined })
  }

  const lista = movimentos.dados ?? []
  return (
    <Pilha component="section" aria-labelledby="titulo-movimentos" spacing={2}>
      <Typography id="titulo-movimentos" variant="h5" component="h2">
        Histórico de movimentos
      </Typography>
      <Pilha component="form" role="search" aria-label="Filtrar movimentos" onSubmit={aplicar} spacing={2}>
        <GradeForm>
          <TextField type="date" label="De" value={de} onChange={(e) => setDe(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField type="date" label="Até" value={ate} onChange={(e) => setAte(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField select label="Tipo de movimento" value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimento | '')}>
            <MenuItem value="">Todos</MenuItem>
            {(Object.keys(ROTULO_MOVIMENTO) as TipoMovimento[]).map((t) => (
              <MenuItem key={t} value={t}>
                {ROTULO_MOVIMENTO[t]}
              </MenuItem>
            ))}
          </TextField>
        </GradeForm>
        <LinhaAcoes>
          <Button type="submit" variant="outlined" startIcon={<SearchIcon />}>
            Filtrar
          </Button>
        </LinhaAcoes>
      </Pilha>
      {movimentos.carregando && <Carregando />}
      {movimentos.erro && (
        <Aviso tipo="error" titulo="Erro">
          {movimentos.erro}
        </Aviso>
      )}
      {!movimentos.carregando && !movimentos.erro && lista.length === 0 && <TextoSuave>Nenhum movimento no período.</TextoSuave>}
      {lista.length > 0 && (
        <TableContainer>
          <Table size="small" aria-label="Movimentos">
            <TableHead>
              <TableRow>
                <TableCell>Data/hora</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell align="right">Quantidade</TableCell>
                <TableCell>Remessa</TableCell>
                <TableCell>Usuário</TableCell>
                <TableCell>Referência</TableCell>
                <TableCell align="right">Saldo após</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lista.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{formatarDataHora(m.ocorridoEm)}</TableCell>
                  <TableCell>
                    {ROTULO_MOVIMENTO[m.tipo]}
                    {m.estornado && (
                      <Typography component="span" variant="body2" color="text.secondary">
                        {' '}
                        (estornado)
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">{quantidadeComSinal(m.quantidade)}</TableCell>
                  <TableCell>{m.remessaCodigo ?? '—'}</TableCell>
                  <TableCell>{m.usuarioNome ?? '—'}</TableCell>
                  <TableCell>
                    <Referencia m={m} />
                  </TableCell>
                  <TableCell align="right">{m.saldoApos}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Pilha>
  )
}

function Cadastro({ p }: { p: DetalheProduto }) {
  const campos: [string, string][] =
    p.tipo === 'LIVRO'
      ? [
          ['Autor', p.autor ?? '—'],
          ['ISBN', p.isbn ?? '—'],
          ['Editora', p.editoraNome ?? '—'],
          ['Repasse padrão', p.repassePadrao === null ? '—' : `${p.repassePadrao}%`],
        ]
      : [['Categoria', p.categoria ?? '—']]
  campos.push(['Última venda', formatarDataDoInstante(p.ultimaVenda)])
  return (
    <GradeForm as="dl" sx={{ m: 0 }}>
      {campos.map(([rotulo, valor]) => (
        <div key={rotulo}>
          <Typography component="dt" variant="subtitle2" color="text.secondary">
            {rotulo}
          </Typography>
          <Typography component="dd" sx={{ m: 0 }}>
            {valor}
          </Typography>
        </div>
      ))}
    </GradeForm>
  )
}

/** Página do produto (US-INVENTORY-001/009/010): cadastro, saldo por lote, preços e movimentos. */
export function ProdutoPage() {
  const id = Number(useParams().id)
  const [versao, setVersao] = useState(0)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const detalhe = useCarregamento(() => estoqueService.detalhe(id), [id, versao])
  const { acoes, modal } = useAcoesProduto((m) => {
    setMensagem(m)
    setVersao((v) => v + 1)
  }, false)

  if (detalhe.carregando && !detalhe.dados) return <Carregando />
  if (detalhe.erro || !detalhe.dados) {
    return (
      <Aviso tipo="error" titulo="Erro">
        {detalhe.erro ?? 'Produto não encontrado.'}
      </Aviso>
    )
  }
  const p = detalhe.dados
  return (
    <Pilha component="section" aria-labelledby="titulo-produto">
      <LinkRota to={p.tipo === 'LIVRO' ? '/estoque?aba=livros' : '/estoque'}>Voltar ao estoque</LinkRota>
      <LinhaAcoes>
        <TituloPagina id="titulo-produto">{p.nome}</TituloPagina>
        <StatusProdutoTag ativo={p.ativo} />
        <BotaoHistorico entidade="PRODUTO" id={p.id} />
      </LinhaAcoes>
      {mensagem && (
        <Aviso tipo="success" titulo="Pronto" onFechar={() => setMensagem(null)}>
          {mensagem}
        </Aviso>
      )}
      {(p.precoPendente || p.inativacaoPendente) && (
        <Aviso tipo="info" titulo="Pedido aguardando o Administrador">
          {[p.precoPendente && 'alteração de preço', p.inativacaoPendente && 'inativação'].filter(Boolean).join(' e ')}.
          Até a decisão, o preço e o status atuais continuam valendo.
        </Aviso>
      )}
      <LinhaAcoes>
        {acoes(p).map((a) => (
          <Button key={a.rotulo} variant="outlined" onClick={a.executar}>
            {a.rotulo}
          </Button>
        ))}
      </LinhaAcoes>

      <GradeForm>
        <Indicador rotulo="Preço vigente" valor={formatarMoeda(p.preco)} />
        <Indicador rotulo="Saldo disponível" valor={String(p.saldo)} />
        <Indicador rotulo="Aguardando baixa" valor={String(p.aguardandoBaixa)} />
      </GradeForm>
      <Cadastro p={p} />

      <Typography variant="h5" component="h2">
        Saldo por origem
      </Typography>
      {p.lotes.length === 0 ? (
        <TextoSuave>Sem estoque. As unidades entram por compra, doação ou remessa.</TextoSuave>
      ) : (
        <TableContainer>
          <Table size="small" aria-label="Saldo por origem">
            <TableHead>
              <TableRow>
                <TableCell>Origem</TableCell>
                <TableCell>Recebida em</TableCell>
                <TableCell align="right">Repasse</TableCell>
                <TableCell align="right">Saldo</TableCell>
                <TableCell align="right">Aguardando baixa</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {p.lotes.map((l) => (
                <TableRow key={l.remessaId ?? 'proprio'}>
                  <TableCell>{rotuloLote(l)}</TableCell>
                  <TableCell>{formatarData(l.recebidaEm)}</TableCell>
                  <TableCell align="right">{l.repassePercentual === null ? '—' : `${l.repassePercentual}%`}</TableCell>
                  <TableCell align="right">{l.quantidade}</TableCell>
                  <TableCell align="right">{l.aguardandoBaixa}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Typography variant="h5" component="h2">
        Histórico de preços
      </Typography>
      {p.historicoPrecos.length === 0 ? (
        <TextoSuave>O preço não mudou desde o cadastro.</TextoSuave>
      ) : (
        <TableContainer>
          <Table size="small" aria-label="Histórico de preços">
            <TableHead>
              <TableRow>
                <TableCell>Data/hora</TableCell>
                <TableCell align="right">De</TableCell>
                <TableCell align="right">Para</TableCell>
                <TableCell>Solicitado por</TableCell>
                <TableCell>Aprovado por</TableCell>
                <TableCell>Motivo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {p.historicoPrecos.map((h) => (
                <TableRow key={h.alteradoEm + h.precoNovo}>
                  <TableCell>{formatarDataHora(h.alteradoEm)}</TableCell>
                  <TableCell align="right">{formatarMoeda(h.precoAnterior)}</TableCell>
                  <TableCell align="right">{formatarMoeda(h.precoNovo)}</TableCell>
                  <TableCell>{h.solicitadoPor ?? '—'}</TableCell>
                  <TableCell>{h.aprovadoPor}</TableCell>
                  <TableCell>{h.motivo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <HistoricoMovimentos produtoId={id} versao={versao} />
      {modal}
    </Pilha>
  )
}
