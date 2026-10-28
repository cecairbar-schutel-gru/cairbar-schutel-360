package com.durvalcrm.financeiro.domain;

import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.TipoCartao;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Liquidação de cartão (US-FINANCIAL-004): Cartão a receber −bruto, banco +líquido e a taxa como
 * despesa "Despesas comerciais › Taxas de cartão". A organização absorve a taxa. O tipo liquidado
 * (crédito ou débito) é opcional, só para conferência e relatório: o bruto é conferido contra o saldo
 * total de Cartão a receber.
 */
public record LiquidacaoCartao(BigDecimal bruto, BigDecimal taxa, TipoCartao tipoCartao) {

    public static LiquidacaoCartao de(BigDecimal bruto, BigDecimal taxa, BigDecimal saldoCartao) {
        return de(bruto, taxa, null, saldoCartao);
    }

    public static LiquidacaoCartao de(BigDecimal bruto, BigDecimal taxa, TipoCartao tipoCartao, BigDecimal saldoCartao) {
        List<ErroCampo> erros = new ArrayList<>();
        Valores.exigirPositivo(bruto, "bruto", erros);
        if (taxa == null || taxa.signum() < 0 || taxa.scale() > 2) {
            erros.add(new ErroCampo("taxa", "Informe a taxa (zero ou mais, com até duas casas decimais)."));
        } else if (bruto != null && bruto.signum() > 0 && taxa.compareTo(bruto) >= 0) {
            erros.add(new ErroCampo("taxa", "A taxa deve ser menor que o valor bruto."));
        }
        ValidacaoException.lancarSeHouver(erros);
        if (bruto.compareTo(saldoCartao) > 0) {
            throw new RegraDeNegocioException("BRUTO_EXCEDE_CARTAO_A_RECEBER", "O bruto de " + Dinheiro.brl(bruto)
                    + " excede o saldo de Cartão a receber de " + Dinheiro.brl(saldoCartao) + ".");
        }
        return new LiquidacaoCartao(bruto, taxa, tipoCartao);
    }

    public BigDecimal liquido() {
        return bruto.subtract(taxa);
    }

    public List<LinhaConta> linhasConta(ContaFinanceira cartao, ContaFinanceira banco) {
        if (banco.tipo() != TipoConta.BANCO) {
            throw ValidacaoException.doCampo("contaBancariaId", "Escolha a conta bancária que recebeu o depósito.");
        }
        return List.of(new LinhaConta(cartao.id(), bruto.negate(), tipoCartao), new LinhaConta(banco.id(), liquido()));
    }

    public List<LinhaCategoria> linhasCategoria() {
        return taxa.signum() == 0 ? List.of() : List.of(new LinhaCategoria(CategoriaFinanceira.TAXAS_CARTAO, taxa.negate()));
    }
}
