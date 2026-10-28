import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import EventNoteIcon from '@mui/icons-material/EventNote'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import UndoIcon from '@mui/icons-material/Undo'
import { Box, Card, CardContent, List, ListItem, ListItemIcon, ListItemText, Typography } from '@mui/material'
import { styled } from '@mui/material/styles'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { Indicador } from '../../../shared/components/Indicador'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarData, formatarDataHora } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { AvisoContasPagar } from '../../contaspagar/components/AvisoContasPagar'
import { contasPagarService } from '../../contaspagar/services'
import { AvisoGeracaoCompetencias } from '../../contribuicoes/components/AvisoGeracaoCompetencias'
import { editoraService } from '../../editoras/services'
import type { QuadroSaldos as SaldosEditoras } from '../../editoras/types'
import { AtalhoPainel } from '../components/AtalhoPainel'
import { QuadroDeSaldos } from '../components/QuadroDeSaldos'
import { nomeDoMes } from '../regras'
import { linkDaOrigem, ROTULO_ORIGEM } from '../rotulos'
import { financeiroService } from '../services'
import type { PainelTesoureiro } from '../types'

const GradeAtalhos = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))',
  gap: theme.spacing(2),
}))

const Colunas = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(22rem, 1fr))',
  gap: theme.spacing(3),
  alignItems: 'start',
}))

/** Painel do Tesoureiro (wireframe 3, US-FINANCIAL-015): tudo o que espera pela Tesouraria. */
export function PainelTesoureiroPage() {
  const painel = useCarregamento(() => financeiroService.painelTesoureiro(), [])
  const editoras = useCarregamento(() => editoraService.saldos(), [])
  const contasPagar = useCarregamento(() => contasPagarService.resumo(), [])
  if (painel.carregando) return <Carregando linhas={6} />
  if (painel.erro || !painel.dados) {
    return (
      <Aviso tipo="error" titulo="Erro">
        {painel.erro ?? 'Não foi possível carregar o painel.'}
      </Aviso>
    )
  }
  const p = painel.dados
  const naoConciliados = p.conciliacoes.reduce((s, c) => s + c.naoConciliados, 0)
  const editorasComSaldo = (editoras.dados?.editoras ?? []).filter((e) => e.saldoDevido > 0).length
  return (
    <Pilha component="section" aria-labelledby="titulo-painel-tesoureiro">
      <TituloPagina id="titulo-painel-tesoureiro">Visão financeira — {nomeDoMes(p.mes)}</TituloPagina>
      <AvisoGeracaoCompetencias />
      <AvisoContasPagar />

      <GradeForm aria-label="Indicadores do mês">
        <Indicador rotulo="Previsto do mês" valor={formatarMoeda(p.mensalidades.previsto)} destaque="success" detalhe="Mensalidades da competência" />
        <Indicador rotulo="Recebido no mês" valor={formatarMoeda(p.mensalidades.recebido)} destaque="primary" detalhe="Competências do mês já pagas" />
        <Indicador rotulo="Pendente do mês" valor={formatarMoeda(p.mensalidades.pendente)} destaque="error" />
        <Indicador rotulo="Total pendente (anterior)" valor={formatarMoeda(p.mensalidades.pendenteAnterior)} detalhe="Competências de meses anteriores" />
        <Indicador rotulo="Receita líquida" valor={formatarMoeda(p.receitaLiquida)} detalhe="Receitas no mês menos taxas de cartão" />
        <Indicador rotulo="Taxas de cartão" valor={formatarMoeda(p.resumoDoMes.taxasCartao)} destaque="warning" />
      </GradeForm>

      <GradeAtalhos role="navigation" aria-label="Atalhos da Tesouraria">
        <AtalhoPainel rotulo="Aprovar gastos" icone={FactCheckIcon} contador={p.intencoesPendentes} para="/intencoes-gasto/aprovacao" />
        <AtalhoPainel rotulo="Conciliar conta" icone={AccountBalanceIcon} contador={naoConciliados} para="/conciliacao" />
        <AtalhoPainel rotulo="Liquidar cartão" icone={CreditCardIcon} para="/financeiro/liquidacao-cartao" />
        <AtalhoPainel rotulo="Contas a pagar" icone={EventNoteIcon} contador={contasPagar.dados?.vencidas} para="/contas-pagar" />
        <AtalhoPainel rotulo="Pagar editoras" icone={MenuBookIcon} contador={editorasComSaldo} para="/editoras/saldos" />
        <AtalhoPainel
          rotulo="Fechamento mensal"
          icone={EventAvailableIcon}
          contador={p.periodo.itensTotal === null ? null : p.periodo.itensTotal - (p.periodo.itensConcluidos ?? 0)}
          para="/fechamento"
        />
        <AtalhoPainel rotulo="Transferência" icone={CompareArrowsIcon} para="/financeiro/transferencia" />
        <AtalhoPainel rotulo="Lançamento manual" icone={NoteAddIcon} para="/financeiro/lancamentos/novo" />
        <AtalhoPainel rotulo="Lançamentos" icone={ReceiptLongIcon} para="/financeiro/lancamentos" />
      </GradeAtalhos>

      <Colunas>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" component="h2" gutterBottom>
              Saldos por conta
            </Typography>
            <QuadroDeSaldos saldos={p.saldos} comExtrato />
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography variant="h6" component="h2" gutterBottom>
                Pendências do período
              </Typography>
              <LinkRota to="/financeiro/lancamentos">Ver lançamentos</LinkRota>
            </Box>
            <Pendencias painel={p} editoras={editoras.dados} />
          </CardContent>
        </Card>
      </Colunas>
    </Pilha>
  )
}

function Pendencias({ painel: p, editoras }: { painel: PainelTesoureiro; editoras: SaldosEditoras | null }) {
  const comSaldo = (editoras?.editoras ?? []).filter((e) => e.saldoDevido > 0)
  const itens = [
    <ListItem key="periodo" disableGutters>
      <ListItemIcon>
        <EventAvailableIcon color={p.periodo.itensTotal === null ? 'success' : p.periodo.situacao === 'REABERTO' ? 'error' : 'warning'} />
      </ListItemIcon>
      <ListItemText
        primary={
          p.periodo.itensTotal === null ? (
            `Período ${nomeDoMes(p.periodo.mes)}: em andamento`
          ) : (
            <LinkRota to="/fechamento">{`Fechamento de ${nomeDoMes(p.periodo.mes)}${p.periodo.situacao === 'REABERTO' ? ' (reaberto)' : ''}`}</LinkRota>
          )
        }
        secondary={
          p.periodo.itensTotal === null
            ? 'Os meses anteriores estão fechados.'
            : `Checklist: ${p.periodo.itensConcluidos} de ${p.periodo.itensTotal} itens concluídos`
        }
      />
    </ListItem>,
    ...(p.intencoesPendentes
      ? [
          <ListItem key="intencoes" disableGutters>
            <ListItemIcon>
              <FactCheckIcon color="warning" />
            </ListItemIcon>
            <ListItemText
              primary={<LinkRota to="/intencoes-gasto/aprovacao">Intenções de gasto aguardando aprovação</LinkRota>}
              secondary={`${p.intencoesPendentes} aguardando decisão`}
            />
          </ListItem>,
        ]
      : []),
    ...(comSaldo.length > 0
      ? [
          <ListItem key="editoras" disableGutters>
            <ListItemIcon>
              <MenuBookIcon color="warning" />
            </ListItemIcon>
            <ListItemText
              primary={<LinkRota to="/editoras/saldos">Acertos com editoras</LinkRota>}
              secondary={`${comSaldo.length} editora(s) com saldo devido: ${formatarMoeda(editoras!.total)}`}
            />
          </ListItem>,
        ]
      : []),
    ...p.conciliacoes
      .filter((c) => c.naoConciliados > 0)
      .map((c) => (
        <ListItem key={`conc-${c.contaId}`} disableGutters>
          <ListItemIcon>
            <AccountBalanceIcon color="warning" />
          </ListItemIcon>
          <ListItemText
            primary={<LinkRota to="/conciliacao">{`Conciliação — ${c.contaNome}`}</LinkRota>}
            secondary={`${c.naoConciliados} ${c.naoConciliados === 1 ? 'lançamento pendente' : 'lançamentos pendentes'} · última conciliação: ${c.ultimaConciliacao ? formatarData(c.ultimaConciliacao) : 'nenhuma'}`}
          />
        </ListItem>
      )),
    ...p.cancelamentosRecentes.map((c) => {
      const link = linkDaOrigem(c.origemTipo, c.origemId)
      return (
        <ListItem key={`canc-${c.lancamentoId}`} disableGutters>
          <ListItemIcon>
            <UndoIcon color="error" />
          </ListItemIcon>
          <ListItemText
            primary={
              <>
                {ROTULO_ORIGEM[c.origemTipo]} cancelada: {link ? <LinkRota to={link}>{c.descricao}</LinkRota> : c.descricao}
              </>
            }
            secondary={`${formatarMoeda(c.valor)} · ${formatarDataHora(c.registradoEm)} · ${c.registradoPor}`}
          />
        </ListItem>
      )
    }),
  ]
  return (
    <>
      <List dense aria-label="Pendências do período">
        {itens}
      </List>
      {itens.length === 1 && <TextoSuave>Nenhum gasto a aprovar, acerto com editoras, conciliação pendente ou cancelamento nos últimos 7 dias.</TextoSuave>}
    </>
  )
}
