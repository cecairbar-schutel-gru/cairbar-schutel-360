package com.durvalcrm.administracao.domain;

import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Leitura das planilhas de importação em CSV (US-ADMIN-012), como o Excel salva: separador ";" ou
 * ",", aspas com "" para escapar, quebras de linha dentro de aspas e BOM do UTF-8. Os cabeçalhos são
 * comparados sem acento, maiúsculas nem espaços; a linha 1 é o cabeçalho, como na planilha.
 */
public final class PlanilhaCsv {

    public static final int MAXIMO_LINHAS = 10_000;

    /** Linha de dados com o número que ela tem na planilha (o cabeçalho é a 1). */
    public record Linha(int numero, Map<String, String> valores) {

        public String valor(String coluna) {
            String v = valores.get(coluna);
            return v == null ? "" : v.trim();
        }
    }

    private PlanilhaCsv() {
    }

    public static List<Linha> ler(String conteudo, List<String> colunas) {
        String texto = conteudo.startsWith("﻿") ? conteudo.substring(1) : conteudo;
        List<List<String>> registros = registros(texto, separador(texto));
        if (registros.isEmpty()) {
            throw ValidacaoException.doCampo("arquivo", "O arquivo está vazio.");
        }
        List<String> cabecalho = registros.get(0).stream().map(PlanilhaCsv::coluna).toList();
        List<String> faltando = colunas.stream().filter(c -> !cabecalho.contains(c)).toList();
        if (!faltando.isEmpty()) {
            throw ValidacaoException.doCampo("arquivo", "Use o modelo: faltam as colunas " + String.join(", ", faltando)
                    + ".");
        }
        List<Linha> linhas = new ArrayList<>();
        for (int i = 1; i < registros.size(); i++) {
            List<String> r = registros.get(i);
            if (r.stream().allMatch(String::isBlank)) {
                continue;
            }
            Map<String, String> valores = new HashMap<>();
            for (int c = 0; c < cabecalho.size() && c < r.size(); c++) {
                valores.put(cabecalho.get(c), r.get(c));
            }
            linhas.add(new Linha(i + 1, valores));
        }
        if (linhas.isEmpty()) {
            throw ValidacaoException.doCampo("arquivo", "O arquivo não tem linhas para importar.");
        }
        if (linhas.size() > MAXIMO_LINHAS) {
            throw ValidacaoException.doCampo("arquivo", "Importe no máximo " + MAXIMO_LINHAS + " linhas por arquivo.");
        }
        return linhas;
    }

    /** "Data de nascimento" → "data_de_nascimento". */
    static String coluna(String nome) {
        return Textos.normalizar(nome).replace("-", "").replaceAll("[^a-z0-9]+", "_").replaceAll("^_+|_+$", "");
    }

    private static char separador(String texto) {
        int fim = texto.indexOf('\n');
        String primeira = fim < 0 ? texto : texto.substring(0, fim);
        long pontoEVirgula = primeira.chars().filter(c -> c == ';').count();
        long virgula = primeira.chars().filter(c -> c == ',').count();
        return pontoEVirgula >= virgula ? ';' : ',';
    }

    private static List<List<String>> registros(String texto, char separador) {
        List<List<String>> registros = new ArrayList<>();
        List<String> atual = new ArrayList<>();
        StringBuilder campo = new StringBuilder();
        boolean aspas = false;
        for (int i = 0; i < texto.length(); i++) {
            char c = texto.charAt(i);
            if (aspas) {
                if (c == '"' && i + 1 < texto.length() && texto.charAt(i + 1) == '"') {
                    campo.append('"');
                    i++;
                } else if (c == '"') {
                    aspas = false;
                } else {
                    campo.append(c);
                }
            } else if (c == '"') {
                aspas = true;
            } else if (c == separador) {
                atual.add(campo.toString());
                campo.setLength(0);
            } else if (c == '\n' || c == '\r') {
                if (c == '\r' && i + 1 < texto.length() && texto.charAt(i + 1) == '\n') {
                    i++;
                }
                atual.add(campo.toString());
                campo.setLength(0);
                registros.add(atual);
                atual = new ArrayList<>();
            } else {
                campo.append(c);
            }
        }
        if (!campo.isEmpty() || !atual.isEmpty()) {
            atual.add(campo.toString());
            registros.add(atual);
        }
        return registros;
    }
}
