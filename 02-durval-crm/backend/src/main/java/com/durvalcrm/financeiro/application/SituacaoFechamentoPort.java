package com.durvalcrm.financeiro.application;

import com.durvalcrm.financeiro.application.PainelTesoureiroUseCase.SituacaoPeriodo;

/**
 * Resumo do checklist do fechamento mensal para o painel do Tesoureiro (US-CLOSING-001): o mês mais
 * antigo ainda aberto que já terminou, com os itens concluídos. Implementada pelo módulo Fechamento,
 * para que o Financeiro não dependa dele.
 */
public interface SituacaoFechamentoPort {

    SituacaoPeriodo situacao();
}
