import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router-dom'
import { ProvedorTema } from '../../app/ProvedorTema'
import { criarRoteadorEmMemoria } from '../../app/rotas'
import { AuthProvider } from '../../auth/AuthProvider'
import { authSimulado } from '../../auth/authSimulado'
import { bancoFinanceiro } from '../../mocks/bancoFinanceiro'
import { bancoVendas } from '../../mocks/bancoVendas'

function renderizar(usuarioId: string, entrada: string) {
  authSimulado.entrar(usuarioId)
  return render(
    <ProvedorTema>
      <AuthProvider>
        <RouterProvider router={criarRoteadorEmMemoria([entrada])} />
      </AuthProvider>
    </ProvedorTema>,
  )
}

const semEspacoDuro = (t: string | null) => (t ?? '').replace(/ /g, ' ')
const carrinho = () => screen.getByRole('table', { name: 'Carrinho' })

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:comprovante')
  URL.revokeObjectURL = vi.fn()
  HTMLAnchorElement.prototype.click = vi.fn()
})

async function buscarEAdicionar(usuario: ReturnType<typeof userEvent.setup>, termo: string, nome: string) {
  const busca = screen.getByLabelText('Buscar produto por nome, título, autor ou ISBN')
  await usuario.clear(busca)
  await usuario.type(busca, termo)
  await usuario.click(await screen.findByRole('button', { name: `Adicionar ${nome}` }))
}

describe('nova venda (Jornada B)', () => {
  it('vende um livro e dois produtos da cantina em dinheiro, com troco e comprovante', async () => {
    const usuario = userEvent.setup()
    renderizar('u-vendedor', '/vendas/nova')

    // Não se escolhe caixa: o dinheiro entra na conta de recebimento definida pelo Administrador.
    expect(await screen.findByText('Entra em Caixa Secretaria.')).toBeInTheDocument()
    await buscarEAdicionar(usuario, 'nosso', 'Nosso Lar')

    await usuario.click(screen.getByRole('tab', { name: 'Cantina' }))
    const salgados = await screen.findByRole('region', { name: 'Salgados' })
    // Sem saldo: visível, mas desabilitado.
    expect(within(salgados).getByRole('button', { name: 'Adicionar Coxinha' })).toBeDisabled()
    await usuario.click(within(salgados).getByRole('button', { name: 'Adicionar Pão de queijo' }))
    await usuario.click(screen.getByRole('button', { name: 'Aumentar Pão de queijo' }))
    expect(semEspacoDuro(screen.getByTestId('total-carrinho').textContent)).toBe('R$ 55,00')

    const finalizar = screen.getByRole('button', { name: 'Finalizar venda' })
    expect(finalizar).toBeDisabled()
    await usuario.type(screen.getByLabelText('Dinheiro (valor da venda)'), '50')
    expect(semEspacoDuro(screen.getByText(/Faltam/).textContent)).toContain('Faltam R$ 5,00 para fechar o total de R$ 55,00.')
    await usuario.click(screen.getByRole('button', { name: 'Tudo em Dinheiro' }))
    await usuario.type(screen.getByLabelText('Valor entregue pelo cliente (opcional)'), '100')
    expect(semEspacoDuro(screen.getByText(/^Troco:/).textContent)).toBe('Troco: R$ 45,00')

    expect(finalizar).toBeEnabled()
    await usuario.click(finalizar)
    const dialogo = await screen.findByRole('dialog')
    expect(semEspacoDuro(dialogo.textContent)).toContain('Dinheiro — Caixa Secretaria')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar venda' }))

    expect(await screen.findByText(/Venda nº 1 registrada/)).toBeInTheDocument()
    expect(screen.getByText('Documento sem valor fiscal')).toBeInTheDocument()
    const itens = screen.getByRole('table', { name: 'Itens do comprovante' })
    expect(within(itens).getByText('Pão de queijo')).toBeInTheDocument()
    expect(screen.getByText('Vendedor: Bruno Vendedor')).toBeInTheDocument()
    // Só o valor da venda entra na conta do dinheiro; o troco não.
    expect(bancoFinanceiro.saldo(1)).toBe(55)
    expect(bancoVendas.saldo(2)).toBe(3)
    expect(bancoVendas.saldo(12)).toBe(18)

    await usuario.click(screen.getByRole('button', { name: 'Baixar PDF (80 mm)' }))
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled())

    // Um carrinho novo e vazio fica pronto.
    await usuario.click(screen.getByRole('button', { name: 'Nova venda' }))
    expect(await screen.findByText(/O carrinho está vazio/)).toBeInTheDocument()
  })

  it('consignado sai por FIFO e o detalhe mostra remessas e obrigações', async () => {
    const usuario = userEvent.setup()
    renderizar('u-vendedor', '/vendas/nova')

    await screen.findByLabelText('Dinheiro (valor da venda)')
    await buscarEAdicionar(usuario, '978-8573287868', 'O Caminho')
    const quantidade = within(carrinho()).getByLabelText('Quantidade de O Caminho')
    await usuario.clear(quantidade)
    await usuario.type(quantidade, '9')
    expect(within(carrinho()).getByRole('alert')).toHaveTextContent('Só 8 disponíveis.')
    expect(screen.getByRole('button', { name: 'Finalizar venda' })).toBeDisabled()
    await usuario.clear(quantidade)
    await usuario.type(quantidade, '4')

    await usuario.click(screen.getByRole('button', { name: 'Tudo em Cartão' }))
    // Crédito ou débito é obrigatório no cartão (simulação de 27/10/2026, P9).
    expect(screen.getByRole('button', { name: 'Finalizar venda' })).toBeDisabled()
    await usuario.click(screen.getByRole('radio', { name: 'Débito' }))
    await usuario.click(screen.getByRole('button', { name: 'Finalizar venda' }))
    await usuario.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar venda' }))

    const obrigacoes = await screen.findByRole('table', { name: 'Remessas usadas e obrigações criadas' })
    const linhas = within(obrigacoes).getAllByRole('row').slice(1).map((l) => semEspacoDuro(l.textContent))
    expect(linhas).toEqual([
      'O CaminhoR-0001340%R$ 60,00Em aberto',
      'O CaminhoR-0002135%R$ 17,50Em aberto',
    ])
    expect(bancoVendas.saldoLote(1, 1)).toBe(0)
    expect(bancoVendas.saldoLote(1, 2)).toBe(4)
  })

  it('destaca o item sem saldo na confirmação sem registrar nada', async () => {
    const usuario = userEvent.setup()
    renderizar('u-vendedor', '/vendas/nova')

    await screen.findByLabelText('Dinheiro (valor da venda)')
    await buscarEAdicionar(usuario, 'nosso lar', 'Nosso Lar')
    // Outra venda leva as unidades enquanto o carrinho está aberto.
    for (let i = 0; i < 4; i++) bancoVendas.confirmar(
      { itens: [{ produtoId: 2, quantidade: 1, precoUnitario: 45 }], pagamentos: [{ meio: 'DINHEIRO', valor: 45 }], refazVendaId: null, chaveIdempotencia: `k${i}` },
      { id: 'u-vendedor', nome: 'Bruno Vendedor', papeis: ['vendedor'] },
    )

    await usuario.click(screen.getByRole('button', { name: 'Tudo em Dinheiro' }))
    await usuario.click(screen.getByRole('button', { name: 'Finalizar venda' }))
    await usuario.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar venda' }))

    expect(await screen.findByText('Estoque insuficiente para algum item. Nada foi registrado.')).toBeInTheDocument()
    const tabela = await screen.findByRole('table', { name: 'Carrinho' })
    expect(within(tabela).getByRole('alert')).toHaveTextContent('Sem estoque.')
    expect(screen.getByRole('button', { name: 'Finalizar venda' })).toBeDisabled()
  })

  it('mantém o carrinho ao recarregar a página até descartar', async () => {
    const usuario = userEvent.setup()
    const { unmount } = renderizar('u-vendedor', '/vendas/nova')
    await screen.findByLabelText('Dinheiro (valor da venda)')
    await buscarEAdicionar(usuario, 'cafe', 'Café')
    unmount()

    renderizar('u-vendedor', '/vendas/nova')
    expect(await within(await screen.findByRole('table', { name: 'Carrinho' })).findByText('Café')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Descartar venda' }))
    await usuario.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Descartar' }))
    expect(await screen.findByText(/O carrinho está vazio/)).toBeInTheDocument()
  })

  it('cancela com motivo, devolve o estoque e refaz com o preço atual destacado', async () => {
    const usuario = userEvent.setup()
    const vendedor = { id: 'u-vendedor', nome: 'Bruno Vendedor', papeis: ['vendedor' as const] }
    const { id } = bancoVendas.confirmar(
      { itens: [{ produtoId: 10, quantidade: 2, precoUnitario: 3.5 }], pagamentos: [{ meio: 'PIX', valor: 7 }], refazVendaId: null, chaveIdempotencia: 'k1' },
      vendedor,
    )
    renderizar('u-vendedor', `/vendas/${id}`)

    await usuario.click(await screen.findByRole('button', { name: 'Cancelar venda' }))
    const dialogo = await screen.findByRole('dialog')
    const confirmar = within(dialogo).getByRole('button', { name: 'Cancelar venda' })
    await usuario.type(within(dialogo).getByLabelText(/Motivo/), 'curto')
    expect(confirmar).toBeDisabled()
    await usuario.type(within(dialogo).getByLabelText(/Motivo/), ' — produto errado')
    await usuario.click(confirmar)

    expect(await screen.findByText(/Por Bruno Vendedor em/)).toBeInTheDocument()
    expect(bancoVendas.saldo(10)).toBe(30)
    expect(bancoFinanceiro.saldo(3)).toBe(0)

    bancoVendas.alterarPreco(10, 4)
    await usuario.click(screen.getByRole('button', { name: 'Refazer venda' }))
    expect(await screen.findByText('Refazendo a venda nº 1')).toBeInTheDocument()
    expect(semEspacoDuro(within(carrinho()).getByText(/Preço mudou/).textContent)).toBe('Preço mudou: era R$ 3,50')
    expect(semEspacoDuro(screen.getByTestId('total-carrinho').textContent)).toBe('R$ 8,00')

    await usuario.click(screen.getByRole('button', { name: 'Tudo em Dinheiro' }))
    await usuario.click(screen.getByRole('button', { name: 'Finalizar venda' }))
    await usuario.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar venda' }))
    expect(await screen.findByText(/Refaz a venda cancelada/)).toBeInTheDocument()

    await usuario.click(screen.getByRole('link', { name: 'nº 1' }))
    expect(await screen.findByText(/Refeita como/)).toHaveTextContent('Refeita como nº 2.')
    expect(screen.queryByRole('button', { name: 'Refazer venda' })).not.toBeInTheDocument()
  })

  it('o painel do Vendedor resume o dia com as vendas do PDV e a lista mostra só as dele', async () => {
    const usuario = userEvent.setup()
    const vendedor = { id: 'u-vendedor', nome: 'Bruno Vendedor', papeis: ['vendedor' as const] }
    bancoVendas.confirmar(
      { itens: [{ produtoId: 10, quantidade: 2, precoUnitario: 3.5 }], pagamentos: [{ meio: 'DINHEIRO', valor: 7 }], refazVendaId: null, chaveIdempotencia: 'k1' },
      vendedor,
    )
    const { id } = bancoVendas.confirmar(
      { itens: [{ produtoId: 12, quantidade: 1, precoUnitario: 5 }], pagamentos: [{ meio: 'CARTAO', valor: 5, tipoCartao: 'CREDITO' }], refazVendaId: null, chaveIdempotencia: 'k2' },
      vendedor,
    )
    bancoVendas.cancelar(id, 'Cliente desistiu da compra', vendedor)
    bancoVendas.confirmar(
      { itens: [{ produtoId: 10, quantidade: 1, precoUnitario: 3.5 }], pagamentos: [{ meio: 'PIX', valor: 3.5 }], refazVendaId: null, chaveIdempotencia: 'k3' },
      { id: 'u-pdv', nome: 'Fábio PDV', papeis: ['pdv'] },
    )
    renderizar('u-vendedor', '/')

    expect(await screen.findByRole('button', { name: 'Nova venda' })).toBeInTheDocument()
    const indicador = (rotulo: string) =>
      semEspacoDuro(within(screen.getByRole('main')).getByText(rotulo).parentElement?.textContent ?? '')
    await waitFor(() => expect(indicador('Vendas')).toBe('Vendas2'))
    expect(indicador('Dinheiro')).toBe('DinheiroR$ 7,00')
    expect(indicador('PIX')).toBe('PIXR$ 3,50')
    expect(indicador('Cartão')).toBe('CartãoR$ 0,00')
    expect(indicador('Cancelamentos')).toBe('Cancelamentos1')
    // Atalhos do Estoque habilitados (US-INVENTORY-002/006/009).
    expect(screen.getByRole('button', { name: 'Entrada por doação' })).toBeEnabled()
    // O Vendedor recebe doações anônimas e pede intenções de gasto.
    expect(screen.getByRole('button', { name: 'Receber doação' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Nova intenção de gasto' })).toBeEnabled()

    await usuario.click(screen.getByRole('button', { name: 'Vendas de hoje' }))
    const tabela = await screen.findByRole('table', { name: 'Vendas encontradas' })
    expect(within(tabela).getAllByRole('row')).toHaveLength(3)
    await usuario.click(screen.getByRole('combobox', { name: 'Situação' }))
    await usuario.click(await screen.findByRole('option', { name: 'Canceladas' }))
    await usuario.click(screen.getByRole('button', { name: 'Filtrar' }))
    await waitFor(() => expect(within(screen.getByRole('table', { name: 'Vendas encontradas' })).getAllByRole('row')).toHaveLength(2))
  })

  it('o Tesoureiro consulta vendas sem poder vender nem cancelar', async () => {
    bancoVendas.confirmar(
      { itens: [{ produtoId: 10, quantidade: 1, precoUnitario: 3.5 }], pagamentos: [{ meio: 'DINHEIRO', valor: 3.5 }], refazVendaId: null, chaveIdempotencia: 'k1' },
      { id: 'u-vendedor', nome: 'Bruno Vendedor', papeis: ['vendedor'] },
    )
    renderizar('u-tesoureiro', '/vendas/1')

    expect(await screen.findByRole('heading', { name: 'Venda nº 1' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar venda' })).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Menu lateral' })).not.toHaveTextContent('Nova venda')
  })

  it('o Tesoureiro vê a tag PDV, filtra as do PDV e cancela uma delas', async () => {
    const usuario = userEvent.setup()
    bancoVendas.confirmar(
      { itens: [{ produtoId: 10, quantidade: 1, precoUnitario: 3.5 }], pagamentos: [{ meio: 'DINHEIRO', valor: 3.5 }], refazVendaId: null, chaveIdempotencia: 'k1' },
      { id: 'u-vendedor', nome: 'Bruno Vendedor', papeis: ['vendedor'] },
    )
    bancoVendas.confirmar(
      { itens: [{ produtoId: 12, quantidade: 1, precoUnitario: 5 }], pagamentos: [{ meio: 'DINHEIRO', valor: 5 }], refazVendaId: null, chaveIdempotencia: 'k2' },
      { id: 'u-pdv', nome: 'Fábio PDV', papeis: ['pdv'] },
    )
    renderizar('u-tesoureiro', '/vendas')

    let tabela = await screen.findByRole('table', { name: 'Vendas encontradas' })
    expect(within(tabela).getAllByText('PDV')).toHaveLength(1)
    await usuario.click(screen.getByRole('combobox', { name: 'Origem' }))
    await usuario.click(await screen.findByRole('option', { name: 'PDV da cantina' }))
    await usuario.click(screen.getByRole('button', { name: 'Filtrar' }))
    await waitFor(() => expect(within(screen.getByRole('table', { name: 'Vendas encontradas' })).getAllByRole('row')).toHaveLength(2))
    tabela = screen.getByRole('table', { name: 'Vendas encontradas' })

    await usuario.click(within(tabela).getByRole('link', { name: '2' }))
    await usuario.click(await screen.findByRole('button', { name: 'Cancelar venda' }))
    const dialogo = await screen.findByRole('dialog')
    await usuario.type(within(dialogo).getByRole('textbox', { name: 'Motivo' }), 'Venda acidental no PDV')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar venda' }))
    await waitFor(() => expect(bancoVendas.listar({ status: 'CANCELADA' }, { id: 'u-tesoureiro', nome: 'Carla', papeis: ['tesoureiro'] })).toHaveLength(1))
  })
})
