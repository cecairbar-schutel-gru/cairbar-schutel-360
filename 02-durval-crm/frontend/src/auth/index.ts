import { authKeycloak } from './authKeycloak'
import { authSimulado } from './authSimulado'
import type { AuthService } from './tipos'

export type { AuthService, Papel, Usuario } from './tipos'
export { ROTULO_PAPEL } from './tipos'

/** Com os mocks (desenvolvimento e testes) o login é simulado; no build de produção, Keycloak. */
export const authService: AuthService =
  import.meta.env.VITE_USAR_MOCKS === 'false' ? authKeycloak : authSimulado
