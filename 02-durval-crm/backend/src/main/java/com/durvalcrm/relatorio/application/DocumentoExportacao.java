package com.durvalcrm.relatorio.application;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Relatório pronto para exportar (US-REPORT-021): título, período, os filtros aplicados na tela e
 * seções em forma de tabela. As células guardam o valor (texto, BigDecimal, número inteiro ou
 * LocalDate), nunca o texto formatado: o PDF formata; a planilha grava números como números.
 *
 * @param arquivo nome do arquivo, sem extensão
 */
public record DocumentoExportacao(String titulo, String arquivo, String periodo, List<Filtro> filtros,
        List<Secao> secoes) {

    public enum Formato { TEXTO, MOEDA, INTEIRO, PERCENTUAL, DATA }

    public record Filtro(String rotulo, String valor) {
    }

    public record Coluna(String titulo, Formato formato) {
        public static Coluna texto(String titulo) { return new Coluna(titulo, Formato.TEXTO); }
        public static Coluna moeda(String titulo) { return new Coluna(titulo, Formato.MOEDA); }
        public static Coluna inteiro(String titulo) { return new Coluna(titulo, Formato.INTEIRO); }
        public static Coluna percentual(String titulo) { return new Coluna(titulo, Formato.PERCENTUAL); }
        public static Coluna data(String titulo) { return new Coluna(titulo, Formato.DATA); }
    }

    /**
     * @param total linha de totais (nula se a seção não tem); célula nula fica em branco
     * @param notas observações impressas depois da tabela
     */
    public record Secao(String titulo, List<Coluna> colunas, List<List<Object>> linhas, List<Object> total,
            List<String> notas) {

        public int quantidadeDeLinhas() {
            return linhas.size();
        }
    }

    public int linhas() {
        return secoes.stream().mapToInt(Secao::quantidadeDeLinhas).sum();
    }

    /** Montagem de uma seção linha a linha. */
    public static final class Construtor {
        private final String titulo;
        private final List<Coluna> colunas;
        private final List<List<Object>> linhas = new ArrayList<>();
        private final List<String> notas = new ArrayList<>();
        private List<Object> total;

        public Construtor(String titulo, Coluna... colunas) {
            this.titulo = titulo;
            this.colunas = List.of(colunas);
        }

        public Construtor linha(Object... celulas) {
            linhas.add(Arrays.asList(celulas));
            return this;
        }

        public Construtor total(Object... celulas) {
            total = Arrays.asList(celulas);
            return this;
        }

        public Construtor nota(String texto) {
            notas.add(texto);
            return this;
        }

        public Secao montar() {
            return new Secao(titulo, colunas, List.copyOf(linhas), total, List.copyOf(notas));
        }
    }
}
