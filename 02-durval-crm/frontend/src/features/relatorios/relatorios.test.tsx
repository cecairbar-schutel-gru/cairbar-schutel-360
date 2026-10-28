import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router-dom'
import { ProvedorTema } from '../../app/ProvedorTema'
import { criarRoteadorEmMemoria } from '../../app/rotas'
import { AuthProvider } from '../../auth/AuthProvider'
import { authSimulado } from '../../auth/authSimulado'
import { USUARIOS_SIMULADOS } from '../../auth/usuariosSimulados'
import { bancoEditoras } from '../../mocks/bancoEditoras'
import { bancoFinanceiro } from '../../mocks/bancoFinanceiro'
import { bancoVendas } from '../../mocks/bancoVendas'
import { hoje, paraIsoData } from '../../shared/formatters/datas'
import { formatarMoeda } from '../../shared/formatters/formatadores'

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
const tesoureira = USUARIOS_SIMULADOS.find((u) => u.id === 'u-tesoureiro')!
const vendedor = USUARIOS_SIMULADOS.find((u) => u.id === 'u-vendedor')!
const HOJE = paraIsoData(hoje())
const BANCO_A = 3

function lancar(tipo: 'RECEITA' | 'DESPESA', categoria: string, valor: number, descricao: string) {
  bancoFinanceiro.lancarManual(tesoureira, { contaId: BANCO_A, data: HOJE, tipo, categoria, valor, descricao, anexo: null, chaveIdempotencia: '' })
}

function venderCafe(quantidade: number) {
  return bancoVendas.confirmar({
    itens: [{ produtoId: 10, quantidade, precoUnitario: 3.5 }],
    pagamentos: [{ meio: 'DINHEIRO', valor: quantidade * 3.5 }],
    refazVendaId: null,
    chaveIdempotencia: crypto.randomUUID(),
  }, vendedor)
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:relatorio')
  URL.revokeObjectURL = vi.fn()
  HTMLAnchorElement.prototype.click = vi.fn()
})

describe('relatórios (US-REPORT)', () => {
  it('menu e acesso por perfil: Tesouraria vê todos, Vendedor vendas e estoque, Operador nenhum', async () => {
    renderizar('u-tesoureiro', '/relatorios')
    const lista = await screen.findByRole('list', { name: 'Relatórios disponíveis' })
    for (const nome of ['Prestação de contas mensal', 'Fluxo de caixa', 'Receitas e despesas por categoria', 'Saldos por conta', 'Mensalidades', 'Vendas', 'Estoque', 'Acertos com editoras']) {
      expect(within(lista).getByRole('heading', { name: nome })).toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: 'Relatórios' })).toBeInTheDocument()
  })

  it('o Vendedor vê só vendas e estoque e não abre os financeiros', async () => {
    renderizar('u-vendedor', '/relatorios')
    const lista = await screen.findByRole('list', { name: 'Relatórios disponíveis' })
    expect(within(lista).getAllByRole('heading').map((h) => h.textContent)).toEqual(['Vendas', 'Estoque', 'Folha de contagem'])
  })

  it('o Operador não tem relatórios', async () => {
    renderizar('u-operador', '/relatorios/fluxo-caixa')
    expect(await screen.findByText('Seu perfil não possui permissão para esta tela.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Relatórios' })).not.toBeInTheDocument()
  })

  it('US-REPORT-002: receitas e despesas por categoria no layout do wireframe 12, com drill-down', async () => {
    lancar('RECEITA', 'OUTRAS_RECEITAS.OUTRAS_ENTRADAS', 800, 'Bazar')
    lancar('DESPESA', 'DESPESAS_OPERACIONAIS.ENERGIA_ELETRICA', 200, 'Luz')
    const usuario = userEvent.setup()
    renderizar('u-admin', '/relatorios/receitas-despesas')

    const resumo = await screen.findByRole('generic', { name: 'Resumo do período' })
    expect(semEspacoDuro(resumo.textContent)).toContain('ReceitasR$ 800,00')
    expect(semEspacoDuro(resumo.textContent)).toContain('DespesasR$ 200,00')
    expect(semEspacoDuro(resumo.textContent)).toContain('R$ 600,00')
    // O saldo devido hoje às editoras fica ao lado do resultado, sem ser descontado dele (regime de caixa).
    const devido = formatarMoeda(bancoEditoras.saldos().total)
    expect(semEspacoDuro(resumo.textContent)).toContain(semEspacoDuro(`Devido às editoras (saldo atual)${devido}`))
    expect(screen.getByRole('link', { name: 'Acertos com editoras' })).toHaveAttribute('href', '/editoras/saldos')
    const receitas = screen.getByRole('table', { name: 'Receitas por categoria' })
    expect(within(receitas).getByRole('progressbar', { name: 'Outras receitas: 100,0%' })).toBeInTheDocument()
    // Todo o plano ativo aparece, mesmo sem valor no período.
    expect(within(receitas).getByText('Mensalidades')).toBeInTheDocument()

    await usuario.click(within(screen.getByRole('table', { name: 'Despesas por categoria' })).getByRole('link', { name: 'Lançamentos de Energia elétrica' }))
    expect(await screen.findByRole('heading', { name: 'Lançamentos' })).toBeInTheDocument()
    expect(await screen.findByText('Luz')).toBeInTheDocument()
    expect(screen.queryByText('Bazar')).not.toBeInTheDocument()
  })

  it('US-REPORT-001: fluxo de caixa com saldo final igual ao das contas e transferências à parte', async () => {
    lancar('RECEITA', 'OUTRAS_RECEITAS.OUTRAS_ENTRADAS', 500, 'Bazar')
    bancoFinanceiro.transferir(tesoureira, { contaOrigemId: BANCO_A, contaDestinoId: 1, valor: 100, data: HOJE, descricao: 'Troco', chaveIdempotencia: '' })
    const usuario = userEvent.setup()
    renderizar('u-tesoureiro', '/relatorios/fluxo-caixa')

    const resumo = await screen.findByRole('generic', { name: 'Resumo do período' })
    expect(semEspacoDuro(resumo.textContent)).toContain('EntradasR$ 500,00')
    expect(semEspacoDuro(resumo.textContent)).toContain('R$ 100,00 recebidas · R$ 100,00 enviadas')
    expect(semEspacoDuro(resumo.textContent)).toContain('Saldo finalR$ 500,00')

    // Só o caixa da secretaria: a transferência entra e não há receita.
    await usuario.click(screen.getByRole('combobox', { name: 'Contas' }))
    await usuario.click(await screen.findByRole('option', { name: 'Caixa Secretaria' }))
    await waitFor(() => expect(semEspacoDuro(screen.getByRole('generic', { name: 'Resumo do período' }).textContent)).toContain('EntradasR$ 0,00'))
    expect(semEspacoDuro(screen.getByRole('generic', { name: 'Resumo do período' }).textContent)).toContain('Saldo finalR$ 100,00')
  })

  it('US-REPORT-006 e 021: vendas do Vendedor com cancelamento descontado e exportação para Excel', async () => {
    venderCafe(2)
    const cancelada = venderCafe(1)
    bancoVendas.cancelar(cancelada.id, 'Quantidade digitada errada', vendedor)
    const usuario = userEvent.setup()
    renderizar('u-vendedor', '/relatorios/vendas')

    const totais = await screen.findByRole('generic', { name: 'Totais do período' })
    expect(semEspacoDuro(totais.textContent)).toContain('Vendas no período2')
    expect(semEspacoDuro(totais.textContent)).toContain('Canceladas no período1R$ 3,50')
    expect(semEspacoDuro(totais.textContent)).toContain('Receita líquidaR$ 7,00')
    expect(within(screen.getByRole('table', { name: 'Por produto' })).getByRole('link', { name: 'Café' })).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Exportar' }))
    await usuario.click(await screen.findByRole('menuitem', { name: /Excel/ }))
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled())
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('US-REPORT-007: estoque por produto e origem, com a folha de contagem', async () => {
    venderCafe(3)
    const usuario = userEvent.setup()
    renderizar('u-vendedor', '/relatorios/estoque?tipo=CANTINA')

    const tabela = await screen.findByRole('table', { name: 'Saldos e movimentos por produto' })
    const cafe = within(tabela).getByRole('link', { name: 'Café' }).closest('tr')!
    // A carga de 30 unidades é saldo inicial ou compra, conforme o dia de hoje; a venda tira 3.
    const [inicial, compra, , , venda, , , , final] = within(cafe).getAllByRole('cell').map((c) => Number(c.textContent)).slice(2)
    expect(inicial + compra).toBe(30)
    expect(venda).toBe(3)
    expect(final).toBe(27)
    expect(screen.getByRole('table', { name: 'Baixas por motivo' })).toBeInTheDocument()

    await usuario.click(screen.getByRole('link', { name: 'Folha de contagem' }))
    const folha = await screen.findByRole('table', { name: 'Folha de contagem' })
    expect(within(folha).getByText('Café').closest('tr')).toHaveTextContent('27')
    expect(within(folha).queryByText('O Caminho')).not.toBeInTheDocument()
  })

  it('US-REPORT-004: mensalidades com competências por mês e doadores com pendências', async () => {
    renderizar('u-tesoureiro', '/relatorios/mensalidades')
    expect(await screen.findByRole('table', { name: 'Competências por mês' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Doadores com 3 ou mais competências pendentes' })).toBeInTheDocument()
    expect(screen.getByRole('generic', { name: 'Recebido no período' })).toBeInTheDocument()
  })

  it('US-REPORT-003: saldos por conta, com Cartão a receber à parte e o modo saldo na data', async () => {
    lancar('RECEITA', 'OUTRAS_RECEITAS.OUTRAS_ENTRADAS', 300, 'Bazar')
    const usuario = userEvent.setup()
    renderizar('u-tesoureiro', '/relatorios/saldos')
    const bancos = await screen.findByRole('table', { name: 'Bancos' })
    expect(within(bancos).getByRole('link', { name: 'Banco A' }).closest('tr')).toHaveTextContent('Nunca conciliada')
    expect(screen.getByRole('heading', { name: 'Cartão a receber (valor a receber)' })).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Saldo na data' }))
    expect(await screen.findByRole('heading', { name: /Saldos por conta em/ })).toBeInTheDocument()
    expect(within(await screen.findByRole('table', { name: 'Bancos' })).queryByRole('columnheader', { name: 'Entradas' })).not.toBeInTheDocument()
  })

  it('US-REPORT-021: lançamentos e demonstrativo também exportam', async () => {
    lancar('RECEITA', 'OUTRAS_RECEITAS.OUTRAS_ENTRADAS', 300, 'Bazar')
    const usuario = userEvent.setup()
    renderizar('u-tesoureiro', `/fechamento/${HOJE.slice(0, 7)}/demonstrativo`)
    await usuario.click(await screen.findByRole('button', { name: 'Exportar' }))
    await usuario.click(await screen.findByRole('menuitem', { name: /PDF/ }))
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled())
  })
})
