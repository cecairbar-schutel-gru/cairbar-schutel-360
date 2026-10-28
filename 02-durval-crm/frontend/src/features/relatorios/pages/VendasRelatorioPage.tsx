import { Box, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, Typography } from '@mui/material'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { Indicador } from '../../../shared/components/Indicador'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { CabecalhoRelatorio } from '../components/CabecalhoRelatorio'
import { Colunas } from '../components/Colunas'
import { FiltroPeriodo } from '../components/FiltroPeriodo'
import { BarraPercentual, Dinheiro } from '../components/Valores'
import { descreverPeriodo, linkMovimentos, linkVendas } from '../regras'
import { relatorioService } from '../services'
import { ROTULO_MEIO_RELATORIO, type FiltroVendasRelatorio, type RelatorioVendas } from '../types'
import { useFiltrosNaUrl } from '../useFiltrosNaUrl'

const percentualDe = (parte: number, total: number) => (total === 0 ? null : Math.round((parte / total) * 1000) / 10)

/**
 * Vendas (US-REPORT-006): totais, livros × cantina, formas de pagamento, produtos (da maior receita
 * para a menor) e vendedores. Cancelamentos saem da receita na data em que foram feitos. O Vendedor
 * vê as vendas que fez e as do PDV da cantina.
 */
export function VendasRelatorioPage() {
  const { periodo, definirPeriodo } = useFiltrosNaUrl()
  const filtro: FiltroVendasRelatorio = { ...periodo }
  const { dados, carregando, erro } = useCarregamento(() => relatorioService.vendas(filtro), [periodo.de, periodo.ate])
  return (
    <Pilha component="section" aria-labelledby="titulo-vendas-relatorio">
      <CabecalhoRelatorio
        id="titulo-vendas-relatorio"
        titulo={`Vendas — ${descreverPeriodo(periodo)}`}
        exportar={(formato) => relatorioService.exportar('vendas', formato, { ...filtro })}
        filtros={<FiltroPeriodo key={`${periodo.de}:${periodo.ate}`} periodo={periodo} onChange={definirPeriodo} />}
      />
      {carregando && <Carregando linhas={6} />}
      {erro && (
        <Aviso tipo="error" titulo="Erro">
          {erro}
        </Aviso>
      )}
      {dados && !carregando && <Conteudo v={dados} />}
    </Pilha>
  )
}

function Conteudo({ v }: { v: RelatorioVendas }) {
  const periodo = { de: v.de, ate: v.ate }
  const totalMeios = v.porMeio.reduce((s, m) => s + m.valor, 0)
  return (
    <>
      <GradeForm aria-label="Totais do período">
        <Indicador rotulo="Vendas no período" valor={String(v.vendas)} detalhe={`${formatarMoeda(v.receitaBruta)} de receita bruta`} />
        <Indicador rotulo="Canceladas no período" valor={String(v.canceladas)} destaque={v.canceladas > 0 ? 'warning' : undefined}
          detalhe={formatarMoeda(v.valorCancelado)} />
        <Indicador rotulo="Receita líquida" valor={formatarMoeda(v.receitaLiquida)} destaque="primary" />
        <Indicador rotulo="Livros" valor={formatarMoeda(v.livros)} detalhe={`Cantina: ${formatarMoeda(v.cantina)}`} />
      </GradeForm>
      <TextoSuave>
        <LinkRota to={linkVendas(periodo)}>Ver as vendas do período</LinkRota>
        {v.canceladas > 0 && (
          <>
            {' · '}
            <LinkRota to={linkVendas({ ...periodo, status: 'CANCELADA' })}>ver as canceladas</LinkRota>
          </>
        )}
      </TextoSuave>
      <Colunas>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" component="h2" gutterBottom>
              Por forma de pagamento
            </Typography>
            <TableContainer>
              <Table size="small" aria-label="Por forma de pagamento">
                <TableBody>
                  {v.porMeio.map((m) => (
                    <TableRow key={m.meio}>
                      <TableCell>{ROTULO_MEIO_RELATORIO[m.meio]}</TableCell>
                      <TableCell sx={{ width: '45%' }}><BarraPercentual percentual={percentualDe(m.valor, totalMeios)} /></TableCell>
                      <TableCell align="right"><Dinheiro valor={m.valor} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Total</TableCell>
                    <TableCell />
                    <TableCell align="right"><Dinheiro valor={totalMeios} negrito /></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" component="h2" gutterBottom>
              Por vendedor
            </Typography>
            {v.porVendedor.length === 0 ? (
              <TextoSuave>Nenhuma venda no período.</TextoSuave>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <TableContainer>
                  <Table size="small" aria-label="Por vendedor">
                    <TableHead>
                      <TableRow>
                        <TableCell>Vendedor</TableCell>
                        <TableCell align="right">Vendas</TableCell>
                        <TableCell align="right">Canceladas</TableCell>
                        <TableCell align="right">Líquido</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {v.porVendedor.map((c) => (
                        <TableRow key={c.vendedorSubject}>
                          <TableCell>{c.nome}</TableCell>
                          <TableCell align="right">{c.vendas}</TableCell>
                          <TableCell align="right">{c.canceladas}</TableCell>
                          <TableCell align="right"><Dinheiro valor={c.liquido} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      </Colunas>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>
            Por produto
          </Typography>
          {v.porProduto.length === 0 ? (
            <TextoSuave>Nenhum produto vendido no período.</TextoSuave>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <TableContainer>
                <Table size="small" aria-label="Por produto">
                  <TableHead>
                    <TableRow>
                      <TableCell>Produto</TableCell>
                      <TableCell>Tipo</TableCell>
                      <TableCell align="right">Quantidade</TableCell>
                      <TableCell sx={{ width: '30%' }}>Participação</TableCell>
                      <TableCell align="right">Receita</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {v.porProduto.map((p) => (
                      <TableRow key={p.produtoId}>
                        <TableCell>
                          <LinkRota to={linkMovimentos(p.produtoId, periodo)}>{p.nome}</LinkRota>
                        </TableCell>
                        <TableCell>{p.tipo === 'LIVRO' ? 'Livro' : 'Cantina'}</TableCell>
                        <TableCell align="right">{p.quantidade}</TableCell>
                        <TableCell><BarraPercentual percentual={percentualDe(p.valor, v.receitaLiquida)} /></TableCell>
                        <TableCell align="right"><Dinheiro valor={p.valor} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
          <TextoSuave>Preço de cada venda como foi registrado; vendas anteriores nunca são recalculadas.</TextoSuave>
        </CardContent>
      </Card>
    </>
  )
}
