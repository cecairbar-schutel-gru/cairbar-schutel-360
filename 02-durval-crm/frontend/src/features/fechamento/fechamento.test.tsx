import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router-dom'
import { ProvedorTema } from '../../app/ProvedorTema'
import { criarRoteadorEmMemoria } from '../../app/rotas'
import { AuthProvider } from '../../auth/AuthProvider'
import { authSimulado } from '../../auth/authSimulado'
import { USUARIOS_SIMULADOS } from '../../auth/usuariosSimulados'
import { bancoConciliacoes } from '../../mocks/bancoConciliacoes'
import { bancoFechamento } from '../../mocks/bancoFechamento'
import { bancoFinanceiro, CONTAS } from '../../mocks/bancoFinanceiro'
import { hoje, paraIsoData } from '../../shared/formatters/datas'
import { deslocarMes } from '../editoras/regras'
import { nomeDoMes } from '../financeiro/regras'

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
const MES = deslocarMes(paraIsoData(hoje()).slice(0, 7), -1)
const ULTIMO_DIA = paraIsoData(new Date(Number(MES.slice(0, 4)), Number(MES.slice(5, 7)), 0))
const BANCO_A = 3
const BANCO_B = 4

function receita(contaId: number, data: string, valor: number, descricao: string) {
  return bancoFinanceiro.lancarManual(tesoureira, {
    contaId,
    data,
    tipo: 'RECEITA',
    categoria: 'OUTRAS_RECEITAS.OUTRAS_ENTRADAS',
    valor,
    descricao,
    anexo: null,
    chaveIdempotencia: '',
  }).id
}

/** O primeiro período é o mês passado: um bazar no Banco A e os dois bancos conciliados até o fim do mês. */
function prepararMes() {
  for (const c of CONTAS) c.dataCorte = `${MES}-01`
  const bazar = receita(BANCO_A, `${MES}-10`, 1000, 'Bazar')
  for (const [contaId, saldo, ids] of [
    [BANCO_A, 1000, [bazar]],
    [BANCO_B, 0, []],
  ] as const) {
    const s = bancoConciliacoes.iniciar(tesoureira, contaId, ULTIMO_DIA, saldo)
    if (ids.length > 0) bancoConciliacoes.marcar(tesoureira, s.id, [...ids], true)
    bancoConciliacoes.concluir(tesoureira, s.id)
  }
  return bazar
}

/** Dia 3 do mês atual: dentro da janela padrão (dias 1 a 7, US-CLOSING-014). */
function hojeNoDia(dia: number) {
  const agora = new Date()
  vi.setSystemTime(new Date(agora.getFullYear(), agora.getMonth(), dia, 12))
}

describe('fechamento mensal (US-CLOSING-001, 007, 008, 009, 013 e 014)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    hojeNoDia(3)
  })
  afterEach(() => vi.useRealTimers())

  it('Tesoureiro resolve o checklist, fecha o mês e a trava passa a valer', async () => {
    const bazar = prepararMes()
    const usuario = userEvent.setup()
    renderizar('u-tesoureiro', '/')

    // Painel do Tesoureiro: o checklist resumido nas pendências e o atalho.
    expect(await screen.findByRole('link', { name: `Fechamento de ${nomeDoMes(MES)}` })).toBeInTheDocument()
    expect(screen.getByText('Checklist: 4 de 5 itens concluídos')).toBeInTheDocument()
    await usuario.click(screen.getByRole('link', { name: 'Fechamento mensal (1 pendentes)' }))

    expect(await screen.findByRole('heading', { name: `Checklist — ${nomeDoMes(MES)}` })).toBeInTheDocument()
    const itens = screen.getByRole('list', { name: 'Itens do checklist' })
    expect(within(itens).getByText('Todas as contas bancárias conciliadas até o último dia do mês.')).toBeInTheDocument()
    expect(within(itens).getByText('Aguardando confirmação')).toBeInTheDocument()
    const fechar = screen.getByRole('button', { name: 'Fechar período' })
    expect(fechar).toBeDisabled()

    // Item 5: confirmação das liquidações de cartão.
    await usuario.click(within(itens).getByRole('button', { name: 'Confirmar liquidações' }))
    expect(await within(itens).findByText(/Confirmado por Carla Tesoureira/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Fechar período' })).toBeEnabled())

    // US-CLOSING-008: confirmação com nota opcional.
    await usuario.click(screen.getByRole('button', { name: 'Fechar período' }))
    const dialogo = await screen.findByRole('dialog')
    await usuario.type(within(dialogo).getByLabelText('Nota do fechamento (opcional)'), 'Conferido com o extrato')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Fechar período' }))
    expect(await screen.findByText(`${nomeDoMes(MES)} fechado. Os saldos e o demonstrativo foram gravados.`)).toBeInTheDocument()
    expect(await screen.findByText('Nada a fechar')).toBeInTheDocument()
    const linha = within(screen.getByRole('table', { name: 'Períodos' })).getByRole('row', { name: new RegExp(nomeDoMes(MES)) })
    expect(within(linha).getByText('Fechado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reabrir/ })).not.toBeInTheDocument()

    // Trava: nada entra no mês fechado; o estorno do que aconteceu nele cai hoje.
    expect(() => receita(BANCO_A, `${MES}-20`, 10, 'Atrasado')).toThrow(/está fechado/)
    const { estornoId } = bancoFinanceiro.estornar(tesoureira, bazar, 'Lançado na conta errada', null)
    expect(bancoFinanceiro.lancamento(estornoId).data).toBe(paraIsoData(hoje()))
    expect(() => bancoConciliacoes.iniciar(tesoureira, BANCO_A, ULTIMO_DIA, 0)).toThrow(/está fechado/)

    // US-CLOSING-007: o demonstrativo vira a versão gravada.
    await usuario.click(within(linha).getByRole('button', { name: `Demonstrativo de ${nomeDoMes(MES)}` }))
    expect(await screen.findByRole('heading', { name: `Prestação de contas — ${nomeDoMes(MES)}` })).toBeInTheDocument()
    expect(screen.getByText(/Fechado em .* por Carla Tesoureira · versão 1/)).toBeInTheDocument()
    const receitas = screen.getByRole('table', { name: 'Receitas por categoria' })
    expect(within(receitas).getByText('Outras entradas')).toBeInTheDocument()
    expect(within(receitas).getAllByText('Variação relevante').length).toBeGreaterThan(0)
  })

  it('Administrador reabre o mês fechado com justificativa e todos veem o aviso', async () => {
    prepararMes()
    bancoFechamento.confirmarCartao(tesoureira, MES)
    bancoFechamento.fechar(tesoureira, MES, '')
    const usuario = userEvent.setup()
    renderizar('u-admin', '/fechamento')

    await usuario.click(await screen.findByRole('button', { name: `Reabrir ${nomeDoMes(MES)}` }))
    const dialogo = await screen.findByRole('dialog')
    const confirmar = within(dialogo).getByRole('button', { name: 'Reabrir período' })
    await usuario.type(within(dialogo).getByLabelText(/Justificativa/), 'Erro na luz')
    expect(confirmar).toBeDisabled()
    await usuario.type(within(dialogo).getByLabelText(/Justificativa/), ' lançada em dobro no dia 12')
    expect(confirmar).toBeEnabled()
    await usuario.click(confirmar)

    const [a, m] = MES.split('-')
    expect(await screen.findByText(new RegExp(`Período ${m}/${a} reaberto por Daniel Administrador`))).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: `Checklist — ${nomeDoMes(MES)}` })).toBeInTheDocument()
    expect(screen.getByText(/Erro na luz lançada em dobro/)).toBeInTheDocument()
    // Reaberto: aceita lançamentos de novo e o cartão precisa ser confirmado outra vez.
    expect(() => receita(BANCO_A, `${MES}-20`, 10, 'Doação esquecida')).not.toThrow()
    expect(screen.getByText('Aguardando confirmação')).toBeInTheDocument()
    // O Administrador também fecha: o botão espera o checklist.
    expect(screen.getByRole('button', { name: 'Fechar período' })).toBeDisabled()
  })

  it('fora da janela o botão fica desabilitado; o Tesoureiro altera a janela nas Configurações', async () => {
    prepararMes()
    bancoFechamento.confirmarCartao(tesoureira, MES)
    hojeNoDia(15)
    expect(() => bancoFechamento.fechar(tesoureira, MES, '')).toThrow(/do dia 1 ao dia 7/)
    const usuario = userEvent.setup()
    renderizar('u-tesoureiro', '/fechamento')

    expect(await screen.findByText('Fora da janela de fechamento')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fechar período' })).toBeDisabled()

    // Configurações: o Tesoureiro vê só a janela de fechamento.
    await usuario.click(screen.getByRole('link', { name: 'Alterar janela' }))
    expect(await screen.findByRole('heading', { name: 'Janela de fechamento' })).toBeInTheDocument()
    expect(screen.getByText('Do dia 1 ao dia 7')).toBeInTheDocument()
    await usuario.click(screen.getByRole('combobox', { name: 'Primeiro dia' }))
    await usuario.click(await screen.findByRole('option', { name: '12' }))
    await usuario.click(screen.getByRole('combobox', { name: 'Último dia' }))
    await usuario.click(await screen.findByRole('option', { name: '20' }))
    expect(screen.getByText('A janela tem no máximo 7 dias.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar janela' })).toBeDisabled()
    await usuario.click(screen.getByRole('combobox', { name: 'Último dia' }))
    await usuario.click(await screen.findByRole('option', { name: '18' }))
    await usuario.click(screen.getByRole('button', { name: 'Salvar janela' }))
    expect(await screen.findByText('Janela alterada: do dia 12 ao dia 18 de cada mês.')).toBeInTheDocument()
    expect(screen.getByText(/Alterada por Carla Tesoureira/)).toBeInTheDocument()

    await usuario.click(screen.getByRole('link', { name: 'Voltar às Configurações' }))
    expect(await screen.findByRole('link', { name: /Janela de fechamento/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Valor da mensalidade/ })).not.toBeInTheDocument()

    // Dentro da nova janela o fechamento é liberado.
    await usuario.click(screen.getByRole('link', { name: 'Fechamento mensal' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Fechar período' })).toBeEnabled())
  })
})
