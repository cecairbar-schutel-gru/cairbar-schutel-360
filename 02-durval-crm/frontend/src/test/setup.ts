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

// Os testes simulam uma tela de computador: as media queries mobile-first (`min-width`) do MUI
// valem até esta largura, e as de `max-width` abaixo dela não.
const LARGURA_TELA_TESTES = 1280
function atendeMedia(consulta: string): boolean {
  const condicoes = [...consulta.matchAll(/\((min|max)-width:\s*([\d.]+)px\)/g)]
  return (
    condicoes.length > 0 &&
    condicoes.every(([, tipo, px]) =>
      tipo === 'min'
        ? LARGURA_TELA_TESTES >= Number(px)
        : LARGURA_TELA_TESTES <= Number(px),
    )
  )
}

// jsdom não implementa estes recursos usados pelos componentes de UI (MUI).
if (!window.matchMedia) {
  window.matchMedia = (consulta: string) =>
    ({
      matches: atendeMedia(consulta),
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
