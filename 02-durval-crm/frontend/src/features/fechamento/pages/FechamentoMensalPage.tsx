import { Box, Button, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { styled } from '@mui/material/styles'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarData, formatarDataDoInstante, formatarDataHora } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { deslocarMes } from '../../editoras/regras'
import { nomeDoMes } from '../../financeiro/regras'
import { ChecklistFechamento } from '../components/ChecklistFechamento'
import { FecharPeriodoDialogo } from '../components/FecharPeriodoDialogo'
import { HistoricoDialogo } from '../components/HistoricoDialogo'
import { ReaberturaDialogo } from '../components/ReaberturaDialogo'
import { SituacaoTag } from '../components/SituacaoTag'
import { EVENTO_PERIODOS } from '../regras'
import { fechamentoService } from '../services'
import type { Checklist, PainelFechamento, ResumoPeriodo, SituacaoJanela } from '../types'

const Colunas = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(22rem, 100%), 1fr))',
  gap: theme.spacing(3),
  alignItems: 'start',
}))

/**
 * Fechamento mensal (Jornada D, US-CLOSING-001, 008, 009 e 014): o checklist do mês a fechar, o mês atual em
 * andamento (só leitura) e a lista dos períodos. O Tesoureiro ou o Administrador confirma o cartão e fecha,
 * dentro da janela de fechamento configurada; o Administrador reabre o mês fechado mais recente.
 */
export function FechamentoMensalPage() {
  const { perfilAtivo } = useAuth()
  const navegar = useNavigate()
  const painel = useCarregamento(() => fechamentoService.painel(), [])
  const periodos = useCarregamento(() => fechamentoService.periodos(), [])
  const janela = useCarregamento(() => fechamentoService.janela(), [])
  const [fechando, setFechando] = useState(false)
  const [reabrindo, setReabrindo] = useState<string | null>(null)
  const [historico, setHistorico] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  // Tesoureiro e Administrador confirmam o cartão e fecham; só o Administrador reabre.
  const tesouraria = perfilAtivo === 'tesoureiro' || perfilAtivo === 'administrador'
  const administrador = perfilAtivo === 'administrador'

  function recarregar() {
    painel.recarregar()
    periodos.recarregar()
    window.dispatchEvent(new Event(EVENTO_PERIODOS))
  }

  async function confirmarCartao(mes: string) {
    setErro(null)
    setConfirmando(true)
    try {
      await fechamentoService.confirmarCartao(mes)
      recarregar()
    } catch (e) {
      setErro(mensagemDetalhada(e))
    } finally {
      setConfirmando(false)
    }
  }

  if (painel.carregando && !painel.dados) return <Carregando linhas={6} />
  if (painel.erro || !painel.dados) {
    return (
      <Aviso tipo="error" titulo="Erro">
        {painel.erro ?? 'Não foi possível carregar o fechamento.'}
      </Aviso>
    )
  }
  const p = painel.dados
  const c = p.checklist

  return (
    <Pilha component="section" aria-labelledby="titulo-fechamento">
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <TituloPagina id="titulo-fechamento">Fechamento mensal</TituloPagina>
        <Button variant="outlined" onClick={() => navegar(`/fechamento/${c?.mes ?? p.ultimoFechado ?? p.mesAtual}/demonstrativo`)}>
          Demonstrativo do mês
        </Button>
      </LinhaAcoes>
      <TextoSuave>
        Os meses são fechados em ordem, depois de terminarem, dentro da janela de fechamento. O fechamento não aprova
        nada: cada item leva à tela, e ao perfil, que resolve a pendência. A situação é recalculada a cada ação.
      </TextoSuave>
      {janela.dados && <ResumoJanela janela={janela.dados} />}
      {mensagem && (
        <Aviso tipo="success" titulo="Pronto" onFechar={() => setMensagem(null)}>
          {mensagem}
        </Aviso>
      )}
      {erro && (
        <Aviso tipo="error" titulo="Erro" onFechar={() => setErro(null)}>
          {erro}
        </Aviso>
      )}

      <Colunas>
        <Card variant="outlined">
          <CardContent>
            {c ? (
              <>
                <LinhaAcoes sx={{ justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="h6" component="h2">
                    Checklist — {nomeDoMes(c.mes)}
                  </Typography>
                  <SituacaoTag situacao={c.status} />
                </LinhaAcoes>
                {c.status === 'REABERTO' && (
                  <Aviso tipo="warning" titulo={`Reaberto por ${c.reabertoPor} em ${formatarDataDoInstante(c.reabertoEm)}`}>
                    {c.justificativaReabertura}
                  </Aviso>
                )}
                <ChecklistFechamento
                  checklist={c}
                  podeConfirmarCartao={tesouraria}
                  confirmando={confirmando}
                  onConfirmarCartao={() => void confirmarCartao(c.mes)}
                />
                <LinhaAcoes sx={{ justifyContent: 'flex-end', mt: 2 }}>
                  <LinkRota to={`/fechamento/${c.mes}/demonstrativo`}>Demonstrativo preliminar</LinkRota>
                  {tesouraria && (
                    <Button variant="contained" disabled={!c.podeFechar} onClick={() => setFechando(true)}>
                      Fechar período
                    </Button>
                  )}
                </LinhaAcoes>
                {tesouraria && !c.podeFechar && <MotivoBloqueio checklist={c} />}
                {!tesouraria && <TextoSuave>Só o Tesoureiro ou o Administrador fecha o período.</TextoSuave>}
              </>
            ) : (
              <SemMesAFechar painel={p} />
            )}
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <LinhaAcoes sx={{ justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="h6" component="h2">
                {nomeDoMes(p.mesAtual)}
              </Typography>
              <SituacaoTag situacao="EM_ANDAMENTO" />
            </LinhaAcoes>
            <TextoSuave>
              Mês em andamento, só para consulta.{' '}
              {janela.dados
                ? `O fechamento poderá ser feito de ${formatarData(diaDoMes(deslocarMes(p.mesAtual, 1), janela.dados.diaInicio))} a ${formatarData(diaDoMes(deslocarMes(p.mesAtual, 1), janela.dados.diaFim))}`
                : `O fechamento fica disponível a partir de ${formatarData(`${deslocarMes(p.mesAtual, 1)}-01`)}`}
              {c && c.mes !== deslocarMes(p.mesAtual, -1) ? ', depois de fechados os meses anteriores' : ''}.
            </TextoSuave>
            <Box sx={{ mt: 1 }}>
              <LinkRota to={`/fechamento/${p.mesAtual}/demonstrativo`}>Demonstrativo preliminar do mês atual</LinkRota>
            </Box>
          </CardContent>
        </Card>
      </Colunas>

      <Typography variant="h6" component="h2">
        Períodos
      </Typography>
      {periodos.carregando && !periodos.dados && <Carregando />}
      {periodos.erro && (
        <Aviso tipo="error" titulo="Erro">
          {periodos.erro}
        </Aviso>
      )}
      {periodos.dados && (
        <TabelaPeriodos
          periodos={periodos.dados}
          administrador={administrador}
          onDemonstrativo={(mes) => navegar(`/fechamento/${mes}/demonstrativo`)}
          onHistorico={setHistorico}
          onReabrir={setReabrindo}
        />
      )}

      {fechando && c && (
        <FecharPeriodoDialogo
          mes={c.mes}
          onFechar={() => setFechando(false)}
          onFecharPeriodo={async (nota) => {
            await fechamentoService.fechar(c.mes, nota)
            setFechando(false)
            setMensagem(`${nomeDoMes(c.mes)} fechado. Os saldos e o demonstrativo foram gravados.`)
            recarregar()
          }}
        />
      )}
      {reabrindo && (
        <ReaberturaDialogo
          mes={reabrindo}
          onFechar={() => setReabrindo(null)}
          onReabrir={async (justificativa) => {
            await fechamentoService.reabrir(reabrindo, justificativa)
            setMensagem(`${nomeDoMes(reabrindo)} reaberto. Ele precisa passar pelo checklist e ser fechado de novo.`)
            setReabrindo(null)
            recarregar()
          }}
        />
      )}
      {historico && <HistoricoDialogo mes={historico} onFechar={() => setHistorico(null)} />}
    </Pilha>
  )
}

const diaDoMes = (mes: string, dia: number) => `${mes}-${String(dia).padStart(2, '0')}`

/** US-CLOSING-014: dias em que o fechamento pode ser feito, com o atalho para alterá-los. */
function ResumoJanela({ janela: j }: { janela: SituacaoJanela }) {
  return (
    <TextoSuave>
      Janela de fechamento: do dia {j.diaInicio} ao dia {j.diaFim} de cada mês —{' '}
      {j.aberta ? `aberta até ${formatarData(j.fim)}` : `próxima de ${formatarData(j.inicio)} a ${formatarData(j.fim)}`}.{' '}
      <LinkRota to="/administracao/fechamento">Alterar janela</LinkRota>
    </TextoSuave>
  )
}

function MotivoBloqueio({ checklist: c }: { checklist: Checklist }) {
  if (c.concluidos < c.itens.length) {
    return <TextoSuave>“Fechar período” fica disponível quando todos os itens estiverem concluídos.</TextoSuave>
  }
  if (!c.janela.aberta) {
    return (
      <Aviso tipo="info" titulo="Fora da janela de fechamento">
        O checklist está concluído, mas o fechamento só pode ser feito do dia {c.janela.diaInicio} ao dia {c.janela.diaFim}{' '}
        de cada mês. Próxima janela: {formatarData(c.janela.inicio)} a {formatarData(c.janela.fim)}.
      </Aviso>
    )
  }
  return null
}

function SemMesAFechar({ painel: p }: { painel: PainelFechamento }) {
  if (!p.primeiroPeriodo) {
    return (
      <Aviso tipo="info" titulo="Nenhuma conta cadastrada">
        O primeiro período começa no mês da data de corte mais antiga das contas.
      </Aviso>
    )
  }
  return (
    <Aviso tipo="success" titulo="Nada a fechar">
      {p.ultimoFechado
        ? `Todos os meses até ${nomeDoMes(p.ultimoFechado)} estão fechados.`
        : `O primeiro período (${nomeDoMes(p.primeiroPeriodo)}) ainda não terminou.`}
    </Aviso>
  )
}

function TabelaPeriodos({
  periodos,
  administrador,
  onDemonstrativo,
  onHistorico,
  onReabrir,
}: {
  periodos: ResumoPeriodo[]
  administrador: boolean
  onDemonstrativo(mes: string): void
  onHistorico(mes: string): void
  onReabrir(mes: string): void
}) {
  if (periodos.length === 0) return <TextoSuave>Nenhum período.</TextoSuave>
  return (
    <TableContainer>
      <Table aria-label="Períodos">
        <TableHead>
          <TableRow>
            <TableCell>Mês</TableCell>
            <TableCell>Situação</TableCell>
            <TableCell>Fechamento</TableCell>
            <TableCell align="right">Versões</TableCell>
            <TableCell>Ações</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {periodos.map((p) => (
            <TableRow key={p.mes} hover selected={p.aFechar}>
              <TableCell>
                {nomeDoMes(p.mes)}
                {p.aFechar && (
                  <Typography variant="caption" component="span" color="text.secondary" sx={{ display: 'block' }}>
                    Mês a fechar
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <SituacaoTag situacao={p.situacao} />
              </TableCell>
              <TableCell>
                {p.fechadoEm ? `${formatarDataHora(p.fechadoEm)} · ${p.fechadoPor}` : '—'}
                {p.situacao === 'REABERTO' && p.reabertoEm && (
                  <Typography variant="caption" component="span" color="text.secondary" sx={{ display: 'block' }}>
                    Reaberto em {formatarDataHora(p.reabertoEm)} por {p.reabertoPor}
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right">{p.versoes}</TableCell>
              <TableCell>
                <LinhaAcoes>
                  <Button size="small" onClick={() => onDemonstrativo(p.mes)} aria-label={`Demonstrativo de ${nomeDoMes(p.mes)}`}>
                    Demonstrativo
                  </Button>
                  <Button size="small" onClick={() => onHistorico(p.mes)} aria-label={`Histórico de ${nomeDoMes(p.mes)}`}>
                    Histórico
                  </Button>
                  {administrador && p.podeReabrir && (
                    <Button size="small" color="error" variant="outlined" onClick={() => onReabrir(p.mes)} aria-label={`Reabrir ${nomeDoMes(p.mes)}`}>
                      Reabrir
                    </Button>
                  )}
                </LinhaAcoes>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
