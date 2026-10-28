import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarCompetencia, formatarData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { SituacaoCompetenciaTag } from '../../contribuicoes/components/SituacaoCompetenciaTag'
import { competenciaService } from '../../contribuicoes/services'

/**
 * US-CONTRIB-002: pendentes, próximos 12 meses ("Futura", ainda não gravados) e pagas/canceladas
 * dos últimos 24 meses; as mais antigas em "Mostrar mais".
 */
export function CompetenciasTab({
  doadorId,
  versao,
}: {
  doadorId: number
  versao: number
}) {
  const [completo, setCompleto] = useState(false)
  const { dados, carregando, erro } = useCarregamento(
    () => competenciaService.painel(doadorId, completo),
    [doadorId, versao, completo],
  )

  if (carregando && !dados) return <Carregando />
  if (erro || !dados)
    return (
      <Aviso tipo="error" titulo="Erro">
        {erro ?? 'Erro inesperado.'}
      </Aviso>
    )

  return (
    <Pilha>
      <Typography aria-live="polite">
        <strong>{dados.quantidadePendentes}</strong>{' '}
        {dados.quantidadePendentes === 1
          ? 'competência pendente'
          : 'competências pendentes'}{' '}
        — total <strong>{formatarMoeda(dados.totalPendente)}</strong>
      </Typography>
      {dados.itens.length === 0 ? (
        <TextoSuave>Este doador ainda não possui competências.</TextoSuave>
      ) : (
        <Table aria-label="Competências do doador">
          <TableHead>
            <TableRow>
              <TableCell>Competência</TableCell>
              <TableCell>Valor</TableCell>
              <TableCell>Situação</TableCell>
              <TableCell>Pagamento</TableCell>
              <TableCell>Recibo</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {dados.itens.map((c) => (
              <TableRow key={c.competencia}>
                <TableCell>{formatarCompetencia(c.competencia)}</TableCell>
                <TableCell>{formatarMoeda(c.valor)}</TableCell>
                <TableCell>
                  <SituacaoCompetenciaTag situacao={c.situacao} atrasada={c.atrasada} />
                </TableCell>
                <TableCell>{formatarData(c.dataPagamento)}</TableCell>
                <TableCell>
                  {c.numeroRecibo && c.contribuicaoId ? (
                    <LinkRota to={`/contribuicoes/${c.contribuicaoId}`}>{c.numeroRecibo}</LinkRota>
                  ) : (
                    (c.numeroRecibo ?? '—')
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {dados.possuiMaisAntigas && !completo && (
        <div>
          <Button onClick={() => setCompleto(true)}>Mostrar mais</Button>
        </div>
      )}
    </Pilha>
  )
}
