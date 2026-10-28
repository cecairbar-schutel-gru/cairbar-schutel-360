import { Box, Card, CardContent, Chip, Table, TableBody, TableCell, TableFooter, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { Indicador } from '../../../shared/components/Indicador'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarData, hoje, paraIsoData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { CabecalhoRelatorio } from '../components/CabecalhoRelatorio'
import { FiltroPeriodo } from '../components/FiltroPeriodo'
import { Dinheiro } from '../components/Valores'
import { descreverPeriodo, linkLancamentos, ROTULO_GRUPO_CONTAS } from '../regras'
import { relatorioService } from '../services'
import type { SaldoContaRelatorio, SaldosPorConta, TotaisSaldos } from '../types'
import { useFiltrosNaUrl } from '../useFiltrosNaUrl'

/**
 * Saldos por conta (US-REPORT-003): no período, saldo inicial, entradas, saídas, transferências e
 * saldo final de cada caixa e banco, com os totais por tipo; ou o saldo no fim de um dia. Cartão a
 * receber aparece à parte, como valor a receber; os bancos mostram até quando estão conciliados.
 */
export function SaldosContasPage() {
  const { periodo, definirPeriodo, alterar, texto } = useFiltrosNaUrl()
  const data = /^\d{4}-\d{2}-\d{2}$/.test(texto('data')) ? texto('data') : ''
  const naData = data !== ''
  const filtro = naData ? { data } : periodo
  const { dados, carregando, erro } = useCarregamento(() => relatorioService.saldos(filtro), [naData, data, periodo.de, periodo.ate])
  return (
    <Pilha component="section" aria-labelledby="titulo-saldos">
      <CabecalhoRelatorio
        id="titulo-saldos"
        titulo={naData ? `Saldos por conta em ${formatarData(data)}` : `Saldos por conta — ${descreverPeriodo(periodo)}`}
        exportar={(formato) => relatorioService.exportar('saldos', formato, { ...filtro })}
        filtros={
          <LinhaAcoes>
            <ToggleButtonGroup size="small" exclusive value={naData ? 'DATA' : 'PERIODO'} aria-label="Modo"
              onChange={(_, modo) => modo && alterar({ data: modo === 'DATA' ? paraIsoData(hoje()) : undefined })}>
              <ToggleButton value="PERIODO">Período</ToggleButton>
              <ToggleButton value="DATA">Saldo na data</ToggleButton>
            </ToggleButtonGroup>
            {naData ? (
              <TextField type="date" size="small" label="Data" value={data} onChange={(e) => e.target.value && alterar({ data: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }} />
            ) : (
              <FiltroPeriodo key={`${periodo.de}:${periodo.ate}`} periodo={periodo} onChange={definirPeriodo} />
            )}
          </LinhaAcoes>
        }
      />
      {carregando && <Carregando linhas={6} />}
      {erro && (
        <Aviso tipo="error" titulo="Erro">
          {erro}
        </Aviso>
      )}
      {dados && !carregando && <Conteudo s={dados} />}
    </Pilha>
  )
}

function Conteudo({ s }: { s: SaldosPorConta }) {
  const naData = s.modo === 'DATA'
  return (
    <>
      <GradeForm aria-label="Posição">
        <Indicador rotulo="Disponível (caixas e bancos)" valor={formatarMoeda(s.totalDisponivel.saldoFinal)} destaque="primary" />
        <Indicador rotulo="Cartão a receber" valor={formatarMoeda(s.cartaoAReceber?.saldoFinal ?? 0)} detalhe="A receber das adquirentes" />
        <Indicador rotulo="Disponível + a receber" valor={formatarMoeda(s.totalComRecebiveis)} />
      </GradeForm>
      {s.grupos.map((g) => (
        <TabelaContas key={g.tipo} titulo={ROTULO_GRUPO_CONTAS[g.tipo]} contas={g.contas} totais={g.totais} s={s}
          bancos={g.tipo === 'BANCO'} />
      ))}
      <TabelaContas titulo="Cartão a receber (valor a receber)" contas={s.cartaoAReceber ? [s.cartaoAReceber] : []} s={s} />
      <TextoSuave>
        {naData
          ? `Saldos no fim do dia ${formatarData(s.ate)}: saldo inicial mais os lançamentos até essa data.`
          : 'Transferências incluem as liquidações de cartão (o líquido que vai para o banco); a taxa está nas saídas de Cartão a receber.'}
      </TextoSuave>
    </>
  )
}

function TabelaContas({ titulo, contas, totais, s, bancos }: {
  titulo: string
  contas: SaldoContaRelatorio[]
  totais?: TotaisSaldos
  s: SaldosPorConta
  bancos?: boolean
}) {
  const naData = s.modo === 'DATA'
  const de = s.de ?? s.ate
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          {titulo}
        </Typography>
        {contas.length === 0 ? (
          <TextoSuave>Nenhuma conta.</TextoSuave>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" aria-label={titulo}>
              <TableHead>
                <TableRow>
                  <TableCell>Conta</TableCell>
                  {!naData && (
                    <>
                      <TableCell align="right">Saldo inicial</TableCell>
                      <TableCell align="right">Entradas</TableCell>
                      <TableCell align="right">Saídas</TableCell>
                      <TableCell align="right">Transf. recebidas</TableCell>
                      <TableCell align="right">Transf. enviadas</TableCell>
                    </>
                  )}
                  <TableCell align="right">{naData ? 'Saldo' : 'Saldo final'}</TableCell>
                  {bancos && <TableCell>Conciliada até</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {contas.map((c) => (
                  <TableRow key={c.contaId}>
                    <TableCell>
                      <LinkRota to={linkLancamentos({ de: naData ? '' : de, ate: s.ate, contaId: c.contaId })}>{c.nome}</LinkRota>
                      {!c.ativa && <Chip size="small" variant="outlined" label="inativa" sx={{ ml: 1 }} />}
                    </TableCell>
                    {!naData && (
                      <>
                        <TableCell align="right"><Dinheiro valor={c.saldoInicial} /></TableCell>
                        <TableCell align="right"><Dinheiro valor={c.entradas} /></TableCell>
                        <TableCell align="right"><Dinheiro valor={c.saidas} /></TableCell>
                        <TableCell align="right"><Dinheiro valor={c.transferenciasEntrada} /></TableCell>
                        <TableCell align="right"><Dinheiro valor={c.transferenciasSaida} /></TableCell>
                      </>
                    )}
                    <TableCell align="right"><Dinheiro valor={c.saldoFinal} negrito /></TableCell>
                    {bancos && <TableCell>{c.conciliadaAte ? formatarData(c.conciliadaAte) : 'Nunca conciliada'}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
              {totais && (
                <TableFooter>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Total</TableCell>
                    {!naData && (
                      <>
                        <TableCell align="right"><Dinheiro valor={totais.saldoInicial} negrito /></TableCell>
                        <TableCell align="right"><Dinheiro valor={totais.entradas} negrito /></TableCell>
                        <TableCell align="right"><Dinheiro valor={totais.saidas} negrito /></TableCell>
                        <TableCell align="right"><Dinheiro valor={totais.transferenciasEntrada} negrito /></TableCell>
                        <TableCell align="right"><Dinheiro valor={totais.transferenciasSaida} negrito /></TableCell>
                      </>
                    )}
                    <TableCell align="right"><Dinheiro valor={totais.saldoFinal} negrito /></TableCell>
                    {bancos && <TableCell />}
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
