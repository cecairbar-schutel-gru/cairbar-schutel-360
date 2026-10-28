package com.durvalcrm.editora.domain;

import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Devolução de livros não vendidos de uma remessa (US-PUBLISHER-005): só tira do estoque, sem
 * lançamento financeiro nem obrigação.
 */
public record Devolucao(Long id, long remessaId, LocalDate devolvidaEm, String observacao, List<Item> itens,
        Instant registradaEm, String registradaPorSubject, String registradaPor) {

    public static final int MAXIMO_OBSERVACAO = 500;

    public record Item(long produtoId, int quantidade) {
    }

    public Devolucao {
        Objects.requireNonNull(devolvidaEm);
        itens = List.copyOf(itens);
    }

    /**
     * {@code quantidades}: o que foi informado por título (zeros são ignorados); {@code restantes} e
     * {@code nomes}: os títulos da remessa, com o saldo atual de cada lote.
     */
    public static Devolucao nova(Remessa remessa, LocalDate data, String observacao, Map<Long, Integer> quantidades,
            Map<Long, Integer> restantes, Map<Long, String> nomes, LocalDate hoje, String subject, String autor,
            Instant agora) {
        remessa.exigirNaoCancelada();
        List<ErroCampo> erros = new ArrayList<>();
        if (data == null) {
            erros.add(new ErroCampo("devolvidaEm", "Informe a data da devolução."));
        } else if (data.isAfter(hoje)) {
            erros.add(new ErroCampo("devolvidaEm", "A data da devolução não pode ser futura."));
        } else if (data.isBefore(remessa.getRecebidaEm())) {
            erros.add(new ErroCampo("devolvidaEm", "A devolução não pode ser anterior ao recebimento da remessa."));
        }
        String texto = Textos.compactar(observacao);
        if (texto.length() > MAXIMO_OBSERVACAO) {
            erros.add(new ErroCampo("observacao", "Use até 500 caracteres."));
        }
        List<Item> itens = new ArrayList<>();
        for (Map.Entry<Long, Integer> e : quantidades.entrySet()) {
            Integer quantidade = e.getValue();
            if (quantidade == null || quantidade == 0) {
                continue;
            }
            String campo = "itens[" + e.getKey() + "]";
            Integer restante = restantes.get(e.getKey());
            if (restante == null) {
                erros.add(new ErroCampo(campo, "O título não faz parte da remessa " + remessa.getCodigo() + "."));
            } else if (quantidade < 0) {
                erros.add(new ErroCampo(campo, "A quantidade não pode ser negativa."));
            } else if (quantidade > restante) {
                erros.add(new ErroCampo(campo, "Restam só " + restante + " unidade(s) de " + nomes.get(e.getKey())
                        + " nesta remessa."));
            } else {
                itens.add(new Item(e.getKey(), quantidade));
            }
        }
        if (itens.isEmpty() && erros.stream().noneMatch(er -> er.campo().startsWith("itens"))) {
            erros.add(new ErroCampo("itens", "Informe a quantidade devolvida de ao menos um título."));
        }
        ValidacaoException.lancarSeHouver(erros);
        return new Devolucao(null, remessa.getId(), data, texto.isEmpty() ? null : texto, itens, agora, subject, autor);
    }
}
