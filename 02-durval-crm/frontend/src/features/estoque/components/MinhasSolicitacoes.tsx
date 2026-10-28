import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { TextoSuave } from '../../../shared/components/layout'
import { formatarDataHora } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { ROTULO_TIPO_SOLICITACAO } from '../rotulos'
import { estoqueService } from '../services'
import { DescricaoSolicitacao } from './DescricaoSolicitacao'
import { StatusSolicitacaoTag } from './Tags'

/** Resumo de "Minhas solicitações" no painel do Vendedor (US-SALES-021), com a decisão e o motivo. */
export function MinhasSolicitacoes({ limite = 5 }: { limite?: number }) {
  const lista = useCarregamento(() => estoqueService.solicitacoes({ minhas: true }), [])
  if (lista.carregando) return <Carregando linhas={2} />
  if (lista.erro) {
    return (
      <Aviso tipo="error" titulo="Erro">
        {lista.erro}
      </Aviso>
    )
  }
  const itens = (lista.dados ?? []).slice(0, limite)
  if (itens.length === 0) return <TextoSuave>Você não tem pedidos de baixa, preço ou inativação.</TextoSuave>
  return (
    <>
      <TableContainer>
        <Table size="small" aria-label="Minhas solicitações">
          <TableHead>
            <TableRow>
              <TableCell>Data</TableCell>
              <TableCell>Pedido</TableCell>
              <TableCell>Produto</TableCell>
              <TableCell>Detalhe</TableCell>
              <TableCell>Situação</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {itens.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{formatarDataHora(s.solicitadaEm)}</TableCell>
                <TableCell>{ROTULO_TIPO_SOLICITACAO[s.tipo]}</TableCell>
                <TableCell>{s.produtoNome}</TableCell>
                <TableCell>
                  <DescricaoSolicitacao s={s} />
                </TableCell>
                <TableCell>
                  <StatusSolicitacaoTag status={s.status} />
                  {s.motivoDecisao && <TextoSuave>{s.motivoDecisao}</TextoSuave>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <LinkRota to="/estoque/solicitacoes">Ver todas as minhas solicitações</LinkRota>
    </>
  )
}
