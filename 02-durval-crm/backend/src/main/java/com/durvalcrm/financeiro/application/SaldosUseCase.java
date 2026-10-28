package com.durvalcrm.financeiro.application;

import com.durvalcrm.financeiro.application.QuadroSaldos.SaldoConta;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.ContaFinanceiraRepository;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.shared.domain.TipoCartao;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.transaction.annotation.Transactional;

/** Saldos de todas as contas (US-FINANCIAL-002), para o Tesoureiro e o Administrador. */
public class SaldosUseCase {

    private final ContaFinanceiraRepository contas;
    private final ConsultaFinanceiraPort consulta;
    private final Clock relogio;

    public SaldosUseCase(ContaFinanceiraRepository contas, ConsultaFinanceiraPort consulta, Clock relogio) {
        this.contas = contas;
        this.consulta = consulta;
        this.relogio = relogio;
    }

    /** {@code data} nula: agora; senão, ao fim daquele dia. */
    @Transactional(readOnly = true)
    public QuadroSaldos saldos(LocalDate data) {
        LocalDate hoje = LocalDate.now(relogio);
        if (data != null && data.isAfter(hoje)) {
            throw ValidacaoException.doCampo("data", "Escolha hoje ou uma data passada.");
        }
        Map<Long, BigDecimal> saldos = consulta.saldos(data);
        List<SaldoConta> visiveis = contas.listar().stream()
                .map(c -> new SaldoConta(c, data != null && data.isBefore(c.dataCorte())
                        ? null : saldos.getOrDefault(c.id(), c.saldoInicial())))
                // Inativas só aparecem se tinham saldo na data pedida.
                .filter(s -> s.conta().ativa() || (s.saldo() != null && s.saldo().signum() != 0))
                .toList();
        List<SaldoConta> caixas = doTipo(visiveis, TipoConta.CAIXA);
        List<SaldoConta> bancos = doTipo(visiveis, TipoConta.BANCO);
        SaldoConta cartao = doTipo(visiveis, TipoConta.CARTAO_A_RECEBER).stream().findFirst().orElse(null);
        BigDecimal subtotalCaixas = somar(caixas);
        BigDecimal subtotalBancos = somar(bancos);
        BigDecimal total = subtotalCaixas.add(subtotalBancos)
                .add(cartao == null || cartao.saldo() == null ? BigDecimal.ZERO : cartao.saldo());
        return new QuadroSaldos(data == null ? hoje : data, caixas, bancos, cartao, subtotalCaixas, subtotalBancos,
                total);
    }

    /**
     * Saldo atual de Cartão a receber dividido em crédito, débito e não informado (vendas e
     * contribuições anteriores ao tipo, lançamentos manuais e liquidações sem tipo). Só para
     * conferência: a liquidação é limitada pelo total.
     */
    @Transactional(readOnly = true)
    public SaldoCartaoAReceber cartaoAReceber() {
        ContaFinanceira cartao = contas.cartaoAReceber();
        BigDecimal total = consulta.saldos(null).getOrDefault(cartao.id(), cartao.saldoInicial());
        Map<TipoCartao, BigDecimal> porTipo = consulta.somaPorTipoCartao(cartao.id());
        BigDecimal credito = porTipo.getOrDefault(TipoCartao.CREDITO, BigDecimal.ZERO);
        BigDecimal debito = porTipo.getOrDefault(TipoCartao.DEBITO, BigDecimal.ZERO);
        return new SaldoCartaoAReceber(total, credito, debito, total.subtract(credito).subtract(debito));
    }

    public record SaldoCartaoAReceber(BigDecimal total, BigDecimal credito, BigDecimal debito,
            BigDecimal naoInformado) {
    }

    private static List<SaldoConta> doTipo(List<SaldoConta> saldos, TipoConta tipo) {
        return saldos.stream().filter(s -> s.conta().tipo() == tipo).toList();
    }

    private static BigDecimal somar(List<SaldoConta> saldos) {
        return saldos.stream().map(SaldoConta::saldo).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
