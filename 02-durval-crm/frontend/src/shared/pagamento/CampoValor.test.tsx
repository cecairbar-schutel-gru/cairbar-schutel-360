import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { CampoValor } from './CamposPagamento'
import { filtrarValorDigitado } from './regras'

function Campo() {
  const [valor, setValor] = useState('')
  return <CampoValor rotulo="Preço de venda" valor={valor} onAlterar={setValor} />
}

describe('filtrarValorDigitado', () => {
  it('mantém só dígitos e um separador decimal com até duas casas', () => {
    expect(filtrarValorDigitado('R$ 35,00Luz')).toBe('35,00')
    expect(filtrarValorDigitado('1.234,567')).toBe('1234,56')
    expect(filtrarValorDigitado('12.5')).toBe('12,5')
    expect(filtrarValorDigitado('12,5,')).toBe('12,5')
    expect(filtrarValorDigitado('-10')).toBe('10')
    expect(filtrarValorDigitado('abc')).toBe('')
  })
})

describe('CampoValor', () => {
  it('ignora letras digitadas', async () => {
    const usuario = userEvent.setup()
    render(<Campo />)
    const campo = screen.getByLabelText('Preço de venda')
    await usuario.type(campo, '3a5,0x0L')
    expect(campo).toHaveValue('35,00')
  })

  it('limpa o texto colado', async () => {
    const usuario = userEvent.setup()
    render(<Campo />)
    const campo = screen.getByLabelText('Preço de venda')
    await usuario.click(campo)
    await usuario.paste('R$ 35,00Luz')
    expect(campo).toHaveValue('35,00')
  })
})
