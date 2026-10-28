package com.durvalcrm.relatorio.application;

import com.durvalcrm.shared.domain.ValidacaoException;
import java.util.Locale;

public enum FormatoExportacao {
    PDF("pdf", "application/pdf"),
    XLSX("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final String extensao;
    private final String tipoConteudo;

    FormatoExportacao(String extensao, String tipoConteudo) {
        this.extensao = extensao;
        this.tipoConteudo = tipoConteudo;
    }

    public String extensao() {
        return extensao;
    }

    public String tipoConteudo() {
        return tipoConteudo;
    }

    /** "PDF", "XLSX" ou "EXCEL"; sem valor é erro de validação. */
    public static FormatoExportacao de(String valor) {
        if (valor != null) {
            String v = valor.trim().toUpperCase(Locale.ROOT);
            if (v.equals("EXCEL")) {
                return XLSX;
            }
            for (FormatoExportacao f : values()) {
                if (f.name().equals(v)) {
                    return f;
                }
            }
        }
        throw ValidacaoException.doCampo("formato", "Escolha o formato: PDF ou XLSX.");
    }

    public record Arquivo(String nome, String tipoConteudo, byte[] conteudo) {
    }
}
