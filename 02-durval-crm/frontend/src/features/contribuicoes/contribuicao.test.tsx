import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '../../auth/AuthProvider'
import { authSimulado } from '../../auth/authSimulado'
import { ProvedorTema } from '../../app/ProvedorTema'
import { criarRoteadorEmMemoria } from '../../app/rotas'
import { bancoContribuicoes } from '../../mocks/bancoContribuicoes'
import { bancoDoadores } from '../../mocks/bancoDoadores'
import { USUARIOS_SIMULADOS } from '../../auth/usuariosSimulados'

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

const operador = USUARIOS_SIMULADOS.find((u) => u.id === 'u-operador')!
const semEspacoDuro = (t: string | null) => (t ?? '').replace(/ /g, ' ')

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:recibo')
  URL.revokeObjectURL = vi.fn()
  HTMLAnchorElement.prototype.click = vi.fn()
})

describe('receber contribuição (Jornada A)', () => {
  it('quita as pendentes com PIX e cartão, classifica o excedente e emite o recibo', async () => {
    const usuario = userEvent.setup()
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null)
    renderizar('u-operador', '/contribuicoes/nova/1')

    expect(await screen.findByRole('heading', { name: 'João da Silva' })).toBeInTheDocument()
    const continuar = screen.getByRole('button', { name: 'Continuar' })
    // Nada vem pré-selecionado.
    expect(screen.getAllByRole('checkbox').every((c) => !(c as HTMLInputElement).checked)).toBe(true)
    // Cada caixa diz o que marca.
    expect(screen.getAllByRole('checkbox', { name: /^Pagar \d{2}\/\d{4}$/ }).length).toBeGreaterThan(0)
    await usuario.click(screen.getByRole('button', { name: 'Selecionar todas as pendentes' }))
    expect(semEspacoDuro(screen.getByText(/competências selecionadas/).textContent)).toContain('R$ 100,00')
    await usuario.click(continuar)

    // O PIX entra na conta de recebimento definida pelo Administrador.
    expect(await screen.findByText('Entra em Banco A.')).toBeInTheDocument()
    await usuario.type(screen.getByLabelText('PIX'), '70,00')
    await usuario.type(screen.getByLabelText('Cartão'), '50')
    await usuario.click(screen.getByRole('radio', { name: 'Débito' }))

    const revisar = screen.getByRole('button', { name: 'Revisar e confirmar' })
    expect(revisar).toBeDisabled()
    await usuario.click(screen.getByRole('checkbox', { name: /como doação extraordinária de João da Silva/ }))
    expect(revisar).toBeEnabled()
    await usuario.click(revisar)

    const dialogo = await screen.findByRole('dialog')
    expect(semEspacoDuro(dialogo.textContent)).toContain('Doação extraordinária')
    expect(semEspacoDuro(dialogo.textContent)).toContain('PIX — Banco A')
    expect(semEspacoDuro(dialogo.textContent)).toContain('Cartão de débito — ')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar recebimento' }))

    expect(await screen.findByText(/Contribuição registrada\. Recibo nº \d{4}-000001/)).toBeInTheDocument()
    expect(bancoContribuicoes.saldo(3)).toBe(70)
    expect(bancoContribuicoes.saldo(5)).toBe(50)
    expect(bancoDoadores.listarCompetencias(1).filter((c) => c.status === 'PENDENTE')).toHaveLength(0)

    // US-CONTRIB-010: canal com consentimento, mensagem editável e PDF baixado.
    const mensagem = await screen.findByLabelText('Mensagem de WhatsApp')
    expect((mensagem as HTMLTextAreaElement).value).toContain('Olá, João!')
    expect((mensagem as HTMLTextAreaElement).value).toMatch(/Recibo nº \d{4}-000001/)
    await usuario.click(screen.getByRole('button', { name: 'Abrir WhatsApp' }))
    expect(abrir).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/wa\.me\/5511987654321\?text=/), '_blank', 'noopener,noreferrer')
    await waitFor(() => expect(bancoContribuicoes.mensagensPreparadas).toHaveLength(1))
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('bloqueia a confirmação quando falta dinheiro', async () => {
    const usuario = userEvent.setup()
    renderizar('u-operador', '/contribuicoes/nova/1')

    await usuario.click(await screen.findByRole('button', { name: 'Selecionar todas as pendentes' }))
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }))
    await usuario.type(await screen.findByLabelText(/^Dinheiro/), '70')

    expect(
      semEspacoDuro((await screen.findByText(/no valor recebido/)).textContent),
    ).toContain('Faltam R$ 30,00 no valor recebido. Remova uma competência ou ajuste os valores.')
    expect(screen.getByRole('button', { name: 'Revisar e confirmar' })).toBeDisabled()
  })

  it('registra doação anônima sem doador e sem agradecimento', async () => {
    const usuario = userEvent.setup()
    renderizar('u-operador', '/contribuicoes/anonima')

    await usuario.type(await screen.findByLabelText(/^Dinheiro/), '15')
    await usuario.type(screen.getByLabelText('Observação (opcional)'), 'Caixa de ofertas')
    // Sem competências nesse fluxo: o resumo não mostra a linha delas.
    expect(within(screen.getByRole('table', { name: 'Resumo' })).queryByText('Competências selecionadas')).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Revisar e confirmar' }))
    await usuario.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar recebimento' }))

    expect(await screen.findByText(/Contribuição registrada/)).toBeInTheDocument()
    expect(screen.getAllByText('Doação anônima').length).toBeGreaterThan(0)
    expect(screen.queryByRole('heading', { name: 'Agradecer doador' })).not.toBeInTheDocument()
  })

  it('o Tesoureiro cancela com motivo e o recibo passa a mostrar o cancelamento', async () => {
    const { id } = bancoContribuicoes.registrar(
      {
        doadorId: 1,
        anonima: false,
        competencias: [bancoDoadores.listarCompetencias(1).find((c) => c.status === 'PENDENTE')!.competencia],
        valorDoacao: 0,
        pagamentos: [{ meio: 'DINHEIRO', valor: 50 }],
        observacao: '',
        chaveIdempotencia: 'k1',
      },
      operador,
    )
    const usuario = userEvent.setup()
    renderizar('u-tesoureiro', `/contribuicoes/${id}`)

    expect(await screen.findByText(/2ª via/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Cancelar contribuição' }))
    const dialogo = await screen.findByRole('dialog')
    const confirmar = within(dialogo).getByRole('button', { name: 'Cancelar contribuição' })
    await usuario.type(within(dialogo).getByLabelText(/Motivo/), 'curto')
    expect(confirmar).toBeDisabled()
    await usuario.type(within(dialogo).getByLabelText(/Motivo/), ' — lançada no doador errado')
    await usuario.click(confirmar)

    expect(await screen.findByText(/Cancelado em .* Motivo: curto — lançada no doador errado/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar contribuição' })).not.toBeInTheDocument()
    expect(bancoContribuicoes.saldo(1)).toBe(0)
  })

  it('o painel do Operador resume o dia e lista as últimas contribuições', async () => {
    bancoContribuicoes.registrar(
      {
        doadorId: 2,
        anonima: false,
        competencias: [],
        valorDoacao: 40,
        pagamentos: [
          { meio: 'DINHEIRO', valor: 25 },
          { meio: 'PIX', valor: 15 },
        ],
        observacao: '',
        chaveIdempotencia: 'k2',
      },
      operador,
    )
    renderizar('u-operador', '/')

    const tabela = await screen.findByRole('table', { name: 'Minhas últimas contribuições' })
    expect(tabela).toHaveTextContent('Maria Aparecida Souza')
    expect(screen.getByRole('button', { name: 'Doação anônima' })).toBeInTheDocument()
    // Intenções de gasto são pedidas pelo Vendedor.
    expect(screen.queryByRole('button', { name: 'Nova intenção de gasto' })).not.toBeInTheDocument()
  })

  it('o histórico do perfil lista as contribuições do ano com o total sem as canceladas', async () => {
    const registrar = (chave: string, valor: number) =>
      bancoContribuicoes.registrar(
        {
          doadorId: 1,
          anonima: false,
          competencias: [],
          valorDoacao: valor,
          pagamentos: [{ meio: 'DINHEIRO', valor }],
          observacao: '',
          chaveIdempotencia: chave,
        },
        operador,
      )
    registrar('a', 30)
    bancoContribuicoes.cancelar(registrar('b', 20).id, 'Valor digitado errado', operador)
    const usuario = userEvent.setup()
    renderizar('u-operador', '/doadores/1')

    await usuario.click(await screen.findByRole('tab', { name: 'Contribuições' }))
    const tabela = await screen.findByRole('table', { name: 'Contribuições do doador' })
    expect(within(tabela).getAllByRole('row')).toHaveLength(3)
    expect(tabela).toHaveTextContent('Valor digitado errado')
    expect(semEspacoDuro(screen.getByText(/Total contribuído em/).textContent)).toContain('R$ 30,00')
  })
})
