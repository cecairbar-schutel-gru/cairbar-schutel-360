import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router-dom'
import { ProvedorTema } from '../../app/ProvedorTema'
import { criarRoteadorEmMemoria } from '../../app/rotas'
import { AuthProvider } from '../../auth/AuthProvider'
import { authSimulado } from '../../auth/authSimulado'
import { bancoEstoque } from '../../mocks/bancoEstoque'

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
const linha = (tabela: HTMLElement, texto: string) => within(tabela).getByText(texto).closest('tr') as HTMLElement

async function acaoDaLinha(usuario: ReturnType<typeof userEvent.setup>, produto: string, acao: string) {
  await usuario.click(await screen.findByRole('button', { name: `Ações de ${produto}` }))
  await usuario.click(await screen.findByRole('menuitem', { name: acao }))
}

describe('estoque (wireframe 10)', () => {
  it('lista a cantina e os livros com saldo próprio/consignado, última entrada, status e filtros', async () => {
    const usuario = userEvent.setup()
    renderizar('u-vendedor', '/estoque')

    const cantina = await screen.findByRole('table', { name: 'Produtos da cantina' })
    const cafe = linha(cantina, 'Café')
    expect(within(cafe).getByText('30')).toBeInTheDocument()
    expect(within(cafe).getByText('01/10/2026')).toBeInTheDocument()
    expect(within(cafe).getByText('Ativo')).toBeInTheDocument()
    // Inativo fica fora por padrão.
    expect(within(cantina).queryByText('Brigadeiro')).not.toBeInTheDocument()

    await usuario.click(screen.getByLabelText('Somente sem saldo'))
    await waitFor(() => expect(screen.getByRole('table', { name: 'Produtos da cantina' })).not.toHaveTextContent('Café'))
    expect(screen.getByRole('table', { name: 'Produtos da cantina' })).toHaveTextContent('Coxinha')

    await usuario.click(screen.getByRole('tab', { name: 'Livros consignados' }))
    const livros = await screen.findByRole('table', { name: 'Livros' })
    await usuario.click(screen.getByLabelText('Somente sem saldo'))
    await waitFor(() => expect(within(livros).getByText('O Caminho')).toBeInTheDocument())
    const caminho = linha(screen.getByRole('table', { name: 'Livros' }), 'O Caminho')
    // Saldo 8: nenhum próprio, 8 consignados (R-0001 e R-0002).
    expect(within(caminho).getAllByRole('cell').map((c) => c.textContent)).toEqual(
      expect.arrayContaining(['8', '0']),
    )

    await usuario.type(screen.getByLabelText('Buscar por título, autor ou ISBN'), '978-85-7328-655-7')
    await waitFor(() => expect(screen.getByRole('table', { name: 'Livros' })).not.toHaveTextContent('O Caminho'))
    expect(screen.getByRole('table', { name: 'Livros' })).toHaveTextContent('Nosso Lar')
  })

  it('pede baixa de consignado pela remessa FIFO e o Administrador aprova gerando a obrigação', async () => {
    const usuario = userEvent.setup()
    const { unmount } = renderizar('u-vendedor', '/estoque?aba=livros')

    await acaoDaLinha(usuario, 'O Caminho', 'Solicitar baixa')
    const dialogo = await screen.findByRole('dialog')
    // Sem estoque próprio: a remessa mais antiga vem pré-selecionada.
    expect(await within(dialogo).findByRole('combobox', { name: 'Lote' })).toHaveTextContent('Remessa R-0001 — 3 disponíveis')
    await usuario.click(within(dialogo).getByRole('combobox', { name: 'Motivo' }))
    await usuario.click(await screen.findByRole('option', { name: 'Dano' }))
    expect(within(dialogo).getByText(/gera, na aprovação, uma obrigação com a editora/)).toBeInTheDocument()
    await usuario.type(within(dialogo).getByLabelText(/Justificativa/), 'Capa rasgada')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Enviar para aprovação' }))

    expect(await screen.findByText(/Baixa de 1 unidade de O Caminho enviada para aprovação/)).toBeInTheDocument()
    // Pendente: o saldo não muda e aparece "aguardando baixa".
    expect(await screen.findByText('1 aguardando baixa')).toBeInTheDocument()
    expect(bancoEstoque.saldoLote(1, 1)).toBe(3)
    unmount()

    renderizar('u-admin', '/estoque/solicitacoes')
    const fila = await screen.findByRole('table', { name: 'Aprovações de estoque' })
    expect(fila).toHaveTextContent('Remessa R-0001 · saldo atual 3')
    expect(fila).toHaveTextContent('Bruno Vendedor')
    await usuario.click(within(fila).getByRole('button', { name: 'Aprovar pedido 1' }))
    expect(await screen.findByText('Pedido nº 1 aprovado.')).toBeInTheDocument()
    expect(await screen.findByText('Nenhum pedido pendente.')).toBeInTheDocument()
    expect(bancoEstoque.saldoLote(1, 1)).toBe(2)
    expect(bancoEstoque.listarObrigacoes()).toEqual([expect.objectContaining({ remessaId: 1, valor: 20 })])
  })

  it('bloqueia a aprovação se o saldo caiu e exige motivo para rejeitar', async () => {
    const usuario = userEvent.setup()
    const vendedor = { id: 'u-vendedor', nome: 'Bruno Vendedor', papeis: ['vendedor' as const] }
    bancoEstoque.solicitarBaixa({ produtoId: 10, remessaId: null, quantidade: 5, motivo: 'VENCIMENTO', justificativa: 'Venceu', foto: null }, vendedor)
    bancoEstoque.definirSaldo(10, null, 4)
    renderizar('u-admin', '/estoque/solicitacoes')

    const fila = await screen.findByRole('table', { name: 'Aprovações de estoque' })
    await usuario.click(within(fila).getByRole('button', { name: 'Aprovar pedido 1' }))
    expect(
      await screen.findByText('O saldo atual do lote é 4 e não cobre a baixa de 5. Rejeite ou peça uma nova solicitação.'),
    ).toBeInTheDocument()

    await usuario.click(within(fila).getByRole('button', { name: 'Rejeitar pedido 1' }))
    const dialogo = await screen.findByRole('dialog')
    const rejeitar = within(dialogo).getByRole('button', { name: 'Rejeitar' })
    expect(rejeitar).toBeDisabled()
    await usuario.type(within(dialogo).getByLabelText(/Motivo da rejeição/), 'Recontar o estoque')
    await usuario.click(rejeitar)
    expect(await screen.findByText('Pedido nº 1 rejeitado.')).toBeInTheDocument()
    expect(bancoEstoque.saldo(10)).toBe(4)
  })

  it('pede novo preço da cantina; o preço atual vale até a aprovação e entra no histórico', async () => {
    const usuario = userEvent.setup()
    const { unmount } = renderizar('u-vendedor', '/estoque/produtos/10')

    await usuario.click(await screen.findByRole('button', { name: 'Solicitar novo preço' }))
    const dialogo = await screen.findByRole('dialog')
    await usuario.type(within(dialogo).getByLabelText('Novo preço'), '4,20')
    expect(within(dialogo).getByText('Diferença: +20,0%')).toBeInTheDocument()
    await usuario.type(within(dialogo).getByLabelText(/Motivo/), 'Fornecedor reajustou')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Enviar para aprovação' }))
    expect(await screen.findByText('Pedido aguardando o Administrador')).toBeInTheDocument()
    expect(bancoEstoque.produto(10).preco).toBe(3.5)

    // Só um pedido de preço pendente por produto.
    await usuario.click(screen.getByRole('button', { name: 'Solicitar novo preço' }))
    const segundo = await screen.findByRole('dialog')
    await usuario.type(within(segundo).getByLabelText('Novo preço'), '4')
    await usuario.type(within(segundo).getByLabelText(/Motivo/), 'outro')
    await usuario.click(within(segundo).getByRole('button', { name: 'Enviar para aprovação' }))
    expect(await within(segundo).findByText('Já existe um pedido de preço pendente para este produto.')).toBeInTheDocument()
    unmount()

    const admin = renderizar('u-admin', '/estoque/solicitacoes')
    const fila = await screen.findByRole('table', { name: 'Aprovações de estoque' })
    expect(semEspacoDuro(fila.textContent)).toContain('R$ 3,50 → R$ 4,20')
    await usuario.click(within(fila).getByRole('button', { name: 'Aprovar pedido 1' }))
    expect(await screen.findByText('Pedido nº 1 aprovado.')).toBeInTheDocument()
    admin.unmount()

    renderizar('u-vendedor', '/estoque/produtos/10')
    const historico = await screen.findByRole('table', { name: 'Histórico de preços' })
    expect(semEspacoDuro(historico.textContent)).toContain('R$ 4,20')
    expect(historico).toHaveTextContent('Bruno Vendedor')
    expect(historico).toHaveTextContent('Daniel Administrador')
  })

  it('registra entrada por doação sem lançamento e o Administrador cancela com estorno', async () => {
    const usuario = userEvent.setup()
    const { unmount } = renderizar('u-vendedor', '/')

    await usuario.click(await screen.findByRole('button', { name: 'Entrada por doação' }))
    await usuario.type(await screen.findByLabelText(/Adicionar produto/), 'cafe')
    await usuario.click(await screen.findByRole('option', { name: 'Café (Bebidas)' }))
    const quantidade = screen.getByLabelText('Quantidade de Café')
    await usuario.clear(quantidade)
    await usuario.type(quantidade, '6')
    await usuario.type(screen.getByLabelText('Doador ou observação (opcional)'), 'Dona Maria')
    await usuario.click(screen.getByRole('button', { name: 'Registrar entrada' }))

    expect(await screen.findByText('Entrada nº 1 registrada. O estoque já foi atualizado.')).toBeInTheDocument()
    expect(bancoEstoque.saldo(10)).toBe(36)
    const recentes = await screen.findByRole('table', { name: 'Entradas por doação' })
    expect(recentes).toHaveTextContent('6 × Café')
    expect(recentes).toHaveTextContent('Dona Maria')
    unmount()

    renderizar('u-admin', '/estoque/entrada-doacao')
    const lista = await screen.findByRole('table', { name: 'Entradas por doação' })
    await usuario.click(within(lista).getByRole('button', { name: 'Cancelar' }))
    const dialogo = await screen.findByRole('dialog')
    await usuario.type(within(dialogo).getByLabelText(/Motivo/), 'Lançada em duplicidade')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar entrada' }))
    expect(await screen.findByText(/Entrada nº 1 cancelada/)).toBeInTheDocument()
    expect(bancoEstoque.saldo(10)).toBe(30)

    renderizar('u-admin', '/estoque/produtos/10')
    const movimentos = await screen.findByRole('table', { name: 'Movimentos' })
    const linhas = within(movimentos).getAllByRole('row')
    expect(linhas[1]).toHaveTextContent('Estorno')
    expect(linhas[1]).toHaveTextContent('−6')
    expect(linhas[1]).toHaveTextContent('30')
    expect(linhas[2]).toHaveTextContent('Entrada por doação (estornado)')
    expect(linhas[2]).toHaveTextContent('+6')
    expect(linhas[2]).toHaveTextContent('36')
  })

  it('cadastra produto da cantina com aviso de nome parecido e bloqueia correção após movimento', async () => {
    const usuario = userEvent.setup()
    renderizar('u-vendedor', '/estoque/produtos/novo?tipo=CANTINA')

    await usuario.type(await screen.findByLabelText(/^Nome/), 'Cafe com leite')
    expect(await screen.findByText(/Já existe produto com nome parecido/, {}, { timeout: 2000 })).toBeInTheDocument()
    await usuario.type(screen.getByLabelText(/Categoria/), 'Bebidas')
    await usuario.type(screen.getByLabelText('Preço de venda'), '5')
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar' }))

    expect(await screen.findByRole('heading', { name: 'Cafe com leite' })).toBeInTheDocument()
    expect(screen.getByText('Sem estoque. As unidades entram por compra, doação ou remessa.')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Editar cadastro' }))
    expect(await screen.findByRole('button', { name: 'Salvar alterações' })).toBeEnabled()

    // Com movimento, só o Administrador corrige.
    renderizar('u-vendedor', '/estoque/produtos/10/editar')
    expect(await screen.findByText('Correção só pelo Administrador')).toBeInTheDocument()
  })

  it('inativação: pedido avisa o saldo e a aprovação fica bloqueada até zerar', async () => {
    const usuario = userEvent.setup()
    const { unmount } = renderizar('u-vendedor', '/estoque/produtos/11')

    await usuario.click(await screen.findByRole('button', { name: 'Solicitar inativação' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText('Ainda há 12 unidades em estoque')).toBeInTheDocument()
    await usuario.type(within(dialogo).getByLabelText(/Motivo/), 'Não vendemos mais')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Enviar para aprovação' }))
    expect(await screen.findByText(/Pedido de inativação de Suco de laranja enviado/)).toBeInTheDocument()
    unmount()

    renderizar('u-admin', '/estoque/solicitacoes')
    const fila = await screen.findByRole('table', { name: 'Aprovações de estoque' })
    expect(fila).toHaveTextContent('Estoque atual: 12')
    await usuario.click(within(fila).getByRole('button', { name: 'Aprovar pedido 1' }))
    expect(await screen.findByText('Dê baixa ou venda as 12 unidades restantes antes de inativar.')).toBeInTheDocument()
    expect(bancoEstoque.produto(11).ativo).toBe(true)
  })

  it('mostra as solicitações e a decisão no painel do Vendedor', async () => {
    const vendedor = { id: 'u-vendedor', nome: 'Bruno Vendedor', papeis: ['vendedor' as const] }
    const admin = { id: 'u-admin', nome: 'Daniel Administrador', papeis: ['administrador' as const] }
    const { id } = bancoEstoque.solicitarPreco(12, 5.5, 'Custo subiu', vendedor)
    bancoEstoque.rejeitar(id, 'Manter o preço este mês', admin)
    renderizar('u-vendedor', '/')

    const minhas = await screen.findByRole('table', { name: 'Minhas solicitações' })
    expect(minhas).toHaveTextContent('Alteração de preço')
    expect(minhas).toHaveTextContent('Pão de queijo')
    expect(minhas).toHaveTextContent('Rejeitada')
    expect(minhas).toHaveTextContent('Manter o preço este mês')
  })

  it('o Administrador ajusta o estoque após contagem', async () => {
    const usuario = userEvent.setup()
    renderizar('u-admin', '/estoque/produtos/12')

    await usuario.click(await screen.findByRole('button', { name: 'Ajustar estoque' }))
    const dialogo = await screen.findByRole('dialog')
    await usuario.type(within(dialogo).getByLabelText(/Quantidade contada/), '18')
    expect(within(dialogo).getByText('Saldo no sistema: 20 · diferença -2')).toBeInTheDocument()
    await usuario.type(within(dialogo).getByLabelText(/Motivo/), 'Contagem de sábado')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar ajuste' }))
    expect(await screen.findByText('Estoque de Pão de queijo ajustado (-2).')).toBeInTheDocument()
    expect(bancoEstoque.saldo(12)).toBe(18)
    const movimentos = await screen.findByRole('table', { name: 'Movimentos' })
    expect(within(movimentos).getAllByRole('row')[1]).toHaveTextContent('Ajuste')
  })
})
