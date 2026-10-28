import SearchIcon from '@mui/icons-material/Search'
import {
  Button,
  Chip,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { Indicador } from '../../../shared/components/Indicador'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarData, formatarDataHora, hoje, paraIsoData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { doadorService } from '../../doadores/services'
import { contribuicaoService } from '../services'

/** Painel do Operador (wireframe 1, US-CONTRIB-021): atender rápido e ver o que foi recebido hoje. */
export function PainelOperadorPage() {
  const { usuario } = useAuth()
  const navegar = useNavigate()
  const [termo, setTermo] = useState('')
  const painel = useCarregamento(() => contribuicaoService.painelOperador(), [])
  const dia = paraIsoData(hoje())
  const aniversariantes = useCarregamento(() => doadorService.listarAniversariantes(dia, dia), [dia])

  function buscar(evento: FormEvent) {
    evento.preventDefault()
    navegar(`/doadores?q=${encodeURIComponent(termo.trim())}`)
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-painel">
      <TituloPagina id="titulo-painel">Olá, {usuario?.nome}</TituloPagina>

      <Pilha component="form" role="search" onSubmit={buscar} spacing={2}>
        <TextField
          label="Buscar doador por nome, telefone ou e-mail"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <Button type="submit" startIcon={<SearchIcon />}>
                    Buscar
                  </Button>
                </InputAdornment>
              ),
            },
          }}
        />
        <LinhaAcoes>
          <Button variant="contained" onClick={() => navegar('/doadores/novo')}>
            Cadastro rápido
          </Button>
          <Button variant="outlined" onClick={() => navegar('/contribuicoes/anonima')}>
            Doação anônima
          </Button>
        </LinhaAcoes>
      </Pilha>

      {aniversariantes.dados && (
        <Typography>
          {aniversariantes.dados.itens.length === 0
            ? 'Nenhum aniversariante hoje.'
            : `${aniversariantes.dados.itens.length} ${
                aniversariantes.dados.itens.length === 1 ? 'aniversariante' : 'aniversariantes'
              } hoje.`}{' '}
          <LinkRota to="/aniversariantes">Ver aniversariantes</LinkRota>
        </Typography>
      )}

      <Typography variant="h5" component="h2">
        Hoje, {formatarData(dia)}
      </Typography>
      {painel.carregando && <Carregando />}
      {painel.erro && <Aviso tipo="error" titulo="Erro">{painel.erro}</Aviso>}
      {painel.dados && (
        <>
          <GradeForm>
            <Indicador rotulo="Contribuições" valor={String(painel.dados.quantidade)} />
            <Indicador rotulo="Dinheiro" valor={formatarMoeda(painel.dados.totalDinheiro)} />
            <Indicador rotulo="PIX" valor={formatarMoeda(painel.dados.totalPix)} />
            <Indicador rotulo="Cartão" valor={formatarMoeda(painel.dados.totalCartao)} />
          </GradeForm>
          <Typography variant="h5" component="h2">
            Minhas últimas contribuições
          </Typography>
          {painel.dados.ultimas.length === 0 ? (
            <TextoSuave>Nenhuma contribuição registrada por você.</TextoSuave>
          ) : (
            <Table size="small" aria-label="Minhas últimas contribuições">
              <TableHead>
                <TableRow>
                  <TableCell>Data/hora</TableCell>
                  <TableCell>Recibo</TableCell>
                  <TableCell>Doador</TableCell>
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {painel.dados.ultimas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{formatarDataHora(c.recebidaEm)}</TableCell>
                    <TableCell>
                      <LinkRota to={`/contribuicoes/${c.id}`}>{c.numeroRecibo}</LinkRota>{' '}
                      {c.status === 'CANCELADA' && <Chip size="small" color="error" label="Cancelada" />}
                    </TableCell>
                    <TableCell>{c.doadorNome}</TableCell>
                    <TableCell align="right">{formatarMoeda(c.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </Pilha>
  )
}
