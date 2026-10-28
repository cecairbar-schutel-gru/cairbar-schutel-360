package com.durvalcrm.venda.application;

import com.durvalcrm.estoque.domain.TipoProduto;
import com.durvalcrm.shared.application.DadosOrganizacao;
import com.durvalcrm.venda.domain.PagamentoVenda;
import com.durvalcrm.venda.domain.StatusVenda;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Detalhe e comprovante da venda (US-SALES-008/011): itens com o preço congelado, remessas usadas
 * e obrigações criadas para os consignados, pagamentos e, se for o caso, o cancelamento e o vínculo
 * com a venda refeita.
 */
public record DetalheVenda(
        long id,
        long numero,
        Instant confirmadaEm,
        String vendedorNome,
        /** Feita pelo perfil PDV da cantina: o Tesoureiro também pode cancelá-la (US-SALES-022). */
        boolean pdv,
        List<Item> itens,
        List<PagamentoVenda> pagamentos,
        BigDecimal total,
        StatusVenda status,
        Instant canceladaEm,
        String canceladaPor,
        String motivoCancelamento,
        Referencia refazVenda,
        Referencia refeitaComo,
        DadosOrganizacao organizacao) {

    public record Item(long produtoId, String produtoNome, TipoProduto tipo, int quantidade, BigDecimal precoUnitario,
            BigDecimal subtotal, List<Lote> lotes) {
    }

    /** Remessa ({@code null} para estoque próprio), quantidade e obrigação com a editora. */
    public record Lote(Long remessaId, String remessaCodigo, int quantidade, BigDecimal repassePercentual,
            Long obrigacaoId, BigDecimal valorObrigacao) {
    }

    public record Referencia(long id, long numero) {
    }
}
