import { Box, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, Typography } from '@mui/material'
import { useAuth } from '../../../auth/AuthProvider'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { Indicador } from '../../../shared/components/Indicador'
import { LinkRota } from '../../../shared/components/LinkRota'
import { CampoMes } from '../../../shared/components/CampoMes'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarCompetencia, formatarData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { deslocarMes } from '../../editoras/regras'
import { nomeDoMes } from '../../financeiro/regras'
import { CabecalhoRelatorio } from '../components/CabecalhoRelatorio'
import { Colunas } from '../components/Colunas'
import { FiltroPeriodo } from '../components/FiltroPeriodo'
import { BarraPercentual, Dinheiro } from '../components/Valores'
import { descreverPeriodo, linkLancamentos, mesAtual } from '../regras'
import { relatorioService } from '../services'
import type { FiltroMensalidades, RecebimentoMensalidades, RelatorioMensalidades, SituacaoCompetencias } from '../types'
import { useFiltrosNaUrl } from '../useFiltrosNaUrl'

const MES = /^\d{4}-(0[1-9]|1[0-2])$/
const MENSALIDADES = 'RECEITAS_CONTRIBUICOES.MENSALIDADES'

/**
 * Mensalidades (US-REPORT-004; Spec §8 "Competências corretamente acompanhadas"): situação das
 * competências por mês com a taxa de pagamento, o que foi recebido no período (de meses
 * anteriores, do mês e antecipado) e os doadores ativos com 3 ou mais competências pendentes.
 */
export function MensalidadesPage() {
  const { periodo, definirPeriodo, alterar, texto } = useFiltrosNaUrl()
  const competenciaAte = MES.test(texto('competenciaAte')) ? texto('competenciaAte') : mesAtual()
  const competenciaDe = MES.test(texto('competenciaDe')) ? texto('competenciaDe') : deslocarMes(competenciaAte, -5)
  const filtro: FiltroMensalidades = { ...periodo, competenciaDe, competenciaAte }
  const { dados, carregando, erro } = useCarregamento(() => relatorioService.mensalidades(filtro), [
    periodo.de, periodo.ate, competenciaDe, competenciaAte,
  ])
  return (
    <Pilha component="section" aria-labelledby="titulo-mensalidades">
      <CabecalhoRelatorio
        id="titulo-mensalidades"
        titulo="Mensalidades"
        exportar={(formato) => relatorioService.exportar('mensalidades', formato, { ...filtro })}
        filtros={
          <LinhaAcoes>
            <CampoMes size="small" rotulo="Competências de" valor={competenciaDe} max={competenciaAte}
              onAlterar={(m) => alterar({ competenciaDe: m })} />
            <CampoMes size="small" rotulo="até" valor={competenciaAte} min={competenciaDe}
              onAlterar={(m) => alterar({ competenciaAte: m })} />
            <FiltroPeriodo key={`${periodo.de}:${periodo.ate}`} periodo={periodo} onChange={definirPeriodo} rotulo="Recebimentos" />
          </LinhaAcoes>
        }
      />
      {carregando && <Carregando linhas={6} />}
      {erro && (
        <Aviso tipo="error" titulo="Erro">
          {erro}
        </Aviso>
      )}
      {dados && !carregando && <Conteudo m={dados} />}
    </Pilha>
  )
}

function Conteudo({ m }: { m: RelatorioMensalidades }) {
  const r = m.recebimentos
  const periodo = { de: m.de, ate: m.ate }
  return (
    <>
      <GradeForm aria-label="Recebido no período">
        <Indicador rotulo={`Recebido em ${descreverPeriodo(periodo)}`} valor={formatarMoeda(r.total.valor)} destaque="primary"
          detalhe={`${r.total.quantidade} competências`} />
        <Indicador rotulo="De meses anteriores" valor={formatarMoeda(r.atrasadas.valor)} detalhe={`${r.atrasadas.quantidade} competências`} />
        <Indicador rotulo="Do próprio mês" valor={formatarMoeda(r.mesCorrente.valor)} destaque="success" detalhe={`${r.mesCorrente.quantidade} competências`} />
        <Indicador rotulo="Antecipadas" valor={formatarMoeda(r.antecipadas.valor)} detalhe={`${r.antecipadas.quantidade} competências`} />
      </GradeForm>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>
            Competências de {formatarCompetencia(m.competenciaDe)} a {formatarCompetencia(m.competenciaAte)}
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <TableContainer>
              <Table size="small" aria-label="Competências por mês">
                <TableHead>
                  <TableRow>
                    <TableCell>Competência</TableCell>
                    <TableCell align="right">Geradas</TableCell>
                    <TableCell align="right">Pagas</TableCell>
                    <TableCell align="right">Pendentes</TableCell>
                    <TableCell align="right">Canceladas</TableCell>
                    <TableCell align="right">Valor pago</TableCell>
                    <TableCell align="right">Valor pendente</TableCell>
                    <TableCell sx={{ minWidth: 160 }}>Taxa de pagamento</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {m.porCompetencia.map((s) => (
                    <LinhaCompetencia key={s.mes} s={s} rotulo={nomeDoMes(s.mes!)} />
                  ))}
                </TableBody>
                <TableFooter>
                  <LinhaCompetencia s={m.totalCompetencias} rotulo="Total" negrito />
                </TableFooter>
              </Table>
            </TableContainer>
          </Box>
          <TextoSuave>Taxa de pagamento = pagas ÷ (geradas − canceladas). A situação é a de hoje.</TextoSuave>
        </CardContent>
      </Card>

      <Colunas>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" component="h2" gutterBottom>
              Recebido em mensalidades
            </Typography>
            {m.recebimentosPorMes.length === 0 ? (
              <TextoSuave>Nenhuma mensalidade recebida no período.</TextoSuave>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <TableContainer>
                  <Table size="small" aria-label="Recebido em mensalidades">
                    <TableHead>
                      <TableRow>
                        <TableCell>Mês do recebimento</TableCell>
                        <TableCell align="right">Atrasadas</TableCell>
                        <TableCell align="right">Do mês</TableCell>
                        <TableCell align="right">Antecipadas</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {m.recebimentosPorMes.map((x) => (
                        <LinhaRecebimento key={x.mes} r={x} rotulo={nomeDoMes(x.mes!)} />
                      ))}
                    </TableBody>
                    <TableFooter>
                      <LinhaRecebimento r={r} rotulo="Total" negrito />
                    </TableFooter>
                  </Table>
                </TableContainer>
              </Box>
            )}
            <TextoSuave>
              Pela data do recebimento (regime de caixa); cancelamentos descontados na data do estorno. Veja os{' '}
              <LinkRota to={linkLancamentos({ ...periodo, categoria: MENSALIDADES })}>lançamentos de mensalidades</LinkRota>.
            </TextoSuave>
          </CardContent>
        </Card>
        <DoadoresComPendencias m={m} />
      </Colunas>
    </>
  )
}

function LinhaCompetencia({ s, rotulo, negrito }: { s: SituacaoCompetencias; rotulo: string; negrito?: boolean }) {
  const fw = negrito ? 600 : undefined
  return (
    <TableRow>
      <TableCell sx={{ fontWeight: fw }}>{rotulo}</TableCell>
      <TableCell align="right" sx={{ fontWeight: fw }}>{s.geradas}</TableCell>
      <TableCell align="right" sx={{ fontWeight: fw }}>{s.pagas}</TableCell>
      <TableCell align="right" sx={{ fontWeight: fw }}>{s.pendentes}</TableCell>
      <TableCell align="right" sx={{ fontWeight: fw }}>{s.canceladas}</TableCell>
      <TableCell align="right"><Dinheiro valor={s.valorPago} negrito={negrito} /></TableCell>
      <TableCell align="right"><Dinheiro valor={s.valorPendente} negrito={negrito} /></TableCell>
      <TableCell><BarraPercentual percentual={s.taxaPagamento} rotulo={`Taxa de pagamento de ${rotulo}`} /></TableCell>
    </TableRow>
  )
}

function LinhaRecebimento({ r, rotulo, negrito }: { r: RecebimentoMensalidades; rotulo: string; negrito?: boolean }) {
  return (
    <TableRow>
      <TableCell sx={{ fontWeight: negrito ? 600 : undefined }}>{rotulo}</TableCell>
      <TableCell align="right"><Dinheiro valor={r.atrasadas.valor} negrito={negrito} /></TableCell>
      <TableCell align="right"><Dinheiro valor={r.mesCorrente.valor} negrito={negrito} /></TableCell>
      <TableCell align="right"><Dinheiro valor={r.antecipadas.valor} negrito={negrito} /></TableCell>
      <TableCell align="right"><Dinheiro valor={r.total.valor} negrito /></TableCell>
    </TableRow>
  )
}

/** Lista para planejar contatos; o perfil do doador abre para quem tem acesso a Doadores. */
function DoadoresComPendencias({ m }: { m: RelatorioMensalidades }) {
  const { possuiPapel } = useAuth()
  const comPerfil = possuiPapel('operador', 'administrador')
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          Doadores com 3 ou mais competências pendentes
        </Typography>
        {m.doadoresComPendencias.length === 0 ? (
          <TextoSuave>Nenhum doador ativo com 3 ou mais competências pendentes.</TextoSuave>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <TableContainer>
              <Table size="small" aria-label="Doadores com pendências">
                <TableHead>
                  <TableRow>
                    <TableCell>Doador</TableCell>
                    <TableCell align="right">Pendentes</TableCell>
                    <TableCell align="right">Valor pendente</TableCell>
                    <TableCell>Último pagamento</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {m.doadoresComPendencias.map((d) => (
                    <TableRow key={d.doadorId}>
                      <TableCell>{comPerfil ? <LinkRota to={`/doadores/${d.doadorId}`}>{d.nome}</LinkRota> : d.nome}</TableCell>
                      <TableCell align="right">{d.pendentes}</TableCell>
                      <TableCell align="right"><Dinheiro valor={d.valorPendente} /></TableCell>
                      <TableCell>{d.ultimoPagamento ? formatarData(d.ultimoPagamento) : 'Nunca pagou'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
