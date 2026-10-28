import { usuarioDasClaims } from './authKeycloak'

describe('usuário a partir do token do Keycloak', () => {
  it('lê as realm roles do DurvalCRM', () => {
    const usuario = usuarioDasClaims({
      sub: 'f3a1',
      name: 'Maria Souza',
      preferred_username: 'maria',
      realm_access: { roles: ['tesoureiro', 'operador', 'schutelista', 'bibliotecario', 'offline_access'] },
      resource_access: { 'durvalcrm-api': { roles: ['administrador'] } },
    })

    expect(usuario).toEqual({
      id: 'f3a1',
      nome: 'Maria Souza',
      papeis: ['operador', 'tesoureiro'],
    })
  })

  it('sem roles, o usuário fica sem papéis', () => {
    const usuario = usuarioDasClaims({ sub: 'b2', preferred_username: 'joao' })

    expect(usuario).toEqual({ id: 'b2', nome: 'joao', papeis: [] })
  })
})
