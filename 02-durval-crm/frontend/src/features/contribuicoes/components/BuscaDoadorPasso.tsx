import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinhaAcoes, Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarTelefone } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { StatusTag } from '../../doadores/components/StatusTag'
import { doadorService } from '../../doadores/services'
import { MINIMO_BUSCA, type ResumoDoador } from '../../doadores/types'

/** Passo 1 (wireframe 5): busca por nome, telefone ou e-mail. */
export function BuscaDoadorPasso({ onSelecionar }: { onSelecionar(d: ResumoDoador): void }) {
  const navegar = useNavigate()
  const [termo, setTermo] = useState('')
  const aplicado = useDebounce(termo.trim(), 250)
  const ativa = aplicado.length >= MINIMO_BUSCA
  const { dados, carregando, erro } = useCarregamento(
    () => (ativa ? doadorService.buscar(aplicado) : Promise.resolve([])),
    [aplicado],
  )

  return (
    <Pilha>
      <TextField
        label="Nome, telefone ou e-mail"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        autoFocus
        helperText={`Digite ao menos ${MINIMO_BUSCA} caracteres.`}
      />
      {erro && (
        <Aviso tipo="error" titulo="Erro">
          {erro}
        </Aviso>
      )}
      {ativa && carregando && <Carregando />}
      {ativa && !carregando && dados && dados.length === 0 && (
        <TextoSuave>Nenhum doador encontrado.</TextoSuave>
      )}
      {ativa && dados && dados.length > 0 && (
        <Table size="small" aria-label="Doadores encontrados">
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Telefone</TableCell>
              <TableCell>Situação</TableCell>
              <TableCell>Pendentes</TableCell>
              <TableCell>Ação</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {dados.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.nome}</TableCell>
                <TableCell>{formatarTelefone(d.telefonePrincipal)}</TableCell>
                <TableCell>
                  <StatusTag status={d.status} />
                </TableCell>
                <TableCell>{d.competenciasPendentes}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    variant="outlined"
                    aria-label={`Selecionar ${d.nome}`}
                    onClick={() => onSelecionar(d)}
                  >
                    Selecionar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <LinhaAcoes>
        <Button
          onClick={() =>
            navegar(`/doadores/novo${termo.trim() ? `?q=${encodeURIComponent(termo.trim())}` : ''}`)
          }
        >
          Cadastrar novo doador
        </Button>
      </LinhaAcoes>
    </Pilha>
  )
}
