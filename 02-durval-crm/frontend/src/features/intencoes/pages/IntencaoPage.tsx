import AttachFileIcon from '@mui/icons-material/AttachFile'
import {
  Box,
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { styled } from '@mui/material/styles'
import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { mensagemDetalhada, salvarArquivo } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarData, formatarDataHora } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { ModalMotivo } from '../../estoque/components/ModalMotivo'
import { AprovarDialogo } from '../components/AprovarDialogo'
import { CorrigirDialogo } from '../components/CorrigirDialogo'
import { StatusIntencaoTag } from '../components/StatusIntencaoTag'
import { TabelaItens } from '../components/TabelaItens'
import { recebimentoConfere, tamanhoLegivel } from '../regras'
import { ROTULO_MEIO } from '../rotulos'
import { intencaoService } from '../services'
import type { DetalheIntencao, ResultadoAcao } from '../types'
import { BotaoHistorico } from '../../administracao/components/HistoricoAuditoria'

const Dados = styled('dl')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(9rem, max-content) 1fr',
  columnGap: theme.spacing(2),
  rowGap: theme.spacing(1),
  margin: 0,
  '& dt': { color: theme.palette.text.secondary },
  '& dd': { margin: 0 },
}))

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          {titulo}
        </Typography>
        {children}
      </CardContent>
    </Card>
  )
}

type Dialogo = 'aprovar' | 'rejeitar' | 'retirar' | 'corrigir' | 'cancelar' | null

/**
 * Detalhe da intenção (US-EXPENSE-002/008) com as ações que a situação e o perfil permitem: aprovar
 * ou rejeitar (Tesouraria), retirar ou copiar como nova (solicitante), conferir o recebimento
 * (Vendedor) e corrigir ou cancelar a compra divergente (Tesouraria).
 */
export function IntencaoPage() {
  const id = Number(useParams().id)
  const navegar = useNavigate()
  const estado = useLocation().state as { mensagem?: string } | null
  const { perfilAtivo } = useAuth()
  const detalhe = useCarregamento(() => intencaoService.intencao(id), [id])
  const decide = !!detalhe.dados?.acoes.decidir
  const opcoes = useCarregamento(() => (decide ? intencaoService.opcoes() : Promise.resolve(null)), [decide])
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error' | 'warning'; texto: string } | null>(
    estado?.mensagem ? { tipo: 'success', texto: estado.mensagem } : null,
  )

  if (detalhe.carregando && !detalhe.dados) return <Carregando linhas={6} />
  if (detalhe.erro || !detalhe.dados) {
    return (
      <Aviso tipo="error" titulo="Erro">
        {detalhe.erro ?? 'Intenção não encontrada.'}
      </Aviso>
    )
  }
  const i = detalhe.dados
  const a = i.aprovacao
  const voltar =
    perfilAtivo === 'vendedor'
      ? i.acoes.receber
        ? { para: '/intencoes-gasto/recebimentos', texto: 'Voltar aos recebimentos' }
        : { para: '/intencoes-gasto', texto: 'Voltar às minhas intenções' }
      : { para: '/intencoes-gasto/aprovacao', texto: 'Voltar à aprovação de gastos' }

  function concluido(texto: string, r?: ResultadoAcao) {
    setDialogo(null)
    setMensagem(r?.avisos.length ? { tipo: 'warning', texto: `${texto} ${r.avisos.join(' ')}` } : { tipo: 'success', texto })
    detalhe.recarregar()
  }

  async function abrirAnexo(ordem: number) {
    try {
      const arquivo = await intencaoService.baixarAnexo(i.id, ordem)
      const endereco = URL.createObjectURL(arquivo.conteudo)
      if (!window.open(endereco, '_blank')) salvarArquivo(arquivo)
      setTimeout(() => URL.revokeObjectURL(endereco), 60_000)
    } catch (e) {
      setMensagem({ tipo: 'error', texto: mensagemDetalhada(e) })
    }
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-intencao">
      <LinkRota to={voltar.para}>{voltar.texto}</LinkRota>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TituloPagina id="titulo-intencao">Intenção de gasto nº {i.id}</TituloPagina>
        <StatusIntencaoTag status={i.status} />
        <BotaoHistorico entidade="IntencaoGasto" id={i.id} />
      </Box>
      {mensagem && (
        <Aviso tipo={mensagem.tipo} titulo={mensagem.tipo === 'error' ? 'Não foi possível concluir' : 'Pronto'} onFechar={() => setMensagem(null)}>
          {mensagem.texto}
        </Aviso>
      )}

      <LinhaAcoes>
        {i.acoes.decidir && (
          <>
            <Button variant="contained" onClick={() => setDialogo('aprovar')} disabled={!opcoes.dados}>
              Aprovar
            </Button>
            <Button color="error" variant="outlined" onClick={() => setDialogo('rejeitar')}>
              Rejeitar
            </Button>
          </>
        )}
        {i.acoes.resolverDivergencia && (
          <>
            <Button variant="contained" onClick={() => setDialogo('corrigir')}>
              Corrigir compra
            </Button>
            <Button color="error" variant="outlined" onClick={() => setDialogo('cancelar')}>
              Cancelar compra
            </Button>
          </>
        )}
        {i.acoes.retirar && (
          <Button variant="outlined" onClick={() => setDialogo('retirar')}>
            Retirar pedido
          </Button>
        )}
        {i.acoes.copiar && (
          <Button variant="contained" onClick={() => navegar(`/intencoes-gasto/nova?copiar=${i.id}`)}>
            Copiar como nova
          </Button>
        )}
      </LinhaAcoes>

      {i.status === 'REJEITADA' && (
        <Aviso tipo="error" titulo={`Rejeitada por ${i.decididaPorNome ?? '—'} em ${formatarDataHora(i.decididaEm)}`}>
          Motivo: {i.motivoRejeicao}
        </Aviso>
      )}
      {i.status === 'CANCELADA' && (
        <Aviso tipo="info" titulo={`Cancelada por ${i.canceladaPorNome ?? '—'} em ${formatarDataHora(i.canceladaEm)}`}>
          Motivo: {i.motivoCancelamento}
        </Aviso>
      )}
      {i.status === 'DIVERGENTE' && (
        <Aviso tipo="warning" titulo={`Recebimento divergente, informado por ${i.recebidaPorNome ?? '—'} em ${formatarDataHora(i.recebidaEm)}`}>
          {i.divergencia} A entrada no estoque fica bloqueada até a compra ser corrigida ou cancelada.
        </Aviso>
      )}

      {i.acoes.receber && <ConferirRecebimento intencao={i} onConcluido={(texto) => concluido(texto)} />}

      <Bloco titulo="Pedido">
        <Dados>
          <dt>Descrição</dt>
          <dd>{i.descricao}</dd>
          <dt>Categoria</dt>
          <dd>{i.categoriaNome}</dd>
          <dt>Valor solicitado</dt>
          <dd>{formatarMoeda(i.valorSolicitado)}</dd>
          <dt>Justificativa</dt>
          <dd>{i.justificativa}</dd>
          <dt>Solicitante</dt>
          <dd>
            {i.solicitanteNome ?? '—'}, em {formatarDataHora(i.criadaEm)}
          </dd>
          {i.gastoNoMes !== null && (
            <>
              <dt>Gasto no mês</dt>
              <dd>{formatarMoeda(i.gastoNoMes)} já lançados nesta subcategoria no mês corrente</dd>
            </>
          )}
        </Dados>
        {i.compraCantina && i.itens.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <TabelaItens itens={i.itens} />
          </Box>
        )}
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" component="h3">
            Anexos
          </Typography>
          {i.anexos.length === 0 ? (
            <TextoSuave>Nenhum anexo.</TextoSuave>
          ) : (
            <LinhaAcoes>
              {i.anexos.map((x) => (
                <Button key={x.ordem} size="small" startIcon={<AttachFileIcon />} onClick={() => void abrirAnexo(x.ordem)}>
                  {x.nome} ({tamanhoLegivel(x.tamanho)})
                </Button>
              ))}
            </LinhaAcoes>
          )}
        </Box>
      </Bloco>

      {a && (
        <Bloco titulo="Pagamento aprovado">
          <Dados>
            <dt>Valor aprovado</dt>
            <dd>
              {formatarMoeda(a.valor)}
              {a.valor !== i.valorSolicitado && ` (pedido: ${formatarMoeda(i.valorSolicitado)})`}
            </dd>
            <dt>Categoria</dt>
            <dd>
              {a.categoriaNome}
              {a.categoria !== i.categoria && ` (pedido: ${i.categoriaNome})`}
            </dd>
            <dt>Meio e conta</dt>
            <dd>
              {ROTULO_MEIO[a.meio]} · {a.contaNome}
            </dd>
            <dt>Data do pagamento</dt>
            <dd>{formatarData(a.data)}</dd>
            {a.nota && (
              <>
                <dt>Nota do aprovador</dt>
                <dd>{a.nota}</dd>
              </>
            )}
            <dt>Aprovada por</dt>
            <dd>
              {i.decididaPorNome ?? '—'}, em {formatarDataHora(i.decididaEm)}
            </dd>
            {a.lancamentoId !== null && perfilAtivo !== 'vendedor' && (
              <>
                <dt>Despesa</dt>
                <dd>
                  <LinkRota to={`/financeiro/lancamentos/${a.lancamentoId}`}>Lançamento nº {a.lancamentoId}</LinkRota>
                </dd>
              </>
            )}
          </Dados>
        </Bloco>
      )}

      <Bloco titulo="Histórico">
        <List dense aria-label="Histórico da intenção">
          {i.historico.map((h, n) => (
            <ListItem key={n} disableGutters>
              <ListItemText primary={h.descricao} secondary={`${formatarDataHora(h.em)} · ${h.usuario ?? '—'}`} />
            </ListItem>
          ))}
        </List>
      </Bloco>

      {dialogo === 'aprovar' && opcoes.dados && (
        <AprovarDialogo
          intencao={i}
          opcoes={opcoes.dados}
          onFechar={() => setDialogo(null)}
          onAprovada={(r) => concluido(`Intenção nº ${i.id} aprovada. Despesa registrada (lançamento nº ${r.lancamentoId}).`, r)}
        />
      )}
      {dialogo === 'rejeitar' && (
        <ModalMotivo
          titulo="Rejeitar gasto"
          rotulo={`Intenção nº ${i.id} · ${i.descricao}`}
          rotuloCampo="Motivo da rejeição"
          textoConfirmar="Rejeitar"
          perigo
          onFechar={() => setDialogo(null)}
          onConfirmar={async (motivo) => {
            await intencaoService.rejeitar(i.id, motivo)
            concluido(`Intenção nº ${i.id} rejeitada. Nada foi lançado.`)
          }}
        >
          <TextoSuave>O solicitante vê o motivo em “Minhas intenções” e pode copiar o pedido como novo.</TextoSuave>
        </ModalMotivo>
      )}
      {dialogo === 'retirar' && (
        <ModalMotivo
          titulo="Retirar pedido"
          rotulo={`Intenção nº ${i.id} · ${i.descricao}`}
          rotuloCampo="Por que não precisa mais?"
          textoConfirmar="Retirar pedido"
          perigo
          onFechar={() => setDialogo(null)}
          onConfirmar={async (motivo) => {
            await intencaoService.retirar(i.id, motivo)
            concluido(`Intenção nº ${i.id} retirada da fila de aprovação.`)
          }}
        />
      )}
      {dialogo === 'corrigir' && (
        <CorrigirDialogo
          intencao={i}
          onFechar={() => setDialogo(null)}
          onCorrigida={(r) =>
            concluido(
              r.lancamentoId
                ? `Compra corrigida. A despesa foi estornada e lançada com o novo valor (lançamento nº ${r.lancamentoId}); o Vendedor confere de novo.`
                : 'Compra corrigida; o Vendedor confere de novo.',
              r,
            )
          }
        />
      )}
      {dialogo === 'cancelar' && (
        <ModalMotivo
          titulo="Cancelar compra"
          rotulo={`Intenção nº ${i.id} · ${i.descricao}`}
          rotuloCampo="Motivo do cancelamento"
          textoConfirmar="Cancelar compra"
          perigo
          onFechar={() => setDialogo(null)}
          onConfirmar={async (motivo) => {
            await intencaoService.cancelar(i.id, motivo)
            concluido(`Compra nº ${i.id} cancelada. A despesa foi estornada e nada entrou no estoque.`)
          }}
        >
          <TextoSuave>
            A despesa de {a ? formatarMoeda(a.valor) : '—'} é estornada. Se o fornecedor devolver o dinheiro, registre a entrada como
            lançamento manual.
          </TextoSuave>
        </ModalMotivo>
      )}
    </Pilha>
  )
}

/** Conferência do Vendedor (US-EXPENSE-006), com as quantidades aprovadas já preenchidas. */
function ConferirRecebimento({ intencao: i, onConcluido }: { intencao: DetalheIntencao; onConcluido(texto: string): void }) {
  const [recebidas, setRecebidas] = useState<Record<number, string>>(() =>
    Object.fromEntries(i.itens.map((x) => [x.produtoId, String(x.quantidade)])),
  )
  const [divergencia, setDivergencia] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const numeros = Object.fromEntries(
    i.itens.map((x) => [x.produtoId, /^\d+$/.test(recebidas[x.produtoId] ?? '') ? Number(recebidas[x.produtoId]) : null]),
  )
  const preenchidas = i.itens.every((x) => numeros[x.produtoId] !== null)
  const confere = preenchidas && recebimentoConfere(i.itens, numeros)

  async function confirmar() {
    setEnviando(true)
    setErro(null)
    try {
      const r = await intencaoService.receber(
        i.id,
        i.itens.map((x) => ({ produtoId: x.produtoId, quantidade: numeros[x.produtoId]! })),
        confere ? '' : divergencia,
      )
      onConcluido(
        r.status === 'RECEBIDA'
          ? 'Recebimento conferido. O estoque foi atualizado.'
          : 'Divergência registrada. A entrada no estoque fica bloqueada até a Tesouraria resolver.',
      )
    } catch (e) {
      setErro(mensagemDetalhada(e))
      setEnviando(false)
    }
  }

  return (
    <Bloco titulo="Conferir recebimento">
      <Pilha spacing={2}>
        <TextoSuave>Informe quanto chegou de cada produto (zero se não chegou). A compra só pode ser recebida uma vez.</TextoSuave>
        {erro && (
          <Aviso tipo="error" titulo="Não foi possível registrar">
            {erro}
          </Aviso>
        )}
        <Table size="small" aria-label="Quantidades recebidas">
          <TableHead>
            <TableRow>
              <TableCell>Produto</TableCell>
              <TableCell align="right">Aprovada</TableCell>
              <TableCell align="right">Recebida</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {i.itens.map((x) => (
              <TableRow key={x.produtoId}>
                <TableCell>{x.produtoNome}</TableCell>
                <TableCell align="right">{x.quantidade}</TableCell>
                <TableCell align="right">
                  <TextField
                    size="small"
                    type="number"
                    value={recebidas[x.produtoId] ?? ''}
                    onChange={(e) => setRecebidas((r) => ({ ...r, [x.produtoId]: e.target.value }))}
                    error={numeros[x.produtoId] !== null && numeros[x.produtoId] !== x.quantidade}
                    slotProps={{ htmlInput: { min: 0, step: 1, 'aria-label': `Quantidade recebida de ${x.produtoNome}` } }}
                    sx={{ width: '6rem' }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {preenchidas && !confere && (
          <TextField
            label="Descreva a divergência"
            required
            multiline
            minRows={2}
            value={divergencia}
            onChange={(e) => setDivergencia(e.target.value)}
            helperText="Nada entra no estoque até a Tesouraria corrigir ou cancelar a compra."
          />
        )}
        <LinhaAcoes>
          <Button
            variant="contained"
            disabled={enviando || !preenchidas || (!confere && !divergencia.trim())}
            onClick={() => void confirmar()}
          >
            {confere ? 'Confirmar recebimento' : 'Registrar divergência'}
          </Button>
        </LinhaAcoes>
      </Pilha>
    </Bloco>
  )
}
