import { apenasDigitos } from '../formatters/formatadores'

export function preencherModelo(
  modelo: string,
  variaveis: Record<string, string>,
): string {
  return Object.entries(variaveis).reduce(
    (texto, [chave, valor]) => texto.replaceAll(`{${chave}}`, valor),
    modelo,
  )
}

/** Link `wa.me` com o telefone nacional prefixado com o DDI do Brasil. */
export function linkWhatsApp(telefone: string, texto: string): string {
  return `https://wa.me/55${apenasDigitos(telefone)}?text=${encodeURIComponent(texto)}`
}

export function linkEmail(endereco: string, assunto: string, corpo: string): string {
  return `mailto:${endereco}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`
}
