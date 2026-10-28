import { paraReais } from '../../shared/pagamento/regras'
import type { FormatoExtrato, LinhaExtratoLida } from './types'

/**
 * Leitura do extrato do banco no navegador: OFX (SGML 1.x ou XML 2.x) e CSV exportado do internet
 * banking. O resultado são linhas normalizadas (data ISO, valor com sinal: + entra, − sai) que vão
 * para o servidor; nada do arquivo é enviado além disso.
 */

export class ErroLeituraExtrato extends Error {}

/** Extratos de bancos brasileiros costumam vir em Windows-1252; UTF-8 inválido cai nele. */
export function decodificarArquivo(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true })
      .decode(bytes)
      .replace(/^﻿/, '')
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

export function detectarFormato(
  nomeArquivo: string,
  texto: string,
): FormatoExtrato {
  if (
    /\.ofx$/i.test(nomeArquivo) ||
    /<OFX>/i.test(texto) ||
    /^\s*OFXHEADER/i.test(texto)
  )
    return 'OFX'
  return 'CSV'
}

const dataValida = (a: number, m: number, d: number) => {
  const data = new Date(a, m - 1, d)
  return (
    a >= 1900 &&
    data.getFullYear() === a &&
    data.getMonth() === m - 1 &&
    data.getDate() === d
  )
}
const iso = (a: number, m: number, d: number) =>
  dataValida(a, m, d)
    ? `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    : null

/** dd/mm/aaaa, dd/mm/aa, dd-mm-aaaa, dd.mm.aaaa, aaaa-mm-dd ou aaaammdd (com hora opcional) → ISO. */
export function lerDataExtrato(texto: string): string | null {
  const t = texto.trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t)
  if (m) return iso(+m[1], +m[2], +m[3])
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s|$|T)/.exec(t + ' ')
  if (m) {
    const ano = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    return iso(ano, +m[2], +m[1])
  }
  m = /^(\d{4})(\d{2})(\d{2})/.exec(t)
  if (m) return iso(+m[1], +m[2], +m[3])
  return null
}

/**
 * Valor do extrato em reais: "-1.234,56", "1,234.56", "-12.5", "(45,00)", "R$ 10,00", "100,00 D"
 * (débito) ou "100,00 C". Nulo se não for um valor.
 */
export function lerValorExtrato(texto: string): number | null {
  let t = texto.trim().replace(/\s+/g, ' ')
  if (!t) return null
  let negativo = false
  const sufixo = /\s*([DC])$/i.exec(t)
  if (sufixo) {
    negativo = sufixo[1].toUpperCase() === 'D'
    t = t.slice(0, sufixo.index)
  }
  if (/^\(.*\)$/.test(t)) {
    negativo = true
    t = t.slice(1, -1)
  }
  t = t.replace(/R\$/i, '').replace(/\s/g, '')
  if (/^[-−]/.test(t)) {
    negativo = !negativo
    t = t.slice(1)
  } else if (t.startsWith('+')) {
    t = t.slice(1)
  }
  if (/[-−]$/.test(t)) {
    negativo = !negativo
    t = t.slice(0, -1)
  }
  if (!/^[\d.,]+$/.test(t)) return null
  const virgula = t.lastIndexOf(',')
  const ponto = t.lastIndexOf('.')
  let normalizado: string
  if (virgula >= 0 && ponto >= 0) {
    // O último separador é o decimal.
    normalizado =
      virgula > ponto
        ? t.replace(/\./g, '').replace(',', '.')
        : t.replace(/,/g, '')
  } else if (virgula >= 0) {
    normalizado =
      t.match(/,/g)!.length > 1 ? t.replace(/,/g, '') : t.replace(',', '.')
  } else {
    normalizado =
      t.match(/\./g) && t.match(/\./g)!.length > 1 ? t.replace(/\./g, '') : t
  }
  if (!/^\d+(\.\d+)?$/.test(normalizado)) return null
  const centavos = Math.round(Number(normalizado) * 100)
  return paraReais(negativo ? -centavos : centavos)
}

// OFX

export interface ExtratoOfx {
  linhas: LinhaExtratoLida[]
  /** LEDGERBAL: saldo do extrato e a data dele. */
  saldoFinal: number | null
  dataSaldo: string | null
  /** BANKTRANLIST: período coberto. */
  dataInicio: string | null
  dataFim: string | null
  conta: string | null
}

/** Valor de um elemento OFX dentro de um trecho (SGML sem fechamento ou XML). */
function campoOfx(trecho: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i').exec(trecho)
  const valor = m?.[1].trim()
  return valor ? desfazerEntidades(valor) : null
}

const desfazerEntidades = (t: string) =>
  t
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

export function lerOfx(texto: string): ExtratoOfx {
  if (!/<OFX>/i.test(texto))
    throw new ErroLeituraExtrato(
      'O arquivo não parece um OFX: falta o bloco <OFX>.',
    )
  const blocos = texto
    .split(/<STMTTRN>/i)
    .slice(1)
    .map((b) => b.split(/<\/STMTTRN>/i)[0])
  const linhas: LinhaExtratoLida[] = []
  blocos.forEach((b, i) => {
    const data = lerDataExtrato(campoOfx(b, 'DTPOSTED') ?? '')
    const valor = lerValorExtrato(campoOfx(b, 'TRNAMT') ?? '')
    if (!data || valor === null) {
      throw new ErroLeituraExtrato(
        `Transação ${i + 1} do OFX sem data (DTPOSTED) ou valor (TRNAMT) válidos.`,
      )
    }
    if (valor === 0) return
    const nome = campoOfx(b, 'NAME')
    const memo = campoOfx(b, 'MEMO')
    const descricao =
      [nome, memo && memo !== nome ? memo : null].filter(Boolean).join(' · ') ||
      campoOfx(b, 'TRNTYPE') ||
      ''
    linhas.push({ data, descricao, valor, identificador: campoOfx(b, 'FITID') })
  })
  const saldo = texto.split(/<LEDGERBAL>/i)[1]
  const lista = texto.split(/<BANKTRANLIST>/i)[1] ?? ''
  return {
    linhas,
    saldoFinal: saldo ? lerValorExtrato(campoOfx(saldo, 'BALAMT') ?? '') : null,
    dataSaldo: saldo ? lerDataExtrato(campoOfx(saldo, 'DTASOF') ?? '') : null,
    dataInicio: lerDataExtrato(campoOfx(lista, 'DTSTART') ?? ''),
    dataFim: lerDataExtrato(campoOfx(lista, 'DTEND') ?? ''),
    conta: campoOfx(texto, 'ACCTID'),
  }
}

// CSV

/** Separa o CSV (`;`, `,` ou tabulação, o que aparecer mais na primeira linha), com aspas. */
export function separarCsv(texto: string): string[][] {
  const primeira = texto.split(/\r?\n/).find((l) => l.trim()) ?? ''
  const fora = primeira.replace(/"[^"]*"/g, '')
  const separador = [';', '\t', ','].reduce(
    (melhor, s) =>
      fora.split(s).length > fora.split(melhor).length ? s : melhor,
    ';',
  )
  const tabela: string[][] = []
  let linha: string[] = []
  let celula = ''
  let aspas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') {
        celula += '"'
        i++
      } else if (c === '"') aspas = false
      else celula += c
    } else if (c === '"') aspas = true
    else if (c === separador) {
      linha.push(celula)
      celula = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      linha.push(celula)
      tabela.push(linha)
      linha = []
      celula = ''
    } else celula += c
  }
  if (celula || linha.length > 0) {
    linha.push(celula)
    tabela.push(linha)
  }
  return tabela
    .map((l) => l.map((c) => c.trim()))
    .filter((l) => l.some((c) => c !== ''))
}

/**
 * Colunas do CSV. Com `saida`, o arquivo tem colunas separadas: `valor` são as entradas e `saida`
 * as saídas (o sinal vem da coluna).
 */
export interface MapeamentoCsv {
  data: number
  descricao: number
  valor: number
  saida: number | null
}

const sem = (t: string) =>
  t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** A primeira linha é cabeçalho quando nenhuma célula dela é uma data. */
export const temCabecalho = (tabela: string[][]) =>
  !!tabela[0] && !tabela[0].some((c) => lerDataExtrato(c) !== null)

/** Sugere as colunas pelo cabeçalho (Data, Histórico/Descrição, Valor, Crédito/Débito). */
export function sugerirColunas(tabela: string[][]): MapeamentoCsv {
  const largura = Math.max(...tabela.slice(0, 20).map((l) => l.length), 1)
  const cabecalho = temCabecalho(tabela) ? tabela[0].map(sem) : []
  const achar = (...termos: RegExp[]) => {
    for (const t of termos) {
      const i = cabecalho.findIndex((c) => t.test(c))
      if (i >= 0) return i
    }
    return -1
  }
  const amostra = tabela.slice(cabecalho.length ? 1 : 0, 21)
  const coluna = (teste: (c: string) => boolean) => {
    for (let i = 0; i < largura; i++)
      if (amostra.length > 0 && amostra.every((l) => teste(l[i] ?? '')))
        return i
    return -1
  }
  let data = achar(/^data/, /data/, /^dt/)
  if (data < 0) data = coluna((c) => lerDataExtrato(c) !== null)
  const entrada = achar(/credito/, /entrada/)
  const saida = achar(/debito/, /saida/)
  let valor = achar(/^valor/, /valor/, /quantia|montante/)
  const separadas = entrada >= 0 && saida >= 0 && valor < 0
  if (separadas) valor = entrada
  if (valor < 0) {
    for (let i = largura - 1; i >= 0; i--) {
      if (
        i !== data &&
        amostra.length > 0 &&
        amostra.every((l) => lerValorExtrato(l[i] ?? '') !== null)
      ) {
        valor = i
        break
      }
    }
  }
  let descricao = achar(
    /historico/,
    /descri/,
    /lancamento/,
    /memo|detalhe|observ/,
  )
  if (descricao < 0) {
    descricao =
      [...Array(largura).keys()].find(
        (i) => i !== data && i !== valor && i !== (separadas ? saida : -1),
      ) ?? 0
  }
  return {
    data: Math.max(data, 0),
    descricao,
    valor: Math.max(valor, 0),
    saida: separadas ? saida : null,
  }
}

export interface OpcoesCsv {
  cabecalho: boolean
  /** Linhas de saldo do banco ("SALDO ANTERIOR", "S A L D O") não são movimentos. */
  ignorarSaldos: boolean
}

export interface ResultadoCsv {
  linhas: LinhaExtratoLida[]
  /** Linhas que não puderam ser lidas, com o número no arquivo. */
  erros: string[]
  saldosIgnorados: number
}

const ehSaldo = (descricao: string) =>
  /^s\s?a\s?l\s?d\s?o\b/.test(sem(descricao).trim())

export function lerCsv(
  tabela: string[][],
  mapa: MapeamentoCsv,
  opcoes: OpcoesCsv,
): ResultadoCsv {
  const linhas: LinhaExtratoLida[] = []
  const erros: string[] = []
  let saldosIgnorados = 0
  tabela.forEach((celulas, i) => {
    if (opcoes.cabecalho && i === 0) return
    const numero = i + 1
    const descricao = (celulas[mapa.descricao] ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    if (opcoes.ignorarSaldos && ehSaldo(descricao)) {
      saldosIgnorados++
      return
    }
    const data = lerDataExtrato(celulas[mapa.data] ?? '')
    let valor: number | null
    if (mapa.saida === null) valor = lerValorExtrato(celulas[mapa.valor] ?? '')
    else {
      const entra = lerValorExtrato(celulas[mapa.valor] ?? '')
      const sai = lerValorExtrato(celulas[mapa.saida] ?? '')
      valor =
        entra === null && sai === null
          ? null
          : paraReais(
              Math.round(Math.abs(entra ?? 0) * 100) -
                Math.round(Math.abs(sai ?? 0) * 100),
            )
    }
    if (!data)
      erros.push(
        `Linha ${numero}: data “${celulas[mapa.data] ?? ''}” não reconhecida.`,
      )
    else if (valor === null)
      erros.push(`Linha ${numero}: valor não reconhecido.`)
    else if (valor !== 0)
      linhas.push({ data, descricao, valor, identificador: null })
  })
  return { linhas, erros, saldosIgnorados }
}
