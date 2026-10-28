import AccountTreeIcon from '@mui/icons-material/AccountTree'
import AssessmentIcon from '@mui/icons-material/Assessment'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import ForumIcon from '@mui/icons-material/Forum'
import LibraryAddIcon from '@mui/icons-material/LibraryAdd'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import PaymentsIcon from '@mui/icons-material/Payments'
import { Box, Button, Card, CardContent, Chip, List, ListItem, ListItemText, Tab, Tabs, Typography } from '@mui/material'
import { styled, useTheme } from '@mui/material/styles'
import { BarChart } from '@mui/x-charts/BarChart'
import { useState } from 'react'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { Indicador } from '../../../shared/components/Indicador'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarCompetencia, formatarData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { AvisoContasPagar } from '../../contaspagar/components/AvisoContasPagar'
import { AvisoGeracaoCompetencias } from '../../contribuicoes/components/AvisoGeracaoCompetencias'
import { estoqueService } from '../../estoque/services'
import type { ResumoSolicitacao, TipoSolicitacao } from '../../estoque/types'
import { ReaberturaDialogo } from '../../fechamento/components/ReaberturaDialogo'
import { fechamentoService } from '../../fechamento/services'
import { AtalhoPainel } from '../../financeiro/components/AtalhoPainel'
import { GastosAguardandoDecisao } from '../../intencoes/components/ResumosPainel'
import { nomeDoMes } from '../../financeiro/regras'
import { variacaoPercentual } from '../regras'
import { administracaoService } from '../services'

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

const ABAS: { tipo: TipoSolicitacao; rotulo: string }[] = [
  { tipo: 'BAIXA', rotulo: 'Baixas' },
  { tipo: 'PRECO', rotulo: 'Preços' },
  { tipo: 'INATIVACAO', rotulo: 'Inativações' },
]

function comVariacao(atual: number, anterior: number): string {
  const v = variacaoPercentual(atual, anterior)
  if (v === null) return 'Sem movimento no mês anterior'
  return `${v >= 0 ? '↑' : '↓'} ${Math.abs(v)}% em relação ao mês anterior`
}

/**
 * Painel do Administrador (wireframe 4, US-ADMIN-021): visão geral da organização, as decisões que
 * esperam por ele (aprovações de estoque, com destaque para as que travam o fechamento), a situação
 * dos períodos, a mensalidade agendada, os avisos e os atalhos.
 */
export function PainelAdministradorPage() {
  const theme = useTheme()
  const painel = useCarregamento(() => administracaoService.painel(), [])
  const solicitacoes = useCarregamento(() => estoqueService.solicitacoes({ status: 'PENDENTE' }), [])
  const fechamento = useCarregamento(() => fechamentoService.painel(), [])
  const [aba, setAba] = useState<TipoSolicitacao>('BAIXA')
  const [reabrindo, setReabrindo] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  if (painel.carregando) return <Carregando linhas={6} />
  if (painel.erro || !painel.dados) {
    return (
      <Aviso tipo="error" titulo="Erro">
        {painel.erro ?? 'Não foi possível carregar o painel.'}
      </Aviso>
    )
  }
  const p = painel.dados
  const pendentes = solicitacoes.dados ?? []
  const mesAFechar = fechamento.dados?.mesAFechar ?? null
  const travaFechamento = (s: ResumoSolicitacao) => mesAFechar !== null && s.solicitadaEm.slice(0, 7) <= mesAFechar
  const daAba = pendentes.filter((s) => s.tipo === aba)

  return (
    <Pilha component="section" aria-labelledby="titulo-painel-admin">
      <TituloPagina id="titulo-painel-admin">Visão geral da organização</TituloPagina>
      <AvisoGeracaoCompetencias />
      <AvisoContasPagar />
      <GastosAguardandoDecisao />
      {mensagem && (
        <Aviso tipo="success" titulo="Pronto" onFechar={() => setMensagem(null)}>
          {mensagem}
        </Aviso>
      )}

      <GradeForm aria-label="Indicadores da organização">
        <Indicador rotulo="Doadores ativos" valor={String(p.doadoresAtivos)} />
        <Indicador
          rotulo="Vendas no mês"
          valor={formatarMoeda(p.vendasNoMes)}
          destaque="primary"
          detalhe={comVariacao(p.vendasNoMes, p.vendasMesAnterior)}
        />
        <Indicador
          rotulo="Resultado do mês"
          valor={formatarMoeda(p.resultadoNoMes)}
          destaque={p.resultadoNoMes < 0 ? 'error' : 'success'}
          detalhe={comVariacao(p.resultadoNoMes, p.resultadoMesAnterior)}
        />
      </GradeForm>

      <GradeAtalhos role="navigation" aria-label="Atalhos do Administrador">
        <AtalhoPainel rotulo="Gerenciar usuários" icone={ManageAccountsIcon} para="/administracao/usuarios" />
        <AtalhoPainel rotulo="Plano de contas" icone={AccountTreeIcon} para="/administracao/plano-contas" />
        <AtalhoPainel rotulo="Configurar mensagens" icone={ForumIcon} para="/administracao/mensagens" />
        <AtalhoPainel
          rotulo="Fechamento mensal"
          icone={EventAvailableIcon}
          contador={pendentes.filter(travaFechamento).length}
          para="/fechamento"
        />
        <AtalhoPainel rotulo="Aprovações de estoque" icone={FactCheckIcon} contador={pendentes.length} para="/estoque/solicitacoes" />
        <AtalhoPainel rotulo="Nova remessa" icone={LocalShippingIcon} para="/editoras/remessas/nova" />
        <AtalhoPainel rotulo="Novo título" icone={LibraryAddIcon} para="/estoque/produtos/novo?tipo=LIVRO" />
        <AtalhoPainel rotulo="Editoras" icone={MenuBookIcon} para="/editoras" />
        <AtalhoPainel rotulo="Mensalidade" icone={PaymentsIcon} para="/administracao/mensalidade" />
        <AtalhoPainel rotulo="Relatórios" icone={AssessmentIcon} para="/relatorios" />
      </GradeAtalhos>

      <Colunas>
        <Card variant="outlined" sx={{ position: 'relative' }}>
          <CardContent>
            <Typography variant="h6" component="h2" gutterBottom>
              Receitas vs Despesas (últimos 6 meses)
            </Typography>
            <BarChart
              height={260}
              xAxis={[{ scaleType: 'band', data: p.receitasDespesas.map((m) => formatarCompetencia(m.mes)) }]}
              series={[
                { data: p.receitasDespesas.map((m) => m.receitas), label: 'Receitas', color: theme.palette.primary.main, valueFormatter: (v) => formatarMoeda(v ?? 0) },
                { data: p.receitasDespesas.map((m) => m.despesas), label: 'Despesas', color: theme.palette.grey[400], valueFormatter: (v) => formatarMoeda(v ?? 0) },
              ]}
            />
            {/* Os mesmos números em tabela, para leitores de tela. */}
            <Box
              component="table"
              sx={{ position: 'absolute', width: 1, height: 1, p: 0, m: -1, border: 0, overflow: 'hidden', whiteSpace: 'nowrap', clip: 'rect(0 0 0 0)' }}
            >
              <caption>Receitas e despesas por mês</caption>
              <tbody>
                {p.receitasDespesas.map((m) => (
                  <tr key={m.mes}>
                    <th scope="row">{nomeDoMes(m.mes)}</th>
                    <td>Receitas {formatarMoeda(m.receitas)}</td>
                    <td>Despesas {formatarMoeda(m.despesas)}</td>
                  </tr>
                ))}
              </tbody>
            </Box>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography variant="h6" component="h2" gutterBottom>
                Aprovações pendentes
              </Typography>
              <LinkRota to="/estoque/solicitacoes">Ver todas</LinkRota>
            </Box>
            <Tabs value={aba} onChange={(_, v: TipoSolicitacao) => setAba(v)} aria-label="Tipos de solicitação">
              {ABAS.map((a) => (
                <Tab key={a.tipo} value={a.tipo} label={`${a.rotulo} (${pendentes.filter((s) => s.tipo === a.tipo).length})`} />
              ))}
            </Tabs>
            {solicitacoes.carregando && <Carregando linhas={2} />}
            {solicitacoes.erro && (
              <Aviso tipo="error" titulo="Erro">
                {solicitacoes.erro}
              </Aviso>
            )}
            {!solicitacoes.carregando && daAba.length === 0 && <TextoSuave>Nenhuma solicitação deste tipo aguardando decisão.</TextoSuave>}
            <List dense aria-label="Solicitações aguardando decisão">
              {daAba.map((s) => (
                <ListItem key={s.id} disableGutters>
                  <ListItemText
                    primary={
                      <>
                        <LinkRota to="/estoque/solicitacoes">{s.produtoNome}</LinkRota>
                        {travaFechamento(s) && (
                          <Chip size="small" color="warning" sx={{ ml: 1 }} label={`Trava o fechamento de ${formatarCompetencia(mesAFechar!)}`} />
                        )}
                      </>
                    }
                    secondary={`${s.solicitanteNome ?? '—'} · ${formatarData(s.solicitadaEm.slice(0, 10))}${s.novoPreco !== null ? ` · novo preço ${formatarMoeda(s.novoPreco)}` : ''}${s.quantidade !== null ? ` · ${s.quantidade} un.` : ''}`}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" component="h2" gutterBottom>
              Períodos e mensalidade
            </Typography>
            <List dense aria-label="Situação dos períodos e da mensalidade">
              {fechamento.dados && (
                <>
                  <ListItem disableGutters>
                    <ListItemText
                      primary={`Período atual: ${nomeDoMes(fechamento.dados.mesAtual)} (em andamento)`}
                      secondary={
                        fechamento.dados.mesAFechar
                          ? `A fechar: ${nomeDoMes(fechamento.dados.mesAFechar)}`
                          : 'Os meses anteriores estão fechados.'
                      }
                    />
                  </ListItem>
                  <ListItem
                    disableGutters
                    secondaryAction={
                      fechamento.dados.ultimoFechado && (
                        <Button size="small" onClick={() => setReabrindo(fechamento.dados!.ultimoFechado)}>
                          Reabrir
                        </Button>
                      )
                    }
                  >
                    <ListItemText
                      primary={`Último fechado: ${fechamento.dados.ultimoFechado ? nomeDoMes(fechamento.dados.ultimoFechado) : 'nenhum'}`}
                      secondary={<LinkRota to="/fechamento">Fechamento mensal</LinkRota>}
                    />
                  </ListItem>
                </>
              )}
              <ListItem disableGutters>
                <ListItemText
                  primary={
                    p.mensalidadeAgendada
                      ? `Mensalidade: ${formatarMoeda(p.mensalidadeAgendada.valor)} a partir de ${formatarCompetencia(p.mensalidadeAgendada.vigenteDe)}`
                      : 'Mensalidade: nenhuma alteração agendada'
                  }
                  secondary={<LinkRota to="/administracao/mensalidade">Valor da mensalidade</LinkRota>}
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Colunas>

      {reabrindo && (
        <ReaberturaDialogo
          mes={reabrindo}
          onFechar={() => setReabrindo(null)}
          onReabrir={async (justificativa) => {
            await fechamentoService.reabrir(reabrindo, justificativa)
            setMensagem(`Período ${formatarCompetencia(reabrindo)} reaberto.`)
            setReabrindo(null)
            fechamento.recarregar()
          }}
        />
      )}
    </Pilha>
  )
}
