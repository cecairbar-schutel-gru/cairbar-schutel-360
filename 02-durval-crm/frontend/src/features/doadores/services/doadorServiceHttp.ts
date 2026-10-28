import { requisitar } from '../../../shared/api/http'
import type { DoadorService } from './DoadorService'

export const doadorServiceHttp: DoadorService = {
  buscar: (termo) => requisitar('/doadores/busca', { consulta: { q: termo } }),
  obter: (id) => requisitar(`/doadores/${id}`),
  verificarDuplicatas: (dados) =>
    requisitar('/doadores/duplicatas', { metodo: 'POST', corpo: dados }),
  cadastrarRapido: (dados) =>
    requisitar('/doadores', { metodo: 'POST', corpo: dados }),
  atualizar: (id, dados) =>
    requisitar(`/doadores/${id}`, { metodo: 'PUT', corpo: dados }),
  inativar: (id, dados) =>
    requisitar(`/doadores/${id}/inativacao`, { metodo: 'POST', corpo: dados }),
  reativar: (id, dados) =>
    requisitar(`/doadores/${id}/reativacao`, { metodo: 'POST', corpo: dados }),
  anonimizar: (id, dados) =>
    requisitar(`/doadores/${id}/anonimizacao`, {
      metodo: 'POST',
      corpo: dados,
    }),
  listarNotas: (id) => requisitar(`/doadores/${id}/notas`),
  adicionarNota: (id, texto) =>
    requisitar(`/doadores/${id}/notas`, { metodo: 'POST', corpo: { texto } }),
  listarAniversariantes: (de, ate) =>
    requisitar('/doadores/aniversariantes', { consulta: { de, ate } }),
  consultarCep: (cep) => requisitar(`/enderecos/cep/${cep}`),
}
