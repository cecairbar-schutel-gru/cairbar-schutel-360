package com.durvalcrm.fechamento.domain;

import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.YearMonth;
import java.util.Objects;

/**
 * Mês do calendário (US-CLOSING-008, 009). Fechado pelo Tesoureiro quando o checklist passa; só o
 * Administrador reabre, com justificativa. A reabertura desfaz a confirmação das liquidações de cartão:
 * o mês passa de novo pelo checklist.
 */
public class Periodo {

    public static final int MINIMO_JUSTIFICATIVA = 20;
    static final int MAXIMO_TEXTO = 1000;

    private final YearMonth mes;
    private StatusPeriodo status;
    private Autor fechamento;
    private String nota;
    private Autor reabertura;
    private String justificativa;
    private Autor cartaoConfirmado;

    private Periodo(YearMonth mes, StatusPeriodo status, Autor fechamento, String nota, Autor reabertura,
            String justificativa, Autor cartaoConfirmado) {
        this.mes = Objects.requireNonNull(mes);
        this.status = Objects.requireNonNull(status);
        this.fechamento = fechamento;
        this.nota = nota;
        this.reabertura = reabertura;
        this.justificativa = justificativa;
        this.cartaoConfirmado = cartaoConfirmado;
    }

    public static Periodo aberto(YearMonth mes) {
        return new Periodo(mes, StatusPeriodo.ABERTO, null, null, null, null, null);
    }

    public static Periodo reconstituir(YearMonth mes, StatusPeriodo status, Autor fechamento, String nota,
            Autor reabertura, String justificativa, Autor cartaoConfirmado) {
        return new Periodo(mes, status, fechamento, nota, reabertura, justificativa, cartaoConfirmado);
    }

    /** O checklist (US-CLOSING-001) é conferido pelo caso de uso antes; aqui só o estado e a nota opcional. */
    public void fechar(Autor autor, String nota) {
        exigirNaoFechado();
        String texto = Textos.compactar(nota);
        if (texto.length() > MAXIMO_TEXTO) {
            throw ValidacaoException.doCampo("nota", "Use até " + MAXIMO_TEXTO + " caracteres na nota.");
        }
        this.status = StatusPeriodo.FECHADO;
        this.fechamento = Objects.requireNonNull(autor);
        this.nota = texto.isEmpty() ? null : texto;
    }

    public void reabrir(Autor autor, String justificativa) {
        if (status != StatusPeriodo.FECHADO) {
            throw new RegraDeNegocioException("PERIODO_NAO_FECHADO",
                    "O mês de " + RegrasPeriodo.MES.format(mes) + " não está fechado.");
        }
        String texto = Textos.compactar(justificativa);
        if (texto.length() < MINIMO_JUSTIFICATIVA || texto.length() > MAXIMO_TEXTO) {
            throw ValidacaoException.doCampo("justificativa", "Explique por que o mês precisa ser reaberto (de "
                    + MINIMO_JUSTIFICATIVA + " a " + MAXIMO_TEXTO + " caracteres).");
        }
        this.status = StatusPeriodo.REABERTO;
        this.reabertura = Objects.requireNonNull(autor);
        this.justificativa = texto;
        this.cartaoConfirmado = null;
    }

    /** Item 5 do checklist: o Tesoureiro confirma que toda liquidação depositada até o fim do mês foi registrada. */
    public void confirmarCartao(Autor autor) {
        exigirNaoFechado();
        this.cartaoConfirmado = Objects.requireNonNull(autor);
    }

    public boolean fechado() {
        return status == StatusPeriodo.FECHADO;
    }

    private void exigirNaoFechado() {
        if (status == StatusPeriodo.FECHADO) {
            throw new RegraDeNegocioException("PERIODO_FECHADO",
                    "O mês de " + RegrasPeriodo.MES.format(mes) + " já está fechado.");
        }
    }

    public YearMonth getMes() {
        return mes;
    }

    public StatusPeriodo getStatus() {
        return status;
    }

    public Autor getFechamento() {
        return fechamento;
    }

    public String getNota() {
        return nota;
    }

    public Autor getReabertura() {
        return reabertura;
    }

    public String getJustificativa() {
        return justificativa;
    }

    public Autor getCartaoConfirmado() {
        return cartaoConfirmado;
    }
}
