package com.durvalcrm.relatorio.application;

import java.time.Instant;
import java.time.ZoneId;

/** Geração dos arquivos da exportação (US-REPORT-021); implementada nos adapters de PDF e planilha. */
public interface ExportadorPort {

    /**
     * Cabeçalho comum: organização (e o logotipo, no PDF), data e hora da geração e quem gerou.
     */
    record Emissao(String organizacao, Instant em, ZoneId zona, String usuario, byte[] logo) {

        public Emissao(String organizacao, Instant em, ZoneId zona, String usuario) {
            this(organizacao, em, zona, usuario, null);
        }
    }

    /** PDF A4 paisagem com cabeçalho, filtros e número das páginas. */
    byte[] pdf(DocumentoExportacao documento, Emissao emissao);

    /** Planilha .xlsx: uma aba por seção, uma linha por registro, células numéricas e a linha de totais. */
    byte[] planilha(DocumentoExportacao documento, Emissao emissao);
}
