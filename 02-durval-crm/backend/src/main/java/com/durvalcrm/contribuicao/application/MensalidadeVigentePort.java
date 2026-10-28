package com.durvalcrm.contribuicao.application;

import java.math.BigDecimal;
import java.time.YearMonth;

/** Valor único da mensalidade vigente para um mês (mantido pela Administração). */
public interface MensalidadeVigentePort {

    BigDecimal valorPara(YearMonth mes);
}
