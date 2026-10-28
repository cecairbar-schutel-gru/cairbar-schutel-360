import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import {
  Button,
  InputAdornment,
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
import { useNavigate } from 'react-router-dom'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarData, hoje, paraIsoData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { normalizarTexto } from '../../../shared/text/texto'
import { StatusContaPagarTag } from '../components/Tags'
import { ROTULO_RECORRENCIA } from '../rotulos'
import { contasPagarService } from '../services'
import type { SituacaoContas } from '../types'

/** Cadastro das contas a pagar: busca, situação e o próximo vencimento em aberto de cada uma. */
export function CadastroContasPagarPage() {
  const navegar = useNavigate()
  const [termo, setTermo] = useState('')
  const [situacao, setSituacao] = useState<SituacaoContas>('ATIVAS')
  const contas = useCarregamento(() => contasPagarService.listar(situacao), [situacao])
  const hojeIso = paraIsoData(hoje())

  const busca = normalizarTexto(termo)
  const lista = (contas.dados ?? []).filter(
    ({ conta: c }) => !busca || normalizarTexto(`${c.descricao} ${c.favorecido ?? ''}`).includes(busca),
  )
  return (
    <Pilha component="section" aria-labelledby="titulo-cadastro-contas-pagar">
      <LinkRota to="/contas-pagar">Voltar às contas a pagar</LinkRota>
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <TituloPagina id="titulo-cadastro-contas-pagar">Cadastro de contas a pagar</TituloPagina>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navegar('/contas-pagar/nova')}>
          Nova conta
        </Button>
      </LinhaAcoes>
      <GradeForm role="search" aria-label="Filtrar contas a pagar">
        <TextField
          label="Buscar por descrição ou favorecido"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
        />
        <TextField select label="Situação" value={situacao} onChange={(e) => setSituacao(e.target.value as SituacaoContas)}>
          <MenuItem value="ATIVAS">Ativas</MenuItem>
          <MenuItem value="TODAS">Todas</MenuItem>
        </TextField>
      </GradeForm>
      {contas.carregando && <Carregando />}
      {contas.erro && <Aviso tipo="error" titulo="Erro">{contas.erro}</Aviso>}
      {!contas.carregando && !contas.erro && lista.length === 0 && <TextoSuave>Nenhuma conta a pagar cadastrada.</TextoSuave>}
      {lista.length > 0 && (
        <TableContainer>
          <Table size="small" aria-label="Contas a pagar">
            <TableHead>
              <TableRow>
                <TableCell>Conta</TableCell>
                <TableCell>Categoria</TableCell>
                <TableCell>Recorrência</TableCell>
                <TableCell align="right">Valor previsto</TableCell>
                <TableCell>Próximo vencimento</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lista.map(({ conta: c, categoriaNome, proximoVencimento, quitada }) => (
                <TableRow key={c.id} hover>
                  <TableCell>
                    <LinkRota to={`/contas-pagar/${c.id}`}>{c.descricao}</LinkRota>
                    {c.favorecido && (
                      <Typography variant="body2" color="text.secondary">
                        {c.favorecido}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{categoriaNome ?? c.categoria}</TableCell>
                  <TableCell>{ROTULO_RECORRENCIA[c.recorrencia]}</TableCell>
                  <TableCell align="right">{formatarMoeda(c.valorPrevisto)}</TableCell>
                  <TableCell>
                    {proximoVencimento ? (
                      <Typography variant="body2" color={proximoVencimento < hojeIso ? 'error.dark' : undefined}>
                        {formatarData(proximoVencimento)}
                        {proximoVencimento < hojeIso && ' (vencida)'}
                      </Typography>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusContaPagarTag ativa={c.ativa} quitada={quitada} />
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
