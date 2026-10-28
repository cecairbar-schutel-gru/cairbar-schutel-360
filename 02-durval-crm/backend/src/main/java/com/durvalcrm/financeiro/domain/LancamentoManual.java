package com.durvalcrm.financeiro.domain;

import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Receita ou despesa que não vem de outro módulo (US-FINANCIAL-009): uma conta e uma subcategoria
 * ativa do mesmo tipo, fora das categorias com fluxo próprio.
 */
public record LancamentoManual(TipoCategoria tipo, Categoria categoria, BigDecimal valor, String descricao) {

    public static final int MAXIMO_DESCRICAO = 200;

    public static LancamentoManual de(TipoCategoria tipo, Categoria categoria, BigDecimal valor, String descricao) {
        List<ErroCampo> erros = new ArrayList<>();
        if (tipo == null) {
            erros.add(new ErroCampo("tipo", "Escolha receita ou despesa."));
        }
        if (categoria == null || !categoria.subcategoria() || !categoria.ativa()
                || CategoriaFinanceira.temFluxoProprio(categoria) || (tipo != null && categoria.tipo() != tipo)) {
            erros.add(new ErroCampo("categoria", "Escolha uma subcategoria ativa de "
                    + (tipo == TipoCategoria.DESPESA ? "despesa" : "receita") + " disponível para lançamento manual."));
        }
        Valores.exigirPositivo(valor, "valor", erros);
        String texto = Textos.compactar(descricao);
        if (texto.isEmpty() || texto.length() > MAXIMO_DESCRICAO) {
            erros.add(new ErroCampo("descricao", "Descreva o lançamento (até 200 caracteres)."));
        }
        ValidacaoException.lancarSeHouver(erros);
        return new LancamentoManual(tipo, categoria, valor, texto);
    }

    /** Receita entra positiva na conta; despesa sai. */
    public BigDecimal valorAssinado() {
        return tipo == TipoCategoria.RECEITA ? valor : valor.negate();
    }

    public List<LinhaConta> linhasConta(ContaFinanceira conta) {
        return List.of(new LinhaConta(conta.id(), valorAssinado()));
    }

    public List<LinhaCategoria> linhasCategoria() {
        return List.of(new LinhaCategoria(categoria.codigo(), valorAssinado()));
    }
}
