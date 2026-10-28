import { Box, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow } from '@mui/material'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { Indicador } from '../../../shared/components/Indicador'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { CabecalhoRelatorio } from '../components/CabecalhoRelatorio'
import { FiltroPeriodo } from '../components/FiltroPeriodo'
import { Dinheiro } from '../components/Valores'
import { descreverPeriodo } from '../regras'
import { relatorioService } from '../services'
import type { AcertoEditora } from '../types'
import { useFiltrosNaUrl } from '../useFiltrosNaUrl'

/**
 * Acertos com editoras (US-REPORT-009): por editora, saldo inicial + obrigações (vendas e
 * dano/extravio) − estornos − pagamentos = saldo final, com o total de todas e o link para a
 * apuração mensal de cada uma (US-PUBLISHER-007).
 */
export function AcertosEditorasPage() {
  const { periodo, definirPeriodo } = useFiltrosNaUrl()
  const { dados, carregando, erro } = useCarregamento(() => relatorioService.editoras(periodo), [periodo.de, periodo.ate])
  const mesDaApuracao = periodo.ate.slice(0, 7)
  return (
    <Pilha component="section" aria-labelledby="titulo-acertos">
      <CabecalhoRelatorio
        id="titulo-acertos"
        titulo={`Acertos com editoras — ${descreverPeriodo(periodo)}`}
        exportar={(formato) => relatorioService.exportar('editoras', formato, { ...periodo })}
        filtros={<FiltroPeriodo key={`${periodo.de}:${periodo.ate}`} periodo={periodo} onChange={definirPeriodo} />}
      />
      {carregando && <Carregando linhas={6} />}
      {erro && (
        <Aviso tipo="error" titulo="Erro">
          {erro}
        </Aviso>
      )}
      {dados && !carregando && (
        <>
          <GradeForm aria-label="Totais do período">
            <Indicador rotulo="Saldo devido no início" valor={formatarMoeda(dados.total.saldoInicial)} />
            <Indicador rotulo="Novas obrigações" valor={formatarMoeda(dados.total.obrigacoesVendas + dados.total.obrigacoesBaixas)} destaque="warning" />
            <Indicador rotulo="Pagamentos" valor={formatarMoeda(dados.total.pagamentos)} destaque="success" />
            <Indicador rotulo="Saldo devido no fim" valor={formatarMoeda(dados.total.saldoFinal)} destaque="primary" />
          </GradeForm>
          <Card variant="outlined">
            <CardContent>
              {dados.editoras.length === 0 ? (
                <TextoSuave>Nenhuma editora com saldo ou movimento no período.</TextoSuave>
              ) : (
                <Box sx={{ overflowX: 'auto' }}>
                  <TableContainer>
                    <Table size="small" aria-label="Acertos por editora">
                      <TableHead>
                        <TableRow>
                          <TableCell>Editora</TableCell>
                          <TableCell align="right">Saldo inicial</TableCell>
                          <TableCell align="right">Vendas</TableCell>
                          <TableCell align="right">Dano/extravio</TableCell>
                          <TableCell align="right">Estornos</TableCell>
                          <TableCell align="right">Pagamentos</TableCell>
                          <TableCell align="right">Saldo final</TableCell>
                          <TableCell align="right">Transferido ao mês seguinte</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {dados.editoras.map((e) => (
                          <Linha key={e.editoraId} a={e} mes={mesDaApuracao} />
                        ))}
                      </TableBody>
                      <TableFooter>
                        <Linha a={dados.total} mes={mesDaApuracao} total />
                      </TableFooter>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </CardContent>
          </Card>
          <TextoSuave>
            Saldo final = inicial + obrigações − estornos − pagamentos (pagamentos estornados no período já descontados). A
            transferência do saldo ao mês seguinte é a decisão registrada no fechamento: não muda o valor devido. O nome da
            editora abre a apuração de {mesDaApuracao.slice(5, 7)}/{mesDaApuracao.slice(0, 4)}.
          </TextoSuave>
        </>
      )}
    </Pilha>
  )
}

function Linha({ a, mes, total }: { a: AcertoEditora; mes: string; total?: boolean }) {
  return (
    <TableRow>
      <TableCell sx={{ fontWeight: total ? 600 : undefined }}>
        {a.editoraId ? <LinkRota to={`/editoras/${a.editoraId}/apuracao?mes=${mes}`}>{a.nome}</LinkRota> : a.nome}
      </TableCell>
      <TableCell align="right"><Dinheiro valor={a.saldoInicial} negrito={total} /></TableCell>
      <TableCell align="right"><Dinheiro valor={a.obrigacoesVendas} negrito={total} /></TableCell>
      <TableCell align="right"><Dinheiro valor={a.obrigacoesBaixas} negrito={total} /></TableCell>
      <TableCell align="right"><Dinheiro valor={a.estornos} negrito={total} /></TableCell>
      <TableCell align="right"><Dinheiro valor={a.pagamentos} negrito={total} /></TableCell>
      <TableCell align="right"><Dinheiro valor={a.saldoFinal} negrito /></TableCell>
      <TableCell align="right"><Dinheiro valor={a.transferido} negrito={total} /></TableCell>
    </TableRow>
  )
}
