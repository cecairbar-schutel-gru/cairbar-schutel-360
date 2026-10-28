package com.durvalcrm.financeiro.adapter.in.rest;

import com.durvalcrm.financeiro.application.ContasFinanceirasUseCase.ContaComSaldo;
import com.durvalcrm.financeiro.application.ContasRecebimentoUseCase.Destinos;
import com.durvalcrm.financeiro.application.QuadroSaldos;
import com.durvalcrm.financeiro.application.QuadroSaldos.SaldoConta;
import com.durvalcrm.financeiro.application.ConsultarLancamentosUseCase.ItemLancamento;
import com.durvalcrm.financeiro.application.ConsultarLancamentosUseCase.PaginaLancamentos;
import com.durvalcrm.financeiro.application.PainelTesoureiroUseCase.ConciliacaoPendente;
import com.durvalcrm.financeiro.application.PainelTesoureiroUseCase.PainelTesoureiro;
import com.durvalcrm.financeiro.application.PainelTesoureiroUseCase.SituacaoPeriodo;
import com.durvalcrm.financeiro.application.ConsultaFinanceiraPort.Cancelamento;
import com.durvalcrm.financeiro.application.ConsultaFinanceiraPort.ResumoPeriodo;
import com.durvalcrm.financeiro.application.MensalidadesDoMesPort.ResumoMensalidades;
import com.durvalcrm.financeiro.domain.Categoria;
import com.durvalcrm.financeiro.domain.CategoriaFinanceira;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.TipoCategoria;
import com.durvalcrm.financeiro.domain.TipoConta;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

final class FinanceiroResponses {

    private FinanceiroResponses() {
    }

    /** {@code saldo} e {@code temLancamentos} só vêm no cadastro de contas. */
    record ContaResponse(long id, String codigo, String nome, TipoConta tipo, boolean ativa, String localizacao,
            String banco, String agencia, String numeroConta, BigDecimal saldoInicial, LocalDate dataCorte,
            BigDecimal saldo, Boolean temLancamentos) {

        static ContaResponse de(ContaFinanceira c) {
            return new ContaResponse(c.id(), c.codigo(), c.nome(), c.tipo(), c.ativa(), c.localizacao(), c.banco(),
                    c.agencia(), c.numeroConta(), c.saldoInicial(), c.dataCorte(), null, null);
        }

        static ContaResponse de(ContaComSaldo s) {
            ContaFinanceira c = s.conta();
            return new ContaResponse(c.id(), c.codigo(), c.nome(), c.tipo(), c.ativa(), c.localizacao(), c.banco(),
                    c.agencia(), c.numeroConta(), c.saldoInicial(), c.dataCorte(), s.saldo(), s.temLancamentos());
        }
    }

    /** {@code dinheiro} e {@code pix} nulos enquanto o Administrador não os define. */
    record ContasRecebimentoResponse(ContaResponse dinheiro, ContaResponse pix, ContaResponse cartao) {

        static ContasRecebimentoResponse de(Destinos d) {
            return new ContasRecebimentoResponse(d.dinheiro() == null ? null : ContaResponse.de(d.dinheiro()),
                    d.pix() == null ? null : ContaResponse.de(d.pix()), ContaResponse.de(d.cartao()));
        }
    }

    record SaldoContaResponse(long id, String codigo, String nome, TipoConta tipo, boolean ativa, LocalDate dataCorte,
            BigDecimal saldo) {

        static SaldoContaResponse de(SaldoConta s) {
            ContaFinanceira c = s.conta();
            return new SaldoContaResponse(c.id(), c.codigo(), c.nome(), c.tipo(), c.ativa(), c.dataCorte(), s.saldo());
        }
    }

    record SaldosResponse(LocalDate data, List<SaldoContaResponse> caixas, List<SaldoContaResponse> bancos,
            SaldoContaResponse cartaoAReceber, BigDecimal subtotalCaixas, BigDecimal subtotalBancos, BigDecimal total) {

        static SaldosResponse de(QuadroSaldos q) {
            return new SaldosResponse(q.data(), q.caixas().stream().map(SaldoContaResponse::de).toList(),
                    q.bancos().stream().map(SaldoContaResponse::de).toList(),
                    q.cartaoAReceber() == null ? null : SaldoContaResponse.de(q.cartaoAReceber()), q.subtotalCaixas(),
                    q.subtotalBancos(), q.total());
        }
    }

    /** {@code permiteManual}: fora das categorias com fluxo próprio (US-FINANCIAL-009). */
    record CategoriaResponse(String codigo, String nome, TipoCategoria tipo, String categoriaPai, String nomeCompleto,
            boolean ativa, boolean permiteManual) {

        static CategoriaResponse de(Categoria c) {
            return new CategoriaResponse(c.codigo(), c.nome(), c.tipo(), c.categoriaPai(), c.nomeCompleto(), c.ativa(),
                    c.subcategoria() && !CategoriaFinanceira.temFluxoProprio(c));
        }
    }

    record PaginaResponse(ContaResponse conta, List<ItemLancamento> itens, boolean temMais, BigDecimal saldoAnterior,
            BigDecimal saldoFinal) {

        static PaginaResponse de(PaginaLancamentos p) {
            return new PaginaResponse(p.conta() == null ? null : ContaResponse.de(p.conta()), p.itens(), p.temMais(),
                    p.saldoAnterior(), p.saldoFinal());
        }
    }


    record ConciliacaoResponse(long contaId, String contaNome, long naoConciliados, LocalDate ultimaConciliacao) {

        static ConciliacaoResponse de(ConciliacaoPendente c) {
            return new ConciliacaoResponse(c.conta().id(), c.conta().nome(), c.naoConciliados(), c.ultimaConciliacao());
        }
    }

    record PeriodoResponse(String mes, String situacao, Integer itensConcluidos, Integer itensTotal) {

        static PeriodoResponse de(SituacaoPeriodo p) {
            return new PeriodoResponse(p.mes().toString(), p.situacao(), p.itensConcluidos(), p.itensTotal());
        }
    }

    record PainelTesoureiroResponse(String mes, ResumoMensalidades mensalidades, ResumoPeriodo resumoDoMes,
            BigDecimal receitaLiquida, SaldosResponse saldos, Long intencoesPendentes,
            List<ConciliacaoResponse> conciliacoes, PeriodoResponse periodo, List<Cancelamento> cancelamentosRecentes) {

        static PainelTesoureiroResponse de(PainelTesoureiro p) {
            return new PainelTesoureiroResponse(p.mes().toString(), p.mensalidades(), p.resumoDoMes(), p.receitaLiquida(),
                    SaldosResponse.de(p.saldos()), p.intencoesPendentes(),
                    p.conciliacoes().stream().map(ConciliacaoResponse::de).toList(), PeriodoResponse.de(p.periodo()),
                    p.cancelamentosRecentes());
        }
    }
}
