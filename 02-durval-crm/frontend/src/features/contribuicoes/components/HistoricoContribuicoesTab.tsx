import {
  Chip,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { LinhaAcoes, Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarDataHora } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { listarCompetencias } from '../regras'
import { contribuicaoService } from '../services'
import { ROTULO_MEIO } from '../types'

/** Aba "Contribuições" do perfil (US-CONTRIB-012); cada linha abre a 2ª via do recibo. */
export function HistoricoContribuicoesTab({ doadorId, versao }: { doadorId: number; versao: number }) {
  const [ano, setAno] = useState<number | undefined>(undefined)
  const { dados, carregando, erro } = useCarregamento(
    () => contribuicaoService.historico(doadorId, ano),
    [doadorId, ano, versao],
  )

  if (carregando && !dados) return <Carregando />
  if (erro || !dados) return <Aviso tipo="error" titulo="Erro">{erro ?? 'Erro inesperado.'}</Aviso>

  return (
    <Pilha>
      <LinhaAcoes>
        <TextField
          select
          size="small"
          label="Ano"
          value={dados.ano}
          onChange={(e) => setAno(Number(e.target.value))}
          sx={{ minWidth: '8rem' }}
        >
          {dados.anosDisponiveis.map((a) => (
            <MenuItem key={a} value={a}>
              {a}
            </MenuItem>
          ))}
        </TextField>
        <Typography aria-live="polite">
          Total contribuído em {dados.ano}: <strong>{formatarMoeda(dados.totalNoAno)}</strong>
        </Typography>
      </LinhaAcoes>
      {dados.itens.length === 0 ? (
        <TextoSuave>Nenhuma contribuição em {dados.ano}.</TextoSuave>
      ) : (
        <TableContainer>
          <Table aria-label="Contribuições do doador">
            <TableHead>
              <TableRow>
                <TableCell>Data</TableCell>
                <TableCell>Recibo</TableCell>
                <TableCell>Competências</TableCell>
                <TableCell>Doação</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Meios</TableCell>
                <TableCell>Situação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dados.itens.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{formatarDataHora(c.recebidaEm)}</TableCell>
                  <TableCell>
                    <LinkRota to={`/contribuicoes/${c.id}`}>{c.numeroRecibo}</LinkRota>
                  </TableCell>
                  <TableCell>{c.competencias.length > 0 ? listarCompetencias(c.competencias) : '—'}</TableCell>
                  <TableCell>{c.valorDoacao > 0 ? formatarMoeda(c.valorDoacao) : '—'}</TableCell>
                  <TableCell>{formatarMoeda(c.total)}</TableCell>
                  <TableCell>{c.meios.map((m) => ROTULO_MEIO[m]).join(', ')}</TableCell>
                  <TableCell>
                    {c.status === 'CANCELADA' ? (
                      <Pilha spacing={0.5}>
                        <Chip size="small" color="error" label="Cancelada" sx={{ alignSelf: 'flex-start' }} />
                        <TextoSuave>{c.motivoCancelamento}</TextoSuave>
                      </Pilha>
                    ) : (
                      <Chip size="small" color="success" label="Registrada" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Pilha>
  )
}
