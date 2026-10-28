import { describe, expect, it } from 'vitest'
import {
  decodificarArquivo,
  detectarFormato,
  lerCsv,
  lerDataExtrato,
  lerOfx,
  lerValorExtrato,
  separarCsv,
  sugerirColunas,
  temCabecalho,
} from './leitorExtrato'

const OFX_SGML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
CHARSET:1252

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>001<ACCTID>56789-0</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20261001120000[-3:BRT]
<DTEND>20261015120000[-3:BRT]
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261005120000[-3:BRT]
<TRNAMT>-100.00
<FITID>2026100501
<MEMO>PAGTO CONTA ENERGIA
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261010
<TRNAMT>50,00
<FITID>2026101002
<NAME>DEP DINHEIRO
<MEMO>AG 1234
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>945.00<DTASOF>20261015</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`

const OFX_XML = `<?xml version="1.0" encoding="UTF-8"?><?OFX OFXHEADER="200" VERSION="220"?>
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>FEE</TRNTYPE><DTPOSTED>20261015</DTPOSTED><TRNAMT>-5.00</TRNAMT><FITID>X1</FITID>
<NAME>TARIFA &amp; PACOTE</NAME></STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

describe('leitura do extrato', () => {
  it('lê datas e valores nos formatos dos bancos', () => {
    expect(lerDataExtrato('05/10/2026')).toBe('2026-10-05')
    expect(lerDataExtrato('5/10/26')).toBe('2026-10-05')
    expect(lerDataExtrato('2026-10-05T10:00')).toBe('2026-10-05')
    expect(lerDataExtrato('20261005120000[-3:BRT]')).toBe('2026-10-05')
    expect(lerDataExtrato('31/02/2026')).toBeNull()
    expect(lerDataExtrato('Data')).toBeNull()
    expect(lerValorExtrato('-1.234,56')).toBe(-1234.56)
    expect(lerValorExtrato('1,234.56')).toBe(1234.56)
    expect(lerValorExtrato('R$ 10,00')).toBe(10)
    expect(lerValorExtrato('(45,00)')).toBe(-45)
    expect(lerValorExtrato('100,00 D')).toBe(-100)
    expect(lerValorExtrato('100,00 C')).toBe(100)
    expect(lerValorExtrato('12.5')).toBe(12.5)
    expect(lerValorExtrato('-')).toBeNull()
    expect(lerValorExtrato('abc')).toBeNull()
  })

  it('lê o OFX em SGML com saldo, período e FITID', () => {
    expect(detectarFormato('extrato.txt', OFX_SGML)).toBe('OFX')
    const ofx = lerOfx(OFX_SGML)
    expect(ofx.linhas).toEqual([
      {
        data: '2026-10-05',
        descricao: 'PAGTO CONTA ENERGIA',
        valor: -100,
        identificador: '2026100501',
      },
      {
        data: '2026-10-10',
        descricao: 'DEP DINHEIRO · AG 1234',
        valor: 50,
        identificador: '2026101002',
      },
    ])
    expect(ofx).toMatchObject({
      saldoFinal: 945,
      dataSaldo: '2026-10-15',
      dataInicio: '2026-10-01',
      dataFim: '2026-10-15',
      conta: '56789-0',
    })
  })

  it('lê o OFX em XML e recusa o que não é OFX', () => {
    expect(lerOfx(OFX_XML).linhas).toEqual([
      {
        data: '2026-10-15',
        descricao: 'TARIFA & PACOTE',
        valor: -5,
        identificador: 'X1',
      },
    ])
    expect(lerOfx(OFX_XML).saldoFinal).toBeNull()
    expect(() => lerOfx('Data;Valor')).toThrow(/não parece um OFX/)
  })

  it('decodifica Windows-1252 quando o arquivo não é UTF-8', () => {
    const latin1 = new Uint8Array([
      0x48, 0x69, 0x73, 0x74, 0xf3, 0x72, 0x69, 0x63, 0x6f,
    ]) // "Histórico"
    expect(decodificarArquivo(latin1.buffer)).toBe('Histórico')
    expect(
      decodificarArquivo(
        new TextEncoder().encode('﻿Ação').buffer as ArrayBuffer,
      ),
    ).toBe('Ação')
  })

  it('lê o CSV com cabeçalho, sugere as colunas e ignora linhas de saldo', () => {
    const tabela = separarCsv(
      'Data;Histórico;Documento;Valor\r\n01/10/2026;SALDO ANTERIOR;;1.000,00\r\n05/10/2026;"PAGTO; ENERGIA";123;-100,00\r\n10/10/2026;DEP DINHEIRO;;50,00\r\n11/10/2026;SEM VALOR;;x\r\n',
    )
    expect(detectarFormato('extrato.csv', 'Data;Valor')).toBe('CSV')
    expect(temCabecalho(tabela)).toBe(true)
    const mapa = sugerirColunas(tabela)
    expect(mapa).toEqual({ data: 0, descricao: 1, valor: 3, saida: null })
    const r = lerCsv(tabela, mapa, { cabecalho: true, ignorarSaldos: true })
    expect(r.linhas).toEqual([
      {
        data: '2026-10-05',
        descricao: 'PAGTO; ENERGIA',
        valor: -100,
        identificador: null,
      },
      {
        data: '2026-10-10',
        descricao: 'DEP DINHEIRO',
        valor: 50,
        identificador: null,
      },
    ])
    expect(r.saldosIgnorados).toBe(1)
    expect(r.erros).toEqual(['Linha 5: valor não reconhecido.'])
  })

  it('lê o CSV com colunas de crédito e débito separadas', () => {
    const tabela = separarCsv(
      'Data,Descrição,Crédito,Débito\n05/10/2026,Energia,,100.00\n10/10/2026,Depósito,50.00,\n',
    )
    const mapa = sugerirColunas(tabela)
    expect(mapa).toEqual({ data: 0, descricao: 1, valor: 2, saida: 3 })
    expect(
      lerCsv(tabela, mapa, { cabecalho: true, ignorarSaldos: true }).linhas.map(
        (l) => l.valor,
      ),
    ).toEqual([-100, 50])
  })

  it('sem cabeçalho, acha a data e o valor pelo conteúdo', () => {
    const tabela = separarCsv(
      '05/10/2026\tEnergia\t-100,00\n10/10/2026\tDepósito\t50,00',
    )
    expect(temCabecalho(tabela)).toBe(false)
    expect(sugerirColunas(tabela)).toEqual({
      data: 0,
      descricao: 1,
      valor: 2,
      saida: null,
    })
  })
})
