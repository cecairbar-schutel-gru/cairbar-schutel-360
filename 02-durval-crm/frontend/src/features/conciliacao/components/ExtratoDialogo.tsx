import { InputAdornment, TextField } from '@mui/material'
import { useState } from 'react'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { Pilha, TextoSuave } from '../../../shared/components/layout'
import {
  formatarData,
  hoje,
  paraIsoData,
} from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { paraTextoDigitado } from '../../../shared/pagamento/regras'
import { errosPorCampo } from '../../doadores/components/errosDeCampo'
import { lerSaldo } from '../regras'

interface Props {
  titulo: string
  contaNome: string
  /** Data final da última conciliação: a nova deve ser posterior. */
  conciliadaAte: string | null
  /** Saldo do extrato da última conciliação (ou o saldo inicial da conta), só para orientar. */
  saldoAbertura: number | null
  inicial?: { dataFim: string; saldoExtrato: number }
  textoConfirmar: string
  onFechar(): void
  onConfirmar(dataFim: string, saldoExtrato: number): Promise<void>
}

const somarDias = (iso: string, dias: number) => {
  const [a, m, d] = iso.split('-').map(Number)
  return paraIsoData(new Date(a, m - 1, d + dias))
}

/**
 * Dados do extrato (US-RECONCILIATION-001): data final, posterior à última conciliação e no máximo
 * ontem (o extrato do dia só fecha no dia seguinte), e saldo final. Usado para iniciar a sessão e para corrigir o que foi digitado errado.
 */
export function ExtratoDialogo({
  titulo,
  contaNome,
  conciliadaAte,
  saldoAbertura,
  inicial,
  textoConfirmar,
  onFechar,
  onConfirmar,
}: Props) {
  const ontem = somarDias(paraIsoData(hoje()), -1)
  const [dataFim, setDataFim] = useState(
    inicial?.dataFim ?? ontem,
  )
  const [saldo, setSaldo] = useState(() => {
    if (!inicial) return ''
    const texto = paraTextoDigitado(
      Math.round(Math.abs(inicial.saldoExtrato) * 100),
    )
    return inicial.saldoExtrato < 0 ? `-${texto}` : texto
  })
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    const locais: Record<string, string> = {}
    const valor = lerSaldo(saldo)
    if (!dataFim) locais.dataFim = 'Informe a data final do extrato.'
    else if (dataFim > ontem)
      locais.dataFim = `Use uma data até ontem (${formatarData(ontem)}): o extrato de hoje só fecha amanhã.`
    else if (conciliadaAte && dataFim <= conciliadaAte) {
      locais.dataFim = `Use uma data posterior à última conciliação (${formatarData(conciliadaAte)}).`
    }
    if (valor === null)
      locais.saldoExtrato = 'Informe o saldo final do extrato.'
    else if (Number.isNaN(valor))
      locais.saldoExtrato = 'Use um valor como 1.234,56 (negativo: -1.234,56).'
    setErros(locais)
    if (Object.keys(locais).length > 0) return
    setEnviando(true)
    setErro(null)
    try {
      await onConfirmar(dataFim, valor!)
    } catch (e) {
      setErros(errosPorCampo(e))
      setErro(mensagemDeErro(e))
      setEnviando(false)
    }
  }

  return (
    <DialogoAcao
      aberto
      rotulo={contaNome}
      titulo={titulo}
      textoConfirmar={textoConfirmar}
      confirmarDesabilitado={enviando}
      onFechar={onFechar}
      onConfirmar={() => void confirmar()}
    >
      <Pilha spacing={2}>
        <TextoSuave>
          {conciliadaAte
            ? `Conciliada até ${formatarData(conciliadaAte)}`
            : 'Primeira conciliação desta conta'}
          {saldoAbertura !== null &&
            `: o saldo conciliado de partida é ${formatarMoeda(saldoAbertura)}.`}
        </TextoSuave>
        {erro && (
          <Aviso tipo="error" titulo="Não foi possível salvar">
            {erro}
          </Aviso>
        )}
        <TextField
          type="date"
          label="Data final do extrato"
          required
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          error={!!erros.dataFim}
          helperText={
            erros.dataFim ??
            'Último dia que o extrato do banco cobre (ex.: o último dia do mês).'
          }
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: {
              max: ontem,
              min: conciliadaAte ? somarDias(conciliadaAte, 1) : undefined,
            },
          }}
        />
        <TextField
          label="Saldo final do extrato"
          required
          value={saldo}
          onChange={(e) => setSaldo(e.target.value)}
          error={!!erros.saldoExtrato}
          helperText={
            erros.saldoExtrato ??
            'Como aparece no extrato, nessa data. Negativo: use o sinal de menos.'
          }
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">R$</InputAdornment>
              ),
            },
            htmlInput: { inputMode: 'decimal' },
          }}
        />
      </Pilha>
    </DialogoAcao>
  )
}
