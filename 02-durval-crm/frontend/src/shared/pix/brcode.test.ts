import { describe, expect, it } from 'vitest'
import { crc16, gerarPayloadPix, textoPix } from './brcode'

describe('BR Code PIX', () => {
  it('gera o payload do exemplo do manual do Banco Central', () => {
    expect(
      gerarPayloadPix({ chave: '123e4567-e12b-12d1-a456-426655440000', nome: 'Fulano de Tal', cidade: 'BRASILIA' }),
    ).toBe(
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
    )
  })

  it('inclui o valor com duas casas e o identificador da cobrança', () => {
    const payload = gerarPayloadPix({
      chave: '+5511988887777',
      nome: 'Centro Espírita Cairbar Schutel',
      cidade: 'São José dos Campos',
      valorCentavos: 1250,
      txid: 'PDV-42',
    })
    expect(payload).toContain('540512.50')
    expect(payload).toContain('5925Centro Espirita Cairbar S')
    expect(payload).toContain('6015Sao Jose dos Ca')
    expect(payload).toContain('62090505PDV42')
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)))
  })

  it('tira acentos e símbolos dos textos', () => {
    expect(textoPix('  Cantina   Ação & Cia ', 25)).toBe('Cantina Acao Cia')
  })
})
