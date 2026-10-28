/**
 * BR Code do PIX estático (Manual de Padrões para Iniciação do PIX, Banco Central): payload EMV
 * "copia e cola" que vira o QR Code de cobrança do PDV da cantina.
 */

export interface DadosCobrancaPix {
  chave: string
  /** Nome do recebedor; vai sem acentos e cortado em 25 caracteres. */
  nome: string
  /** Cidade do recebedor; vai sem acentos e cortada em 15 caracteres. */
  cidade: string
  /** Em centavos; sem valor, quem paga digita o valor no app do banco. */
  valorCentavos?: number
  /** Identificador da cobrança (até 25 letras e números); sem ele vai "***". */
  txid?: string
}

const campo = (id: string, valor: string) => `${id}${String(valor.length).padStart(2, '0')}${valor}`

/** Sem acentos e só com os caracteres aceitos pelos bancos nos campos de texto do BR Code. */
export function textoPix(valor: string, maximo: number): string {
  return valor
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9 .,\-/]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximo)
    .trim()
}

/** CRC16-CCITT (polinômio 0x1021, inicial 0xFFFF), em 4 dígitos hexadecimais maiúsculos. */
export function crc16(payload: string): string {
  let crc = 0xffff
  for (const byte of new TextEncoder().encode(payload)) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function gerarPayloadPix({ chave, nome, cidade, valorCentavos, txid }: DadosCobrancaPix): string {
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', chave)
  const identificador = (txid ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'
  const semCrc =
    campo('00', '01') +
    campo('26', conta) +
    campo('52', '0000') +
    campo('53', '986') +
    (valorCentavos && valorCentavos > 0 ? campo('54', (valorCentavos / 100).toFixed(2)) : '') +
    campo('58', 'BR') +
    campo('59', textoPix(nome, 25)) +
    campo('60', textoPix(cidade, 15)) +
    campo('62', campo('05', identificador)) +
    '6304'
  return semCrc + crc16(semCrc)
}
