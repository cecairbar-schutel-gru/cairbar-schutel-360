package com.durvalcrm.intencaogasto.adapter.in.rest;

import com.durvalcrm.intencaogasto.application.Comandos.AprovacaoCommand;
import com.durvalcrm.intencaogasto.application.Comandos.CorrecaoCommand;
import com.durvalcrm.intencaogasto.application.Comandos.ItemPedido;
import com.durvalcrm.intencaogasto.application.Comandos.NovaIntencao;
import com.durvalcrm.intencaogasto.application.Comandos.RecebimentoCommand;
import com.durvalcrm.intencaogasto.domain.AnexoIntencao;
import com.durvalcrm.intencaogasto.domain.MeioPagamentoGasto;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** DTOs HTTP de entrada das intenções de gasto; as regras ficam no domínio. */
final class IntencaoRequests {

    private IntencaoRequests() {
    }

    /** Anexo em Base64 (PDF, JPG ou PNG de até 10 MB). */
    record AnexoRequest(String nome, String tipo, String conteudoBase64) {

        AnexoIntencao paraAnexo() {
            try {
                return new AnexoIntencao(nome, tipo,
                        Base64.getDecoder().decode(conteudoBase64 == null ? "" : conteudoBase64));
            } catch (IllegalArgumentException e) {
                throw ValidacaoException.doCampo("anexos", "Não foi possível ler o anexo " + nome + ".");
            }
        }
    }

    record ItemRequest(Long produtoId, Integer quantidade) {
    }

    record NovaIntencaoRequest(String descricao, String categoria, BigDecimal valor, String justificativa,
            List<ItemRequest> itens, List<AnexoRequest> anexos) {

        NovaIntencao paraComando() {
            return new NovaIntencao(descricao, categoria, valor, justificativa,
                    itens == null ? List.of() : itens.stream().map(i -> new ItemPedido(i.produtoId(), i.quantidade())).toList(),
                    anexos == null ? List.of() : anexos.stream().map(AnexoRequest::paraAnexo).toList());
        }
    }

    record MotivoRequest(String motivo) {
    }

    record AprovacaoRequest(BigDecimal valor, String categoria, MeioPagamentoGasto meio, Long contaId, LocalDate data,
            String nota) {

        AprovacaoCommand paraComando() {
            return new AprovacaoCommand(valor, categoria, meio, contaId, data, nota);
        }
    }

    record RecebimentoRequest(List<ItemRequest> itens, String divergencia) {

        RecebimentoCommand paraComando() {
            return new RecebimentoCommand(quantidades(itens), divergencia);
        }
    }

    record CorrecaoRequest(List<ItemRequest> itens, BigDecimal valor, String motivo) {

        CorrecaoCommand paraComando() {
            return new CorrecaoCommand(quantidades(itens), valor, motivo);
        }
    }

    private static Map<Long, Integer> quantidades(List<ItemRequest> itens) {
        Map<Long, Integer> mapa = new LinkedHashMap<>();
        if (itens != null) {
            for (ItemRequest i : itens) {
                if (i.produtoId() != null) {
                    mapa.put(i.produtoId(), i.quantidade());
                }
            }
        }
        return mapa;
    }
}
