import { Box, Card, CardContent, Chip, Link, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { TextoSuave } from '../../../shared/components/layout'
import { linkLancamentos } from '../regras'
import type { GrupoCategoria, Periodo } from '../types'
import { BarraPercentual, Dinheiro } from './Valores'

/**
 * "Receitas por categoria" / "Despesas por categoria" do wireframe 12: categoria e subcategorias,
 * barra de participação no total do grupo e o valor, que abre os lançamentos por trás dele.
 */
export function TabelaCategorias({ titulo, grupos, total, periodo, vazio = 'Nada no período.' }: {
  titulo: string
  grupos: GrupoCategoria[]
  total: number
  periodo: Periodo
  vazio?: string
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          {titulo}
        </Typography>
        {grupos.length === 0 ? (
          <TextoSuave>{vazio}</TextoSuave>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <TableContainer>
              <Table size="small" aria-label={titulo}>
                <TableHead>
                  <TableRow>
                    <TableCell>Categoria</TableCell>
                    <TableCell sx={{ width: '35%' }}>Participação</TableCell>
                    <TableCell align="right">Valor</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {grupos.map((g) => (
                    <Grupo key={g.codigo} grupo={g} periodo={periodo} />
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Total</TableCell>
                    <TableCell />
                    <TableCell align="right"><Dinheiro valor={total} negrito /></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </TableContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

function Grupo({ grupo, periodo }: { grupo: GrupoCategoria; periodo: Periodo }) {
  return (
    <>
      <TableRow>
        <TableCell sx={{ fontWeight: 600 }}>
          {grupo.nome}
          {!grupo.ativa && <Chip size="small" variant="outlined" label="inativa" sx={{ ml: 1 }} />}
        </TableCell>
        <TableCell><BarraPercentual percentual={grupo.percentual} rotulo={grupo.nome} /></TableCell>
        <TableCell align="right">
          <Link component={RouterLink} to={linkLancamentos({ ...periodo, categoria: grupo.codigo })}
            aria-label={`Lançamentos de ${grupo.nome}`}>
            <Dinheiro valor={grupo.valor} negrito />
          </Link>
        </TableCell>
      </TableRow>
      {grupo.subcategorias.map((s) => (
        <TableRow key={s.codigo}>
          <TableCell sx={{ pl: 4 }}>
            {s.nome}
            {!s.ativa && <Chip size="small" variant="outlined" label="inativa" sx={{ ml: 1 }} />}
          </TableCell>
          <TableCell><BarraPercentual percentual={s.percentual} /></TableCell>
          <TableCell align="right">
            {s.valor === 0 ? (
              <Dinheiro valor={0} />
            ) : (
              <Link component={RouterLink} to={linkLancamentos({ ...periodo, categoria: s.codigo })}
                aria-label={`Lançamentos de ${s.nome}`}>
                <Dinheiro valor={s.valor} />
              </Link>
            )}
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
