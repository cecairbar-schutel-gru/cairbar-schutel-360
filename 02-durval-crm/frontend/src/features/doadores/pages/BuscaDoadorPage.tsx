import AddIcon from '@mui/icons-material/Add'
import ClearIcon from '@mui/icons-material/Clear'
import SearchIcon from '@mui/icons-material/Search'
import {
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import {
  LinhaAcoes,
  Pilha,
  TextoSuave,
  TituloPagina,
} from '../../../shared/components/layout'
import { formatarTelefone } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { StatusTag } from '../components/StatusTag'
import { doadorService } from '../services'
import { MINIMO_BUSCA } from '../types'

export function BuscaDoadorPage() {
  const [params] = useSearchParams()
  const navegar = useNavigate()
  const [termo, setTermo] = useState(params.get('q') ?? '')
  const termoAplicado = useDebounce(termo.trim(), 250)
  const ativa = termoAplicado.length >= MINIMO_BUSCA

  const { dados, carregando, erro } = useCarregamento(
    () => (ativa ? doadorService.buscar(termoAplicado) : Promise.resolve([])),
    [termoAplicado, ativa],
  )

  return (
    <Pilha component="section" aria-labelledby="titulo-busca">
      <TituloPagina id="titulo-busca">Buscar doador</TituloPagina>
      <LinhaAcoes>
        <Box sx={{ flex: '1 1 24rem' }}>
          <TextField
            id="busca-doador"
            type="search"
            fullWidth
            label="Buscar por nome, telefone ou e-mail"
            placeholder="Nome, telefone ou e-mail"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            autoFocus
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: termo && (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Limpar busca"
                      edge="end"
                      onClick={() => setTermo('')}
                    >
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => navegar('/doadores/novo')}
        >
          Cadastro rápido
        </Button>
      </LinhaAcoes>

      {!ativa && (
        <TextoSuave>
          Digite ao menos {MINIMO_BUSCA} caracteres para buscar.
        </TextoSuave>
      )}
      {ativa && carregando && <Carregando />}
      {ativa && erro && (
        <Aviso tipo="error" titulo="Erro na busca">
          {erro}
        </Aviso>
      )}
      {ativa && !carregando && !erro && dados && dados.length === 0 && (
        <Aviso
          tipo="info"
          titulo="Nenhum doador encontrado"
          acao={
            <Button
              color="inherit"
              size="small"
              onClick={() =>
                navegar(`/doadores/novo?q=${encodeURIComponent(termoAplicado)}`)
              }
            >
              Cadastro rápido com “{termoAplicado}”
            </Button>
          }
        >
          Você pode cadastrar a pessoa agora.
        </Aviso>
      )}
      {ativa && dados && dados.length > 0 && (
        <div aria-live="polite">
          <TableContainer>
            <Table aria-label="Resultados da busca de doadores">
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Telefone</TableCell>
                  <TableCell>E-mail</TableCell>
                  <TableCell>Situação</TableCell>
                  <TableCell>Pendências</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dados.map((d) => (
                  <TableRow key={d.id} hover>
                    <TableCell>
                      <LinkRota to={`/doadores/${d.id}?acao=receber`}>
                        {d.nome}
                      </LinkRota>
                    </TableCell>
                    <TableCell>{formatarTelefone(d.telefonePrincipal)}</TableCell>
                    <TableCell>{d.emailPrincipal ?? '—'}</TableCell>
                    <TableCell>
                      {d.status === 'INATIVO' ? (
                        <Chip size="small" label="Inativo" />
                      ) : (
                        <StatusTag status={d.status} />
                      )}
                    </TableCell>
                    <TableCell>{d.competenciasPendentes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      )}
    </Pilha>
  )
}
