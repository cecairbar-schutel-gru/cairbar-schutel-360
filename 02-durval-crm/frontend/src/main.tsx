import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { authService } from './auth'
import { AuthProvider } from './auth/AuthProvider'
import { ErroInicializacao } from './app/ErroInicializacao'
import { ProvedorTema } from './app/ProvedorTema'
import { criarRoteador } from './app/rotas'
import { alinharHojeAoServidor } from './shared/formatters/datas'

async function iniciar() {
  const raiz = createRoot(document.getElementById('root')!)

  // Dados simulados (MSW) em desenvolvimento; no build de produção, backend e Keycloak reais.
  if (import.meta.env.VITE_USAR_MOCKS !== 'false') {
    const { worker } = await import('./mocks/browser')
    await worker.start({ onUnhandledFrame: 'bypass' })
  } else {
    // "Hoje" das telas igual ao do servidor (data simulada de DEV); sem resposta, fica o do navegador.
    try {
      const resposta = await fetch('/api/publico/relogio', { headers: { Accept: 'application/json' } })
      if (resposta.ok) alinharHojeAoServidor(((await resposta.json()) as { hoje: string }).hoje)
    } catch {
      // segue com o relógio do navegador
    }
  }

  // Antes do roteador: o retorno do login chega na URL e é limpo pelo Keycloak.
  let loginConcluido: boolean
  try {
    loginConcluido = await authService.iniciar()
  } catch {
    raiz.render(
      <StrictMode>
        <ProvedorTema>
          <ErroInicializacao />
        </ProvedorTema>
      </StrictMode>,
    )
    return
  }

  raiz.render(
    <StrictMode>
      <ProvedorTema>
        <AuthProvider loginConcluido={loginConcluido}>
          <RouterProvider router={criarRoteador()} />
        </AuthProvider>
      </ProvedorTema>
    </StrictMode>,
  )
}

void iniciar()
