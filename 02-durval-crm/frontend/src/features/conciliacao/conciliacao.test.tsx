import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router-dom'
import { ProvedorTema } from '../../app/ProvedorTema'
import { criarRoteadorEmMemoria } from '../../app/rotas'
import { AuthProvider } from '../../auth/AuthProvider'
import { authSimulado } from '../../auth/authSimulado'
import { USUARIOS_SIMULADOS } from '../../auth/usuariosSimulados'
import { bancoConciliacoes } from '../../mocks/bancoConciliacoes'
import { bancoFinanceiro, CONTAS } from '../../mocks/bancoFinanceiro'
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

const semEspacoDuro = (t: string | null) => (t ?? '').replace(/ /g, ' ')
const tesoureira = USUARIOS_SIMULADOS.find((u) => u.id === 'u-tesoureiro')!
/** Ontem: o extrato vai no máximo até ontem, e os lançamentos dos testes caem dentro dele. */
const dia = () => {
  const h = hoje()
  return paraIsoData(new Date(h.getFullYear(), h.getMonth(), h.getDate() - 1))
}
const BANCO_A = 3

function manual(tipo: 'RECEITA' | 'DESPESA', valor: number, descricao: string) {
  return bancoFinanceiro.lancarManual(tesoureira, {
    contaId: BANCO_A,
    data: dia(),
    tipo,
    categoria:
      tipo === 'RECEITA'
        ? 'OUTRAS_RECEITAS.OUTRAS_ENTRADAS'
        : 'DESPESAS_OPERACIONAIS.ENERGIA_ELETRICA',
    valor,
    descricao,
    anexo: null,
    chaveIdempotencia: '',
  }).id
}

/** Luz (−100), depósito do caixa (+50) e um PIX (+30) que ainda não está no extrato. */
function prepararLancamentos() {
  CONTAS[0].saldoInicial = 100
  const luz = manual('DESPESA', 100, 'Conta de luz')
  const deposito = bancoFinanceiro.transferir(tesoureira, {
    contaOrigemId: 1,
    contaDestinoId: BANCO_A,
    valor: 50,
    data: dia(),
    descricao: 'Depósito do caixa',
    chaveIdempotencia: '',
  }).id
  const pix = manual('RECEITA', 30, 'PIX do bazar')
  return { luz, deposito, pix }
}

const diferenca = () =>
  semEspacoDuro(
    within(screen.getByRole('complementary')).getByText('Diferença').nextSibling
      ?.textContent ?? null,
  )

describe('conciliação bancária (US-RECONCILIATION-001 a 010)', () => {
  it.each(['u-tesoureiro', 'u-admin'])(
    '%s vê o botão "Conciliar" da página',
    async (usuarioId) => {
      renderizar(usuarioId, '/conciliacao')
      await screen.findByRole('table', { name: 'Contas bancárias' })
      expect(
        screen.getByRole('button', { name: 'Conciliar' }),
      ).toBeInTheDocument()
    },
  )

  it.each(['u-operador', 'u-vendedor'])(
    '%s não chega à conciliação nem ao botão "Conciliar"',
    async (usuarioId) => {
      renderizar(usuarioId, '/conciliacao')
      await waitFor(() =>
        expect(
          screen.queryByRole('heading', { name: 'Conciliação bancária' }),
        ).not.toBeInTheDocument(),
      )
      expect(
        screen.queryByRole('button', { name: 'Conciliar' }),
      ).not.toBeInTheDocument()
    },
  )

  it('botão "Conciliar" abre o modal com a conta e as opções OFX e CSV e segue para a importação', async () => {
    const usuario = userEvent.setup()
    renderizar('u-tesoureiro', '/conciliacao')
    await screen.findByRole('table', { name: 'Contas bancárias' })

    await usuario.click(screen.getByRole('button', { name: 'Conciliar' }))
    const modal = await screen.findByRole('dialog', { name: 'Conciliar' })
    expect(within(modal).getByRole('radio', { name: /OFX/ })).toBeChecked()
    const csv = within(modal).getByRole('radio', { name: /CSV/ })
    expect(
      within(modal).getByRole('button', { name: 'Continuar' }),
    ).toBeDisabled()

    await usuario.click(
      within(modal).getByRole('combobox', { name: /Conta bancária/ }),
    )
    await usuario.click(await screen.findByRole('option', { name: 'Banco A' }))
    await usuario.click(csv)
    await usuario.click(
      within(modal).getByRole('button', { name: 'Continuar' }),
    )

    // Sem sessão aberta: pede os dados do extrato, inicia e abre a importação no formato escolhido.
    const extrato = await screen.findByRole('dialog', {
      name: /Iniciar conciliação/,
    })
    await usuario.type(
      within(extrato).getByLabelText(/Saldo final do extrato/),
      '0,00',
    )
    await usuario.click(
      within(extrato).getByRole('button', { name: 'Iniciar' }),
    )
    const importar = await screen.findByRole('dialog', {
      name: /Importar extrato do banco \(CSV\)/,
    })
    expect(
      within(importar).getByLabelText('Arquivo do extrato (CSV)'),
    ).toHaveAttribute('accept', '.csv,.txt,text/csv')
  })

  it('Tesoureiro inicia, marca, adiciona a tarifa ausente e conclui com o PIX pendente', async () => {
    const { luz } = prepararLancamentos()
    const usuario = userEvent.setup()
    renderizar('u-tesoureiro', '/')

    // Menu do Tesoureiro (wireframe 3) e a tela inicial com as contas bancárias.
    await usuario.click(
      await screen.findByRole('link', { name: 'Conciliação' }),
    )
    const contas = await screen.findByRole('table', {
      name: 'Contas bancárias',
    })
    const linhaBancoA = within(contas).getByRole('row', { name: /Banco A/ })
    expect(
      within(linhaBancoA).getByText('Nunca conciliada'),
    ).toBeInTheDocument()
    expect(within(linhaBancoA).getByText('3')).toBeInTheDocument()

    // US-RECONCILIATION-001: extrato até ontem (a data sugerida) com saldo de −R$ 55,00 (tarifa de R$ 5,00 incluída).
    await usuario.click(
      within(linhaBancoA).getByRole('button', { name: 'Conciliar Banco A' }),
    )
    const dialogo = await screen.findByRole('dialog')
    await usuario.type(
      within(dialogo).getByLabelText(/Saldo final do extrato/),
      '-55,00',
    )
    await usuario.click(
      within(dialogo).getByRole('button', { name: 'Iniciar' }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Conciliação — Banco A' }),
    ).toBeInTheDocument()
    expect(diferenca()).toBe('-R$ 55,00')

    // US-RECONCILIATION-003: cada clique é gravado e o resumo acompanha.
    await usuario.click(screen.getByRole('checkbox', { name: /Conta de luz/ }))
    await usuario.click(
      screen.getByRole('checkbox', { name: /Depósito do caixa/ }),
    )
    await waitFor(() => expect(diferenca()).toBe('-R$ 5,00'))
    await waitFor(() =>
      expect(bancoConciliacoes.sessao(1).totalMarcado).toBe(-50),
    )
    expect(
      screen.getByRole('button', { name: 'Concluir conciliação' }),
    ).toBeDisabled()
    expect(
      bancoConciliacoes.sessao(1).lancamentos.find((l) => l.id === luz)
        ?.marcadoPor,
    ).toBe('Carla Tesoureira')

    // US-RECONCILIATION-005: a tarifa entra já marcada, com a categoria sugerida.
    await usuario.click(
      screen.getByRole('button', { name: 'Adicionar lançamento ausente' }),
    )
    const adicionar = await screen.findByRole('dialog')
    expect(
      within(adicionar).getByRole('combobox', { name: 'Subcategoria' }),
    ).toHaveTextContent('Taxas bancárias')
    await usuario.type(within(adicionar).getByLabelText('Valor'), '5')
    // Sem descrição, o erro aparece e o campo recebe o foco.
    await usuario.click(
      within(adicionar).getByRole('button', { name: 'Registrar e marcar' }),
    )
    expect(within(adicionar).getByLabelText(/^Descrição/)).toHaveFocus()
    expect(
      within(adicionar).getByText(/Descreva o lançamento/),
    ).toBeInTheDocument()
    await usuario.type(
      within(adicionar).getByLabelText(/^Descrição/),
      'Tarifa de manutenção',
    )
    await usuario.click(
      within(adicionar).getByRole('button', { name: 'Registrar e marcar' }),
    )
    expect(await screen.findByText(/registrado e marcado/)).toBeInTheDocument()
    await waitFor(() => expect(diferenca()).toBe('R$ 0,00'))
    expect(screen.getByText('Adicionado na conciliação')).toBeInTheDocument()

    // US-RECONCILIATION-007: conclui; o PIX não marcado fica pendente.
    await usuario.click(
      screen.getByRole('button', { name: 'Concluir conciliação' }),
    )
    const confirmar = await screen.findByRole('dialog')
    expect(
      within(confirmar).getByText(/Os 1 sem marcar ficam pendentes/),
    ).toBeInTheDocument()
    await usuario.click(
      within(confirmar).getByRole('button', { name: 'Concluir' }),
    )
    expect(await screen.findByText(/está conciliada até/)).toBeInTheDocument()

    // US-RECONCILIATION-010: o relatório da sessão.
    expect(
      screen.getByRole('heading', { name: /Lançamentos conciliados \(3\)/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: /Adicionados durante a conciliação \(1\)/,
      }),
    ).toBeInTheDocument()
    const pendentes = screen.getByRole('region', {
      name: 'Pendentes (diferenças de prazo)',
    })
    expect(within(pendentes).getByText('PIX do bazar')).toBeInTheDocument()
    expect(bancoFinanceiro.lancamento(luz).conciliado).toBe(true)
    expect(
      bancoConciliacoes.contas().find((c) => c.contaId === BANCO_A),
    ).toMatchObject({ conciliadaAte: dia(), naoConciliados: 1 })
  })

  it('"Marcar todos os exibidos" vale para a lista filtrada', async () => {
    prepararLancamentos()
    const sessao = bancoConciliacoes.iniciar(tesoureira, BANCO_A, dia(), -50)
    const usuario = userEvent.setup()
    renderizar('u-tesoureiro', `/conciliacao/${sessao.id}`)

    await usuario.type(await screen.findByLabelText('Texto ou nº'), 'conta')
    expect(
      screen.getAllByRole('checkbox', { name: /Lançamento nº/ }),
    ).toHaveLength(1)
    await usuario.click(
      screen.getByRole('button', { name: 'Marcar todos os exibidos' }),
    )
    await waitFor(() =>
      expect(bancoConciliacoes.sessao(sessao.id).totalMarcado).toBe(-100),
    )
    await usuario.click(screen.getByLabelText('Mostrar marcados'))
    expect(
      screen.getByText('Nenhum lançamento com esses filtros.'),
    ).toBeInTheDocument()
  })

  it('Administrador também concilia: tem o item no menu, marca e conclui', async () => {
    const { luz, deposito, pix } = prepararLancamentos()
    const sessao = bancoConciliacoes.iniciar(tesoureira, BANCO_A, dia(), -20)
    const usuario = userEvent.setup()
    renderizar('u-admin', `/conciliacao/${sessao.id}`)

    expect(
      await screen.findByRole('link', { name: 'Conciliação' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Somente consulta')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Importar extrato (OFX/CSV)' }),
    ).toBeInTheDocument()
    await usuario.click(screen.getByRole('checkbox', { name: /Conta de luz/ }))
    await usuario.click(
      screen.getByRole('checkbox', { name: /Depósito do caixa/ }),
    )
    await usuario.click(screen.getByRole('checkbox', { name: /PIX do bazar/ }))
    await waitFor(() => expect(diferenca()).toBe('R$ 0,00'))
    await usuario.click(
      screen.getByRole('button', { name: 'Concluir conciliação' }),
    )
    await usuario.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Concluir',
      }),
    )
    expect(await screen.findByText(/está conciliada até/)).toBeInTheDocument()
    expect(bancoConciliacoes.sessao(sessao.id)).toMatchObject({
      status: 'CONCLUIDA',
      concluidaPor: 'Daniel Administrador',
    })
    expect(
      [luz, deposito, pix].every(
        (id) => bancoFinanceiro.lancamento(id).conciliado,
      ),
    ).toBe(true)
  })

  it('"Corrigir" abre o estorno e o estorno entra na lista para marcar', async () => {
    const { luz } = prepararLancamentos()
    const sessao = bancoConciliacoes.iniciar(tesoureira, BANCO_A, dia(), 0)
    const usuario = userEvent.setup()
    renderizar('u-tesoureiro', `/conciliacao/${sessao.id}`)

    await usuario.click(
      await screen.findByRole('button', {
        name: `Corrigir o lançamento nº ${luz}`,
      }),
    )
    const dialogo = await screen.findByRole('dialog')
    await usuario.type(
      within(dialogo).getByLabelText(/Motivo/),
      'Valor lançado em dobro',
    )
    await usuario.click(
      within(dialogo).getByRole('button', { name: 'Estornar' }),
    )
    expect(
      await screen.findByRole('checkbox', { name: /Estorno: Conta de luz/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(`Estornado pelo nº ${luz + 3}`)).toBeInTheDocument()
  })

  it('sugere ontem como data final e não deixa conciliar até hoje', async () => {
    const usuario = userEvent.setup()
    renderizar('u-tesoureiro', '/conciliacao')

    const linha = within(
      await screen.findByRole('table', { name: 'Contas bancárias' }),
    ).getByRole('row', { name: /Banco A/ })
    await usuario.click(
      within(linha).getByRole('button', { name: 'Conciliar Banco A' }),
    )
    const dialogo = await screen.findByRole('dialog')
    const data = within(dialogo).getByLabelText(/Data final do extrato/)
    expect(data).toHaveValue(dia())
    expect(data).toHaveAttribute('max', dia())

    // O extrato de hoje só fecha amanhã: o que for lançado depois, hoje, ficaria fora da conciliação.
    fireEvent.change(data, { target: { value: paraIsoData(hoje()) } })
    await usuario.type(
      within(dialogo).getByLabelText(/Saldo final do extrato/),
      '0',
    )
    await usuario.click(
      within(dialogo).getByRole('button', { name: 'Iniciar' }),
    )
    const br = dia().split('-').reverse().join('/')
    expect(
      await within(dialogo).findByText(
        `Use uma data até ontem (${br}): o extrato de hoje só fecha amanhã.`,
      ),
    ).toBeInTheDocument()
  })

  it('não deixa iniciar com data anterior à última conciliação e mostra o histórico', async () => {
    const s = bancoConciliacoes.iniciar(tesoureira, BANCO_A, dia(), 0)
    bancoConciliacoes.concluir(tesoureira, s.id)
    const usuario = userEvent.setup()
    renderizar('u-tesoureiro', '/conciliacao')

    const linha = within(
      await screen.findByRole('table', { name: 'Contas bancárias' }),
    ).getByRole('row', { name: /Banco A/ })
    expect(within(linha).getByText('Conciliada')).toBeInTheDocument()
    await usuario.click(
      within(linha).getByRole('button', { name: 'Conciliar Banco A' }),
    )
    const dialogo = await screen.findByRole('dialog')
    await usuario.type(
      within(dialogo).getByLabelText(/Saldo final do extrato/),
      '0',
    )
    await usuario.click(
      within(dialogo).getByRole('button', { name: 'Iniciar' }),
    )
    expect(
      await within(dialogo).findByText(
        /Use uma data posterior à última conciliação/,
      ),
    ).toBeInTheDocument()
    await usuario.click(
      within(dialogo).getByRole('button', { name: 'Cancelar' }),
    )

    await usuario.click(within(linha).getByRole('link', { name: 'Histórico' }))
    const historico = await screen.findByRole('table', {
      name: 'Conciliações concluídas',
    })
    expect(
      within(historico).getByRole('link', { name: `Ver relatório nº ${s.id}` }),
    ).toBeInTheDocument()
  })

  it('Tesoureiro importa o extrato em CSV, confirma as sugestões e registra a tarifa a partir da linha', async () => {
    const { luz, deposito } = prepararLancamentos()
    const sessao = bancoConciliacoes.iniciar(tesoureira, BANCO_A, dia(), -55)
    const usuario = userEvent.setup()
    renderizar('u-tesoureiro', `/conciliacao/${sessao.id}`)

    await usuario.click(
      await screen.findByRole('button', { name: 'Importar extrato (OFX/CSV)' }),
    )
    const dialogo = await screen.findByRole('dialog')
    const br = dia().split('-').reverse().join('/')
    const csv = `Data;Histórico;Valor\nSALDO ANTERIOR;;100,00\n${br};PAGTO ENERGIA;-100,00\n${br};DEP DINHEIRO;50,00\n${br};TARIFA PACOTE;-5,00\n`
    await usuario.upload(
      within(dialogo).getByLabelText('Arquivo do extrato (OFX ou CSV)'),
      new File([csv], 'extrato.csv', { type: 'text/csv' }),
    )
    expect(
      await within(dialogo).findByText(/3 movimento\(s\)/),
    ).toBeInTheDocument()
    expect(
      within(dialogo).getByRole('combobox', { name: 'Descrição' }),
    ).toHaveTextContent('Histórico')
    await usuario.click(
      within(dialogo).getByRole('button', { name: 'Importar 3 linha(s)' }),
    )

    expect(
      await screen.findByText(/Extrato importado: 3 linha\(s\)/),
    ).toBeInTheDocument()
    const linhas = screen.getByRole('table', {
      name: 'Linhas do extrato do banco',
    })
    expect(within(linhas).getAllByText('Sugestão')).toHaveLength(2)
    expect(within(linhas).getByText('Sem lançamento')).toBeInTheDocument()

    // Confirmar as sugestões marca os lançamentos.
    await usuario.click(
      screen.getByRole('button', { name: 'Confirmar 2 sugestão(ões)' }),
    )
    await waitFor(() => expect(diferenca()).toBe('-R$ 5,00'))
    const s = bancoConciliacoes.sessao(sessao.id)
    expect(
      s.lancamentos
        .filter((l) => l.marcado)
        .map((l) => l.id)
        .sort(),
    ).toEqual([luz, deposito].sort())
    expect(
      s.extrato?.linhas.filter((l) => l.lancamentoId !== null),
    ).toHaveLength(2)

    // A tarifa: "Adicionar" já traz a linha do extrato preenchida.
    await usuario.click(
      screen.getByRole('button', {
        name: 'Adicionar lançamento para “TARIFA PACOTE”',
      }),
    )
    const adicionar = await screen.findByRole('dialog')
    expect(within(adicionar).getByLabelText('Valor')).toHaveValue('5,00')
    expect(within(adicionar).getByLabelText(/^Descrição/)).toHaveValue(
      'TARIFA PACOTE',
    )
    await usuario.click(
      within(adicionar).getByRole('button', { name: 'Registrar e marcar' }),
    )
    await waitFor(() => expect(diferenca()).toBe('R$ 0,00'))
    expect(
      bancoConciliacoes
        .sessao(sessao.id)
        .extrato?.linhas.every((l) => l.lancamentoId !== null),
    ).toBe(true)

    // Desfazer um par desmarca o lançamento.
    await usuario.click(
      await screen.findByRole('button', {
        name: 'Desfazer o par de “DEP DINHEIRO”',
      }),
    )
    await waitFor(() => expect(diferenca()).toBe('R$ 50,00'))
  })
})
