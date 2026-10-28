/** `pdv` (grupo /pdv do realm): só o PDV da cantina. */
export type Papel = 'operador' | 'vendedor' | 'pdv' | 'tesoureiro' | 'administrador'

export const PAPEIS: readonly Papel[] = ['operador', 'vendedor', 'pdv', 'tesoureiro', 'administrador']

export const ROTULO_PAPEL: Record<Papel, string> = {
  operador: 'Operador',
  vendedor: 'Vendedor',
  pdv: 'PDV',
  tesoureiro: 'Tesoureiro',
  administrador: 'Administrador',
}

export interface Usuario {
  /** `sub` do token (keycloakSubject). */
  id: string
  nome: string
  papeis: Papel[]
}

/**
 * Contrato do provedor de identidade. `simulado` (desenvolvimento com MSW e testes) entra pelo
 * seletor de usuários; `keycloak` entra pelo realm cecairbar (Authorization Code + PKCE).
 */
export interface AuthService {
  readonly modo: 'simulado' | 'keycloak'
  /** Restaura a sessão e processa o retorno do login; `true` quando a página voltou de um login. */
  iniciar(): Promise<boolean>
  usuariosDisponiveis(): Usuario[]
  /** Só no modo simulado. */
  entrar(usuarioId: string): Usuario
  /** Só no modo keycloak: redireciona para o login e volta para `destino`. */
  redirecionarParaLogin(destino: string): Promise<void>
  sair(): Promise<void>
  usuarioAtual(): Usuario | null
  /** Access token válido (renovado perto de expirar) ou `null` sem sessão. */
  obterToken(): Promise<string | null>
}
