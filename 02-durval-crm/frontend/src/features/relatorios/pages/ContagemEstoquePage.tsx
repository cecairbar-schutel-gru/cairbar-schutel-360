import { Box, MenuItem, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { useAuth } from '../../../auth/AuthProvider'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinhaAcoes, Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarData } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { CabecalhoRelatorio } from '../components/CabecalhoRelatorio'
import { opcoesFiltroEstoque } from '../opcoesEstoque'
import { relatorioService } from '../services'
import type { FiltroContagem } from '../types'
import { useFiltrosNaUrl } from '../useFiltrosNaUrl'

/**
 * Folha de contagem (US-REPORT-007): cada produto com a quantidade do sistema e a coluna "Contado"
 * em branco, para imprimir e levar ao inventário físico. Diferenças se corrigem pelo ajuste após
 * contagem (US-INVENTORY-016).
 */
export function ContagemEstoquePage() {
  const { possuiPapel } = useAuth()
  const { alterar, texto, numero } = useFiltrosNaUrl()
  const tipo = texto('tipo') === 'LIVRO' || texto('tipo') === 'CANTINA' ? (texto('tipo') as 'LIVRO' | 'CANTINA') : undefined
  const filtro: FiltroContagem = {
    tipo,
    categoria: tipo === 'LIVRO' ? undefined : texto('categoria') || undefined,
    editoraId: tipo === 'CANTINA' ? undefined : numero('editoraId'),
  }
  const opcoes = useCarregamento(() => opcoesFiltroEstoque(possuiPapel('vendedor', 'administrador')), [])
  const { dados, carregando, erro } = useCarregamento(() => relatorioService.contagem(filtro), [filtro.tipo, filtro.categoria, filtro.editoraId])
  return (
    <Pilha component="section" aria-labelledby="titulo-contagem">
      <CabecalhoRelatorio
        id="titulo-contagem"
        titulo="Folha de contagem de estoque"
        imprimir
        exportar={(formato) => relatorioService.exportar('contagem-estoque', formato, { ...filtro })}
        filtros={
          <LinhaAcoes>
            <TextField select size="small" label="Tipo" value={tipo ?? ''} sx={{ minWidth: 140 }} onChange={(e) => alterar({ tipo: e.target.value })}>
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
          <Typography>
            Quantidades do sistema em <strong>{formatarData(dados.data)}</strong>. Contado por: ______________________ Data: ____/____/______
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <TableContainer>
              <Table size="small" aria-label="Folha de contagem">
                <TableHead>
                  <TableRow>
                    <TableCell>Produto</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Categoria / editora</TableCell>
                    <TableCell align="right">Próprio</TableCell>
                    <TableCell align="right">Consignado</TableCell>
                    <TableCell align="right">No sistema</TableCell>
                    <TableCell sx={{ minWidth: 120 }}>Contado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dados.itens.map((i) => (
                    <TableRow key={i.produtoId}>
                      <TableCell>{i.nome}</TableCell>
                      <TableCell>{i.tipo === 'LIVRO' ? 'Livro' : 'Cantina'}</TableCell>
                      <TableCell>{(i.tipo === 'LIVRO' ? i.editoraNome : i.categoria) ?? '—'}</TableCell>
                      <TableCell align="right">{i.proprio}</TableCell>
                      <TableCell align="right">{i.consignado}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{i.quantidade}</TableCell>
                      <TableCell aria-label={`Contado de ${i.nome} (em branco)`} sx={{ borderBottom: 1, borderColor: 'text.primary' }} />
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} sx={{ fontWeight: 600 }}>Total</TableCell>
                    <TableCell align="right">{dados.itens.reduce((s, i) => s + i.proprio, 0)}</TableCell>
                    <TableCell align="right">{dados.itens.reduce((s, i) => s + i.consignado, 0)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{dados.itens.reduce((s, i) => s + i.quantidade, 0)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </TableContainer>
          </Box>
          <TextoSuave>Diferenças entre o contado e o sistema se corrigem pelo ajuste após contagem, na página de cada produto.</TextoSuave>
        </>
      )}
    </Pilha>
  )
}
