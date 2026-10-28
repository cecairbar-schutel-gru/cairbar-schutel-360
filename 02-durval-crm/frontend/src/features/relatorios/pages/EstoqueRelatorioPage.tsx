import { Box, Button, Card, CardContent, Checkbox, Chip, FormControlLabel, MenuItem, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { LinhaAcoes, Pilha, TextoSuave } from '../../../shared/components/layout'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { CabecalhoRelatorio } from '../components/CabecalhoRelatorio'
import { FiltroPeriodo } from '../components/FiltroPeriodo'
import { opcoesFiltroEstoque } from '../opcoesEstoque'
import { descreverOrigem, descreverPeriodo, linkMovimentos, linkRelatorio, ROTULO_MOTIVO } from '../regras'
import { relatorioService } from '../services'
import type { FiltroEstoqueRelatorio, LinhaEstoque, Periodo, RelatorioEstoque } from '../types'
import { useFiltrosNaUrl } from '../useFiltrosNaUrl'

const COLUNAS: { chave: keyof LinhaEstoque; rotulo: string }[] = [
  { chave: 'inicial', rotulo: 'Inicial' },
  { chave: 'compra', rotulo: 'Compra' },
  { chave: 'doacao', rotulo: 'Doação' },
  { chave: 'remessa', rotulo: 'Remessa' },
  { chave: 'venda', rotulo: 'Venda' },
  { chave: 'devolucao', rotulo: 'Devolução' },
  { chave: 'baixa', rotulo: 'Baixa' },
  { chave: 'ajuste', rotulo: 'Ajuste' },
  { chave: 'fim', rotulo: 'Final' },
]

/**
 * Estoque (US-REPORT-007; Spec §8 "Estoque físico e do sistema compatíveis"): por produto, saldo
 * inicial, entradas (compra, doação, remessa), saídas (venda, devolução, baixa), ajustes e saldo
 * final; livros separados em próprio e consignado por remessa; baixas por motivo.
 */
export function EstoqueRelatorioPage() {
  const { possuiPapel } = useAuth()
  const { periodo, definirPeriodo, alterar, texto, numero } = useFiltrosNaUrl()
  const tipo = texto('tipo') === 'LIVRO' || texto('tipo') === 'CANTINA' ? (texto('tipo') as 'LIVRO' | 'CANTINA') : undefined
  const filtro: FiltroEstoqueRelatorio = {
    ...periodo,
    tipo,
    categoria: tipo === 'LIVRO' ? undefined : texto('categoria') || undefined,
    editoraId: tipo === 'CANTINA' ? undefined : numero('editoraId'),
    somenteComMovimento: texto('somenteComMovimento') === 'true',
  }
  const opcoes = useCarregamento(() => opcoesFiltroEstoque(possuiPapel('vendedor', 'administrador')), [])
  const { dados, carregando, erro } = useCarregamento(() => relatorioService.estoque(filtro), [
    periodo.de, periodo.ate, filtro.tipo, filtro.categoria, filtro.editoraId, filtro.somenteComMovimento,
  ])
  const filtroContagem = { tipo: filtro.tipo, categoria: filtro.categoria, editoraId: filtro.editoraId }
  return (
    <Pilha component="section" aria-labelledby="titulo-estoque-relatorio">
      <CabecalhoRelatorio
        id="titulo-estoque-relatorio"
        titulo={`Estoque — ${descreverPeriodo(periodo)}`}
        exportar={(formato) => relatorioService.exportar('estoque', formato, { ...filtro })}
        filtros={
          <Pilha spacing={1}>
            <LinhaAcoes>
              <FiltroPeriodo key={`${periodo.de}:${periodo.ate}`} periodo={periodo} onChange={definirPeriodo} />
              <TextField select size="small" label="Tipo" value={tipo ?? ''} sx={{ minWidth: 140 }}
                onChange={(e) => alterar({ tipo: e.target.value })}>
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="LIVRO">Livros</MenuItem>
                <MenuItem value="CANTINA">Cantina</MenuItem>
              </TextField>
              {tipo !== 'LIVRO' && (
                <TextField select size="small" label="Categoria" value={filtro.categoria ?? ''} sx={{ minWidth: 160 }}
                  onChange={(e) => alterar({ categoria: e.target.value })}>
                  <MenuItem value="">Todas</MenuItem>
                  {(opcoes.dados?.categorias ?? []).map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              {tipo !== 'CANTINA' && (
                <TextField select size="small" label="Editora" value={filtro.editoraId ?? ''} sx={{ minWidth: 180 }}
                  onChange={(e) => alterar({ editoraId: e.target.value })}>
                  <MenuItem value="">Todas</MenuItem>
                  {(opcoes.dados?.editoras ?? []).map((e) => (
                    <MenuItem key={e.id} value={e.id}>
                      {e.nome}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              <FormControlLabel label="Somente com movimento" control={
                <Checkbox checked={!!filtro.somenteComMovimento} onChange={(e) => alterar({ somenteComMovimento: e.target.checked })} />
              } />
            </LinhaAcoes>
            <Box>
              <Button component={Link} to={linkRelatorio('/relatorios/estoque/contagem', filtroContagem)} variant="outlined">
                Folha de contagem
              </Button>
            </Box>
          </Pilha>
        }
      />
      {carregando && <Carregando linhas={6} />}
      {erro && (
        <Aviso tipo="error" titulo="Erro">
          {erro}
        </Aviso>
      )}
      {dados && !carregando && <Conteudo e={dados} periodo={periodo} />}
    </Pilha>
  )
}

function Conteudo({ e, periodo }: { e: RelatorioEstoque; periodo: Periodo }) {
  return (
    <>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>
            Saldos e movimentos por produto
          </Typography>
          {e.produtos.length === 0 ? (
            <TextoSuave>Nenhum produto com os filtros escolhidos.</TextoSuave>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <TableContainer>
                <Table size="small" aria-label="Saldos e movimentos por produto">
                  <TableHead>
                    <TableRow>
                      <TableCell>Produto</TableCell>
                      <TableCell>Origem</TableCell>
                      {COLUNAS.map((c) => (
                        <TableCell key={c.chave} align="right">{c.rotulo}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {e.produtos.flatMap((p) => {
                      const linhas = p.origens.map((o, i) => (
                        <TableRow key={`${p.produtoId}-${o.remessaId ?? 'proprio'}`}>
                          <TableCell sx={{ borderBottom: p.origens.length > 1 && i < p.origens.length - 1 ? 0 : undefined }}>
                            {i === 0 && (
                              <>
                                <LinkRota to={linkMovimentos(p.produtoId, periodo)}>{p.nome}</LinkRota>
                                {!p.ativo && <Chip size="small" variant="outlined" label="inativo" sx={{ ml: 1 }} />}
                                <Typography variant="caption" component="span" color="text.secondary" sx={{ display: 'block' }}>
                                  {p.tipo === 'LIVRO' ? (p.editoraNome ?? 'Livro') : (p.categoria ?? 'Cantina')}
                                </Typography>
                              </>
                            )}
                          </TableCell>
                          <TableCell>{descreverOrigem(o)}</TableCell>
                          {COLUNAS.map((c) => (
                            <TableCell key={c.chave} align="right" sx={{ fontWeight: c.chave === 'fim' ? 600 : undefined }}>{o[c.chave]}</TableCell>
                          ))}
                        </TableRow>
                      ))
                      if (p.origens.length > 1) {
                        linhas.push(
                          <TableRow key={`${p.produtoId}-total`}>
                            <TableCell />
                            <TableCell sx={{ fontWeight: 600 }}>Total do produto</TableCell>
                            {COLUNAS.map((c) => (
                              <TableCell key={c.chave} align="right" sx={{ fontWeight: 600 }}>{p.total[c.chave]}</TableCell>
                            ))}
                          </TableRow>,
                        )
                      }
                      return linhas
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }} colSpan={2}>Total</TableCell>
                      {COLUNAS.map((c) => (
                        <TableCell key={c.chave} align="right" sx={{ fontWeight: 600 }}>{e.total[c.chave]}</TableCell>
                      ))}
                    </TableRow>
                  </TableFooter>
                </Table>
              </TableContainer>
            </Box>
          )}
          <TextoSuave>
            Final = inicial + compra + doação + remessa − venda − devolução − baixa + ajuste. Cancelamentos de venda e estornos
            reduzem a coluna do movimento original. O nome do produto abre o histórico de movimentos.
          </TextoSuave>
        </CardContent>
      </Card>
      <Card variant="outlined" sx={{ maxWidth: 480 }}>
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>
            Baixas por motivo
          </Typography>
          <TableContainer>
            <Table size="small" aria-label="Baixas por motivo">
              <TableBody>
                {e.baixasPorMotivo.map((b) => (
                  <TableRow key={b.motivo}>
                    <TableCell>{ROTULO_MOTIVO[b.motivo]}</TableCell>
                    <TableCell align="right">{b.quantidade}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{e.baixasPorMotivo.reduce((s, b) => s + b.quantidade, 0)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </>
  )
}
