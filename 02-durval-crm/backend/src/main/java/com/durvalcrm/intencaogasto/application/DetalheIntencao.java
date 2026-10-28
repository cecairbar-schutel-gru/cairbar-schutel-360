package com.durvalcrm.intencaogasto.application;

import com.durvalcrm.intencaogasto.application.ConsultaIntencoesPort.InfoAnexo;
import com.durvalcrm.intencaogasto.domain.EventoIntencao;
import com.durvalcrm.intencaogasto.domain.IntencaoGasto;
import java.math.BigDecimal;
import java.util.List;

/**
 * Tudo o que a tela de detalhe mostra (US-EXPENSE-002/008): a intenção, o nome da subcategoria
 * pedida, os anexos, o histórico e, só para quem decide, quanto a subcategoria já gastou no mês.
 */
public record DetalheIntencao(IntencaoGasto intencao, String categoriaNome, List<InfoAnexo> anexos,
        List<EventoIntencao> historico, BigDecimal gastoNoMes, Acoes acoes) {

    /** O que o usuário atual pode fazer com a intenção na situação dela. */
    public record Acoes(boolean decidir, boolean resolverDivergencia, boolean retirar, boolean receber,
            boolean copiar) {
    }
}
