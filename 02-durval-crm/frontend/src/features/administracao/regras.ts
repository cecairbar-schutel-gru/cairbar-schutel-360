import { formatarCompetencia } from '../../shared/formatters/datas'
import { apenasDigitos, formatarMoeda } from '../../shared/formatters/formatadores'
import { preencherModelo } from '../../shared/text/mensagens'
import { validarCpf, validarEmail } from '../../shared/validators/validadores'
import { deslocarMes } from '../editoras/regras'
import type { TipoChavePix } from './types'

export const MINIMO_MOTIVO_MENSALIDADE = 5
export const MAXIMO_LOGO_BYTES = 1024 * 1024
export const TIPOS_LOGO = ['image/png', 'image/jpeg']
export const LIMITES_MODELO = { whatsapp: 1000, emailAssunto: 200, emailCorpo: 4000 } as const

/** Dados de exemplo da pré-visualização dos modelos (US-ADMIN-003). */
export function dadosDeExemplo(organizacao: string): Record<string, string> {
  return {
    nome: 'Maria da Silva',
    valor: formatarMoeda(100),
    competencias: '10/2026 e 11/2026',
    data: '19/10/2026',
    recibo: '2026-000123',
    organizacao,
  }
}

export function preVisualizar(texto: string, organizacao: string): string {
  return preencherModelo(texto, dadosDeExemplo(organizacao))
}

/** Variáveis entre chaves que o modelo não aceita ("{doador}"). */
export function variaveisDesconhecidas(texto: string, aceitas: string[]): string[] {
  const encontradas = [...texto.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1])
  return [...new Set(encontradas.filter((v) => !aceitas.includes(v)))].map((v) => `{${v}}`)
}

/** O novo valor vale a partir do mês seguinte ao atual (US-ADMIN-002). */
export function primeiroMesPermitido(mesAtual: string): string {
  return deslocarMes(mesAtual, 1)
}

export function erroNovoValor(valor: number | null, vigenteDe: string, motivo: string, mesAtual: string, vigente: number): string | null {
  if (valor === null || !(valor > 0)) return 'Informe um valor maior que zero.'
  if (Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-6) return 'Informe o valor em reais e centavos.'
  if (Math.round(valor * 100) === Math.round(vigente * 100)) return 'O valor é igual ao vigente.'
  if (!/^\d{4}-\d{2}$/.test(vigenteDe) || vigenteDe <= mesAtual) {
    return `O novo valor vale a partir de ${formatarCompetencia(primeiroMesPermitido(mesAtual))} ou depois.`
  }
  if (motivo.trim().length < MINIMO_MOTIVO_MENSALIDADE) return 'Informe o motivo da alteração.'
  return null
}

/** Variação em relação ao mês anterior (nula sem base de comparação). */
export function variacaoPercentual(atual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return Math.round(((atual - anterior) / Math.abs(anterior)) * 100)
}

export function validarCnpj(valor: string): boolean {
  const d = apenasDigitos(valor)
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const digito = (pesos: number[]) => {
    const resto = pesos.reduce((s, p, i) => s + Number(d[i]) * p, 0) % 11
    return resto < 2 ? 0 : 11 - resto
  }
  return digito([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[12]) && digito([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[13])
}

export function formatarCnpj(valor: string | null | undefined): string {
  const d = apenasDigitos(valor ?? '')
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : (valor ?? '')
}

export function erroLogo(arquivo: File): string | null {
  if (!TIPOS_LOGO.includes(arquivo.type)) return 'Envie o logotipo em PNG ou JPG.'
  if (arquivo.size === 0 || arquivo.size > MAXIMO_LOGO_BYTES) return 'O logotipo deve ter até 1 MB.'
  return null
}

export async function lerBase64(arquivo: File): Promise<string> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  let binario = ''
  for (const b of bytes) binario += String.fromCharCode(b)
  return btoa(binario)
}

export function erroPlanilha(arquivo: File): string | null {
  if (!/\.(csv|txt)$/i.test(arquivo.name)) return 'Envie a planilha em CSV (no Excel: Arquivo › Salvar como › CSV).'
  if (arquivo.size === 0) return 'O arquivo está vazio.'
  if (arquivo.size > 5 * 1024 * 1024) return 'O arquivo deve ter até 5 MB.'
  return null
}

/** Chave como o DICT a guarda (o mesmo de `ChavePix` do backend). */
export function normalizarChavePix(tipo: TipoChavePix, valor: string): string {
  const v = valor.trim().replace(/\s+/g, ' ')
  if (tipo === 'CPF' || tipo === 'CNPJ') return apenasDigitos(v)
  if (tipo === 'EMAIL' || tipo === 'ALEATORIA') return v.toLowerCase()
  let d = apenasDigitos(v)
  if (d.startsWith('55') && d.length > 11) d = d.slice(2)
  return d ? `+55${d}` : ''
}

export function erroChavePix(tipo: TipoChavePix, valor: string): string | null {
  const chave = normalizarChavePix(tipo, valor)
  if (!chave) return 'Informe a chave PIX.'
  switch (tipo) {
    case 'CPF':
      return validarCpf(chave) ? null : 'CPF inválido.'
    case 'CNPJ':
      return validarCnpj(chave) ? null : 'CNPJ inválido.'
    case 'EMAIL':
      return chave.length <= 77 && validarEmail(chave) ? null : 'E-mail inválido.'
    case 'TELEFONE':
      return /^\+55\d{10,11}$/.test(chave) ? null : 'Telefone inválido. Informe DDD e 10 ou 11 dígitos.'
    case 'ALEATORIA':
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(chave) ? null : 'Chave aleatória inválida.'
  }
}

/** A cidade vai no BR Code sem acentos, em até 15 caracteres. */
export function erroCidadePix(valor: string): string | null {
  const cidade = valor.trim().replace(/\s+/g, ' ')
  if (!cidade) return 'Informe a cidade para o QR Code PIX.'
  return cidade.normalize('NFD').replace(/\p{M}/gu, '').length > 15 ? 'Use no máximo 15 caracteres.' : null
}
