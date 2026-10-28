import { Button, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinhaAcoes, Pilha, TituloPagina } from '../../../shared/components/layout'
import { formatarData, hoje, paraIsoData } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { QuadroDeSaldos } from '../components/QuadroDeSaldos'
import { financeiroService } from '../services'

/** Entrada do Financeiro da tesouraria: saldos das contas (US-FINANCIAL-002) e as operações do perfil. */
export function FinanceiroPage() {
  const { perfilAtivo } = useAuth()
  const navegar = useNavigate()
  const [data, setData] = useState('')
  const saldos = useCarregamento(() => financeiroService.saldos(data || undefined), [data])

  return (
    <Pilha component="section" aria-labelledby="titulo-financeiro">
      <TituloPagina id="titulo-financeiro">Financeiro</TituloPagina>
      <LinhaAcoes>
        {perfilAtivo === 'tesoureiro' && (
          <>
            <Button variant="contained" onClick={() => navegar('/financeiro/transferencia')}>
              Transferência entre contas
            </Button>
            <Button variant="outlined" onClick={() => navegar('/financeiro/liquidacao-cartao')}>
              Liquidar cartão
            </Button>
            <Button variant="outlined" onClick={() => navegar('/financeiro/lancamentos/novo')}>
              Lançamento manual
            </Button>
          </>
        )}
        <Button variant="outlined" onClick={() => navegar('/financeiro/lancamentos')}>
          Lançamentos
        </Button>
        <Button variant="outlined" onClick={() => navegar('/financeiro/contas')}>
          Contas e recebimento
        </Button>
        <Button variant="outlined" onClick={() => navegar('/conciliacao')}>
          Conciliação bancária
        </Button>
      </LinhaAcoes>

      <Typography variant="h5" component="h2">
        Saldos {data ? `em ${formatarData(data)}` : 'agora'}
      </Typography>
      <TextField
        type="date"
        label="Saldo na data (opcional)"
        value={data}
        onChange={(e) => setData(e.target.value)}
        helperText="Saldos no fim do dia escolhido. Deixe em branco para ver os de agora."
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: paraIsoData(hoje()) } }}
        sx={{ maxWidth: 320 }}
      />
      {saldos.carregando && <Carregando />}
      {saldos.erro && (
        <Aviso tipo="error" titulo="Erro">
          {saldos.erro}
        </Aviso>
      )}
      {saldos.dados && <QuadroDeSaldos saldos={saldos.dados} comExtrato />}
    </Pilha>
  )
}
