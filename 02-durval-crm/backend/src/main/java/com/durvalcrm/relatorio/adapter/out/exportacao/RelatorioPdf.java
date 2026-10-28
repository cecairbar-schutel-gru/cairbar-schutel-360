package com.durvalcrm.relatorio.adapter.out.exportacao;

import com.durvalcrm.relatorio.application.DocumentoExportacao;
import com.durvalcrm.relatorio.application.DocumentoExportacao.Coluna;
import com.durvalcrm.relatorio.application.DocumentoExportacao.Formato;
import com.durvalcrm.relatorio.application.DocumentoExportacao.Secao;
import com.durvalcrm.relatorio.application.ExportadorPort.Emissao;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPageContentStream.AppendMode;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;

/**
 * PDF dos relatórios (US-REPORT-021): A4 paisagem, logotipo e nome da organização, título, período,
 * data, hora e usuário da geração em toda página; filtros na primeira; tabelas com o cabeçalho
 * repetido a cada página, linha de totais em negrito e "Página x de y" no rodapé.
 */
final class RelatorioPdf {

    private static final float MM = 72f / 25.4f;
    private static final PDRectangle PAGINA = new PDRectangle(PDRectangle.A4.getHeight(), PDRectangle.A4.getWidth());
    private static final float MARGEM = 12 * MM;
    private static final float TAMANHO = 7.5f;
    private static final float LINHA = 11.5f;
    private static final float FOLGA = 4f;
    private static final DateTimeFormatter DATA_HORA = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final byte[] LOGO = carregarLogo();

    private final PDFont normal = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    private final PDFont negrito = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
    private final DocumentoExportacao documento;
    private final Emissao emissao;
    private final PDDocument pdf = new PDDocument();
    private PDImageXObject logo;
    private PDPageContentStream cs;
    private float y;

    private RelatorioPdf(DocumentoExportacao documento, Emissao emissao) {
        this.documento = documento;
        this.emissao = emissao;
    }

    static byte[] gerar(DocumentoExportacao documento, Emissao emissao) {
        return new RelatorioPdf(documento, emissao).desenhar();
    }

    private byte[] desenhar() {
        try (pdf; ByteArrayOutputStream saida = new ByteArrayOutputStream()) {
            byte[] imagem = emissao.logo() != null ? emissao.logo() : LOGO;
            logo = imagem == null ? null : PDImageXObject.createFromByteArray(pdf, imagem, "logo");
            novaPagina();
            filtros();
            for (Secao s : documento.secoes()) {
                secao(s);
            }
            cs.close();
            rodapes();
            pdf.save(saida);
            return saida.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException("Falha ao gerar o PDF do relatório.", e);
        }
    }

    private void novaPagina() throws IOException {
        if (cs != null) {
            cs.close();
        }
        PDPage pagina = new PDPage(PAGINA);
        pdf.addPage(pagina);
        cs = new PDPageContentStream(pdf, pagina);
        float topo = PAGINA.getHeight() - MARGEM;
        float x = MARGEM;
        if (logo != null) {
            float altura = 26;
            float largura = altura * logo.getWidth() / logo.getHeight();
            cs.drawImage(logo, MARGEM, topo - altura, largura, altura);
            x += largura + 8;
        }
        texto(negrito, 9, x, topo - 9, emissao.organizacao());
        texto(negrito, 13, x, topo - 23, documento.titulo());
        String gerado = "Gerado em " + DATA_HORA.format(emissao.em().atZone(emissao.zona())) + " por " + emissao.usuario();
        texto(normal, 8, PAGINA.getWidth() - MARGEM - largura(normal, 8, gerado), topo - 9, gerado);
        String periodo = "Período: " + documento.periodo();
        texto(normal, 9, PAGINA.getWidth() - MARGEM - largura(normal, 9, periodo), topo - 23, periodo);
        y = topo - 32;
        cs.setLineWidth(0.6f);
        cs.moveTo(MARGEM, y);
        cs.lineTo(PAGINA.getWidth() - MARGEM, y);
        cs.stroke();
        y -= 10;
    }

    private void filtros() throws IOException {
        if (documento.filtros().isEmpty()) {
            return;
        }
        String linha = "Filtros: " + documento.filtros().stream().map(f -> f.rotulo() + ": " + f.valor())
                .collect(Collectors.joining("  ·  "));
        for (String parte : quebrar(linha, normal, 8, util())) {
            texto(normal, 8, MARGEM, y, parte);
            y -= 11;
        }
        y -= 4;
    }

    private void secao(Secao s) throws IOException {
        float[] larguras = larguras(s);
        if (y - 14 - 2 * LINHA < MARGEM + 12) {
            novaPagina();
        }
        texto(negrito, 10, MARGEM, y, s.titulo());
        y -= 6;
        cabecalho(s, larguras);
        if (s.linhas().isEmpty()) {
            linha(List.of("Nenhum registro."), List.of(Coluna.texto("")), new float[] {util()}, false);
        }
        for (List<Object> l : s.linhas()) {
            linha(l, s.colunas(), larguras, false);
        }
        if (s.total() != null) {
            linha(s.total(), s.colunas(), larguras, true);
        }
        y -= 4;
        for (String nota : s.notas()) {
            for (String parte : quebrar(nota, normal, 7, util())) {
                if (y - 10 < MARGEM + 12) {
                    novaPagina();
                }
                cs.setNonStrokingColor(0.35f);
                texto(normal, 7, MARGEM, y - 7, parte);
                cs.setNonStrokingColor(0f);
                y -= 10;
            }
        }
        y -= 12;
    }

    private void cabecalho(Secao s, float[] larguras) throws IOException {
        float altura = LINHA + 2;
        cs.setNonStrokingColor(0.92f);
        cs.addRect(MARGEM, y - altura, soma(larguras), altura);
        cs.fill();
        cs.setNonStrokingColor(0f);
        float x = MARGEM;
        for (int i = 0; i < s.colunas().size(); i++) {
            Coluna c = s.colunas().get(i);
            String t = cortar(c.titulo(), negrito, larguras[i] - 2 * FOLGA);
            float tx = numerica(c) ? x + larguras[i] - FOLGA - largura(negrito, TAMANHO, t) : x + FOLGA;
            texto(negrito, TAMANHO, tx, y - altura + 4, t);
            x += larguras[i];
        }
        y -= altura;
    }

    private void linha(List<Object> celulas, List<Coluna> colunas, float[] larguras, boolean total) throws IOException {
        if (y - LINHA < MARGEM + 12) {
            novaPagina();
        }
        PDFont fonte = total ? negrito : normal;
        if (total) {
            cs.setLineWidth(0.6f);
            cs.moveTo(MARGEM, y);
            cs.lineTo(MARGEM + soma(larguras), y);
            cs.stroke();
        }
        float x = MARGEM;
        for (int i = 0; i < colunas.size(); i++) {
            Coluna c = colunas.get(i);
            Object valor = i < celulas.size() ? celulas.get(i) : null;
            String t = cortar(Formatos.texto(valor, c.formato()), fonte, larguras[i] - 2 * FOLGA);
            float tx = numerica(c) ? x + larguras[i] - FOLGA - largura(fonte, TAMANHO, t) : x + FOLGA;
            texto(fonte, TAMANHO, tx, y - LINHA + 3.5f, t);
            x += larguras[i];
        }
        y -= LINHA;
        cs.setStrokingColor(0.88f);
        cs.setLineWidth(0.3f);
        cs.moveTo(MARGEM, y);
        cs.lineTo(MARGEM + soma(larguras), y);
        cs.stroke();
        cs.setStrokingColor(0f);
    }

    /** Largura natural de cada coluna; se não couber, as de texto encolhem (e o texto é cortado). */
    private float[] larguras(Secao s) {
        int n = s.colunas().size();
        float[] w = new float[n];
        List<List<Object>> todas = new ArrayList<>(s.linhas());
        if (s.total() != null) {
            todas.add(s.total());
        }
        for (int i = 0; i < n; i++) {
            Coluna c = s.colunas().get(i);
            float maior = largura(negrito, TAMANHO, c.titulo());
            for (List<Object> l : todas) {
                Object v = i < l.size() ? l.get(i) : null;
                maior = Math.max(maior, largura(negrito, TAMANHO, Formatos.texto(v, c.formato())));
            }
            w[i] = Math.min(maior, 260) + 2 * FOLGA;
        }
        float total = soma(w);
        if (total > util()) {
            float numericas = 0;
            float textos = 0;
            for (int i = 0; i < n; i++) {
                if (numerica(s.colunas().get(i))) {
                    numericas += w[i];
                } else {
                    textos += w[i];
                }
            }
            float sobra = util() - numericas;
            float fator = textos > 0 && sobra > 0 ? sobra / textos : util() / total;
            for (int i = 0; i < n; i++) {
                if (textos == 0 || sobra <= 0 || !numerica(s.colunas().get(i))) {
                    w[i] *= fator;
                }
            }
        }
        return w;
    }

    private void rodapes() throws IOException {
        int total = pdf.getNumberOfPages();
        for (int i = 0; i < total; i++) {
            try (PDPageContentStream r = new PDPageContentStream(pdf, pdf.getPage(i), AppendMode.APPEND, true, true)) {
                String pagina = "Página " + (i + 1) + " de " + total;
                String esquerda = emissao.organizacao() + " · " + documento.titulo();
                escrever(r, normal, 7, MARGEM, MARGEM - 2, cortar(esquerda, normal, util() - 80));
                escrever(r, normal, 7, PAGINA.getWidth() - MARGEM - largura(normal, 7, pagina), MARGEM - 2, pagina);
            }
        }
    }

    private static boolean numerica(Coluna c) {
        return c.formato() != Formato.TEXTO && c.formato() != Formato.DATA;
    }

    private static float util() {
        return PAGINA.getWidth() - 2 * MARGEM;
    }

    private static float soma(float[] w) {
        float s = 0;
        for (float v : w) {
            s += v;
        }
        return s;
    }

    private void texto(PDFont fonte, float tamanho, float x, float yy, String s) throws IOException {
        escrever(cs, fonte, tamanho, x, yy, s);
    }

    private static void escrever(PDPageContentStream c, PDFont fonte, float tamanho, float x, float yy, String s)
            throws IOException {
        c.beginText();
        c.setFont(fonte, tamanho);
        c.newLineAtOffset(x, yy);
        c.showText(seguro(fonte, s));
        c.endText();
    }

    private static String cortar(String s, PDFont fonte, float limite) {
        if (largura(fonte, TAMANHO, s) <= limite) {
            return s;
        }
        String t = s;
        while (!t.isEmpty() && largura(fonte, TAMANHO, t + "...") > limite) {
            t = t.substring(0, t.length() - 1);
        }
        return t + "...";
    }

    private static List<String> quebrar(String texto, PDFont fonte, float tamanho, float limite) {
        List<String> linhas = new ArrayList<>();
        StringBuilder atual = new StringBuilder();
        for (String palavra : texto.split(" ")) {
            String tentativa = atual.isEmpty() ? palavra : atual + " " + palavra;
            if (largura(fonte, tamanho, tentativa) <= limite || atual.isEmpty()) {
                atual = new StringBuilder(tentativa);
            } else {
                linhas.add(atual.toString());
                atual = new StringBuilder(palavra);
            }
        }
        linhas.add(atual.toString());
        return linhas;
    }

    private static float largura(PDFont fonte, float tamanho, String s) {
        try {
            return fonte.getStringWidth(seguro(fonte, s)) / 1000 * tamanho;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Troca o sinal de menos tipográfico e o que a codificação WinAnsi da fonte padrão não tem. */
    private static String seguro(PDFont fonte, String s) {
        StringBuilder r = new StringBuilder();
        s.replace('−', '-').replace(' ', ' ').codePoints().forEach(cp -> {
            String c = new String(Character.toChars(cp));
            try {
                fonte.encode(c);
                r.append(c);
            } catch (IllegalArgumentException | IOException e) {
                r.append('?');
            }
        });
        return r.toString();
    }

    private static byte[] carregarLogo() {
        try (InputStream in = RelatorioPdf.class.getResourceAsStream("/recibo/logo.png")) {
            return in == null ? null : in.readAllBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
