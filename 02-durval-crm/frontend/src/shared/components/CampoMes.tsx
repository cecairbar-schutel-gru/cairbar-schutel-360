import { FormHelperText, Stack, TextField } from '@mui/material'
import { hoje } from '../formatters/datas'

const NOMES_DOS_MESES = Array.from({ length: 12 }, (_, i) => {
  const nome = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2026, i, 1))
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)}`
})

interface Props {
  rotulo: string
  /** `AAAA-MM`. */
  valor: string
  onAlterar(valor: string): void
  /** `AAAA-MM`; meses anteriores ficam indisponíveis. */
  min?: string
  /** `AAAA-MM`; meses posteriores ficam indisponíveis. */
  max?: string
  textoAjuda?: string
  size?: 'small' | 'medium'
  required?: boolean
}

/** Anos oferecidos: 5 antes e 5 depois do atual, alargados para incluir o valor e os limites. */
function anosDoCampoMes(valor: string, min?: string, max?: string): number[] {
  const atual = hoje().getFullYear()
  const anos = [valor, min, max].filter((m): m is string => !!m).map((m) => Number(m.slice(0, 4)))
  const inicio = Math.max(min ? Number(min.slice(0, 4)) : -Infinity, Math.min(atual - 5, ...anos))
  const fim = Math.min(max ? Number(max.slice(0, 4)) : Infinity, Math.max(atual + 5, ...anos))
  return Array.from({ length: fim - inicio + 1 }, (_, i) => inicio + i)
}

/** Mantém o mês `AAAA-MM` dentro dos limites. */
function limitarMes(mes: string, min?: string, max?: string): string {
  if (min && mes < min) return min
  if (max && mes > max) return max
  return mes
}

/**
 * Mês/ano em dois selects com os nomes em pt-BR, no lugar do `<input type="month">` nativo, que
 * varia entre navegadores e aparece em inglês em alguns tablets (P14 da simulação de 27/10/2026).
 */
export function CampoMes({ rotulo, valor, onAlterar, min, max, textoAjuda, size, required }: Props) {
  const [ano, mes] = valor ? valor.split('-') : [String(hoje().getFullYear()), '']
  const anos = anosDoCampoMes(valor, min, max)
  const alterar = (novoAno: string, novoMes: string) => onAlterar(limitarMes(`${novoAno}-${novoMes}`, min, max))
  const foraDosLimites = (m: string) => (min !== undefined && `${ano}-${m}` < min) || (max !== undefined && `${ano}-${m}` > max)
  return (
    <div role="group" aria-label={rotulo}>
      <Stack direction="row" spacing={1}>
        <TextField
          select
          label={rotulo}
          size={size}
          required={required}
          value={mes}
          onChange={(e) => alterar(ano, e.target.value)}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true }, htmlInput: { 'aria-label': `${rotulo} (mês)` } }}
          sx={{ minWidth: '9rem', flex: 1 }}
        >
          {!mes && <option value="" />}
          {NOMES_DOS_MESES.map((nome, i) => {
            const m = String(i + 1).padStart(2, '0')
            return (
              <option key={m} value={m} disabled={foraDosLimites(m)}>
                {nome}
              </option>
            )
          })}
        </TextField>
        <TextField
          select
          label="Ano"
          size={size}
          value={ano}
          onChange={(e) => alterar(e.target.value, mes || '01')}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true }, htmlInput: { 'aria-label': `${rotulo} (ano)` } }}
          sx={{ minWidth: '6rem' }}
        >
          {anos.map((a) => (
            <option key={a} value={String(a)}>
              {a}
            </option>
          ))}
        </TextField>
      </Stack>
      {textoAjuda && <FormHelperText sx={{ mx: 1.75 }}>{textoAjuda}</FormHelperText>}
    </div>
  )
}
