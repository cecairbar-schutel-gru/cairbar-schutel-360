import {
  Box,
  Button,
  List,
  ListItem,
  TextField,
  Typography,
} from '@mui/material'
import { useState, type FormEvent } from 'react'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import {
  LinhaAcoes,
  Pilha,
  TextoSuave,
} from '../../../shared/components/layout'
import { mensagemDeErro } from '../../../shared/api/http'
import { formatarDataHora } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { doadorService } from '../services'
import { LIMITE_NOTA } from '../types'

export function NotasTab({
  doadorId,
  somenteLeitura,
}: {
  doadorId: number
  somenteLeitura: boolean
}) {
  const { dados, carregando, erro, recarregar } = useCarregamento(
    () => doadorService.listarNotas(doadorId),
    [doadorId],
  )
  const [texto, setTexto] = useState('')
  const [falha, setFalha] = useState<string | null>(null)

  async function adicionar(evento: FormEvent) {
    evento.preventDefault()
    setFalha(null)
    try {
      await doadorService.adicionarNota(doadorId, texto)
      setTexto('')
      recarregar()
    } catch (e) {
      setFalha(mensagemDeErro(e))
    }
  }

  return (
    <Pilha>
      {!somenteLeitura && (
        <Pilha component="form" onSubmit={adicionar} aria-label="Nova nota">
          <Aviso tipo="warning" titulo="Atenção">
            Não registre dados de saúde, religião ou outros dados sensíveis.
          </Aviso>
          <TextField
            id="nota-texto"
            label="Nova nota"
            multiline
            minRows={3}
            helperText={`As notas não podem ser editadas nem excluídas; para corrigir, registre uma nova nota. ${texto.length}/${LIMITE_NOTA}`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            slotProps={{ htmlInput: { maxLength: LIMITE_NOTA } }}
          />
          {falha && (
            <Aviso tipo="error" titulo="Erro">
              {falha}
            </Aviso>
          )}
          <LinhaAcoes>
            <Button
              type="submit"
              variant="contained"
              disabled={!texto.trim() || texto.length > LIMITE_NOTA}
            >
              Adicionar nota
            </Button>
          </LinhaAcoes>
        </Pilha>
      )}
      {carregando && <Carregando linhas={2} />}
      {erro && (
        <Aviso tipo="error" titulo="Erro">
          {erro}
        </Aviso>
      )}
      {dados && dados.length === 0 && (
        <TextoSuave>Nenhuma nota registrada.</TextoSuave>
      )}
      {dados && dados.length > 0 && (
        <List
          aria-label="Notas do doador"
          disablePadding
          sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
        >
          {dados.map((n) => (
            <ListItem
              key={n.id}
              sx={{
                display: 'block',
                bgcolor: 'background.paper',
                borderLeft: 3,
                borderColor: 'primary.dark',
                px: 2,
                py: 1.5,
              }}
            >
              <Typography>{n.texto}</Typography>
              <Box sx={{ mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {n.autor} · {formatarDataHora(n.criadaEm)}
                </Typography>
              </Box>
            </ListItem>
          ))}
        </List>
      )}
    </Pilha>
  )
}
