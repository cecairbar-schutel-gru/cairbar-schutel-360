package com.durvalcrm.administracao.application;

import com.durvalcrm.administracao.domain.ValorMensalidade;
import com.durvalcrm.financeiro.application.DemonstrativoFinanceiroUseCase;
import com.durvalcrm.financeiro.application.DemonstrativoFinanceiroUseCase.CategoriaDoMes;
import com.durvalcrm.financeiro.application.DemonstrativoFinanceiroUseCase.ResultadoPorCategoria;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import org.springframework.transaction.annotation.Transactional;

/**
 * Números do painel do Administrador (wireframe 4, US-ADMIN-021): doadores ativos, vendas e
 * resultado do mês com o mês anterior, receitas × despesas dos últimos 6 meses, o valor de
 * mensalidade agendado. A fila de aprovações e a situação dos
 * períodos vêm das APIs do Estoque e do Fechamento.
 */
public class PainelAdministradorUseCase {

    static final int MESES_GRAFICO = 6;
    private static final String RECEITAS_VENDAS = "RECEITAS_VENDAS";

    private final DoadoresAdministracaoPort doadores;
    private final DemonstrativoFinanceiroUseCase financeiro;
    private final MensalidadeUseCase mensalidade;
    private final Clock relogio;

    public PainelAdministradorUseCase(DoadoresAdministracaoPort doadores, DemonstrativoFinanceiroUseCase financeiro,
            MensalidadeUseCase mensalidade, Clock relogio) {
        this.doadores = doadores;
        this.financeiro = financeiro;
        this.mensalidade = mensalidade;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public PainelAdministrador consultar() {
        YearMonth atual = YearMonth.now(relogio);
        List<MesReceitasDespesas> meses = new ArrayList<>();
        for (int i = MESES_GRAFICO - 1; i >= 0; i--) {
            YearMonth m = atual.minusMonths(i);
            ResultadoPorCategoria r = financeiro.porCategoria(m);
            meses.add(new MesReceitasDespesas(m, soma(r.receitas()), soma(r.despesas()), vendas(r)));
        }
        MesReceitasDespesas esteMes = meses.get(MESES_GRAFICO - 1);
        MesReceitasDespesas anterior = meses.get(MESES_GRAFICO - 2);
        ValorMensalidade agendada = mensalidade.consultar().agendada();
        return new PainelAdministrador(atual, doadores.contarAtivos(), esteMes.vendas(), anterior.vendas(),
                esteMes.resultado(), anterior.resultado(), meses, agendada);
    }

    private static BigDecimal soma(List<CategoriaDoMes> categorias) {
        return categorias.stream().map(CategoriaDoMes::valor).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal vendas(ResultadoPorCategoria r) {
        return r.receitas().stream().filter(c -> RECEITAS_VENDAS.equals(c.codigo())).map(CategoriaDoMes::valor)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public record MesReceitasDespesas(YearMonth mes, BigDecimal receitas, BigDecimal despesas, BigDecimal vendas) {

        public BigDecimal resultado() {
            return receitas.subtract(despesas);
        }
    }

    public record PainelAdministrador(YearMonth mes, long doadoresAtivos, BigDecimal vendasNoMes,
            BigDecimal vendasMesAnterior, BigDecimal resultadoNoMes, BigDecimal resultadoMesAnterior,
            List<MesReceitasDespesas> receitasDespesas, ValorMensalidade mensalidadeAgendada) {
    }
}
