import { Alert, Table, TableBody, TableCell, TableFooter, TableHead, TableRow, Typography } from '@mui/material'
import { useParams, useSearchParams } from 'react-router-dom'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { LinhaAcoes, Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarData } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { Assinaturas, BotaoImprimir, CabecalhoDocumento, EstiloImpressao } from '../components/Impressao'
import { editoraService } from '../services'

/** Comprovante de devolução para a editora assinar (US-PUBLISHER-005). */
export function DevolucaoPage() {
  const id = Number(useParams().id)
  const [parametros] = useSearchParams()
  const { dados: d, carregando, erro } = useCarregamento(() => editoraService.devolucao(id), [id])
  if (carregando && !d) return <Carregando linhas={6} />
  if (erro || !d) return <Aviso tipo="error" titulo="Erro">{erro ?? 'Devolução não encontrada.'}</Aviso>
  return (
    <Pilha component="section" aria-label={`Devolução nº ${d.id}`}>
      <EstiloImpressao />
      <LinhaAcoes data-nao-imprimir sx={{ justifyContent: 'space-between' }}>
        <LinkRota to={`/editoras/remessas/${d.remessaId}`}>Voltar à remessa {d.remessaCodigo}</LinkRota>
        <BotaoImprimir />
      </LinhaAcoes>
      {parametros.get('nova') === '1' && (
        <Alert severity="success" variant="outlined" data-nao-imprimir>
          Devolução registrada. Imprima o comprovante para a editora assinar.
        </Alert>
      )}
      <CabecalhoDocumento organizacao={d.organizacao} titulo={`Comprovante de devolução nº ${d.id}`} editoraNome={d.editoraNome} editoraCnpj={d.editoraCnpj} />
      <Typography>
        Remessa {d.remessaCodigo} · devolvida em {formatarData(d.devolvidaEm)}
      </Typography>
      <Table size="small" aria-label="Títulos devolvidos">
        <TableHead>
          <TableRow>
            <TableCell>Título</TableCell>
            <TableCell>ISBN</TableCell>
            <TableCell align="right">Quantidade</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {d.itens.map((i) => (
            <TableRow key={i.produtoId}>
              <TableCell>{i.titulo}</TableCell>
              <TableCell>{i.isbn ?? '—'}</TableCell>
              <TableCell align="right">{i.quantidade}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>Total</TableCell>
            <TableCell align="right">{d.itens.reduce((s, i) => s + i.quantidade, 0)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      {d.observacao && <TextoSuave>Observação: {d.observacao}</TextoSuave>}
      <TextoSuave>Registrada por {d.registradaPor}. Devolução sem efeito financeiro.</TextoSuave>
      <Assinaturas esquerda={d.organizacao.nome} direita={d.editoraNome} />
    </Pilha>
  )
}
