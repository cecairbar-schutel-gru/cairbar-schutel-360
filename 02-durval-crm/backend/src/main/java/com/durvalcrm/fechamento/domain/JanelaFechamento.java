package com.durvalcrm.fechamento.domain;

import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;

/**
 * Janela de fechamento (US-CLOSING-014): dias de cada mês, de 1 a 7 seguidos, em que o Tesoureiro ou o
 * Administrador pode fechar o mês anterior (e os atrasados, em ordem). Vai no máximo até o dia 28, que
 * existe em todo mês. Sem configuração, vale do dia 1 ao dia 7.
 *
 * @param alteracao quem gravou a janela atual (nulo no padrão)
 */
public record JanelaFechamento(int diaInicio, int diaFim, Autor alteracao) {

    public static final int MAXIMO_DIAS = 7;
    public static final int ULTIMO_DIA = 28;
    public static final JanelaFechamento PADRAO = new JanelaFechamento(1, MAXIMO_DIAS, null);
    private static final DateTimeFormatter DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public JanelaFechamento {
        if (diaInicio < 1 || diaInicio > ULTIMO_DIA) {
            throw ValidacaoException.doCampo("diaInicio", "Escolha um dia de 1 a " + ULTIMO_DIA + ".");
        }
        if (diaFim < 1 || diaFim > ULTIMO_DIA) {
            throw ValidacaoException.doCampo("diaFim", "Escolha um dia de 1 a " + ULTIMO_DIA + ".");
        }
        if (diaFim < diaInicio) {
            throw ValidacaoException.doCampo("diaFim", "O último dia não pode ser antes do primeiro.");
        }
        if (diaFim - diaInicio + 1 > MAXIMO_DIAS) {
            throw ValidacaoException.doCampo("diaFim", "A janela tem no máximo " + MAXIMO_DIAS + " dias.");
        }
    }

    public static JanelaFechamento validar(Integer diaInicio, Integer diaFim, Autor autor) {
        if (diaInicio == null) {
            throw ValidacaoException.doCampo("diaInicio", "Informe o primeiro dia.");
        }
        if (diaFim == null) {
            throw ValidacaoException.doCampo("diaFim", "Informe o último dia.");
        }
        return new JanelaFechamento(diaInicio, diaFim, autor);
    }

    public boolean contem(LocalDate dia) {
        return dia.getDayOfMonth() >= diaInicio && dia.getDayOfMonth() <= diaFim;
    }

    /** A janela em curso ou, se ela já passou neste mês, a do mês seguinte. */
    public Intervalo atualOuProxima(LocalDate hoje) {
        YearMonth mes = YearMonth.from(hoje);
        if (hoje.getDayOfMonth() > diaFim) {
            mes = mes.plusMonths(1);
        }
        return new Intervalo(mes.atDay(diaInicio), mes.atDay(diaFim));
    }

    public void exigirAberta(LocalDate hoje) {
        if (!contem(hoje)) {
            Intervalo proxima = atualOuProxima(hoje);
            throw new RegraDeNegocioException("FORA_DA_JANELA_FECHAMENTO",
                    "O fechamento só pode ser feito do dia " + diaInicio + " ao dia " + diaFim
                            + " de cada mês. Próxima janela: " + DATA.format(proxima.inicio()) + " a "
                            + DATA.format(proxima.fim()) + ".");
        }
    }

    public record Intervalo(LocalDate inicio, LocalDate fim) {
    }
}
