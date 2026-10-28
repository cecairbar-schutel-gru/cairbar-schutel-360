package com.durvalcrm.administracao.domain;

import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Histórico do valor da mensalidade (US-ADMIN-002, Spec §4): o valor de um mês é o do último
 * registro vigente até ele. Um novo valor vale do mês seguinte em diante, nunca para o passado; só
 * existe um agendamento por vez, que pode ser alterado ou cancelado até o mês dele começar.
 * Competências já geradas guardam o próprio valor e não mudam.
 */
public final class TabelaMensalidade {

    public static final int MINIMO_MOTIVO = 5;

    private final List<ValorMensalidade> valores;

    public TabelaMensalidade(List<ValorMensalidade> valores) {
        if (valores.isEmpty()) {
            throw new IllegalStateException("A tabela de mensalidades não tem valor inicial.");
        }
        this.valores = valores.stream().sorted(Comparator.comparing(ValorMensalidade::vigenteDe)).toList();
    }

    /** Valor das competências do mês; antes do primeiro registro vale o primeiro. */
    public BigDecimal valorPara(YearMonth mes) {
        ValorMensalidade escolhido = valores.get(0);
        for (ValorMensalidade v : valores) {
            if (!v.vigenteDe().isAfter(mes)) {
                escolhido = v;
            }
        }
        return escolhido.valor();
    }

    public ValorMensalidade vigente(YearMonth atual) {
        ValorMensalidade escolhido = valores.get(0);
        for (ValorMensalidade v : valores) {
            if (!v.vigenteDe().isAfter(atual)) {
                escolhido = v;
            }
        }
        return escolhido;
    }

    public Optional<ValorMensalidade> agendada(YearMonth atual) {
        return valores.stream().filter(v -> v.vigenteDe().isAfter(atual)).findFirst();
    }

    /** Do mais recente ao mais antigo. */
    public List<ValorMensalidade> historico() {
        return valores.reversed();
    }

    /** Novo agendamento: 409 {@code AGENDAMENTO_EXISTENTE} se já houver um (deve ser alterado). */
    public void exigirSemAgendamento(YearMonth atual) {
        if (agendada(atual).isPresent()) {
            throw new RegraDeNegocioException("AGENDAMENTO_EXISTENTE",
                    "Já existe uma alteração agendada. Altere ou cancele a alteração agendada.");
        }
    }

    public ValorMensalidade exigirAgendada(YearMonth atual) {
        return agendada(atual).orElseThrow(() -> new RegraDeNegocioException("SEM_AGENDAMENTO",
                "Não há alteração agendada: o mês dela já começou ou ela foi cancelada."));
    }

    /** Valor positivo em centavos, mês a partir do seguinte, motivo e diferente do valor vigente. */
    public void validar(BigDecimal valor, YearMonth vigenteDe, String motivo, YearMonth atual) {
        List<ErroCampo> erros = new ArrayList<>();
        if (valor == null || valor.signum() <= 0) {
            erros.add(new ErroCampo("valor", "Informe um valor maior que zero."));
        } else if (valor.stripTrailingZeros().scale() > 2) {
            erros.add(new ErroCampo("valor", "Informe o valor em reais e centavos."));
        } else if (valor.compareTo(vigente(atual).valor()) == 0) {
            erros.add(new ErroCampo("valor", "O valor é igual ao vigente."));
        }
        if (vigenteDe == null) {
            erros.add(new ErroCampo("vigenteDe", "Informe o mês de início."));
        } else if (!vigenteDe.isAfter(atual)) {
            erros.add(new ErroCampo("vigenteDe", "O novo valor vale a partir do mês seguinte ou depois."));
        }
        if (Textos.compactar(motivo).length() < MINIMO_MOTIVO) {
            erros.add(new ErroCampo("motivo", "Informe o motivo da alteração."));
        }
        ValidacaoException.lancarSeHouver(erros);
    }
}
