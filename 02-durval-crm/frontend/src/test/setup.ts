import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { bancoAdministracao } from '../mocks/bancoAdministracao'
import { bancoConciliacoes } from '../mocks/bancoConciliacoes'
import { bancoContasPagar } from '../mocks/bancoContasPagar'
import { bancoContribuicoes } from '../mocks/bancoContribuicoes'
import { bancoDoadores } from '../mocks/bancoDoadores'
import { bancoEditoras } from '../mocks/bancoEditoras'
import { bancoEstoque } from '../mocks/bancoEstoque'
import { bancoFechamento } from '../mocks/bancoFechamento'
import { bancoFinanceiro } from '../mocks/bancoFinanceiro'
import { bancoIntencoes } from '../mocks/bancoIntencoes'
import { bancoVendas } from '../mocks/bancoVendas'
import { servidor } from '../mocks/servidor'

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  cleanup()
  servidor.resetHandlers()
  bancoDoadores.reiniciar()
  bancoContribuicoes.reiniciar()
  bancoFinanceiro.reiniciar()
  bancoVendas.reiniciar()
  bancoEstoque.reiniciar()
  bancoIntencoes.reiniciar()
  bancoEditoras.reiniciar()
  bancoConciliacoes.reiniciar()
  bancoFechamento.reiniciar()
  bancoAdministracao.reiniciar()
  bancoContasPagar.reiniciar()
  sessionStorage.clear()
  localStorage.clear()
})
afterAll(() => servidor.close())

// jsdom não implementa estes recursos usados pelos componentes de UI (MUI).
if (!window.matchMedia) {
  window.matchMedia = (consulta: string) =>
    ({
      matches: false,
      media: consulta,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
class ResizeObserverFalso {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver ??= ResizeObserverFalso as unknown as typeof ResizeObserver
Element.prototype.scrollIntoView ??= () => {}
