package com.durvalcrm.relatorio.adapter.out.exportacao;

import static org.assertj.core.api.Assertions.assertThat;

import com.durvalcrm.relatorio.application.DocumentoExportacao;
import com.durvalcrm.relatorio.application.DocumentoExportacao.Coluna;
import com.durvalcrm.relatorio.application.DocumentoExportacao.Construtor;
import com.durvalcrm.relatorio.application.DocumentoExportacao.Filtro;
import com.durvalcrm.relatorio.application.ExportadorPort.Emissao;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

class ExportadorAdapterTest {

    private final ExportadorAdapter exportador = new ExportadorAdapter();
    private final Emissao emissao = new Emissao("Centro Espírita Cairbar Schutel", Instant.parse("2026-10-20T13:00:00Z"),
            ZoneId.of("America/Sao_Paulo"), "Carla");

    private DocumentoExportacao documento(int linhas) {
        Construtor c = new Construtor("Lançamentos", Coluna.data("Data"), Coluna.texto("Descrição"),
                Coluna.inteiro("Qtd."), Coluna.moeda("Valor"), Coluna.percentual("%"));
        for (int i = 0; i < linhas; i++) {
            c.linha(LocalDate.of(2026, 10, 1).plusDays(i % 30), "Mensalidade & doação <" + i + ">", i,
                    new BigDecimal("1234.56"), new BigDecimal("12.5"));
        }
        c.total("Total", null, linhas, new BigDecimal("1234.56").multiply(BigDecimal.valueOf(linhas)), null);
        c.nota("Receitas − despesas.");
        return new DocumentoExportacao("Fluxo de caixa", "fluxo", "01/10/2026 a 31/10/2026",
                List.of(new Filtro("Conta", "Banco A")), List.of(c.montar()));
    }

    @Test
    void pdfTemCabecalhoFiltrosEPaginasNumeradas() throws Exception {
        byte[] pdf = exportador.pdf(documento(120), emissao);
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            String texto = new PDFTextStripper().getText(doc);
            assertThat(doc.getNumberOfPages()).isGreaterThan(1);
            assertThat(texto).contains("Centro Espírita Cairbar Schutel", "Fluxo de caixa", "01/10/2026 a 31/10/2026",
                    "Gerado em 20/10/2026 10:00 por Carla", "Conta: Banco A", "R$ 1.234,56", "12,5%",
                    "Página 1 de " + doc.getNumberOfPages(), "Receitas - despesas.");
        }
    }

    @Test
    void planilhaTemNumerosComoNumerosETotais() throws Exception {
        Map<String, String> partes = abrir(exportador.planilha(documento(3), emissao));
        assertThat(partes).containsKeys("[Content_Types].xml", "xl/workbook.xml", "xl/styles.xml",
                "xl/worksheets/sheet1.xml");
        String aba = partes.get("xl/worksheets/sheet1.xml");
        assertThat(aba).contains("Período: 01/10/2026 a 31/10/2026", "Conta: Banco A", "Gerado em 20/10/2026 10:00 por Carla")
                .contains("<v>1234.56</v>", "<v>3703.68</v>", "Mensalidade &amp; doação &lt;0&gt;")
                // 01/10/2026 como número de série do Excel.
                .contains("<v>46296</v>");
        assertThat(partes.get("xl/workbook.xml")).contains("name=\"Lançamentos\"");
    }

    @Test
    void exportaDezMilLinhasEmMenosDeDezSegundos() {
        long inicio = System.nanoTime();
        exportador.planilha(documento(10_000), emissao);
        exportador.pdf(documento(10_000), emissao);
        assertThat((System.nanoTime() - inicio) / 1_000_000).isLessThan(10_000);
    }

    private static Map<String, String> abrir(byte[] zip) throws Exception {
        Map<String, String> partes = new LinkedHashMap<>();
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip))) {
            ZipEntry e;
            while ((e = in.getNextEntry()) != null) {
                partes.put(e.getName(), new String(in.readAllBytes(), StandardCharsets.UTF_8));
            }
        }
        return partes;
    }
}
