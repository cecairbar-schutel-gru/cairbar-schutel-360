package com.durvalcrm.editora.application;

import com.durvalcrm.editora.domain.ItemRemessa;
import com.durvalcrm.editora.domain.Obrigacao;
import com.durvalcrm.editora.domain.ObrigacaoRepository;
import com.durvalcrm.editora.domain.OrigemObrigacao;
import com.durvalcrm.editora.domain.RemessaRepository;
import com.durvalcrm.editora.domain.StatusObrigacao;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import org.springframework.transaction.annotation.Transactional;

/**
 * API do módulo Editoras para Vendas e Estoque: cria a obrigação de cada lote consignado vendido
 * (estornada no cancelamento) ou baixado por dano/extravio. As transações são abertas pelo caso de
 * uso chamador.
 */
public class ObrigacoesEditoraUseCase {

    private final RemessaRepository remessas;
    private final ObrigacaoRepository obrigacoes;
    private final Clock relogio;

    public ObrigacoesEditoraUseCase(RemessaRepository remessas, ObrigacaoRepository obrigacoes, Clock relogio) {
        this.remessas = remessas;
        this.obrigacoes = obrigacoes;
        this.relogio = relogio;
    }

    @Transactional
    public ObrigacaoGerada registrarPorVenda(long vendaId, long remessaId, long produtoId, int quantidade,
            BigDecimal precoUnitario) {
        ItemRemessa item = remessas.item(remessaId, produtoId)
                .orElseThrow(() -> new IllegalStateException("Lote consignado sem item de remessa: remessa "
                        + remessaId + ", produto " + produtoId + "."));
        Obrigacao salva = obrigacoes.salvar(Obrigacao.porVenda(item, vendaId, quantidade, precoUnitario,
                relogio.instant()));
        return new ObrigacaoGerada(salva.getId(), salva.getEditoraId(), item.remessaCodigo(),
                salva.getRepassePercentual(), salva.getValor());
    }

    /** Baixa de consignado por dano ou extravio (US-INVENTORY-008): obrigação sem receita. */
    @Transactional
    public ObrigacaoGerada registrarPorBaixa(long solicitacaoId, long remessaId, long produtoId, int quantidade,
            BigDecimal precoUnitario) {
        ItemRemessa item = remessas.item(remessaId, produtoId)
                .orElseThrow(() -> new IllegalStateException("Lote consignado sem item de remessa: remessa "
                        + remessaId + ", produto " + produtoId + "."));
        Obrigacao salva = obrigacoes.salvar(Obrigacao.porBaixa(item, solicitacaoId, quantidade, precoUnitario,
                relogio.instant()));
        return new ObrigacaoGerada(salva.getId(), salva.getEditoraId(), item.remessaCodigo(),
                salva.getRepassePercentual(), salva.getValor());
    }

    /** Estorna as obrigações da venda; o que já tinha sido pago vira crédito da editora. */
    @Transactional
    public void estornarDaVenda(long vendaId) {
        Instant agora = relogio.instant();
        for (Obrigacao o : obrigacoes.listarPorOrigem(OrigemObrigacao.VENDA, vendaId)) {
            if (o.getStatus() == StatusObrigacao.ESTORNADA) {
                continue;
            }
            BigDecimal credito = o.estornar(agora);
            obrigacoes.salvar(o);
            if (credito.signum() > 0) {
                obrigacoes.registrarCredito(o.getEditoraId(), o.getId(), credito, agora);
            }
        }
    }
}
