package com.durvalcrm.financeiro.application;

import com.durvalcrm.financeiro.domain.AnexoLancamento;
import com.durvalcrm.financeiro.domain.TipoCategoria;
import com.durvalcrm.shared.domain.TipoCartao;
import java.math.BigDecimal;
import java.time.LocalDate;

/** Entradas das operações da Tesouraria; {@code chaveIdempotencia} evita registro em dobro. */
public final class ComandosFinanceiros {

    private ComandosFinanceiros() {
    }

    /** US-FINANCIAL-003. */
    public record TransferenciaCommand(Long contaOrigemId, Long contaDestinoId, BigDecimal valor, LocalDate data,
            String descricao, String chaveIdempotencia) {
    }

    /** US-FINANCIAL-004. */
    public record LiquidacaoCommand(Long contaBancariaId, LocalDate data, BigDecimal bruto, BigDecimal taxa,
            TipoCartao tipoCartao, String referencia, String chaveIdempotencia) {
    }

    /** US-FINANCIAL-009. */
    public record LancamentoManualCommand(Long contaId, LocalDate data, TipoCategoria tipo, String categoria,
            BigDecimal valor, String descricao, AnexoLancamento anexo, String chaveIdempotencia) {
    }

    /**
     * US-FINANCIAL-010: motivo obrigatório e, opcionalmente, o lançamento correto. A correção usa os
     * campos do tipo do lançamento original (manual, transferência ou liquidação).
     */
    public record EstornoCommand(String motivo, Correcao correcao) {
    }

    public record Correcao(LocalDate data, Long contaId, Long contaDestinoId, TipoCategoria tipo, String categoria,
            BigDecimal valor, BigDecimal taxa, String descricao, String referencia) {
    }

    /** US-FINANCIAL-021: a linha de categoria ({@code ordem}) e a nova subcategoria. */
    public record ReclassificacaoCommand(Integer ordem, String categoria, String motivo) {
    }
}
