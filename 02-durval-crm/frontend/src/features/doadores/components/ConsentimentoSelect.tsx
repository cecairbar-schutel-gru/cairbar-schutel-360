import { TextField } from '@mui/material'
import { formatarDataHora } from '../../../shared/formatters/datas'
import { ROTULO_CONSENTIMENTO } from '../rotulos'
import type { Consentimento, ValorConsentimento } from '../types'

interface Props {
  id: string
  rotulo: string
  valor: ValorConsentimento
  registro?: Consentimento
  onChange(valor: ValorConsentimento): void
}

export function ConsentimentoSelect({
  id,
  rotulo,
  valor,
  registro,
  onChange,
}: Props) {
  const ajuda =
    registro?.registradoEm && registro.valor === valor
      ? `Registrado em ${formatarDataHora(registro.registradoEm)}`
      : 'A data será registrada ao salvar.'
  return (
    <TextField
      id={id}
      select
      label={rotulo}
      helperText={
        valor === 'NAO_INFORMADO' ? 'Sem consentimento registrado.' : ajuda
      }
      value={valor}
      onChange={(e) => onChange(e.target.value as ValorConsentimento)}
      slotProps={{ select: { native: true } }}
    >
      {(Object.keys(ROTULO_CONSENTIMENTO) as ValorConsentimento[]).map((v) => (
        <option key={v} value={v}>
          {ROTULO_CONSENTIMENTO[v]}
        </option>
      ))}
    </TextField>
  )
}
