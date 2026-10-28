import { Box, Card, CardContent, MenuItem, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, TextField, Typography } from '@mui/material'
import type { TipoConta } from '../../financeiro/types'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { Indicador } from '../../../shared/components/Indicador'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { financeiroService } from '../../financeiro/services'
import { CabecalhoRelatorio } from '../components/CabecalhoRelatorio'
import { Colunas } from '../components/Colunas'
import { FiltroPeriodo } from '../components/FiltroPeriodo'
import { TabelaCategorias } from '../components/TabelaCategorias'
import { Dinheiro } from '../components/Valores'
import { descreverPeriodo, linkLancamentos, linkRelatorio, ROTULO_AGRUPAMENTO, ROTULO_GRUPO_CONTAS } from '../regras'
import { relatorioService } from '../services'
import type { Agrupamento, FiltroFluxo } from '../types'
import { useFiltrosNaUrl } from '../useFiltrosNaUrl'

const TIPOS: TipoConta[] = ['CAIXA', 'BANCO', 'CARTAO_A_RECEBER']

/** "conta:3", "tipo:BANCO" ou "" (todas), no mesmo seletor. */
function escolhaContas(f: Pick<FiltroFluxo, 'contaId' | 'tipoConta'>): string {
  if (f.contaId) return `conta:${f.contaId}`
  if (f.tipoConta) return `tipo:${f.tipoConta}`
  return ''
}

/**
 * Fluxo de caixa (US-REPORT-001): saldo inicial, entradas e saídas por categoria, transferências à
 * parte e saldo final, que é o saldo das contas no fim do período; linhas por dia, semana ou mês.
 */
export function FluxoCaixaPage() {
  const { periodo, definirPeriodo, alterar, texto, numero } = useFiltrosNaUrl()
  const agrupamento = (['DIA', 'SEMANA', 'MES'].includes(texto('agrupamento')) ? texto('agrupamento') : 'MES') as Agrupamento
  const filtro: FiltroFluxo = {
    ...periodo,
    agrupamento,
    contaId: numero('contaId'),
    tipoConta: (TIPOS as string[]).includes(texto('tipoConta')) ? (texto('tipoConta') as TipoConta) : undefined,
  }
  const contas = useCarregamento(() => financeiroService.contas(), [])
  const { dados, carregando, erro } = useCarregamento(() => relatorioService.fluxoCaixa(filtro), [
    filtro.de, filtro.ate, filtro.agrupamento, filtro.contaId, filtro.tipoConta,
  ])

  function escolherContas(valor: string) {
    const [tipo, id] = valor.split(':')
    alterar({ contaId: tipo === 'conta' ? id : undefined, tipoConta: tipo === 'tipo' ? id : undefined })
  }

  const transferencias = dados ? dados.transferenciasEntrada - dados.transferenciasSaida : 0
  return (
    <Pilha component="section" aria-labelledby="titulo-fluxo">
      <CabecalhoRelatorio
        id="titulo-fluxo"
        titulo={`Fluxo de caixa — ${descreverPeriodo(periodo)}`}
        exportar={(formato) => relatorioService.exportar('fluxo-caixa', formato, { ...filtro })}
        filtros={
          <LinhaAcoes>
            <FiltroPeriodo key={`${periodo.de}:${periodo.ate}`} periodo={periodo} onChange={definirPeriodo} />
            <TextField select size="small" label="Contas" value={escolhaContas(filtro)} onChange={(e) => escolherContas(e.target.value)}
              sx={{ minWidth: 220 }}>
              <MenuItem value="">Todas as contas</MenuItem>
              {TIPOS.filter((t) => t !== 'CARTAO_A_RECEBER').map((t) => (
                <MenuItem key={t} value={`tipo:${t}`}>
                  Todos os {ROTULO_GRUPO_CONTAS[t].toLowerCase()}
                </MenuItem>
              ))}
              {(contas.dados ?? []).map((c) => (
                <MenuItem key={c.id} value={`conta:${c.id}`}>
                  {c.nome}
                </MenuItem>
              ))}
            </TextField>
            <TextField select size="small" label="Agrupar" value={agrupamento} onChange={(e) => alterar({ agrupamento: e.target.value })}
              sx={{ minWidth: 160 }}>
              {(Object.keys(ROTULO_AGRUPAMENTO) as Agrupamento[]).map((a) => (
                <MenuItem key={a} value={a}>
                  {ROTULO_AGRUPAMENTO[a]}
                </MenuItem>
              ))}
            </TextField>
          </LinhaAcoes>
        }
      />
      {carregando && <Carregando linhas={6} />}
      {erro && (
        <Aviso tipo="error" titulo="Erro">
          {erro}
        </Aviso>
      )}
      {dados && !carregando && (
        <>
          <TextoSuave>
            Contas: {dados.contaId ? dados.contas[0]?.nome : dados.tipoConta ? ROTULO_GRUPO_CONTAS[dados.tipoConta] : 'todas'}
            {dados.contas.length > 1 && ` (${dados.contas.map((c) => c.nome).join(', ')})`}
          </TextoSuave>
          <GradeForm aria-label="Resumo do período">
            <Indicador rotulo="Saldo inicial" valor={formatarMoeda(dados.saldoInicial)} />
            <Indicador rotulo="Entradas" valor={formatarMoeda(dados.totalEntradas)} destaque="success" />
            <Indicador rotulo="Saídas" valor={formatarMoeda(dados.totalSaidas)} destaque="error" />
            <Indicador rotulo="Transferências" valor={formatarMoeda(transferencias)}
              detalhe={`${formatarMoeda(dados.transferenciasEntrada)} recebidas · ${formatarMoeda(dados.transferenciasSaida)} enviadas`} />
            <Indicador rotulo="Saldo final" valor={formatarMoeda(dados.saldoFinal)} destaque="primary" />
          </GradeForm>
          <Colunas>
            <TabelaCategorias titulo="Entradas por categoria" grupos={dados.entradas} total={dados.totalEntradas} periodo={periodo}
              vazio="Nenhuma entrada no período." />
            <TabelaCategorias titulo="Saídas por categoria" grupos={dados.saidas} total={dados.totalSaidas} periodo={periodo}
              vazio="Nenhuma saída no período." />
          </Colunas>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h2" gutterBottom>
                Movimento {ROTULO_AGRUPAMENTO[dados.agrupamento].toLowerCase()}
              </Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <TableContainer>
                  <Table size="small" aria-label="Movimento por período">
                    <TableHead>
                      <TableRow>
                        <TableCell>Período</TableCell>
                        <TableCell align="right">Saldo inicial</TableCell>
                        <TableCell align="right">Entradas</TableCell>
                        <TableCell align="right">Saídas</TableCell>
                        <TableCell align="right">Transf. recebidas</TableCell>
                        <TableCell align="right">Transf. enviadas</TableCell>
                        <TableCell align="right">Saldo final</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dados.periodos.map((l) => (
                        <TableRow key={l.inicio}>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <LinkRota to={linkLancamentos({ de: l.inicio, ate: l.fim, contaId: dados.contaId })}>
                              {l.inicio === l.fim ? formatarData(l.inicio) : `${formatarData(l.inicio)} a ${formatarData(l.fim)}`}
                            </LinkRota>
                          </TableCell>
                          <TableCell align="right"><Dinheiro valor={l.saldoInicial} /></TableCell>
                          <TableCell align="right"><Dinheiro valor={l.entradas} /></TableCell>
                          <TableCell align="right"><Dinheiro valor={l.saidas} /></TableCell>
                          <TableCell align="right"><Dinheiro valor={l.transferenciasEntrada} /></TableCell>
                          <TableCell align="right"><Dinheiro valor={l.transferenciasSaida} /></TableCell>
                          <TableCell align="right"><Dinheiro valor={l.saldoFinal} negrito /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Período todo</TableCell>
                        <TableCell align="right"><Dinheiro valor={dados.saldoInicial} negrito /></TableCell>
                        <TableCell align="right"><Dinheiro valor={dados.totalEntradas} negrito /></TableCell>
                        <TableCell align="right"><Dinheiro valor={dados.totalSaidas} negrito /></TableCell>
                        <TableCell align="right"><Dinheiro valor={dados.transferenciasEntrada} negrito /></TableCell>
                        <TableCell align="right"><Dinheiro valor={dados.transferenciasSaida} negrito /></TableCell>
                        <TableCell align="right"><Dinheiro valor={dados.saldoFinal} negrito /></TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </TableContainer>
              </Box>
            </CardContent>
          </Card>
          <TextoSuave>
            Saldo inicial + entradas − saídas + transferências recebidas − enviadas = saldo final, igual ao saldo das contas
            em {formatarData(dados.ate)} (veja <LinkRota to={linkRelatorio('/relatorios/saldos', { de: dados.de, ate: dados.ate })}>Saldos por conta</LinkRota>).
            Numa liquidação de cartão, a taxa é saída de Cartão a receber e o líquido é transferência para o banco.
          </TextoSuave>
        </>
      )}
    </Pilha>
  )
}
