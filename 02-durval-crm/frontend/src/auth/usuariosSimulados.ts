import type { Usuario } from './tipos'

export const USUARIOS_SIMULADOS: Usuario[] = [
  { id: 'u-operador', nome: 'Ana Operadora', papeis: ['operador'] },
  { id: 'u-vendedor', nome: 'Bruno Vendedor', papeis: ['vendedor'] },
  { id: 'u-pdv', nome: 'Fábio PDV', papeis: ['pdv'] },
  { id: 'u-tesoureiro', nome: 'Carla Tesoureira', papeis: ['tesoureiro'] },
  { id: 'u-admin', nome: 'Daniel Administrador', papeis: ['administrador'] },
  {
    id: 'u-multi',
    nome: 'Eva Operadora e Administradora',
    papeis: ['operador', 'administrador'],
  },
]
