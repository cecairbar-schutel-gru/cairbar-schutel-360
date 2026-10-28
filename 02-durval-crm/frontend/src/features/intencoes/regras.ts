import { paraCentavos } from '../../shared/pagamento/regras'
import { MAXIMO_ANEXO_BYTES, MAXIMO_ANEXOS, type AnexoEnviado, type ItemCompra, type MeioPagamentoGasto } from './types'

const TIPOS_ANEXO = ['application/pdf', 'image/jpeg', 'image/png']

/** US-EXPENSE-001: até 5 arquivos PDF, JPG ou PNG de até 10 MB cada. */
export function erroAnexos(arquivos: File[]): string | null {
  if (arquivos.length > MAXIMO_ANEXOS) return 'Anexe no máximo 5 arquivos.'
  for (const a of arquivos) {
    if (!TIPOS_ANEXO.includes(a.type)) return `${a.name}: o anexo deve ser PDF, JPG ou PNG.`
    if (a.size === 0 || a.size > MAXIMO_ANEXO_BYTES) return `${a.name}: cada anexo deve ter até 10 MB.`
  }
  return null
}

export async function lerAnexo(arquivo: File): Promise<AnexoEnviado> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  let binario = ''
  for (const b of bytes) binario += String.fromCharCode(b)
  return { nome: arquivo.name, tipo: arquivo.type, conteudoBase64: btoa(binario) }
}

/** US-EXPENSE-004: ajuste de valor ou de categoria exige nota. */
export function exigeNota(valorSolicitado: number, valor: number | null, categoriaSolicitada: string, categoria: string): boolean {
  return (valor !== null && paraCentavos(valor) !== paraCentavos(valorSolicitado)) || categoria !== categoriaSolicitada
}

/** Dinheiro sai de um caixa; PIX, transferência e boleto, de uma conta bancária. */
export function tipoDeConta(meio: MeioPagamentoGasto): 'CAIXA' | 'BANCO' {
  return meio === 'DINHEIRO' ? 'CAIXA' : 'BANCO'
}

/** US-EXPENSE-006: tudo confere quando cada item recebido é igual ao aprovado. */
export function recebimentoConfere(itens: ItemCompra[], recebidas: Record<number, number | null>): boolean {
  return itens.every((i) => recebidas[i.produtoId] === i.quantidade)
}

export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
