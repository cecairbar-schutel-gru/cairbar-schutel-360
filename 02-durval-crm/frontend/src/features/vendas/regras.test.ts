import { ApiError } from '../../shared/api/http'
import { adicionarAoCarrinho, calcularTroco, errosPorItem, totalDoCarrinho, validarQuantidade } from './regras'
import type { ProdutoVendavel } from './types'

const cafe: ProdutoVendavel = {
  id: 10,
  tipo: 'CANTINA',
  nome: 'Café',
  categoria: 'Bebidas',
  autor: null,
  isbn: null,
  preco: 3.5,
  disponivel: 2,
}

describe('regras do carrinho (US-SALES-002 e 005)', () => {
  it('adiciona 1 unidade, soma na mesma linha e para no disponível', () => {
    let r = adicionarAoCarrinho([], cafe)
    expect(r.itens).toHaveLength(1)
    expect(r.itens[0].quantidade).toBe(1)
    r = adicionarAoCarrinho(r.itens, cafe)
    expect(r.itens[0].quantidade).toBe(2)
    r = adicionarAoCarrinho(r.itens, cafe)
    expect(r.itens[0].quantidade).toBe(2)
    expect(r.aviso).toBe('Café: Só 2 disponíveis.')
    expect(adicionarAoCarrinho([], { ...cafe, disponivel: 0 }).aviso).toBe('Café está sem estoque.')
  })

  it('soma o total em centavos sem erro de ponto flutuante', () => {
    const { itens } = adicionarAoCarrinho([], { ...cafe, preco: 0.1, disponivel: 3 })
    expect(totalDoCarrinho([{ ...itens[0], quantidade: 3 }])).toBe(30)
  })

  it('valida a quantidade digitada contra o disponível', () => {
    expect(validarQuantidade('2', 2)).toEqual({ quantidade: 2, erro: null })
    expect(validarQuantidade('3', 2).erro).toBe('Só 2 disponíveis.')
    expect(validarQuantidade('3', 1).erro).toBe('Só 1 disponível.')
    expect(validarQuantidade('0', 2).erro).toBe('Mínimo 1.')
    expect(validarQuantidade('1,5', 2).erro).toBe('Informe um número inteiro.')
  })

  it('calcula o troco sobre a parte em dinheiro', () => {
    expect(calcularTroco(10000, 5700)).toBe(4300)
    expect(calcularTroco(null, 5700)).toBeNull()
    expect(calcularTroco(5000, 5700)).toBe(-700)
  })

  it('lê os erros por item devolvidos pela confirmação', () => {
    const erro = new ApiError(409, 'ESTOQUE_INSUFICIENTE', 'Estoque insuficiente.', [
      { campo: 'itens[1]', mensagem: 'Só 3 disponíveis.' },
      { campo: 'pagamentos', mensagem: 'outro' },
    ])
    expect([...errosPorItem(erro)]).toEqual([[1, 'Só 3 disponíveis.']])
  })
})
