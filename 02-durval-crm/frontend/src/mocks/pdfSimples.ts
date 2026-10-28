/**
 * PDF mínimo de uma página com linhas de texto (Helvetica, WinAnsi), para o recibo simulado.
 * O PDF real é gerado pelo backend.
 */
export function pdfSimples(linhas: string[], largura = 595, altura = 842): Uint8Array {
  return pdfPaginas([linhas], largura, altura, 11, 16)
}

/** O mesmo, com várias páginas (exportação simulada dos relatórios). */
export function pdfPaginas(paginas: string[][], largura = 595, altura = 842, tamanho = 11, entrelinha = 16): Uint8Array {
  const escapar = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`)
  const n = paginas.length
  // 1 catálogo, 2 páginas, 3 fonte; depois, para cada página, o objeto da página e o do conteúdo.
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${paginas.map((_, i) => `${4 + 2 * i} 0 R`).join(' ')}] /Count ${n} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ]
  paginas.forEach((linhas, i) => {
    const texto = linhas
      .map((l, j) => `BT /F1 ${tamanho} Tf 40 ${altura - 50 - j * entrelinha} Td (${escapar(l)}) Tj ET`)
      .join('\n')
    objetos.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${largura} ${altura}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + 2 * i} 0 R >>`)
    objetos.push(`<< /Length ${latin1(texto).length} >>\nstream\n${texto}\nendstream`)
  })
  let corpo = '%PDF-1.4\n'
  const deslocamentos: number[] = []
  objetos.forEach((o, i) => {
    deslocamentos.push(latin1(corpo).length)
    corpo += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = latin1(corpo).length
  corpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  corpo += deslocamentos.map((d) => `${String(d).padStart(10, '0')} 00000 n \n`).join('')
  corpo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return latin1(corpo)
}

/** Codificação de 1 byte por caractere; o que não cabe em Latin-1 vira "?". */
function latin1(s: string): Uint8Array {
  return Uint8Array.from([...s].map((c) => (c.charCodeAt(0) <= 0xff ? c.charCodeAt(0) : 0x3f)))
}
