import AttachFileIcon from '@mui/icons-material/AttachFile'
import { Chip, Link, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { formatarDataHora } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import type { ResumoIntencao } from '../types'
import { StatusIntencaoTag } from './StatusIntencaoTag'

interface Props {
  rotulo: string
  itens: ResumoIntencao[]
  /** Fila da Tesouraria: mostra quem pediu e a categoria. */
  comSolicitante?: boolean
  /** "Minhas intenções": valor aprovado e destaque do que mudou. */
  comAprovado?: boolean
  /** Recebimentos do Vendedor: produtos e quantidades em vez da categoria. */
  comProdutos?: boolean
  textoLink?: string
}

/** Lista de intenções usada pela fila, por "Minhas intenções" e pelos recebimentos. */
export function TabelaIntencoes({ rotulo, itens, comSolicitante, comAprovado, comProdutos, textoLink = 'Abrir' }: Props) {
  return (
    <TableContainer>
      <Table size="small" aria-label={rotulo}>
        <TableHead>
          <TableRow>
            <TableCell>Nº</TableCell>
            <TableCell>Data</TableCell>
            {comSolicitante && <TableCell>Solicitante</TableCell>}
            <TableCell>Descrição</TableCell>
            {comProdutos ? <TableCell>Produtos</TableCell> : <TableCell>Categoria</TableCell>}
            <TableCell align="right">{comAprovado ? 'Solicitado' : 'Valor'}</TableCell>
            {comAprovado && <TableCell align="right">Aprovado</TableCell>}
            <TableCell>Situação</TableCell>
            <TableCell align="right">Ações</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {itens.map((i) => (
            <TableRow key={i.id} selected={i.novidade}>
              <TableCell>{i.id}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatarDataHora(i.criadaEm)}</TableCell>
              {comSolicitante && <TableCell>{i.solicitanteNome ?? '—'}</TableCell>}
              <TableCell>
                {i.descricao}
                {i.anexos > 0 && (
                  <AttachFileIcon
                    fontSize="small"
                    color="action"
                    titleAccess={`${i.anexos} ${i.anexos === 1 ? 'anexo' : 'anexos'}`}
                    sx={{ verticalAlign: 'middle', ml: 0.5 }}
                  />
                )}
              </TableCell>
              {comProdutos ? (
                <TableCell>{i.itens.map((x) => `${x.quantidade} × ${x.produtoNome}`).join(', ')}</TableCell>
              ) : (
                <TableCell>
                  <Typography variant="body2">{i.categoriaNome}</Typography>
                </TableCell>
              )}
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                {formatarMoeda(i.valorSolicitado)}
              </TableCell>
              {comAprovado && (
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {i.valorAprovado === null ? '—' : formatarMoeda(i.valorAprovado)}
                </TableCell>
              )}
              <TableCell>
                <StatusIntencaoTag status={i.status} />
                {i.novidade && <Chip size="small" color="info" label="Atualizada" sx={{ ml: 0.5 }} />}
              </TableCell>
              <TableCell align="right">
                <Link component={RouterLink} to={`/intencoes-gasto/${i.id}`} aria-label={`${textoLink} intenção nº ${i.id}`}>
                  {textoLink}
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
