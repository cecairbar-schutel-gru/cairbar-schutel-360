import { formatarMoeda } from '../formatters/formatadores'

/** Cada meio entra na conta de recebimento definida pelo Administrador; cartão, em Cartão a receber. */
export type MeioPagamento = 'DINHEIRO' | 'PIX' | 'CARTAO'

export interface Conta {
  id: number
  nome: string
}

/**
 * Conta que recebe cada forma de pagamento, definida pelo Administrador; quem vende ou recebe não
 * escolhe conta. `dinheiro` ou `pix` nulos: a forma ainda não pode ser usada.
 */
export interface ContasDeRecebimento {
  dinheiro: Conta | null
  pix: Conta | null
  cartaoAReceber: Conta
}

/** Nome da conta que recebe o meio, para o resumo antes de confirmar. */
export function contaDoMeio(contas: ContasDeRecebimento, meio: MeioPagamento): string {
  if (meio === 'CARTAO') return contas.cartaoAReceber.nome
  return (meio === 'DINHEIRO' ? contas.dinheiro : contas.pix)?.nome ?? '—'
}

/**
 * Crédito ou débito no cartão (simulação de 27/10/2026, P9). Os dois entram em Cartão a receber;
 * o tipo vai ao comprovante, ao relatório de vendas e à liquidação. Registros antigos não têm tipo.
 */
export type TipoCartao = 'CREDITO' | 'DEBITO'

export const ROTULO_TIPO_CARTAO: Record<TipoCartao, string> = {
  CREDITO: 'Crédito',
  DEBITO: 'Débito',
}

export interface PagamentoInformado {
  meio: MeioPagamento
  valor: number
  /** Só no cartão; obrigatório nas novas operações. */
  tipoCartao?: TipoCartao | null
}

export const ROTULO_MEIO: Record<MeioPagamento, string> = {
  DINHEIRO: 'Dinheiro',
  PIX: 'PIX',
  CARTAO: 'Cartão',
}

/** "Cartão de crédito", "Cartão de débito" ou só "Cartão" quando o tipo não foi informado. */
export function rotuloPagamento(p: { meio: MeioPagamento; tipoCartao?: TipoCartao | null }): string {
  if (p.meio === 'CARTAO' && p.tipoCartao) return `Cartão de ${ROTULO_TIPO_CARTAO[p.tipoCartao].toLowerCase()}`
  return ROTULO_MEIO[p.meio]
}

/** Valores em centavos inteiros: nunca somar reais em ponto flutuante. */
export const paraCentavos = (reais: number) => Math.round(reais * 100)
export const paraReais = (centavos: number) => centavos / 100

/**
 * Lê um valor digitado ("70", "70,5", "1.234,56"). Devolve `null` se vazio e `NaN` se inválido
 * (negativo, mais de duas casas ou texto).
 */
export function lerValor(texto: string): number | null {
  const limpo = texto.trim().replace(/^R\$\s*/, '')
  if (!limpo) return null
  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo
  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) return Number.NaN
  return paraCentavos(Number(normalizado))
}

/**
 * Filtra o que é digitado ou colado num campo de valor: só dígitos e um separador decimal com até duas
 * casas ("R$ 35,00Luz" vira "35,00"). Com vírgula, os pontos são separadores de milhar e saem; sem
 * vírgula, o ponto é o separador decimal e vira vírgula.
 */
export function filtrarValorDigitado(texto: string): string {
  let limpo = texto.replace(/[^\d,.]/g, '')
  limpo = limpo.includes(',') ? limpo.replace(/\./g, '') : limpo.replace('.', ',').replace(/\./g, '')
  const [inteiro, ...resto] = limpo.split(',')
  return resto.length === 0 ? inteiro : `${inteiro},${resto.join('').slice(0, 2)}`
}

/** Centavos no formato digitado ("57,00"), para preencher um campo de valor. */
export function paraTextoDigitado(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',')
}

export interface ValoresDigitados {
  dinheiro: string
  pix: string
  cartao: string
  /** Crédito ou débito; vazio enquanto não escolhido. */
  tipoCartao: TipoCartao | ''
}

export const VALORES_VAZIOS: ValoresDigitados = { dinheiro: '', pix: '', cartao: '', tipoCartao: '' }

export const ERRO_TIPO_CARTAO = 'Informe se o cartão é de crédito ou de débito.'

/** Regra do servidor: tipo obrigatório no cartão e só no cartão. Devolve a mensagem do erro ou `null`. */
export function erroTipoCartao(pagamentos: Pick<PagamentoInformado, 'meio' | 'tipoCartao'>[]): string | null {
  if (pagamentos.some((p) => p.meio === 'CARTAO' && !p.tipoCartao)) return ERRO_TIPO_CARTAO
  if (pagamentos.some((p) => p.meio !== 'CARTAO' && p.tipoCartao)) return 'Crédito ou débito só se informa no pagamento em cartão.'
  return null
}

export interface ResumoPagamento {
  /** Total devido (centavos). */
  devido: number
  recebido: number
  /** recebido − devido; positivo é excedente, negativo é falta. */
  diferenca: number
  erros: string[]
  pagamentos: PagamentoInformado[]
}

/**
 * Valida cada valor e monta os pagamentos. A diferença entre recebido e devido é decidida por quem
 * chama (excedente a classificar na contribuição, bloqueio na venda).
 */
export function resumirPagamento(
  devido: number,
  valores: ValoresDigitados,
): ResumoPagamento {
  const erros: string[] = []
  const pagamentos: PagamentoInformado[] = []
  const adicionar = (meio: MeioPagamento, texto: string) => {
    const centavos = lerValor(texto)
    if (centavos === null) return
    if (Number.isNaN(centavos) || centavos <= 0) {
      erros.push(`Valor inválido em ${meio === 'CARTAO' ? 'cartão' : meio === 'PIX' ? 'PIX' : 'dinheiro'}: use valores positivos com até duas casas decimais.`)
      return
    }
    if (meio !== 'CARTAO') {
      pagamentos.push({ meio, valor: paraReais(centavos) })
      return
    }
    // Sem o tipo o valor ainda conta no recebido, mas a confirmação fica bloqueada.
    if (!valores.tipoCartao) erros.push(ERRO_TIPO_CARTAO)
    pagamentos.push({ meio, valor: paraReais(centavos), tipoCartao: valores.tipoCartao || null })
  }
  adicionar('DINHEIRO', valores.dinheiro)
  adicionar('PIX', valores.pix)
  adicionar('CARTAO', valores.cartao)
  const recebido = pagamentos.reduce((s, p) => s + paraCentavos(p.valor), 0)
  return { devido, recebido, diferenca: recebido - devido, erros, pagamentos }
}

export const brlCentavos = (centavos: number) => formatarMoeda(paraReais(centavos))

export function novaChaveIdempotencia(): string {
  return crypto.randomUUID()
}
