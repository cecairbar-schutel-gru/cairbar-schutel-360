import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthProvider'
import { ProvedorTema } from './ProvedorTema'
import { criarRoteadorEmMemoria } from './rotas'

function renderizar(entrada: string) {
  return render(
    <ProvedorTema>
      <AuthProvider>
        <RouterProvider router={criarRoteadorEmMemoria([entrada])} />
      </AuthProvider>
    </ProvedorTema>,
  )
}

describe('shell e rotas', () => {
  it('redireciona para o login e entra com o usuário simulado', async () => {
    const usuario = userEvent.setup()
    renderizar('/doadores')

    const seletor = await screen.findByLabelText('Usuário')
    await usuario.selectOptions(seletor, 'u-operador')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(
      await screen.findByRole('heading', { name: 'Buscar doador' }),
    ).toBeInTheDocument()
    const menu = screen.getByRole('navigation', { name: 'Menu lateral' })
    expect(menu).toHaveTextContent('Painel')
    expect(menu).toHaveTextContent('Doadores')
    expect(menu).toHaveTextContent('Aniversariantes')
    // Além do Painel, o Operador só vê o grupo Operação.
    expect(menu).not.toHaveTextContent('Estoque')
    expect(menu).not.toHaveTextContent('Vendas')
    expect(menu).not.toHaveTextContent('Tesouraria')
    expect(
      screen.getByRole('link', { name: 'Pular para o conteúdo' }),
    ).toHaveAttribute('href', '#conteudo-principal')
  })

  it('no tablet, esconde o menu lateral atrás do botão hambúrguer', async () => {
    const original = window.matchMedia
    window.matchMedia = (consulta: string) =>
      ({
        ...original(consulta),
        // Só a consulta "down('lg')" do shell bate (largura de tablet).
        matches: consulta.includes('max-width'),
      }) as MediaQueryList
    try {
      const usuario = userEvent.setup()
      renderizar('/doadores')
      await usuario.selectOptions(
        await screen.findByLabelText('Usuário'),
        'u-operador',
      )
      await usuario.click(screen.getByRole('button', { name: 'Entrar' }))
      await screen.findByRole('heading', { name: 'Buscar doador' })

      expect(
        screen.queryByRole('navigation', { name: 'Menu lateral' }),
      ).not.toBeInTheDocument()
      await usuario.click(screen.getByRole('button', { name: 'Abrir menu' }))
      const menu = await screen.findByRole('navigation', {
        name: 'Menu lateral',
      })
      await usuario.click(
        within(menu).getByRole('link', { name: 'Aniversariantes' }),
      )
      expect(
        await screen.findByRole('heading', { name: /aniversariantes/i }),
      ).toBeInTheDocument()
    } finally {
      window.matchMedia = original
    }
  })

  it('nega acesso a tela fora do perfil', async () => {
    const usuario = userEvent.setup()
    renderizar('/aniversariantes')

    await usuario.selectOptions(
      await screen.findByLabelText('Usuário'),
      'u-vendedor',
    )
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Acesso negado')).toBeInTheDocument()
  })
})
