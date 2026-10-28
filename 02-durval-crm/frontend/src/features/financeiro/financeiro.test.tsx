import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router-dom'
import { ProvedorTema } from '../../app/ProvedorTema'
import { criarRoteadorEmMemoria } from '../../app/rotas'
import { AuthProvider } from '../../auth/AuthProvider'
import { authSimulado } from '../../auth/authSimulado'
import { USUARIOS_SIMULADOS } from '../../auth/usuariosSimulados'
import { bancoFinanceiro, CARTAO, CONTAS } from '../../mocks/bancoFinanceiro'
import { bancoVendas } from '../../mocks/bancoVendas'
import { hoje, paraIsoData } from '../../shared/formatters/datas'
import { ROTULO_TIPO_CONTA } from './rotulos'

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

const semEspacoDuro = (t: string | null) => (t ?? '').replace(/\u00a0/g, ' ')
const tesoureira = USUARIOS_SIMULADOS.find((u) => u.id === 'u-tesoureiro')!
const dia = () => paraIsoData(hoje())

async function escolher(usuario: ReturnType<typeof userEvent.setup>, campo: string, opcao: string | RegExp) {
  await usuario.click(await screen.findByRole('combobox', { name: campo }))
  await usuario.click(await screen.findByRole('option', { name: opcao }))
}

function despesaManual(valor: number, conta = 3) {
  return bancoFinanceiro.lancarManual(tesoureira, {
    contaId: conta,
    data: dia(),
    tipo: 'DESPESA',
    categoria: 'DESPESAS_OPERACIONAIS.AGUA',
    valor,
    descricao: 'Conta de água',
    anexo: null,
    chaveIdempotencia: '',
  }).id
}

describe('painel do Tesoureiro (US-FINANCIAL-015, wireframe 3)', () => {
  it('mostra a visão do mês, os saldos por tipo e as pendências', async () => {
    CONTAS[0].saldoInicial = 100
    CARTAO.saldoInicial = 250
    bancoFinanceiro.transferir(tesoureira, {
      contaOrigemId: 1,
      contaDestinoId: 3,
      valor: 40,
      data: dia(),
      descricao: '',
      chaveIdempotencia: '',
    })
    renderizar('u-tesoureiro', '/')

    expect(await screen.findByRole('heading', { name: /^Visão financeira — / })).toBeInTheDocument()
    expect(screen.getByText('Receita líquida')).toBeInTheDocument()
    expect(screen.getByText('Taxas de cartão')).toBeInTheDocument()
    const saldos = screen.getByRole('table', { name: 'Saldos por conta' })
    expect(semEspacoDuro(within(saldos).getByRole('row', { name: /^Caixas/ }).textContent)).toContain('R$ 60,00')
    expect(semEspacoDuro(within(saldos).getByRole('row', { name: /^Total geral/ }).textContent)).toContain('R$ 350,00')
    expect(screen.getByRole('link', { name: 'Liquidar cartão' })).toHaveAttribute('href', '/financeiro/liquidacao-cartao')
    expect(within(screen.getByRole('navigation', { name: 'Atalhos da Tesouraria' })).getByRole('link', { name: 'Aprovar gastos' })).toHaveAttribute('href', '/intencoes-gasto/aprovacao')
    const pendencias = screen.getByRole('list', { name: 'Pendências do período' })
    expect(within(pendencias).getByText('Conciliação — Banco A')).toBeInTheDocument()
  })
})

describe('saldos e contas de recebimento', () => {
  it('Operador e Vendedor não acessam o Financeiro (US-FINANCIAL-002)', async () => {
    renderizar('u-operador', '/financeiro')
    expect(await screen.findByText('Acesso negado')).toBeInTheDocument()
  })

  it('Administrador define onde entram o dinheiro e o PIX das vendas e contribuições', async () => {
    const usuario = userEvent.setup()
    renderizar('u-admin', '/financeiro/contas')
    const cartao = await screen.findByRole('region', { name: 'Contas de recebimento' })
    expect(await within(cartao).findByText('Caixa Secretaria')).toBeInTheDocument()
    await usuario.click(within(cartao).getByRole('button', { name: 'Alterar contas de recebimento' }))
    await usuario.click(within(cartao).getByRole('combobox', { name: 'Dinheiro entra em' }))
    await usuario.click(screen.getByRole('option', { name: 'Caixa Cantina' }))
    await usuario.click(within(cartao).getByRole('combobox', { name: 'PIX entra em' }))
    await usuario.click(screen.getByRole('option', { name: 'Banco B' }))
    await usuario.click(within(cartao).getByRole('button', { name: 'Salvar' }))
    expect(await within(cartao).findByText('Caixa Cantina')).toBeInTheDocument()
    expect(bancoFinanceiro.contasRecebimento().pix?.nome).toBe('Banco B')

    // A conta de recebimento não é inativada antes de trocar o destino.
    const tabela = screen.getByRole('table', { name: 'Contas financeiras' })
    const linha = within(tabela).getByRole('row', { name: /Caixa Cantina/ })
    await usuario.click(within(linha).getByRole('button', { name: 'Inativar' }))
    await usuario.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Inativar' }))
    expect(await screen.findByText(/Defina outra conta de recebimento antes de inativá-la/)).toBeInTheDocument()
  })

  it('Tesoureiro vê as contas de recebimento, mas não as altera', async () => {
    renderizar('u-tesoureiro', '/financeiro/contas')
    const cartao = await screen.findByRole('region', { name: 'Contas de recebimento' })
    expect(await within(cartao).findByText('Banco A')).toBeInTheDocument()
    expect(within(cartao).queryByRole('button', { name: 'Alterar contas de recebimento' })).not.toBeInTheDocument()
  })
})

describe('operações da Tesouraria', () => {
  it('transfere do caixa para o banco e bloqueia caixa negativo (US-FINANCIAL-003)', async () => {
    CONTAS[0].saldoInicial = 100
    const usuario = userEvent.setup()
    renderizar('u-tesoureiro', '/financeiro/transferencia')

    await escolher(usuario, 'De (origem)', /^Caixa Secretaria/)
    await escolher(usuario, 'Para (destino)', /^Banco A/)
    expect(screen.queryByRole('option', { name: /Cartão a receber/ })).not.toBeInTheDocument()
    await usuario.type(screen.getByLabelText('Valor'), '150')
    await usuario.click(screen.getByRole('button', { name: 'Registrar transferência' }))
    expect(semEspacoDuro((await screen.findByText(/o caixa não pode ficar negativo/)).textContent)).toContain(
      'O saldo de Caixa Secretaria é R$ 100,00',
    )

    await usuario.clear(screen.getByLabelText('Valor'))
    await usuario.type(screen.getByLabelText('Valor'), '60')
    await usuario.click(screen.getByRole('button', { name: 'Registrar transferência' }))
    await usuario.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText('Transferência registrada')).toBeInTheDocument()
    expect(bancoFinanceiro.saldo(1)).toBe(40)
    expect(bancoFinanceiro.saldo(3)).toBe(60)
  })

  it('liquida o cartão: líquido calculado, taxa como despesa e bruto limitado ao saldo (US-FINANCIAL-004)', async () => {
    CARTAO.saldoInicial = 1000
    const usuario = userEvent.setup()
    renderizar('u-tesoureiro', '/financeiro/liquidacao-cartao')

    expect(semEspacoDuro((await screen.findByText('Saldo de Cartão a receber')).nextSibling!.textContent)).toBe('R$ 1.000,00')
    await escolher(usuario, 'Conta bancária de destino', 'Banco A')
    await usuario.type(screen.getByLabelText('Valor bruto'), '600')
    await usuario.type(screen.getByLabelText('Taxa'), '18')
    expect(semEspacoDuro(screen.getByRole('status').textContent)).toContain('R$ 582,00')
    await usuario.click(screen.getByRole('button', { name: 'Registrar liquidação' }))
    await usuario.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText('Liquidação registrada')).toBeInTheDocument()
    expect(bancoFinanceiro.saldo(CARTAO.id)).toBe(400)
    expect(bancoFinanceiro.saldo(3)).toBe(582)

    await usuario.type(screen.getByLabelText('Valor bruto'), '450')
    expect(semEspacoDuro((await screen.findByText(/excede o saldo/)).textContent)).toBe(
      'O bruto de R$ 450,00 excede o saldo de Cartão a receber de R$ 400,00.',
    )
  })

  it('mostra o saldo a receber por tipo e liquida informando o tipo (simulação de 27/10/2026, P9)', async () => {
    CARTAO.saldoInicial = 100
    bancoVendas.confirmar(
      { itens: [{ produtoId: 12, quantidade: 1, precoUnitario: 5 }], pagamentos: [{ meio: 'CARTAO', valor: 5, tipoCartao: 'DEBITO' }], refazVendaId: null, chaveIdempotencia: 'p9' },
      { id: 'u-vendedor', nome: 'Bruno Vendedor', papeis: ['vendedor'] },
    )
    const usuario = userEvent.setup()
    renderizar('u-tesoureiro', '/financeiro/liquidacao-cartao')

    const valor = async (rotulo: string) => semEspacoDuro((await screen.findByText(rotulo)).nextSibling!.textContent)
    expect(await valor('Saldo de Cartão a receber')).toBe('R$ 105,00')
    expect(await valor('Débito')).toBe('R$ 5,00')
    expect(await valor('Crédito')).toBe('R$ 0,00')
    expect(await valor('Tipo não informado')).toBe('R$ 100,00')

    await escolher(usuario, 'Conta bancária de destino', 'Banco A')
    await usuario.type(screen.getByLabelText('Valor bruto'), '5')
    await usuario.type(screen.getByLabelText('Taxa'), '0,10')
    await escolher(usuario, 'Tipo liquidado (opcional)', 'Débito')
    await usuario.click(screen.getByRole('button', { name: 'Registrar liquidação' }))
    const dialogo = await screen.findByRole('dialog')
    expect(semEspacoDuro(dialogo.textContent)).toContain('Cartão a receber (débito) −R$ 5,00')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText('Liquidação registrada')).toBeInTheDocument()
    await waitFor(async () => expect(await valor('Débito')).toBe('R$ 0,00'))
    expect(bancoFinanceiro.cartaoAReceber()).toEqual({ total: 100, credito: 0, debito: 0, naoInformado: 100 })
  })

  it('registra lançamento manual sem as categorias de fluxo próprio, com confirmação (US-FINANCIAL-009)', async () => {
    const usuario = userEvent.setup()
    renderizar('u-tesoureiro', '/financeiro/lancamentos/novo')

    await escolher(usuario, 'Conta', 'Banco A')
    await usuario.click(screen.getByRole('combobox', { name: 'Categoria' }))
    expect(screen.queryByRole('option', { name: 'Despesas comerciais' })).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('option', { name: 'Despesas operacionais' }))
    await escolher(usuario, 'Subcategoria', 'Internet')
    await usuario.type(screen.getByLabelText('Valor'), '99,90')
    await usuario.type(screen.getByLabelText(/^Descrição/), 'Fatura de outubro')
    await usuario.click(screen.getByRole('button', { name: 'Registrar lançamento' }))
    const dialogo = await screen.findByRole('dialog')
    expect(semEspacoDuro(dialogo.textContent)).toContain('Despesa de R$ 99,90 em Banco A')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText('Lançamento registrado')).toBeInTheDocument()
    expect(bancoFinanceiro.saldo(3)).toBe(-99.9)
    // Conta bancária pode ficar negativa, com aviso.
    expect(semEspacoDuro(screen.getByText(/ficou negativo/).textContent)).toContain('O saldo de Banco A ficou negativo: -R$ 99,90.')
  })
})

describe('lançamentos (US-FINANCIAL-005, 010 e 021)', () => {
  it('extrato da conta com saldo anterior, saldo corrido e marcação de estorno', async () => {
    CONTAS[2].saldoInicial = 500
    despesaManual(100)
    const estornado = despesaManual(30)
    bancoFinanceiro.estornar(tesoureira, estornado, 'Lançado em duplicidade', null)
    renderizar('u-tesoureiro', '/financeiro/lancamentos?contaId=3')

    const tabela = await screen.findByRole('table', { name: 'Lançamentos encontrados' })
    expect(semEspacoDuro(screen.getByText(/saldo anterior ao período/).textContent)).toContain('R$ 500,00')
    const linhas = within(tabela).getAllByRole('row').slice(1)
    expect(linhas).toHaveLength(3)
    expect(semEspacoDuro(linhas[0].textContent)).toContain('R$ 400,00')
    expect(within(linhas[1]).getByText(`Estornado pelo nº ${estornado + 1}`)).toBeInTheDocument()
    expect(within(linhas[2]).getByText(`Estorno do nº ${estornado}`)).toBeInTheDocument()
    expect(semEspacoDuro(screen.getByText(/Saldo final do período/).textContent)).toContain('R$ 400,00')
  })

  it('estorna com motivo e registra a correção ligada ao original (US-FINANCIAL-010)', async () => {
    CONTAS[2].saldoInicial = 500
    const id = despesaManual(100)
    const usuario = userEvent.setup()
    renderizar('u-tesoureiro', `/financeiro/lancamentos/${id}`)

    await usuario.click(await screen.findByRole('button', { name: 'Estornar' }))
    const dialogo = await screen.findByRole('dialog')
    await usuario.type(within(dialogo).getByLabelText(/Motivo/), 'curto')
    expect(within(dialogo).getByRole('button', { name: 'Estornar' })).toBeDisabled()
    await usuario.type(within(dialogo).getByLabelText(/Motivo/), ' — valor digitado errado')
    await usuario.click(within(dialogo).getByLabelText('Registrar também o lançamento correto'))
    const valor = within(dialogo).getByLabelText('Valor correto')
    expect(valor).toHaveValue('100,00')
    await usuario.clear(valor)
    await usuario.type(valor, '110')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Estornar e registrar a correção' }))

    expect(await screen.findByText('Estorno registrado')).toBeInTheDocument()
    expect(await screen.findByText('Lançamento estornado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Estornar' })).not.toBeInTheDocument()
    expect(bancoFinanceiro.saldo(3)).toBe(390)
    expect(bancoFinanceiro.lancamento(id + 2).corrigeLancamentoId).toBe(id)
  })

  it('reclassifica e mostra o histórico (US-FINANCIAL-021)', async () => {
    const id = despesaManual(80)
    const usuario = userEvent.setup()
    renderizar('u-admin', `/financeiro/lancamentos/${id}`)

    await usuario.click(await screen.findByRole('button', { name: 'Reclassificar' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText('Classificação atual: Despesas operacionais › Água')).toBeInTheDocument()
    await usuario.click(within(dialogo).getByRole('combobox', { name: 'Categoria' }))
    expect(screen.queryByRole('option', { name: 'Outras receitas' })).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('option', { name: 'Despesas operacionais' }))
    await usuario.click(within(dialogo).getByRole('combobox', { name: 'Subcategoria' }))
    await usuario.click(screen.getByRole('option', { name: 'Internet' }))
    await usuario.type(within(dialogo).getByLabelText(/Motivo/), 'Era a fatura da internet')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Reclassificar' }))

    expect(await screen.findByText('Lançamento reclassificado')).toBeInTheDocument()
    const historico = await screen.findByRole('table', { name: 'Histórico de classificação' })
    expect(within(historico).getByText('Despesas operacionais › Internet')).toBeInTheDocument()
    expect(within(historico).getByText('Daniel Administrador')).toBeInTheDocument()
    // O Administrador também estorna (US-FINANCIAL-010).
    expect(screen.getByRole('button', { name: 'Estornar' })).toBeInTheDocument()
  })
})

describe('cadastro de contas (US-FINANCIAL-001)', () => {
  it('Administrador cadastra caixa com o código gerado do nome', async () => {
    const usuario = userEvent.setup()
    renderizar('u-admin', '/financeiro/contas/nova')

    await usuario.type(await screen.findByLabelText(/^Nome/), 'Caixa Eventos')
    await usuario.clear(screen.getByLabelText(/^Saldo inicial/))
    await usuario.type(screen.getByLabelText(/^Saldo inicial/), '-10')
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('O saldo inicial do caixa não pode ser negativo.')).toBeInTheDocument()
    await usuario.clear(screen.getByLabelText(/^Saldo inicial/))
    await usuario.type(screen.getByLabelText(/^Saldo inicial/), '50')
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))

    const tabela = await screen.findByRole('table', { name: 'Contas financeiras' })
    const linha = within(tabela).getByRole('row', { name: /Caixa Eventos/ })
    expect(within(linha).getByText('caixa-eventos')).toBeInTheDocument()
    // Com saldo, a inativação é recusada.
    await usuario.click(within(linha).getByRole('button', { name: 'Inativar' }))
    await usuario.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Inativar' }))
    expect(await screen.findByText(/Só é possível inativar a conta com saldo zero/)).toBeInTheDocument()
  })

  it('Tesoureiro cadastra e edita só contas bancárias, sem inativar nem excluir', async () => {
    const usuario = userEvent.setup()
    renderizar('u-tesoureiro', '/financeiro/contas')
    const tabela = await screen.findByRole('table', { name: 'Contas financeiras' })
    for (const linha of within(tabela).getAllByRole('row').slice(1)) {
      const tipo = within(linha).getAllByRole('cell')[1].textContent
      const editar = within(linha).queryByRole('button', { name: 'Editar' })
      if (tipo === ROTULO_TIPO_CONTA.BANCO) expect(editar).toBeInTheDocument()
      else expect(editar).not.toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: /Inativar|Excluir/ })).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Nova conta' }))
    const tipo = await screen.findByLabelText(/^Tipo/)
    expect(tipo).toHaveTextContent(ROTULO_TIPO_CONTA.BANCO)
    await usuario.type(screen.getByLabelText(/^Nome/), 'Conta Poupança')
    await usuario.type(screen.getByLabelText(/^Banco/), 'Banco Teste')
    await usuario.type(screen.getByLabelText(/^Agência/), '0001')
    await usuario.type(screen.getByLabelText(/^Número da conta/), '123-4')
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))
    const lista = await screen.findByRole('table', { name: 'Contas financeiras' })
    await waitFor(() => expect(within(lista).getByRole('row', { name: /Conta Poupança/ })).toBeInTheDocument())
  })
})
