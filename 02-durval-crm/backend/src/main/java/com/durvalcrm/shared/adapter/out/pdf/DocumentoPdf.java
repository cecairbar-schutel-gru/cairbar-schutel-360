package com.durvalcrm.shared.adapter.out.pdf;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.List;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.apache.pdfbox.util.Matrix;

/**
 * Comprovantes em PDF (recibo de contribuição, comprovante de venda) nos formatos A4 e térmico de
 * 80 mm, com as fontes padrão do PDF (WinAnsi cobre o português), o logotipo no topo e, se
 * informada, uma marca d'água (ex.: "CANCELADO").
 */
public final class DocumentoPdf {

    private static final float MM = 72f / 25.4f;
    private static final byte[] LOGO = carregarLogo();

    public enum Estilo { TITULO, NEGRITO, NORMAL, PEQUENO, SEPARADOR }

    /** Linha lógica: texto à esquerda e, opcionalmente, um valor alinhado à direita. */
    public record Linha(Estilo estilo, String esquerda, String direita) {
        public static Linha de(Estilo e, String texto) { return new Linha(e, texto, null); }
        public static Linha valor(String rotulo, String valor) { return new Linha(Estilo.NORMAL, rotulo, valor); }
        public static Linha separador() { return new Linha(Estilo.SEPARADOR, "", null); }
    }

    /** Linha já quebrada na largura útil, pronta para desenhar. */
    private record Posta(Estilo estilo, String esquerda, String direita, PDFont fonte, float tamanho, float altura) {
    }

    private record Medidas(float largura, float margem, float tamanhoBase, float larguraLogo) {
        static Medidas de(boolean termica) {
            return termica
                    ? new Medidas(80 * MM, 4 * MM, 8, 50 * MM)
                    : new Medidas(PDRectangle.A4.getWidth(), 20 * MM, 11, 60 * MM);
        }
        float util() { return largura - 2 * margem; }
    }

    private DocumentoPdf() {
    }

    /** @param marcaDagua texto em diagonal sobre cada página, ou {@code null}. */
    public static byte[] gerar(List<Linha> conteudo, boolean termica, String marcaDagua) {
        return gerar(conteudo, termica, marcaDagua, null);
    }

    /** @param logo logotipo da organização (US-ADMIN-005); nulo usa o da instalação. */
    public static byte[] gerar(List<Linha> conteudo, boolean termica, String marcaDagua, byte[] logo) {
        byte[] imagemLogo = logo != null ? logo : LOGO;
        Medidas m = Medidas.de(termica);
        PDFont normal = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
        PDFont negrito = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
        List<Posta> linhas = quebrar(conteudo, m, normal, negrito);

        try (PDDocument doc = new PDDocument(); ByteArrayOutputStream saida = new ByteArrayOutputStream()) {
            PDImageXObject imagem = imagemLogo == null ? null : PDImageXObject.createFromByteArray(doc, imagemLogo, "logo");
            float alturaLogo = imagem == null ? 0 : m.larguraLogo() * imagem.getHeight() / imagem.getWidth();
            float alturaConteudo = linhas.stream().map(Posta::altura).reduce(0f, Float::sum);
            // Bobina térmica: a página tem exatamente a altura do conteúdo.
            float alturaPagina = termica ? alturaConteudo + alturaLogo + 2 * m.margem() + m.tamanhoBase()
                    : PDRectangle.A4.getHeight();

            PDPage pagina = novaPagina(doc, m.largura(), alturaPagina);
            PDPageContentStream cs = new PDPageContentStream(doc, pagina);
            float y = alturaPagina - m.margem();
            if (imagem != null) {
                y -= alturaLogo;
                cs.drawImage(imagem, (m.largura() - m.larguraLogo()) / 2, y, m.larguraLogo(), alturaLogo);
                y -= m.tamanhoBase();
            }
            for (Posta l : linhas) {
                if (y - l.altura() < m.margem()) {
                    marcar(cs, marcaDagua, pagina, negrito);
                    cs.close();
                    pagina = novaPagina(doc, m.largura(), alturaPagina);
                    cs = new PDPageContentStream(doc, pagina);
                    y = alturaPagina - m.margem();
                }
                y -= l.altura();
                desenhar(cs, l, m, y);
            }
            marcar(cs, marcaDagua, pagina, negrito);
            cs.close();
            doc.save(saida);
            return saida.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException("Falha ao gerar o PDF.", e);
        }
    }

    private static byte[] carregarLogo() {
        try (InputStream in = DocumentoPdf.class.getResourceAsStream("/recibo/logo.png")) {
            return in == null ? null : in.readAllBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static List<Posta> quebrar(List<Linha> linhas, Medidas m, PDFont normal, PDFont negrito) {
        List<Posta> postas = new ArrayList<>();
        for (Linha l : linhas) {
            float tamanho = switch (l.estilo()) {
                case TITULO -> m.tamanhoBase() * 1.4f;
                case PEQUENO -> m.tamanhoBase() * 0.85f;
                default -> m.tamanhoBase();
            };
            PDFont fonte = l.estilo() == Estilo.TITULO || l.estilo() == Estilo.NEGRITO ? negrito : normal;
            float altura = tamanho * 1.45f;
            if (l.estilo() == Estilo.SEPARADOR) {
                postas.add(new Posta(Estilo.SEPARADOR, "", null, fonte, tamanho, altura));
                continue;
            }
            String direita = l.direita() == null ? null : seguro(fonte, l.direita());
            float reservada = direita == null ? 0 : largura(fonte, tamanho, direita) + tamanho;
            List<String> partes = quebrarTexto(seguro(fonte, l.esquerda()), fonte, tamanho, m.util() - reservada);
            for (int i = 0; i < partes.size(); i++) {
                postas.add(new Posta(l.estilo(), partes.get(i), i == 0 ? direita : null, fonte, tamanho, altura));
            }
        }
        return postas;
    }

    private static List<String> quebrarTexto(String texto, PDFont fonte, float tamanho, float limite) {
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

    private static void desenhar(PDPageContentStream cs, Posta l, Medidas m, float y) throws IOException {
        if (l.estilo() == Estilo.SEPARADOR) {
            float meio = y + l.altura() / 2;
            cs.setLineWidth(0.5f);
            cs.moveTo(m.margem(), meio);
            cs.lineTo(m.largura() - m.margem(), meio);
            cs.stroke();
            return;
        }
        texto(cs, l.fonte(), l.tamanho(), m.margem(), y + l.altura() * 0.3f, l.esquerda());
        if (l.direita() != null) {
            float x = m.largura() - m.margem() - largura(l.fonte(), l.tamanho(), l.direita());
            texto(cs, l.fonte(), l.tamanho(), x, y + l.altura() * 0.3f, l.direita());
        }
    }

    private static void marcar(PDPageContentStream cs, String marca, PDPage pagina, PDFont fonte) throws IOException {
        if (marca == null) {
            return;
        }
        PDRectangle caixa = pagina.getMediaBox();
        float tamanho = caixa.getWidth() / (marca.length() * 0.66f);
        PDExtendedGraphicsState transparencia = new PDExtendedGraphicsState();
        transparencia.setNonStrokingAlphaConstant(0.2f);
        cs.saveGraphicsState();
        cs.setGraphicsStateParameters(transparencia);
        cs.setNonStrokingColor(0.75f, 0f, 0f);
        cs.beginText();
        cs.setFont(fonte, tamanho);
        float larguraTexto = largura(fonte, tamanho, marca);
        double angulo = Math.toRadians(Math.min(45, Math.toDegrees(Math.atan2(caixa.getHeight(), caixa.getWidth()))));
        float cx = caixa.getWidth() / 2;
        float cy = caixa.getHeight() / 2;
        float dx = (float) (Math.cos(angulo) * larguraTexto / 2);
        float dy = (float) (Math.sin(angulo) * larguraTexto / 2);
        cs.setTextMatrix(Matrix.getRotateInstance(angulo, cx - dx, cy - dy));
        cs.showText(marca);
        cs.endText();
        cs.restoreGraphicsState();
    }

    private static void texto(PDPageContentStream cs, PDFont fonte, float tamanho, float x, float y, String s)
            throws IOException {
        cs.beginText();
        cs.setFont(fonte, tamanho);
        cs.newLineAtOffset(x, y);
        cs.showText(s);
        cs.endText();
    }

    private static PDPage novaPagina(PDDocument doc, float largura, float altura) {
        PDPage pagina = new PDPage(new PDRectangle(largura, altura));
        doc.addPage(pagina);
        return pagina;
    }

    private static float largura(PDFont fonte, float tamanho, String s) {
        try {
            return fonte.getStringWidth(s) / 1000 * tamanho;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Troca por "?" os caracteres que a codificação WinAnsi da fonte padrão não representa. */
    private static String seguro(PDFont fonte, String s) {
        StringBuilder r = new StringBuilder();
        s.codePoints().forEach(cp -> {
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
}
