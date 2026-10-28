package com.durvalcrm.relatorio.adapter.out.exportacao;

import com.durvalcrm.relatorio.application.DocumentoExportacao;
import com.durvalcrm.relatorio.application.DocumentoExportacao.Coluna;
import com.durvalcrm.relatorio.application.DocumentoExportacao.Filtro;
import com.durvalcrm.relatorio.application.DocumentoExportacao.Formato;
import com.durvalcrm.relatorio.application.DocumentoExportacao.Secao;
import com.durvalcrm.relatorio.application.ExportadorPort.Emissao;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.io.Writer;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import java.io.OutputStreamWriter;

/**
 * Planilha .xlsx (Office Open XML) escrita direto no ZIP, linha a linha, sem biblioteca externa
 * (US-REPORT-021): uma aba por seção, com organização, título, período, geração e filtros no topo,
 * uma linha por registro, valores numéricos e datas como números formatados e a linha de totais.
 */
final class PlanilhaXlsx {

    private static final DateTimeFormatter DATA_HORA = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final LocalDate EPOCA_EXCEL = LocalDate.of(1899, 12, 30);

    // Índices de cellXfs em styles.xml.
    private static final int NEGRITO = 1;
    private static final int TITULO = 10;
    private static final int CABECALHO = 11;
    private static final int NOTA = 12;

    private PlanilhaXlsx() {
    }

    static byte[] gerar(DocumentoExportacao documento, Emissao emissao) {
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(saida, StandardCharsets.UTF_8)) {
            List<String> abas = nomesDasAbas(documento.secoes());
            Writer w = new OutputStreamWriter(zip, StandardCharsets.UTF_8);
            entrada(zip, w, "[Content_Types].xml", tiposDeConteudo(abas.size()));
            entrada(zip, w, "_rels/.rels", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\
                    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>\
                    </Relationships>""");
            entrada(zip, w, "xl/workbook.xml", livro(abas));
            entrada(zip, w, "xl/_rels/workbook.xml.rels", relacoesDoLivro(abas.size()));
            entrada(zip, w, "xl/styles.xml", ESTILOS);
            for (int i = 0; i < documento.secoes().size(); i++) {
                zip.putNextEntry(new ZipEntry("xl/worksheets/sheet" + (i + 1) + ".xml"));
                aba(w, documento, documento.secoes().get(i), emissao);
                w.flush();
                zip.closeEntry();
            }
            w.flush();
        } catch (IOException e) {
            throw new UncheckedIOException("Falha ao gerar a planilha do relatório.", e);
        }
        return saida.toByteArray();
    }

    private static void aba(Writer w, DocumentoExportacao d, Secao s, Emissao emissao) throws IOException {
        int n = s.colunas().size();
        w.write("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>");
        w.write("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">");
        w.write("<cols>");
        for (int i = 0; i < n; i++) {
            w.write("<col min=\"" + (i + 1) + "\" max=\"" + (i + 1) + "\" width=\"" + largura(s, i)
                    + "\" customWidth=\"1\"/>");
        }
        w.write("</cols><sheetData>");
        int r = 0;
        r = linhaDeTexto(w, r, emissao.organizacao(), NEGRITO);
        r = linhaDeTexto(w, r, d.titulo() + " — " + s.titulo(), TITULO);
        r = linhaDeTexto(w, r, "Período: " + d.periodo(), 0);
        r = linhaDeTexto(w, r, "Gerado em " + DATA_HORA.format(emissao.em().atZone(emissao.zona())) + " por "
                + emissao.usuario(), 0);
        for (Filtro f : d.filtros()) {
            r = linhaDeTexto(w, r, f.rotulo() + ": " + f.valor(), 0);
        }
        r++;
        r++;
        w.write("<row r=\"" + r + "\">");
        for (int i = 0; i < n; i++) {
            celulaTexto(w, ref(i, r), s.colunas().get(i).titulo(), CABECALHO);
        }
        w.write("</row>");
        for (List<Object> l : s.linhas()) {
            r++;
            linha(w, r, l, s.colunas(), false);
        }
        if (s.total() != null) {
            r++;
            linha(w, r, s.total(), s.colunas(), true);
        }
        r++;
        for (String nota : s.notas()) {
            r = linhaDeTexto(w, r, nota, NOTA);
        }
        w.write("</sheetData></worksheet>");
    }

    private static int linhaDeTexto(Writer w, int r, String texto, int estilo) throws IOException {
        int linha = r + 1;
        w.write("<row r=\"" + linha + "\">");
        celulaTexto(w, "A" + linha, texto, estilo);
        w.write("</row>");
        return linha;
    }

    private static void linha(Writer w, int r, List<Object> celulas, List<Coluna> colunas, boolean total)
            throws IOException {
        w.write("<row r=\"" + r + "\">");
        for (int i = 0; i < colunas.size(); i++) {
            Object v = i < celulas.size() ? celulas.get(i) : null;
            if (v == null) {
                continue;
            }
            Formato f = colunas.get(i).formato();
            String ref = ref(i, r);
            if (v instanceof LocalDate data) {
                w.write("<c r=\"" + ref + "\" s=\"" + (total ? 9 : 8) + "\"><v>"
                        + ChronoUnit.DAYS.between(EPOCA_EXCEL, data) + "</v></c>");
            } else if (Formatos.numero(v) != null) {
                BigDecimal numero = Formatos.numero(v);
                int estilo = switch (f) {
                    case MOEDA -> 2;
                    case PERCENTUAL -> 6;
                    default -> 4;
                };
                w.write("<c r=\"" + ref + "\" s=\"" + (estilo + (total ? 1 : 0)) + "\"><v>" + numero.toPlainString()
                        + "</v></c>");
            } else {
                celulaTexto(w, ref, String.valueOf(v), total ? NEGRITO : 0);
            }
        }
        w.write("</row>");
    }

    private static void celulaTexto(Writer w, String ref, String texto, int estilo) throws IOException {
        w.write("<c r=\"" + ref + "\" t=\"inlineStr\"" + (estilo == 0 ? "" : " s=\"" + estilo + "\"")
                + "><is><t xml:space=\"preserve\">" + xml(texto) + "</t></is></c>");
    }

    private static int largura(Secao s, int coluna) {
        int maior = s.colunas().get(coluna).titulo().length();
        for (List<Object> l : s.linhas()) {
            Object v = coluna < l.size() ? l.get(coluna) : null;
            maior = Math.max(maior, Formatos.texto(v, s.colunas().get(coluna).formato()).length());
            if (maior >= 60) {
                break;
            }
        }
        return Math.max(10, Math.min(60, maior + 2));
    }

    private static String ref(int coluna, int linha) {
        StringBuilder letras = new StringBuilder();
        int c = coluna + 1;
        while (c > 0) {
            int resto = (c - 1) % 26;
            letras.insert(0, (char) ('A' + resto));
            c = (c - 1) / 26;
        }
        return letras.toString() + linha;
    }

    /** Até 31 caracteres, sem []:*?/\ e sem repetir. */
    private static List<String> nomesDasAbas(List<Secao> secoes) {
        List<String> nomes = new ArrayList<>();
        Set<String> usados = new HashSet<>();
        for (Secao s : secoes) {
            String base = s.titulo().replaceAll("[\\[\\]:*?/\\\\]", " ").trim();
            if (base.isEmpty()) {
                base = "Dados";
            }
            base = base.length() > 31 ? base.substring(0, 31).trim() : base;
            String nome = base;
            for (int i = 2; !usados.add(nome.toLowerCase()); i++) {
                String sufixo = " (" + i + ")";
                nome = (base.length() + sufixo.length() > 31 ? base.substring(0, 31 - sufixo.length()) : base) + sufixo;
            }
            nomes.add(nome);
        }
        if (nomes.isEmpty()) {
            nomes.add("Dados");
        }
        return nomes;
    }

    private static String tiposDeConteudo(int abas) {
        StringBuilder s = new StringBuilder("""
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\
                <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\
                <Default Extension="xml" ContentType="application/xml"/>\
                <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>\
                <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>""");
        for (int i = 1; i <= abas; i++) {
            s.append("<Override PartName=\"/xl/worksheets/sheet").append(i)
                    .append(".xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>");
        }
        return s.append("</Types>").toString();
    }

    private static String livro(List<String> abas) {
        StringBuilder s = new StringBuilder("""
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" \
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>""");
        for (int i = 0; i < abas.size(); i++) {
            s.append("<sheet name=\"").append(xml(abas.get(i))).append("\" sheetId=\"").append(i + 1)
                    .append("\" r:id=\"rId").append(i + 1).append("\"/>");
        }
        return s.append("</sheets></workbook>").toString();
    }

    private static String relacoesDoLivro(int abas) {
        StringBuilder s = new StringBuilder("""
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">""");
        for (int i = 1; i <= abas; i++) {
            s.append("<Relationship Id=\"rId").append(i)
                    .append("\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet")
                    .append(i).append(".xml\"/>");
        }
        s.append("<Relationship Id=\"rId").append(abas + 1)
                .append("\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>");
        return s.append("</Relationships>").toString();
    }

    private static void entrada(ZipOutputStream zip, Writer w, String nome, String conteudo) throws IOException {
        zip.putNextEntry(new ZipEntry(nome));
        w.write(conteudo);
        w.flush();
        zip.closeEntry();
    }

    private static String xml(String s) {
        StringBuilder r = new StringBuilder(s.length());
        for (char c : s.toCharArray()) {
            switch (c) {
                case '&' -> r.append("&amp;");
                case '<' -> r.append("&lt;");
                case '>' -> r.append("&gt;");
                case '"' -> r.append("&quot;");
                default -> {
                    if (c >= 0x20 || c == '\t' || c == '\n' || c == '\r') {
                        r.append(c);
                    }
                }
            }
        }
        return r.toString();
    }

    /**
     * 0 padrão; 1 negrito; 2/3 moeda (normal/negrito); 4/5 inteiro; 6/7 percentual (o valor já vem em
     * %, ex.: 45,3); 8/9 data; 10 título; 11 cabeçalho da tabela; 12 nota.
     */
    private static final String ESTILOS = """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\
            <numFmts count="3">\
            <numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00;-&quot;R$&quot; #,##0.00"/>\
            <numFmt numFmtId="165" formatCode="0.0&quot;%&quot;"/>\
            <numFmt numFmtId="166" formatCode="dd/mm/yyyy"/>\
            </numFmts>\
            <fonts count="4">\
            <font><sz val="11"/><name val="Calibri"/></font>\
            <font><b/><sz val="11"/><name val="Calibri"/></font>\
            <font><b/><sz val="14"/><name val="Calibri"/></font>\
            <font><i/><sz val="10"/><color rgb="FF555555"/><name val="Calibri"/></font>\
            </fonts>\
            <fills count="3">\
            <fill><patternFill patternType="none"/></fill>\
            <fill><patternFill patternType="gray125"/></fill>\
            <fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF3"/><bgColor indexed="64"/></patternFill></fill>\
            </fills>\
            <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>\
            <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>\
            <cellXfs count="13">\
            <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>\
            <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>\
            <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>\
            <xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>\
            <xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>\
            <xf numFmtId="3" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>\
            <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>\
            <xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>\
            <xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>\
            <xf numFmtId="166" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>\
            <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>\
            <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>\
            <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>\
            </cellXfs>\
            <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>\
            </styleSheet>""";
}
