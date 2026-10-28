import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router-dom'
import { ProvedorTema } from '../../app/ProvedorTema'
import { criarRoteadorEmMemoria } from '../../app/rotas'
import { AuthProvider } from '../../auth/AuthProvider'
import { authSimulado } from '../../auth/authSimulado'
import { USUARIOS_SIMULADOS } from '../../auth/usuariosSimulados'
import { bancoAdministracao } from '../../mocks/bancoAdministracao'
import { bancoVendas } from '../../mocks/bancoVendas'
import { ErroNegocio } from '../../mocks/erroNegocio'
import { pagamentoPdv } from './regras'

function renderizar(usuarioId = 'u-vendedor', entrada = '/vendas/pdv') {
  authSimulado.entrar(usuarioId)
  return render(
    <ProvedorTema>
      <AuthProvider>
        <RouterProvider router={criarRoteadorEmMemoria([entrada])} />
      </AuthProvider>
    </ProvedorTema>,
  )
}

const vendedor = USUARIOS_SIMULADOS.find((u) => u.id === 'u-vendedor')!
const semEspacoDuro = (t: string | null) => (t ?? '').replace(/\u00a0/g, ' ')

beforeEach(() => localStorage.clear())

describe('PDV da cantina', () => {
  it('toque no card só põe no carrinho; a venda sai pelo Cobrar com confirmação explícita', async () => {
    const usuario = userEvent.setup()
    renderizar()

    const pao = await screen.findByRole('button', { name: /^Adicionar Pão de queijo/ })
    await usuario.dblClick(pao)
    const carrinho = screen.getByRole('region', { name: 'Carrinho' })
    // Toque duplo: 2 unidades visíveis e removíveis, nunca uma venda.
    expect(within(carrinho).getByRole('listitem', { name: '2 × Pão de queijo' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(bancoVendas.listar({}, vendedor)).toHaveLength(0)

    await usuario.click(within(carrinho).getByRole('button', { name: 'Diminuir Pão de queijo' }))
    await usuario.click(screen.getByRole('button', { name: /^Adicionar Café/ }))
    expect(semEspacoDuro(within(carrinho).getByText(/^Total:/).textContent)).toBe('Total: R$ 8,50')

    await usuario.click(within(carrinho).getByRole('button', { name: 'Cobrar' }))
    const dialogo = await screen.findByRole('dialog', { name: /Cobrar/ })
    const confirmar = within(dialogo).getByRole('button', { name: 'Escolha a forma de pagamento' })
    expect(confirmar).toBeDisabled()
    // Escolher a forma só seleciona.
    await usuario.click(within(dialogo).getByRole('button', { name: 'Débito' }))
    expect(bancoVendas.listar({}, vendedor)).toHaveLength(0)
    await usuario.click(within(dialogo).getByRole('button', { name: /^Confirmar venda de R\$\s8,50 no débito$/ }))

    expect(semEspacoDuro((await screen.findByText(/registrada:/)).textContent)).toContain(
      '1 × Pão de queijo, 1 × Café, R$ 8,50 no débito',
    )
    const vendas = bancoVendas.listar({}, vendedor)
    expect(vendas).toHaveLength(1)
    expect(vendas[0].total).toBe(8.5)
    expect(vendas[0].meios).toEqual(['CARTAO'])
    expect(within(carrinho).getByText('Toque nos produtos para adicioná-los.')).toBeInTheDocument()
  })

  it('remove item do carrinho e calcula o troco em dinheiro', async () => {
    const usuario = userEvent.setup()
    renderizar()

    await usuario.click(await screen.findByRole('button', { name: /^Adicionar Café/ }))
    await usuario.click(screen.getByRole('button', { name: /^Adicionar Pão de queijo/ }))
    const carrinho = screen.getByRole('region', { name: 'Carrinho' })
    await usuario.click(within(carrinho).getByRole('button', { name: 'Remover Café' }))
    await usuario.click(within(carrinho).getByRole('button', { name: 'Aumentar Pão de queijo' }))
    await usuario.click(within(carrinho).getByRole('button', { name: 'Cobrar' }))

    const dialogo = await screen.findByRole('dialog', { name: /Cobrar/ })
    await usuario.click(within(dialogo).getByRole('button', { name: 'Dinheiro' }))
    const entregue = within(dialogo).getByLabelText('Valor entregue (opcional)')
    await usuario.type(entregue, '5')
    expect(within(dialogo).getByText('O valor entregue é menor que o total.')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: /^Confirmar venda/ })).toBeDisabled()
    await usuario.clear(entregue)
    await usuario.type(entregue, '50')
    expect(semEspacoDuro(within(dialogo).getByText(/^Troco:/).textContent)).toBe('Troco: R$ 40,00')
    await usuario.click(within(dialogo).getByRole('button', { name: /^Confirmar venda de R\$\s10,00 no dinheiro$/ }))

    expect(semEspacoDuro((await screen.findByText(/registrada:/)).textContent)).toContain('2 × Pão de queijo, R$ 10,00 no dinheiro')
    expect(bancoVendas.listar({}, vendedor)[0].meios).toEqual(['DINHEIRO'])
  })

  it('o perfil PDV abre direto no PDV, só com ele no menu, vê o próprio nome e vende sem acesso às vendas', async () => {
    const usuario = userEvent.setup()
    renderizar('u-pdv', '/')

    const produto = await screen.findByRole('button', { name: /^Adicionar Pão de queijo/ })
    const menu = screen.getByRole('navigation', { name: 'Menu lateral' })
    expect(within(menu).getAllByRole('link').map((l) => l.textContent)).toEqual(['PDV da cantina'])
    expect(within(screen.getByRole('main')).getByLabelText('Usuário: Fábio PDV')).toBeInTheDocument()
    await usuario.click(produto)
    await usuario.click(screen.getByRole('button', { name: 'Cobrar' }))
    const dialogo = await screen.findByRole('dialog')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Dinheiro' }))
    await usuario.click(within(dialogo).getByRole('button', { name: /^Confirmar venda/ }))

    expect(await screen.findByText(/registrada:/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ver comprovante' })).not.toBeInTheDocument()
  })

  it('o perfil PDV vende os livros cadastrados pela aba Livros', async () => {
    const usuario = userEvent.setup()
    renderizar('u-pdv')

    await usuario.click(await screen.findByRole('tab', { name: 'Livros' }))
    await usuario.type(screen.getByRole('textbox', { name: 'Buscar por título, autor ou ISBN' }), 'caminho')
    await usuario.click(await screen.findByRole('button', { name: /^Adicionar O Caminho/ }))
    await usuario.click(screen.getByRole('button', { name: 'Cobrar' }))
    const dialogo = await screen.findByRole('dialog')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Dinheiro' }))
    await usuario.click(within(dialogo).getByRole('button', { name: /^Confirmar venda/ }))

    expect(semEspacoDuro((await screen.findByText(/registrada:/)).textContent)).toContain('1 × O Caminho, R$ 50,00 no dinheiro')
  })

  it('nega o PDV a quem não é Vendedor nem PDV', async () => {
    renderizar('u-operador')
    expect(await screen.findByText('Seu perfil não possui permissão para esta tela.')).toBeInTheDocument()
  })

  it('mostra a cobrança PIX com a chave da organização e registra ao confirmar o recebimento', async () => {
    bancoAdministracao.salvarOrganizacao(USUARIOS_SIMULADOS.find((u) => u.id === 'u-admin')!, 'administrador', {
      ...bancoAdministracao.organizacao(),
      cnpj: '',
      endereco: '',
      telefone: '',
      email: '',
      rodapeRecibo: '',
      tipoChavePix: 'EMAIL',
      chavePix: 'PIX@Cairbar.org',
      cidadePix: 'Campinas',
      logo: null,
      removerLogo: false,
    })
    const usuario = userEvent.setup()
    renderizar()

    // O PIX entra na conta de recebimento definida pelo Administrador; o vendedor não escolhe conta.
    const cafe = await screen.findByRole('button', { name: /^Adicionar Café/ })
    await usuario.click(cafe)
    await usuario.click(cafe)
    await usuario.click(screen.getByRole('button', { name: 'Cobrar' }))
    const dialogo = await screen.findByRole('dialog')
    await usuario.click(within(dialogo).getByRole('button', { name: 'PIX' }))

    expect(await within(dialogo).findByRole('img', { name: /^QR Code PIX de R\$\s7,00/ })).toBeInTheDocument()
    await usuario.click(within(dialogo).getByRole('button', { name: 'Copiar código PIX' }))
    expect(within(dialogo).getByRole('button', { name: 'Código copiado' })).toBeInTheDocument()
    const payload = await navigator.clipboard.readText()
    expect(payload).toContain('0115pix@cairbar.org')
    expect(payload).toContain('54047.00')
    expect(payload).toContain('6008Campinas')

    await usuario.click(within(dialogo).getByRole('button', { name: 'PIX recebido' }))
    await screen.findByText(/registrada:/)
    const [venda] = bancoVendas.listar({}, vendedor)
    expect(venda.meios).toEqual(['PIX'])
  })

  it('o PDV cancela a própria última venda pelo aviso e pelo botão "Última venda"', async () => {
    const usuario = userEvent.setup()
    renderizar('u-pdv')
    const pdv = USUARIOS_SIMULADOS.find((u) => u.id === 'u-pdv')!

    async function vender(nome: RegExp) {
      await usuario.click(await screen.findByRole('button', { name: nome }))
      await usuario.click(screen.getByRole('button', { name: 'Cobrar' }))
      const dialogo = await screen.findByRole('dialog')
      await usuario.click(within(dialogo).getByRole('button', { name: 'Dinheiro' }))
      await usuario.click(within(dialogo).getByRole('button', { name: /^Confirmar venda/ }))
      return screen.findByText(/registrada:/)
    }

    await vender(/^Adicionar Café/)
    await usuario.click(await screen.findByRole('button', { name: 'Cancelar venda' }))
    let modal = await screen.findByRole('dialog', { name: /Cancelar venda/ })
    expect(within(modal).getByRole('textbox', { name: 'Motivo' })).toHaveValue('Cancelada no PDV')
    await usuario.click(within(modal).getByRole('button', { name: 'Cancelar venda' }))
    expect(await screen.findByText(/Venda nº 1 cancelada/)).toBeInTheDocument()

    await vender(/^Adicionar Pão de queijo/)
    await usuario.click(screen.getByRole('button', { name: 'Última venda' }))
    let ultima = await screen.findByRole('dialog', { name: 'Última venda' })
    expect(await within(ultima).findByText('Venda nº 2')).toBeInTheDocument()
    expect(semEspacoDuro(within(ultima).getByText(/^Total:/).textContent)).toBe('Total: R$ 5,00')
    await usuario.click(within(ultima).getByRole('button', { name: 'Cancelar venda' }))
    modal = await screen.findByRole('dialog', { name: /Cancelar venda/ })
    await usuario.click(within(modal).getByRole('button', { name: 'Cancelar venda' }))
    expect(await screen.findByText(/Venda nº 2 cancelada/)).toBeInTheDocument()
    expect(bancoVendas.listar({ status: 'CANCELADA' }, USUARIOS_SIMULADOS.find((u) => u.id === 'u-admin')!)).toHaveLength(2)

    // A última já cancelada: nada mais a cancelar pelo PDV, nem a anterior.
    await usuario.click(screen.getByRole('button', { name: 'Última venda' }))
    ultima = await screen.findByRole('dialog', { name: 'Última venda' })
    expect(await within(ultima).findByText(/Não há outra venda a cancelar/)).toBeInTheDocument()
    expect(within(ultima).queryByRole('button', { name: 'Cancelar venda' })).not.toBeInTheDocument()
    expect(() => bancoVendas.cancelar(1, 'Cancelada no PDV', pdv)).toThrow(ErroNegocio)
  })
})

describe('regras de cancelamento do PDV (mock)', () => {
  const pdv = USUARIOS_SIMULADOS.find((u) => u.id === 'u-pdv')!
  const tesoureiro = USUARIOS_SIMULADOS.find((u) => u.id === 'u-tesoureiro')!
  const venda = (chave: string, quem: typeof pdv) =>
    bancoVendas.confirmar(
      { itens: [{ produtoId: 10, quantidade: 1, precoUnitario: 3.5 }], pagamentos: [{ meio: 'DINHEIRO', valor: 3.5 }], refazVendaId: null, chaveIdempotencia: chave },
      quem,
    )
  const codigo = (f: () => unknown) => {
    try {
      f()
    } catch (e) {
      return (e as ErroNegocio).codigo
    }
    return null
  }

  it('o PDV recebe 409 numa venda anterior; o Tesoureiro cancela a do PDV mas não a de um Vendedor', () => {
    const anterior = venda('a', pdv)
    const ultima = venda('b', pdv)
    const doVendedor = venda('c', vendedor)

    expect(codigo(() => bancoVendas.cancelar(anterior.id, 'Cancelada no PDV', pdv))).toBe('NAO_E_ULTIMA_VENDA_PDV')
    expect(codigo(() => bancoVendas.cancelar(doVendedor.id, 'Venda de outra pessoa', pdv))).toBe('VENDA_DE_OUTRO_VENDEDOR')
    expect(codigo(() => bancoVendas.cancelar(doVendedor.id, 'Venda de um Vendedor', tesoureiro))).toBe('VENDA_DE_OUTRO_VENDEDOR')
    expect(bancoVendas.cancelar(anterior.id, 'Venda acidental no PDV', tesoureiro).status).toBe('CANCELADA')
    expect(bancoVendas.cancelar(ultima.id, 'Cancelada no PDV', pdv).status).toBe('CANCELADA')
  })
})

describe('regras do PDV', () => {
  it('monta o pagamento único', () => {
    expect(pagamentoPdv('CREDITO', 1250)).toEqual({ meio: 'CARTAO', valor: 12.5, tipoCartao: 'CREDITO' })
    expect(pagamentoPdv('DEBITO', 300)).toEqual({ meio: 'CARTAO', valor: 3, tipoCartao: 'DEBITO' })
    expect(pagamentoPdv('PIX', 700)).toEqual({ meio: 'PIX', valor: 7 })
    expect(pagamentoPdv('DINHEIRO', 500)).toEqual({ meio: 'DINHEIRO', valor: 5 })
  })
})
