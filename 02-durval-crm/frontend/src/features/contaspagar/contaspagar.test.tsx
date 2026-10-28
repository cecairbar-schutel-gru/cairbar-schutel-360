import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router-dom'
import { ProvedorTema } from '../../app/ProvedorTema'
import { criarRoteadorEmMemoria } from '../../app/rotas'
import { AuthProvider } from '../../auth/AuthProvider'
import { authSimulado } from '../../auth/authSimulado'
import { USUARIOS_SIMULADOS } from '../../auth/usuariosSimulados'
import { bancoContasPagar, vencimentos } from '../../mocks/bancoContasPagar'
import { bancoFinanceiro, CONTAS } from '../../mocks/bancoFinanceiro'
import { formatarData, hoje, paraIsoData } from '../../shared/formatters/datas'
import type { ContaPagar } from './types'

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

const tesoureira = USUARIOS_SIMULADOS.find((u) => u.id === 'u-tesoureiro')!
const semEspacoDuro = (t: string | null) => (t ?? '').replace(/ /g, ' ')

/** Dia 1 do mês anterior: um vencimento já vencido e o do mês atual. */
function mesAnterior(): string {
  const h = hoje()
  return paraIsoData(new Date(h.getFullYear(), h.getMonth() - 1, 1))
}

function ontem(): string {
  const h = hoje()
  return paraIsoData(new Date(h.getFullYear(), h.getMonth(), h.getDate() - 1))
}

function luz(recorrencia: ContaPagar['recorrencia'] = 'MENSAL', primeiroVencimento = mesAnterior()): ContaPagar {
  return bancoContasPagar.cadastrar({
    descricao: 'Conta de luz',
    favorecido: 'Enel',
    categoria: 'DESPESAS_OPERACIONAIS.ENERGIA_ELETRICA',
    valorPrevisto: 180,
    recorrencia,
    primeiroVencimento,
    fimRecorrencia: null,
    contaFinanceiraId: 3,
    observacoes: null,
  })
}

describe('vencimentos das contas a pagar', () => {
  const base: ContaPagar = {
    id: 1,
    descricao: 'Aluguel',
    favorecido: null,
    categoria: 'DESPESAS_OPERACIONAIS.MANUTENCAO_CONSERVACAO',
    valorPrevisto: 1000,
    recorrencia: 'MENSAL',
    primeiroVencimento: '2026-01-31',
    fimRecorrencia: '2026-04-30',
    contaFinanceiraId: null,
    observacoes: null,
    ativa: true,
  }

  it('mensal no dia 31 usa o último dia dos meses curtos e respeita o fim', () => {
    expect(vencimentos(base, '2026-01-01', '2026-12-31')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })

  it('única, anual e encerrada', () => {
    expect(vencimentos({ ...base, recorrencia: 'UNICA' }, '2026-01-01', '2030-01-01')).toEqual(['2026-01-31'])
    expect(vencimentos({ ...base, recorrencia: 'ANUAL', fimRecorrencia: null }, '2026-01-01', '2028-12-31')).toEqual([
      '2026-01-31',
      '2027-01-31',
      '2028-01-31',
    ])
    expect(vencimentos({ ...base, ativa: false }, '2026-01-01', '2026-12-31')).toEqual([])
  })
})

describe('contas a pagar', () => {
  it('Tesoureiro cadastra uma conta mensal e vê o detalhe com os vencimentos', async () => {
    const usuario = userEvent.setup()
    renderizar('u-tesoureiro', '/contas-pagar/nova')

    await usuario.type(await screen.findByRole('textbox', { name: 'Descrição' }), 'Internet')
    await usuario.click(screen.getByRole('combobox', { name: 'Categoria' }))
    await usuario.click(await screen.findByRole('option', { name: 'Despesas operacionais' }))
    await usuario.click(screen.getByRole('combobox', { name: 'Subcategoria' }))
    await usuario.click(await screen.findByRole('option', { name: 'Internet' }))
    await usuario.type(screen.getByRole('textbox', { name: 'Valor previsto' }), '99,90')
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar conta' }))

    expect(await screen.findByRole('heading', { name: 'Internet' })).toBeInTheDocument()
    expect(screen.getByText('Mensal')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Vencimentos em aberto' })).toBeInTheDocument()
    expect(bancoContasPagar.listar('ATIVAS')).toHaveLength(1)
  })

  it('agenda mostra o vencido, o pagamento gera a despesa e o estorno reabre o vencimento', async () => {
    CONTAS[2].saldoInicial = 500
    const conta = luz()
    const usuario = userEvent.setup()
    renderizar('u-tesoureiro', '/contas-pagar')

    const tabela = await screen.findByRole('table', { name: 'Vencimentos' })
    const vencido = within(tabela).getByRole('row', { name: new RegExp(formatarData(mesAnterior())) })
    expect(within(vencido).getByText('Vencida')).toBeInTheDocument()

    await usuario.click(within(vencido).getByRole('button', { name: /^Pagar Conta de luz/ }))
    const dialogo = await screen.findByRole('dialog')
    const valor = within(dialogo).getByRole('textbox', { name: 'Valor pago' })
    await usuario.clear(valor)
    await usuario.type(valor, '192,37')
    await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Registrar pagamento' })).toBeEnabled())
    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar pagamento' }))

    expect(await screen.findByText('Pagamento registrado')).toBeInTheDocument()
    expect(bancoFinanceiro.saldo(3)).toBeCloseTo(307.63)
    // Pago, o vencimento do mês anterior sai da agenda deste mês e fica no histórico da conta.
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: new RegExp(formatarData(mesAnterior())) })).not.toBeInTheDocument(),
    )
    await usuario.click(screen.getAllByRole('link', { name: 'Conta de luz' })[0])
    const pagamentos = await screen.findByRole('table', { name: 'Pagamentos' })
    expect(semEspacoDuro(pagamentos.textContent)).toContain('R$ 192,37')

    const lancamentoId = bancoContasPagar.conta(conta.id).pagamentos[0].lancamentoId!
    bancoFinanceiro.estornar(tesoureira, lancamentoId, 'Pagamento feito na conta errada', null)
    expect(bancoContasPagar.conta(conta.id).emAberto[0]).toBe(mesAnterior())
  })

  it('conta única paga fica quitada e o estorno a reativa', async () => {
    CONTAS[2].saldoInicial = 500
    const conta = luz('UNICA', ontem())
    const pago = bancoContasPagar.pagar(
      { contaPagarId: conta.id, vencimento: ontem(), pagoEm: ontem(), valor: 180, contaId: 3, observacao: '', chaveIdempotencia: 'u1' },
      tesoureira,
    )
    expect(bancoContasPagar.listar('ATIVAS')).toHaveLength(0)
    renderizar('u-tesoureiro', `/contas-pagar/${conta.id}`)
    expect(await screen.findByText('Quitada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reativar' })).not.toBeInTheDocument()

    bancoFinanceiro.estornar(tesoureira, pago.lancamentoId!, 'Pago em duplicidade', null)
    const detalhe = bancoContasPagar.conta(conta.id)
    expect(detalhe.conta.ativa).toBe(true)
    expect(detalhe.quitada).toBe(false)
    expect(detalhe.emAberto).toEqual([ontem()])
  })

  it('painel do Tesoureiro avisa das contas vencidas', async () => {
    luz('UNICA', ontem())
    renderizar('u-tesoureiro', '/')
    expect(await screen.findByText(/1 conta vencida/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Contas a pagar (1 pendentes)' })).toHaveAttribute('href', '/contas-pagar')
  })

  it('só a Tesouraria vê o menu e as telas', async () => {
    renderizar('u-vendedor', '/contas-pagar')
    const menu = await screen.findByRole('navigation', { name: 'Menu lateral' })
    expect(menu).not.toHaveTextContent('Contas a pagar')
    expect(screen.queryByRole('heading', { name: 'Contas a pagar' })).not.toBeInTheDocument()
  })
})
