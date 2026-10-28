import { formatarMoeda } from '../../shared/formatters/formatadores'
import { paraCentavos, paraReais } from '../../shared/pagamento/regras'
import type { Anexo, Categoria, TipoCategoria } from './types'

/** US-FINANCIAL-010: motivo do estorno com pelo menos 10 caracteres. */
export const MINIMO_MOTIVO_ESTORNO = 10
export const MAXIMO_ANEXO_BYTES = 5 * 1024 * 1024
export const TIPOS_ANEXO = ['application/pdf', 'image/jpeg', 'image/png']

const brl = (valor: number) => formatarMoeda(valor).replace(/ /g, ' ')

/** Líquido da liquidação: bruto − taxa, em centavos inteiros. */
export function liquidoDaLiquidacao(bruto: number, taxa: number): number {
  return paraReais(paraCentavos(bruto) - paraCentavos(taxa))
}

/**
 * Mesmas regras do servidor (US-FINANCIAL-004): taxa ≥ 0 e menor que o bruto; bruto até o saldo
 * de Cartão a receber.
 */
export function erroLiquidacao(
  bruto: number | null,
  taxa: number | null,
  saldoCartao: number,
): { campo: 'bruto' | 'taxa'; mensagem: string } | null {
  if (bruto === null || Number.isNaN(bruto) || bruto <= 0) return { campo: 'bruto', mensagem: 'Informe um valor maior que zero.' }
  if (paraCentavos(bruto) > paraCentavos(saldoCartao)) {
    return { campo: 'bruto', mensagem: `O bruto de ${brl(bruto)} excede o saldo de Cartão a receber de ${brl(saldoCartao)}.` }
  }
  if (taxa === null || Number.isNaN(taxa) || taxa < 0) return { campo: 'taxa', mensagem: 'Informe a taxa (pode ser zero).' }
  if (paraCentavos(taxa) >= paraCentavos(bruto)) return { campo: 'taxa', mensagem: 'A taxa deve ser menor que o valor bruto.' }
  return null
}

/** "2026-10" → "Outubro/2026". */
export function nomeDoMes(mes: string): string {
  const [ano, m] = mes.split('-').map(Number)
  const nome = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(ano, m - 1, 1))
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)}/${ano}`
}

/** Categorias-mãe do tipo com ao menos uma subcategoria que passa no filtro. */
export function categoriasMae(categorias: Categoria[], tipo: TipoCategoria, filtro: (c: Categoria) => boolean): Categoria[] {
  return categorias.filter(
    (mae) => mae.categoriaPai === null && mae.tipo === tipo && categorias.some((s) => s.categoriaPai === mae.codigo && filtro(s)),
  )
}

export function subcategorias(categorias: Categoria[], mae: string, filtro: (c: Categoria) => boolean): Categoria[] {
  return categorias.filter((s) => s.categoriaPai === mae && filtro(s))
}

export function erroAnexo(arquivo: File): string | null {
  if (!TIPOS_ANEXO.includes(arquivo.type)) return 'O anexo deve ser PDF, JPG ou PNG.'
  if (arquivo.size === 0 || arquivo.size > MAXIMO_ANEXO_BYTES) return 'O anexo deve ter até 5 MB.'
  return null
}

export async function lerAnexo(arquivo: File): Promise<Anexo> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  let binario = ''
  for (const b of bytes) binario += String.fromCharCode(b)
  return { nome: arquivo.name, tipo: arquivo.type, conteudoBase64: btoa(binario) }
}
