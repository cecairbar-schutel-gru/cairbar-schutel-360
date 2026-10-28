/**
 * Planilha .xlsx mínima (ZIP sem compressão, células de texto em linha e números como números),
 * para a exportação simulada dos relatórios. A planilha real é gerada pelo backend.
 */
export type CelulaPlanilha = string | number | null

export function planilhaSimples(abas: { nome: string; linhas: CelulaPlanilha[][] }[]): Uint8Array {
  const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const coluna = (i: number) => {
    let s = ''
    for (let c = i + 1; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s
    return s
  }
  const arquivos: [string, string][] = [
    [
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
        '</Types>',
    ],
    [
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ],
    [
      'xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        abas.map((a, i) => `<sheet name="${xml(a.nome.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
        '</sheets></workbook>',
    ],
    [
      'xl/_rels/workbook.xml.rels',
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        '</Relationships>',
    ],
    ...abas.map((a, i): [string, string] => [
      `xl/worksheets/sheet${i + 1}.xml`,
      '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
        a.linhas
          .map(
            (linha, r) =>
              `<row r="${r + 1}">` +
              linha
                .map((v, c) => {
                  const ref = `${coluna(c)}${r + 1}`
                  if (v === null || v === '') return ''
                  return typeof v === 'number' ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${xml(v)}</t></is></c>`
                })
                .join('') +
              '</row>',
          )
          .join('') +
        '</sheetData></worksheet>',
    ]),
  ]
  return zipSemCompressao(arquivos.map(([nome, conteudo]) => [nome, new TextEncoder().encode(conteudo)]))
}

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(dados: Uint8Array): number {
  let c = 0xffffffff
  for (const b of dados) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function zipSemCompressao(arquivos: [string, Uint8Array][]): Uint8Array {
  const partes: Uint8Array[] = []
  const central: Uint8Array[] = []
  let deslocamento = 0
  for (const [nome, dados] of arquivos) {
    const n = new TextEncoder().encode(nome)
    const crc = crc32(dados)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x0800, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, dados.length, true)
    local.setUint32(22, dados.length, true)
    local.setUint16(26, n.length, true)
    partes.push(new Uint8Array(local.buffer), n, dados)
    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014b50, true)
    c.setUint16(4, 20, true)
    c.setUint16(6, 20, true)
    c.setUint16(8, 0x0800, true)
    c.setUint32(16, crc, true)
    c.setUint32(20, dados.length, true)
    c.setUint32(24, dados.length, true)
    c.setUint16(28, n.length, true)
    c.setUint32(42, deslocamento, true)
    central.push(new Uint8Array(c.buffer), n)
    deslocamento += 30 + n.length + dados.length
  }
  const tamanhoCentral = central.reduce((s, p) => s + p.length, 0)
  const fim = new DataView(new ArrayBuffer(22))
  fim.setUint32(0, 0x06054b50, true)
  fim.setUint16(8, arquivos.length, true)
  fim.setUint16(10, arquivos.length, true)
  fim.setUint32(12, tamanhoCentral, true)
  fim.setUint32(16, deslocamento, true)
  const todas = [...partes, ...central, new Uint8Array(fim.buffer)]
  const saida = new Uint8Array(todas.reduce((s, p) => s + p.length, 0))
  let i = 0
  for (const p of todas) {
    saida.set(p, i)
    i += p.length
  }
  return saida
}
