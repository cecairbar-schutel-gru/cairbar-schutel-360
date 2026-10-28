import { mensagemDetalhada } from '../../shared/api/http'
import { formatarMoeda } from '../../shared/formatters/formatadores'
import { paraReais } from '../../shared/pagamento/regras'

export {
  lerValor,
  novaChaveIdempotencia,
  paraCentavos,
  paraReais,
  resumirPagamento,
  type ResumoPagamento,
  type ValoresDigitados,
} from '../../shared/pagamento/regras'
export { mensagemDetalhada }

export function mensagemDeFalta(falta: number): string {
  return `Faltam ${formatarMoeda(paraReais(falta))} no valor recebido. Remova uma competência ou ajuste os valores.`
}

/** "09/2026, 10/2026" a partir de `AAAA-MM`. */
export function listarCompetencias(meses: string[]): string {
  return meses.map((m) => `${m.slice(5, 7)}/${m.slice(0, 4)}`).join(', ')
}
