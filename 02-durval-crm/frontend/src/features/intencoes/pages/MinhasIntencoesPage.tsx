import AddIcon from '@mui/icons-material/Add'
import { Button, MenuItem, TextField } from '@mui/material'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { TabelaIntencoes } from '../components/TabelaIntencoes'
import { ROTULO_STATUS } from '../rotulos'
import { intencaoService } from '../services'
import type { StatusIntencao } from '../types'

/**
 * "Minhas intenções de gasto" (US-EXPENSE-008): das mais novas para as mais antigas, com filtro por
 * situação. As que mudaram desde a última visita aparecem destacadas; abrir a tela registra a visita.
 */
export function MinhasIntencoesPage() {
  const navegar = useNavigate()
  const [status, setStatus] = useState<StatusIntencao | ''>('')
  const lista = useCarregamento(() => intencaoService.minhas(status || undefined), [status])

  useEffect(() => {
    if (lista.dados) void intencaoService.registrarVisita().catch(() => undefined)
  }, [lista.dados])

  const itens = lista.dados ?? []
  const novidades = itens.filter((i) => i.novidade).length
  return (
    <Pilha component="section" aria-labelledby="titulo-minhas-intencoes">
      <TituloPagina id="titulo-minhas-intencoes">Minhas intenções de gasto</TituloPagina>
      <TextoSuave>
        Peça antes de gastar: a Tesouraria aprova (podendo ajustar o valor total) e a despesa é registrada automaticamente.
      </TextoSuave>
      <LinhaAcoes>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navegar('/intencoes-gasto/nova')}>
          Nova intenção de gasto
        </Button>
        <TextField
          select
          size="small"
          label="Situação"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusIntencao | '')}
          sx={{ minWidth: '14rem' }}
        >
          <MenuItem value="">Todas</MenuItem>
          {(Object.keys(ROTULO_STATUS) as StatusIntencao[]).map((s) => (
            <MenuItem key={s} value={s}>
              {ROTULO_STATUS[s]}
            </MenuItem>
          ))}
        </TextField>
      </LinhaAcoes>
      {novidades > 0 && (
        <Aviso tipo="info" titulo="Novidades">
          {novidades === 1 ? '1 intenção mudou de situação' : `${novidades} intenções mudaram de situação`} desde a sua última visita.
        </Aviso>
      )}
      {lista.carregando && <Carregando />}
      {lista.erro && (
        <Aviso tipo="error" titulo="Erro">
          {lista.erro}
        </Aviso>
      )}
      {!lista.carregando && !lista.erro && itens.length === 0 && <TextoSuave>Nenhuma intenção de gasto.</TextoSuave>}
      {itens.length > 0 && <TabelaIntencoes rotulo="Minhas intenções de gasto" itens={itens} comAprovado />}
    </Pilha>
  )
}
