import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { CampoMes } from './CampoMes'

function Campo({ inicial, min, max }: { inicial: string; min?: string; max?: string }) {
  const [valor, setValor] = useState(inicial)
  return (
    <>
      <CampoMes rotulo="Mês" valor={valor} onAlterar={setValor} min={min} max={max} />
      <output>{valor}</output>
    </>
  )
}

describe('CampoMes', () => {
  it('mostra os meses em português e devolve AAAA-MM', async () => {
    const usuario = userEvent.setup()
    render(<Campo inicial="2026-10" />)
    const mes = screen.getByLabelText('Mês (mês)')
    expect(mes).toHaveValue('10')
    expect(within(mes).getByRole('option', { name: 'Outubro' })).toBeInTheDocument()
    await usuario.selectOptions(mes, 'Março')
    await usuario.selectOptions(screen.getByLabelText('Mês (ano)'), '2027')
    expect(screen.getByRole('status')).toHaveTextContent('2027-03')
  })

  it('indisponibiliza os meses fora dos limites e ajusta o mês ao trocar o ano', async () => {
    const usuario = userEvent.setup()
    render(<Campo inicial="2027-03" min="2026-11" />)
    await usuario.selectOptions(screen.getByLabelText('Mês (ano)'), '2026')
    expect(screen.getByRole('status')).toHaveTextContent('2026-11')
    const mes = screen.getByLabelText('Mês (mês)')
    expect(within(mes).getByRole('option', { name: 'Outubro' })).toBeDisabled()
    expect(within(mes).getByRole('option', { name: 'Dezembro' })).toBeEnabled()
    expect(within(screen.getByLabelText('Mês (ano)')).queryByRole('option', { name: '2025' })).not.toBeInTheDocument()
  })
})
