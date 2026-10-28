import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router-dom'
import { ProvedorTema } from '../../app/ProvedorTema'
import { criarRoteadorEmMemoria } from '../../app/rotas'
import { AuthProvider } from '../../auth/AuthProvider'
import { authSimulado } from '../../auth/authSimulado'
import { USUARIOS_SIMULADOS } from '../../auth/usuariosSimulados'
import { bancoEditoras } from '../../mocks/bancoEditoras'
import { bancoEstoque } from '../../mocks/bancoEstoque'
import { bancoFinanceiro } from '../../mocks/bancoFinanceiro'
import { bancoVendas } from '../../mocks/bancoVendas'
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
const vendedor = usuario('u-vendedor')
const tesoureira = usuario('u-tesoureiro')
const semEspacoDuro = (t: string | null) => (t ?? '').replace(/ /g, ' ')
const BANCO_A = 3
const mesAtual = () => paraIsoData(hoje()).slice(0, 7)

async function escolher(u: ReturnType<typeof userEvent.setup>, campo: string | RegExp, opcao: string | RegExp) {
  await u.click(await screen.findByRole('combobox', { name: campo }))
  await u.click(await screen.findByRole('option', { name: opcao }))
}

let chave = 0
/** "O Caminho" (R$ 50,00) é consignado da Editora Luz: R-0001 (3 un., 40%) e R-0002 (5 un., 35%). */
function venderOCaminho(quantidade: number) {
  return bancoVendas.confirmar(
    {
      itens: [{ produtoId: 1, quantidade, precoUnitario: 50 }],
      pagamentos: [{ meio: 'DINHEIRO', valor: 50 * quantidade }],
      refazVendaId: null,
      chaveIdempotencia: `venda-${chave++}`,
    },
    vendedor,
  )
}

describe('cadastro de editoras (US-PUBLISHER-001)', () => {
  it('o Administrador cadastra a editora com CNPJ validado', async () => {
    const u = userEvent.setup()
    renderizar('u-admin', '/editoras/nova')
    expect(await screen.findByRole('heading', { name: 'Nova editora' })).toBeInTheDocument()

    await u.type(screen.getByRole('textbox', { name: /^Nome\s*\*?$/ }), 'Editora Aurora')
    await u.type(screen.getByRole('textbox', { name: /CNPJ/ }), '11.222.333/0001-82')
    await u.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(screen.getByText('CNPJ inválido.')).toBeInTheDocument()

    await u.clear(screen.getByRole('textbox', { name: /CNPJ/ }))
    await u.type(screen.getByRole('textbox', { name: /CNPJ/ }), '33445566000186')
    await u.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Já existe uma editora com este CNPJ.')).toBeInTheDocument()

    await u.clear(screen.getByRole('textbox', { name: /CNPJ/ }))
    await u.type(screen.getByRole('textbox', { name: /CNPJ/ }), '11.222.333/0001-81')
    await u.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('heading', { name: 'Editora Aurora' })).toBeInTheDocument()
    expect(screen.getByText('CNPJ: 11.222.333/0001-81')).toBeInTheDocument()
    expect(bancoEditoras.listar('ATIVAS').map((e) => e.nome)).toContain('Editora Aurora')
  })

  it('a Tesouraria vê a lista sem as ações de cadastro', async () => {
    renderizar('u-tesoureiro', '/editoras')
    const tabela = await screen.findByRole('table', { name: 'Editoras' })
    expect(within(tabela).getByRole('link', { name: 'Editora Luz' })).toBeInTheDocument()
    expect(within(tabela).getByText('33.445.566/0001-86')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nova editora' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Saldos e pagamentos' })).toBeInTheDocument()
  })
})

describe('perfis no módulo Editoras', () => {
  it('o Vendedor cadastra e recebe remessas, sem ver saldos nem pedir livros', async () => {
    renderizar('u-vendedor', '/editoras')
    const tabela = await screen.findByRole('table', { name: 'Editoras' })
    expect(within(tabela).queryByText('Saldo devido')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nova editora' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar remessa' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Saldos e pagamentos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pedidos de livros' })).not.toBeInTheDocument()
  })

  it('o Vendedor não abre os pedidos nem os saldos', async () => {
    renderizar('u-vendedor', '/editoras/pedidos/novo')
    expect(await screen.findByText('Seu perfil não possui permissão para esta tela.')).toBeInTheDocument()
  })
})

describe('pedidos de livros', () => {
  it('a Tesouraria registra o pedido com os títulos da editora', async () => {
    const u = userEvent.setup()
    renderizar('u-tesoureiro', '/editoras/pedidos/novo?editoraId=2')
    expect(await screen.findByRole('heading', { name: 'Novo pedido de livros' })).toBeInTheDocument()
    await escolher(u, 'Título da linha 1', /Nosso Lar/)
    const quantidade = screen.getByRole('textbox', { name: 'Quantidade' })
    await u.clear(quantidade)
    await u.type(quantidade, '5')
    await u.click(screen.getByRole('button', { name: 'Registrar pedido' }))

    expect(await screen.findByRole('heading', { name: /^Pedido de livros nº \d+$/ })).toBeInTheDocument()
    expect(screen.getByText('Aguardando entrega')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar pedido' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar remessa recebida' })).not.toBeInTheDocument()
    const [pedido] = bancoEditoras.pedidos({ editoraId: 2 })
    expect(pedido).toMatchObject({ status: 'ABERTO', unidades: 5, pedidoPor: tesoureira.nome })
  })

  it('o Vendedor recebe a remessa contra o pedido e a conferência mostra a diferença', async () => {
    const u = userEvent.setup()
    const pedido = bancoEditoras.pedir({ editoraId: 2, observacao: '', itens: [{ produtoId: 2, quantidade: 5 }] }, tesoureira)
    renderizar('u-vendedor', `/editoras/remessas/nova?editoraId=2&pedidoId=${pedido.id}`)
    // Os títulos do pedido substituem a linha em branco quando o pedido carrega.
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Quantidade' })).toHaveValue('5'))
    const quantidade = screen.getByRole('textbox', { name: 'Quantidade' })
    await u.clear(quantidade)
    await u.type(quantidade, '4')
    await u.type(screen.getByRole('textbox', { name: 'Repasse' }), '30')
    await u.click(screen.getByRole('button', { name: 'Registrar remessa' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Confirmar remessa' })
    expect(dialogo.textContent).toContain(`atendendo o pedido nº ${pedido.id}`)
    await u.click(within(dialogo).getByRole('button', { name: 'Registrar' }))

    expect(await screen.findByRole('heading', { name: /^Remessa R-/ })).toBeInTheDocument()
    const conferido = bancoEditoras.pedido(pedido.id)
    expect(conferido.status).toBe('RECEBIDO')
    expect(conferido.itens).toEqual([expect.objectContaining({ titulo: 'Nosso Lar', pedida: 5, recebida: 4 })])
  })
})

describe('remessas e devoluções (US-PUBLISHER-003 e 005)', () => {
  it('registra a remessa com o código gerado e as unidades no estoque consignado', async () => {
    const u = userEvent.setup()
    renderizar('u-admin', '/editoras/remessas/nova?editoraId=2')
    expect(await screen.findByRole('heading', { name: 'Registrar remessa' })).toBeInTheDocument()

    await escolher(u, 'Título da linha 1', /Nosso Lar/)
    const quantidade = screen.getByRole('textbox', { name: 'Quantidade' })
    await u.clear(quantidade)
    await u.type(quantidade, '4')
    await u.click(screen.getByRole('button', { name: 'Registrar remessa' }))
    expect(screen.getByText('Informe o percentual de repasse.')).toBeInTheDocument()

    await u.type(screen.getByRole('textbox', { name: 'Repasse' }), '30')
    await u.click(screen.getByRole('button', { name: 'Registrar remessa' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Confirmar remessa' })
    expect(semEspacoDuro(dialogo.textContent)).toContain('4 unidade(s) de FEB Editora')
    await u.click(within(dialogo).getByRole('button', { name: 'Registrar' }))

    const ano = paraIsoData(hoje()).slice(0, 4)
    expect(await screen.findByRole('heading', { name: `Remessa R-${ano}-0001` })).toBeInTheDocument()
    const tabela = screen.getByRole('table', { name: 'Títulos da remessa' })
    expect(within(tabela).getByRole('link', { name: 'Nosso Lar' })).toBeInTheDocument()
    expect(within(tabela).getByText('30%')).toBeInTheDocument()
    const remessa = bancoEditoras.remessas({ editoraId: 2 })[0]
    expect(bancoEstoque.saldoLote(2, remessa.id)).toBe(4)
  })

  it('devolve até o restante da remessa, sem lançamento, e abre o comprovante', async () => {
    const u = userEvent.setup()
    renderizar('u-admin', '/editoras/remessas/2')
    await u.click(await screen.findByRole('button', { name: 'Registrar devolução' }))
    const dialogo = await screen.findByRole('dialog', { name: /Devolução da remessa R-0002/ })
    await u.type(within(dialogo).getByRole('textbox', { name: 'Devolver de O Caminho' }), '6')
    await u.click(within(dialogo).getByRole('button', { name: 'Registrar devolução' }))
    expect(within(dialogo).getByText('Restam só 5 unidade(s) de O Caminho nesta remessa.')).toBeInTheDocument()

    await u.clear(within(dialogo).getByRole('textbox', { name: 'Devolver de O Caminho' }))
    await u.type(within(dialogo).getByRole('textbox', { name: 'Devolver de O Caminho' }), '2')
    await u.click(within(dialogo).getByRole('button', { name: 'Registrar devolução' }))

    expect(await screen.findByRole('heading', { name: 'Comprovante de devolução nº 1' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Títulos devolvidos' })).toHaveTextContent('O Caminho')
    expect(bancoEstoque.saldoLote(1, 2)).toBe(3)
    expect(bancoFinanceiro.saldo(BANCO_A)).toBe(bancoFinanceiro.contas().find((c) => c.id === BANCO_A)!.saldoInicial)
  })

  it('remessa com unidades vendidas não pode mais ser cancelada', async () => {
    venderOCaminho(1)
    renderizar('u-admin', '/editoras/remessas/1')
    expect(await screen.findByRole('heading', { name: 'Remessa R-0001' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar remessa' })).not.toBeInTheDocument()
    const linha = within(screen.getByRole('table', { name: 'Títulos da remessa' })).getAllByRole('row')[1]
    expect(semEspacoDuro(linha.textContent)).toContain('R$ 20,00')
  })
})

describe('saldo e pagamento às editoras (US-PUBLISHER-006 e 008)', () => {
  /** Exemplo da US-PUBLISHER-008: R$ 60,00 + R$ 17,50; R$ 70,00 pagos deixam R$ 7,50. */
  it('mostra a alocação antes de confirmar e paga parcialmente', async () => {
    venderOCaminho(3)
    venderOCaminho(1)
    const saldoBanco = bancoFinanceiro.saldo(BANCO_A)
    const u = userEvent.setup()
    renderizar('u-tesoureiro', '/editoras/pagamento?editoraId=1')
    expect(await screen.findByRole('heading', { name: 'Pagar editora' })).toBeInTheDocument()
    expect(semEspacoDuro(screen.getByText(/Saldo devido: /).textContent)).toBe('Saldo devido: R$ 77,50')

    await u.type(screen.getByRole('textbox', { name: 'Valor' }), '70')
    await escolher(u, /Conta de origem/, /Banco A/)
    const alocacao = await screen.findByRole('table', { name: 'Distribuição do pagamento' })
    const linhas = within(alocacao).getAllByRole('row').slice(1).map((l) => semEspacoDuro(l.textContent))
    expect(linhas[0]).toContain('R$ 60,00R$ 60,00R$ 0,00')
    expect(linhas[1]).toContain('R$ 17,50R$ 10,00R$ 7,50')
    expect(semEspacoDuro(screen.getByText(/Saldo devido depois do pagamento/).textContent)).toContain('R$ 7,50')

    await u.click(screen.getByRole('button', { name: 'Registrar pagamento' }))
    await u.click(within(await screen.findByRole('dialog', { name: 'Confirmar pagamento' })).getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText('Pagamento registrado')).toBeInTheDocument()
    expect(bancoEditoras.saldo(1).saldoDevido).toBe(7.5)
    expect(bancoEditoras.saldo(1).obrigacoes.map((o) => o.status)).toEqual(['PAGA', 'PARCIALMENTE_PAGA'])
    expect(bancoFinanceiro.saldo(BANCO_A)).toBe(saldoBanco - 70)
  })

  it('o estorno da despesa no Financeiro reabre as obrigações; venda cancelada vira crédito', () => {
    venderOCaminho(3)
    const pago = bancoEditoras.pagar(
      { editoraId: 1, pagoEm: paraIsoData(hoje()), valor: 60, contaId: BANCO_A, meio: 'PIX', observacao: '', chaveIdempotencia: 'p1' },
      tesoureira,
    )
    expect(bancoEditoras.saldo(1).saldoDevido).toBe(0)
    bancoFinanceiro.estornar(tesoureira, pago.lancamentoId!, 'Pagamento feito na conta errada', null)
    expect(bancoEditoras.saldo(1).saldoDevido).toBe(60)
    expect(bancoEditoras.saldo(1).obrigacoes[0].status).toBe('ABERTA')

    bancoEditoras.pagar({ editoraId: 1, pagoEm: paraIsoData(hoje()), valor: 60, contaId: BANCO_A, meio: 'PIX', observacao: '', chaveIdempotencia: 'p2' }, tesoureira)
    bancoVendas.cancelar(1, 'Cliente desistiu da compra', vendedor)
    expect(bancoEditoras.saldo(1)).toMatchObject({ saldoDevido: -60, creditoDisponivel: 60 })
  })

  it('lista o saldo devido por editora com o total', async () => {
    venderOCaminho(3)
    renderizar('u-tesoureiro', '/editoras/saldos')
    const tabela = await screen.findByRole('table', { name: 'Saldo por editora' })
    expect(semEspacoDuro(within(tabela).getAllByRole('row')[1].textContent)).toContain('Editora LuzR$ 60,00')
    expect(screen.getByRole('button', { name: 'Pagar' })).toBeInTheDocument()
  })
})

describe('apuração mensal e transferência de saldo (US-PUBLISHER-007 e 010)', () => {
  it('a apuração fecha o saldo do mês e mostra o estoque por remessa', async () => {
    venderOCaminho(4)
    bancoEditoras.pagar({ editoraId: 1, pagoEm: paraIsoData(hoje()), valor: 70, contaId: BANCO_A, meio: 'PIX', observacao: '', chaveIdempotencia: 'p3' }, tesoureira)
    renderizar('u-tesoureiro', `/editoras/1/apuracao?mes=${mesAtual()}`)
    const valores = await screen.findByRole('table', { name: 'Seção financeira' })
    const linhas = within(valores).getAllByRole('row').map((l) => semEspacoDuro(l.textContent))
    expect(linhas).toContain('+ Obrigações por vendasR$ 77,50')
    expect(linhas).toContain('− PagamentosR$ 70,00')
    expect(linhas.at(-1)).toBe('= Saldo finalR$ 7,50')
    const estoque = screen.getByRole('table', { name: 'Seção de estoque' })
    expect(within(estoque).getByText('R-0002')).toBeInTheDocument()
  })

  it('o Tesoureiro transfere formalmente o saldo do mês com uma nota', async () => {
    venderOCaminho(1)
    const u = userEvent.setup()
    renderizar('u-tesoureiro', `/editoras/fechamento?mes=${mesAtual()}`)
    const tabela = await screen.findByRole('table', { name: 'Editoras com saldo no fim do mês' })
    expect(within(tabela).getByText('Pendente')).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Transferir saldo' }))
    const dialogo = await screen.findByRole('dialog', { name: /Transferir o saldo de Editora Luz/ })
    expect(within(dialogo).getByRole('button', { name: 'Transferir' })).toBeDisabled()
    await u.type(within(dialogo).getByRole('textbox', { name: /Nota/ }), 'Combinado pagar em 15/11')
    await u.click(within(dialogo).getByRole('button', { name: 'Transferir' }))
    expect(await screen.findByText('Item “Editoras” concluído')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/Combinado pagar em 15\/11/)).toBeInTheDocument())
    expect(bancoEditoras.fechamento(mesAtual()).concluido).toBe(true)
  })
})
