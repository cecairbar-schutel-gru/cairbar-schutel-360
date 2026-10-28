import { erroAnexos, exigeNota, recebimentoConfere, tamanhoLegivel, tipoDeConta } from './regras'

const arquivo = (nome: string, tipo: string, tamanho: number) => new File([new Uint8Array(tamanho)], nome, { type: tipo })

describe('regras das intenções de gasto', () => {
  it('aceita até 5 anexos PDF, JPG ou PNG de até 10 MB (US-EXPENSE-001)', () => {
    expect(erroAnexos([arquivo('a.pdf', 'application/pdf', 10)])).toBeNull()
    expect(erroAnexos([arquivo('a.docx', 'application/msword', 10)])).toContain('PDF, JPG ou PNG')
    expect(erroAnexos([arquivo('a.png', 'image/png', 10 * 1024 * 1024 + 1)])).toContain('10 MB')
    expect(erroAnexos(Array.from({ length: 6 }, (_, i) => arquivo(`${i}.jpg`, 'image/jpeg', 1)))).toContain('no máximo 5')
  })

  it('ajuste de valor ou de categoria exige nota (US-EXPENSE-004)', () => {
    expect(exigeNota(180, 180, 'A', 'A')).toBe(false)
    expect(exigeNota(180, 172.5, 'A', 'A')).toBe(true)
    expect(exigeNota(180, 180, 'A', 'B')).toBe(true)
    expect(exigeNota(0.1 + 0.2, 0.3, 'A', 'A')).toBe(false)
  })

  it('dinheiro sai do caixa e os demais meios do banco', () => {
    expect(tipoDeConta('DINHEIRO')).toBe('CAIXA')
    expect(tipoDeConta('PIX')).toBe('BANCO')
    expect(tipoDeConta('BOLETO')).toBe('BANCO')
  })

  it('recebimento só confere quando todas as quantidades batem (US-EXPENSE-006)', () => {
    const itens = [
      { produtoId: 1, produtoNome: 'Café', quantidade: 10, quantidadeRecebida: null },
      { produtoId: 2, produtoNome: 'Suco', quantidade: 5, quantidadeRecebida: null },
    ]
    expect(recebimentoConfere(itens, { 1: 10, 2: 5 })).toBe(true)
    expect(recebimentoConfere(itens, { 1: 10, 2: 4 })).toBe(false)
    expect(recebimentoConfere(itens, { 1: 10 })).toBe(false)
  })

  it('mostra o tamanho do anexo de forma legível', () => {
    expect(tamanhoLegivel(500)).toBe('500 B')
    expect(tamanhoLegivel(2048)).toBe('2 KB')
    expect(tamanhoLegivel(1.5 * 1024 * 1024)).toBe('1,5 MB')
  })
})
