import type {
  AnonimizacaoDoador,
  AtualizacaoDoador,
  CadastroRapido,
  DadosDuplicidade,
  Doador,
  Endereco,
  InativacaoDoador,
  NotaDoador,
  PossivelDuplicata,
  ReativacaoDoador,
  ResultadoAniversariantes,
  ResumoDoador,
} from '../types'

/** Contrato do módulo Doadores; só a implementação muda ao integrar o backend. */
export interface DoadorService {
  buscar(termo: string): Promise<ResumoDoador[]>
  obter(id: number): Promise<Doador>
  verificarDuplicatas(dados: DadosDuplicidade): Promise<PossivelDuplicata[]>
  cadastrarRapido(dados: CadastroRapido): Promise<Doador>
  atualizar(id: number, dados: AtualizacaoDoador): Promise<Doador>
  inativar(id: number, dados: InativacaoDoador): Promise<Doador>
  reativar(id: number, dados: ReativacaoDoador): Promise<Doador>
  anonimizar(id: number, dados: AnonimizacaoDoador): Promise<Doador>
  listarNotas(id: number): Promise<NotaDoador[]>
  adicionarNota(id: number, texto: string): Promise<NotaDoador>
  listarAniversariantes(
    de: string,
    ate: string,
  ): Promise<ResultadoAniversariantes>
  consultarCep(cep: string): Promise<Endereco | null>
}
