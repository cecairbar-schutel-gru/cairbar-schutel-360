import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router-dom'
import { ProvedorTema } from '../../app/ProvedorTema'
import { criarRoteadorEmMemoria } from '../../app/rotas'
import { AuthProvider } from '../../auth/AuthProvider'
import { authSimulado } from '../../auth/authSimulado'
import { USUARIOS_SIMULADOS } from '../../auth/usuariosSimulados'
import { bancoEstoque } from '../../mocks/bancoEstoque'
import { bancoFinanceiro, CONTAS } from '../../mocks/bancoFinanceiro'
import { bancoIntencoes } from '../../mocks/bancoIntencoes'
import { hoje, paraIsoData } from '../../shared/formatters/datas'

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

const usuario = (id: string) => USUARIOS_SIMULADOS.find((u) => u.id === id)!
const solicitante = usuario('u-vendedor')
const tesoureira = usuario('u-tesoureiro')
const vendedor = usuario('u-vendedor')
const semEspacoDuro = (t: string | null) => (t ?? '').replace(/ /g, ' ')
const BANCO_A = 3

async function escolher(u: ReturnType<typeof userEvent.setup>, campo: string, opcao: string | RegExp) {
  await u.click(await screen.findByRole('combobox', { name: campo }))
  await u.click(await screen.findByRole('option', { name: opcao }))
}

function pedirLimpeza(valor = 180) {
  return bancoIntencoes.criar(
    { descricao: 'Produtos de limpeza', categoria: 'DESPESAS_OPERACIONAIS.MATERIAL_LIMPEZA', valor, justificativa: 'Acabou o estoque', itens: [], anexos: [] },
    solicitante,
  ).id
}

function compraAprovada() {
  const id = bancoIntencoes.criar(
    {
      descricao: 'Reposição da cantina',
      categoria: 'DESPESAS_COMERCIAIS.COMPRA_CANTINA',
      valor: 100,
      justificativa: 'Evento de sábado',
      itens: [
        { produtoId: 10, quantidade: 10 },
        { produtoId: 11, quantidade: 5 },
      ],
      anexos: [],
    },
    solicitante,
  ).id
  bancoIntencoes.aprovar(
    id,
    { valor: 100, categoria: 'DESPESAS_COMERCIAIS.COMPRA_CANTINA', meio: 'PIX', contaId: BANCO_A, data: paraIsoData(hoje()), nota: '' },
    tesoureira,
  )
  return id
}

describe('nova intenção de gasto (wireframe 11, US-EXPENSE-001)', () => {
  it('o Vendedor envia o pedido com categoria, subcategoria, valor e justificativa', async () => {
    const u = userEvent.setup()
    renderizar('u-vendedor', '/intencoes-gasto/nova')

    expect(await screen.findByRole('heading', { name: 'Nova intenção de gasto' })).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Enviar para aprovação' }))
    expect(screen.getByText('Descreva o gasto.')).toBeInTheDocument()
    expect(screen.getByText('Explique o motivo da despesa.')).toBeInTheDocument()

    await u.type(screen.getByRole('textbox', { name: /Descrição/ }), 'Produtos de limpeza')
    await escolher(u, 'Categoria', 'Despesas operacionais')
    await escolher(u, 'Subcategoria', 'Material de limpeza')
    await u.type(screen.getByRole('textbox', { name: 'Valor estimado' }), '180')
    await u.type(screen.getByRole('textbox', { name: /Justificativa/ }), 'Acabou o estoque')
    await u.click(screen.getByRole('button', { name: 'Enviar para aprovação' }))

    expect(await screen.findByText('Intenção nº 1 enviada para aprovação.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Intenção de gasto nº 1' })).toBeInTheDocument()
    expect(screen.getByText('Pendente')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retirar pedido' })).toBeInTheDocument()
    expect(bancoIntencoes.fila('PENDENTE')).toHaveLength(1)
  })

  it('não oferece Repasse às editoras nem Taxas de cartão e exige os produtos na compra da cantina', async () => {
    const u = userEvent.setup()
    renderizar('u-vendedor', '/intencoes-gasto/nova')

    await escolher(u, 'Categoria', 'Despesas comerciais')
    await u.click(screen.getByRole('combobox', { name: 'Subcategoria' }))
    const opcoes = screen.getAllByRole('option').map((o) => o.textContent)
    expect(opcoes).toEqual(['Compra de produtos da cantina'])
    await u.click(screen.getByRole('option', { name: 'Compra de produtos da cantina' }))

    expect(screen.getByText('Produtos da cantina')).toBeInTheDocument()
    await u.type(screen.getByRole('textbox', { name: /Descrição/ }), 'Reposição')
    await u.type(screen.getByRole('textbox', { name: 'Valor estimado' }), '100')
    await u.type(screen.getByRole('textbox', { name: /Justificativa/ }), 'Evento')
    await u.click(screen.getByRole('button', { name: 'Enviar para aprovação' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Liste os produtos da cantina e as quantidades.')

    await escolher(u, 'Produto 1', 'Café (Bebidas)')
    await u.type(screen.getByRole('spinbutton', { name: 'Quantidade 1' }), '10')
    await u.click(screen.getByRole('button', { name: 'Enviar para aprovação' }))

    const itens = await screen.findByRole('table', { name: 'Itens da compra' })
    expect(within(itens).getByText('Café')).toBeInTheDocument()
    expect(within(itens).getByText('10')).toBeInTheDocument()
  })
})

describe('aprovação (US-EXPENSE-002, 004 e 005)', () => {
  it('a Tesoureira aprova com ajuste e nota; a despesa sai da conta de origem', async () => {
    CONTAS[2].saldoInicial = 1000
    const id = pedirLimpeza()
    const u = userEvent.setup()
    renderizar('u-tesoureiro', '/intencoes-gasto/aprovacao')

    const fila = await screen.findByRole('table', { name: 'Intenções de gasto' })
    expect(within(fila).getByText('Bruno Vendedor')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Pendentes (1)' })).toBeInTheDocument()
    await u.click(within(fila).getByRole('link', { name: `Analisar intenção nº ${id}` }))

    expect(await screen.findByText(/já lançados nesta subcategoria/)).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Aprovar' }))
    const dialogo = await screen.findByRole('dialog', { name: /Aprovar gasto/ })
    const valor = within(dialogo).getByRole('textbox', { name: 'Valor aprovado' })
    await u.clear(valor)
    await u.type(valor, '172,50')
    await escolher(u, 'Conta bancária de origem', 'Banco A')
    await u.click(within(dialogo).getByRole('button', { name: 'Aprovar e registrar despesa' }))
    expect(within(dialogo).getByText('Explique o ajuste de valor ou de categoria.')).toBeInTheDocument()
    // O foco vai para o campo com erro.
    expect(within(dialogo).getByRole('textbox', { name: /Nota do ajuste/ })).toHaveFocus()
    expect(within(dialogo).queryByText('O saldo vai ficar negativo')).not.toBeInTheDocument()

    await u.type(within(dialogo).getByRole('textbox', { name: /Nota do ajuste/ }), 'Preço final')
    await u.click(within(dialogo).getByRole('button', { name: 'Aprovar e registrar despesa' }))

    expect(await screen.findByText(/aprovada\. Despesa registrada/)).toBeInTheDocument()
    expect(bancoFinanceiro.saldo(BANCO_A)).toBe(827.5)
    const pagamento = screen.getByRole('heading', { name: 'Pagamento aprovado' }).parentElement!
    expect(semEspacoDuro(pagamento.textContent)).toContain('R$ 172,50 (pedido: R$ 180,00)')
    expect(pagamento).toHaveTextContent('Preço final')
  })

  it('avisa antes de aprovar que o saldo da conta bancária vai ficar negativo', async () => {
    CONTAS[2].saldoInicial = 100
    const id = pedirLimpeza()
    const u = userEvent.setup()
    renderizar('u-tesoureiro', '/intencoes-gasto/aprovacao')

    const fila = await screen.findByRole('table', { name: 'Intenções de gasto' })
    await u.click(within(fila).getByRole('link', { name: `Analisar intenção nº ${id}` }))
    expect(await screen.findByText(/já lançados nesta subcategoria/)).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Aprovar' }))
    const dialogo = await screen.findByRole('dialog', { name: /Aprovar gasto/ })
    await escolher(u, 'Conta bancária de origem', 'Banco A')
    const aviso = within(dialogo).getByText('O saldo vai ficar negativo').parentElement!
    expect(semEspacoDuro(aviso.textContent)).toContain('ficará em -R$ 80,00 (hoje: R$ 100,00)')

    // Não bloqueia: a aprovação segue.
    await u.click(within(dialogo).getByRole('button', { name: 'Aprovar e registrar despesa' }))
    expect(await screen.findByText(/aprovada\. Despesa registrada/)).toBeInTheDocument()
    expect(bancoFinanceiro.saldo(BANCO_A)).toBe(-80)
  })

  it('a rejeição exige motivo, nada é lançado e o Vendedor copia o pedido como novo', async () => {
    const id = pedirLimpeza(50)
    bancoIntencoes.rejeitar(id, 'Sem orçamento este mês', tesoureira)
    const u = userEvent.setup()
    renderizar('u-vendedor', `/intencoes-gasto/${id}`)

    expect(await screen.findByText('Motivo: Sem orçamento este mês')).toBeInTheDocument()
    expect(bancoFinanceiro.saldo(BANCO_A)).toBe(0)
    await u.click(screen.getByRole('button', { name: 'Copiar como nova' }))

    expect(await screen.findByText(`Copiada da intenção nº ${id}. Revise os dados e anexe os arquivos de novo, se precisar.`)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('textbox', { name: /Descrição/ })).toHaveValue('Produtos de limpeza'))
    expect(screen.getByRole('textbox', { name: 'Valor estimado' })).toHaveValue('50,00')
    expect(screen.getByRole('combobox', { name: 'Subcategoria' })).toHaveTextContent('Material de limpeza')
  })
})

describe('Minhas intenções (US-EXPENSE-008 e 009)', () => {
  it('destaca o que mudou desde a última visita e permite retirar o pedido pendente', async () => {
    const aprovada = pedirLimpeza(20)
    const pendente = pedirLimpeza(30)
    bancoIntencoes.registrarVisita(solicitante)
    await new Promise((r) => setTimeout(r, 5))
    bancoIntencoes.aprovar(
      aprovada,
      { valor: 20, categoria: 'DESPESAS_OPERACIONAIS.MATERIAL_LIMPEZA', meio: 'PIX', contaId: BANCO_A, data: paraIsoData(hoje()), nota: '' },
      tesoureira,
    )
    const u = userEvent.setup()
    renderizar('u-vendedor', '/intencoes-gasto')

    const tabela = await screen.findByRole('table', { name: 'Minhas intenções de gasto' })
    expect(screen.getByText('1 intenção mudou de situação desde a sua última visita.')).toBeInTheDocument()
    expect(within(tabela).getByText('Atualizada')).toBeInTheDocument()

    await u.click(within(tabela).getByRole('link', { name: `Abrir intenção nº ${pendente}` }))
    await u.click(await screen.findByRole('button', { name: 'Retirar pedido' }))
    const dialogo = await screen.findByRole('dialog', { name: /Retirar pedido/ })
    await u.type(within(dialogo).getByRole('textbox', { name: /Por que não precisa mais/ }), 'Ganhei os produtos')
    await u.click(within(dialogo).getByRole('button', { name: 'Retirar pedido' }))

    expect(await screen.findByText(/retirada da fila de aprovação/)).toBeInTheDocument()
    expect(bancoIntencoes.fila('PENDENTE')).toHaveLength(0)
  })
})

describe('recebimento da compra da cantina (US-EXPENSE-006 e 007)', () => {
  it('o Vendedor confirma o recebimento conferido e o estoque aumenta', async () => {
    const id = compraAprovada()
    const cafe = bancoEstoque.saldo(10)
    const u = userEvent.setup()
    renderizar('u-vendedor', '/')

    const aguardando = await screen.findByRole('table', { name: 'Compras aguardando recebimento' })
    await u.click(within(aguardando).getByRole('link', { name: `Conferir intenção nº ${id}` }))
    await u.click(await screen.findByRole('button', { name: 'Confirmar recebimento' }))

    expect(await screen.findByText('Recebimento conferido. O estoque foi atualizado.')).toBeInTheDocument()
    expect(bancoEstoque.saldo(10)).toBe(cafe + 10)
    expect(screen.queryByRole('button', { name: 'Confirmar recebimento' })).not.toBeInTheDocument()
  })

  it('diferença exige descrição e bloqueia a entrada; a Tesoureira cancela e a despesa é estornada', async () => {
    const id = compraAprovada()
    const cafe = bancoEstoque.saldo(10)
    const u = userEvent.setup()
    const { unmount } = renderizar('u-vendedor', `/intencoes-gasto/${id}`)

    const recebida = await screen.findByRole('spinbutton', { name: 'Quantidade recebida de Café' })
    await u.clear(recebida)
    await u.type(recebida, '8')
    expect(screen.getByRole('button', { name: 'Registrar divergência' })).toBeDisabled()
    await u.type(screen.getByRole('textbox', { name: /Descreva a divergência/ }), 'Vieram só 8 cafés')
    await u.click(screen.getByRole('button', { name: 'Registrar divergência' }))
    expect(await screen.findByText(/Divergência registrada/)).toBeInTheDocument()
    expect(bancoEstoque.saldo(10)).toBe(cafe)
    expect(bancoFinanceiro.saldo(BANCO_A)).toBe(-100)
    unmount()

    renderizar('u-tesoureiro', '/intencoes-gasto/aprovacao')
    await u.click(await screen.findByRole('tab', { name: 'Divergentes (1)' }))
    await u.click(await screen.findByRole('link', { name: `Analisar intenção nº ${id}` }))
    expect(await screen.findByRole('table', { name: 'Itens da compra' })).toHaveTextContent('Café108')
    await u.click(screen.getByRole('button', { name: 'Cancelar compra' }))
    const dialogo = await screen.findByRole('dialog', { name: /Cancelar compra/ })
    await u.type(within(dialogo).getByRole('textbox', { name: /Motivo do cancelamento/ }), 'Fornecedor vai devolver o valor')
    await u.click(within(dialogo).getByRole('button', { name: 'Cancelar compra' }))

    expect(await screen.findByText(/A despesa foi estornada e nada entrou no estoque/)).toBeInTheDocument()
    expect(bancoFinanceiro.saldo(BANCO_A)).toBe(0)
    expect(bancoEstoque.saldo(10)).toBe(cafe)
  })

  it('a correção com novo valor estorna a despesa, lança a nova e devolve ao Vendedor', () => {
    const id = compraAprovada()
    bancoIntencoes.receber(id, [{ produtoId: 10, quantidade: 8 }, { produtoId: 11, quantidade: 5 }], 'Faltaram 2 cafés', vendedor)
    const r = bancoIntencoes.corrigir(id, [{ produtoId: 10, quantidade: 8 }, { produtoId: 11, quantidade: 5 }], 93, 'Fornecedor abateu', tesoureira)
    expect(r.status).toBe('AGUARDANDO_RECEBIMENTO')
    expect(r.lancamentoId).not.toBeNull()
    expect(bancoFinanceiro.saldo(BANCO_A)).toBe(-93)
  })
})
