import { Button, MenuItem, TextField } from '@mui/material'
import { useState, type FormEvent } from 'react'
import { LinhaAcoes } from '../../../shared/components/layout'
import { nomeDoMes } from '../../financeiro/regras'
import { mesDoPeriodo, mesesRecentes, periodoDoMes } from '../regras'
import type { Periodo } from '../types'

const PERSONALIZADO = 'personalizado'

/**
 * Filtro de período comum a todos os relatórios: o mês (padrão) ou um intervalo de datas.
 * Escolher um mês aplica na hora; o intervalo, ao clicar em "Aplicar".
 */
export function FiltroPeriodo({ periodo, onChange, rotulo = 'Período' }: { periodo: Periodo; onChange: (p: Periodo) => void; rotulo?: string }) {
  const mes = mesDoPeriodo(periodo)
  const meses = mesesRecentes()
  const [personalizado, setPersonalizado] = useState(mes === null || !meses.includes(mes))
  const [de, setDe] = useState(periodo.de)
  const [ate, setAte] = useState(periodo.ate)
  const invalido = !de || !ate || de > ate

  function escolher(valor: string) {
    if (valor === PERSONALIZADO) {
      setPersonalizado(true)
      return
    }
    setPersonalizado(false)
    const p = periodoDoMes(valor)
    setDe(p.de)
    setAte(p.ate)
    onChange(p)
  }

  function aplicar(e: FormEvent) {
    e.preventDefault()
    if (!invalido) onChange({ de, ate })
  }

  return (
    <LinhaAcoes as="form" onSubmit={aplicar} aria-label={rotulo} data-nao-imprimir>
      <TextField
        select
        size="small"
        label={rotulo}
        value={personalizado ? PERSONALIZADO : (mes ?? PERSONALIZADO)}
        onChange={(e) => escolher(e.target.value)}
        sx={{ minWidth: 200 }}
      >
        {meses.map((m) => (
          <MenuItem key={m} value={m}>
            {nomeDoMes(m)}
          </MenuItem>
        ))}
        <MenuItem value={PERSONALIZADO}>Período personalizado…</MenuItem>
      </TextField>
      {personalizado && (
        <>
          <TextField type="date" size="small" label="De" value={de} onChange={(e) => setDe(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }} />
          <TextField type="date" size="small" label="Até" value={ate} onChange={(e) => setAte(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            error={!!de && !!ate && de > ate} helperText={!!de && !!ate && de > ate ? 'Até deve ser depois de De.' : undefined} />
          <Button type="submit" variant="outlined" disabled={invalido}>
            Aplicar
          </Button>
        </>
      )}
    </LinhaAcoes>
  )
}
