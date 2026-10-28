package com.durvalcrm.estoque.domain;

import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Produtos recebidos em doação (US-INVENTORY-006): entram na hora como estoque próprio, sem
 * lançamento financeiro. O cancelamento estorna os movimentos e é só do Administrador.
 */
public final class EntradaDoacao {

    public static final int MAXIMO_OBSERVACAO = 200;

    private final Long id;
    private final List<ItemEntrada> itens;
    private final String observacao;
    private final Instant registradaEm;
    private final String registradaPor;
    private final String registradaPorNome;
    private Instant canceladaEm;
    private String canceladaPorNome;
    private String motivoCancelamento;

    private EntradaDoacao(Long id, List<ItemEntrada> itens, String observacao, Instant registradaEm,
            String registradaPor, String registradaPorNome, Instant canceladaEm, String canceladaPorNome,
            String motivoCancelamento) {
        this.id = id;
        this.itens = List.copyOf(itens);
        this.observacao = observacao;
        this.registradaEm = Objects.requireNonNull(registradaEm);
        this.registradaPor = Objects.requireNonNull(registradaPor);
        this.registradaPorNome = registradaPorNome;
        this.canceladaEm = canceladaEm;
        this.canceladaPorNome = canceladaPorNome;
        this.motivoCancelamento = motivoCancelamento;
    }

    public static EntradaDoacao nova(List<ItemEntrada> itens, String observacao, String quem, String nome,
            Instant em) {
        List<ErroCampo> erros = new ArrayList<>();
        if (itens == null || itens.isEmpty()) {
            erros.add(new ErroCampo("itens", "Adicione ao menos um produto."));
        } else {
            Set<Long> vistos = new HashSet<>();
            for (ItemEntrada i : itens) {
                if (i.quantidade() <= 0) {
                    erros.add(new ErroCampo("itens[" + i.produtoId() + "]", "Informe uma quantidade inteira positiva."));
                }
                if (!vistos.add(i.produtoId())) {
                    erros.add(new ErroCampo("itens", "Cada produto deve aparecer uma única vez."));
                }
            }
        }
        String obs = Textos.compactar(observacao);
        if (obs.length() > MAXIMO_OBSERVACAO) {
            erros.add(new ErroCampo("observacao", "Use até " + MAXIMO_OBSERVACAO + " caracteres."));
        }
        ValidacaoException.lancarSeHouver(erros);
        return new EntradaDoacao(null, itens, obs.isEmpty() ? null : obs, em, quem, nome, null, null, null);
    }

    public static EntradaDoacao reconstituir(Long id, List<ItemEntrada> itens, String observacao,
            Instant registradaEm, String registradaPor, String registradaPorNome, Instant canceladaEm,
            String canceladaPorNome, String motivoCancelamento) {
        return new EntradaDoacao(id, itens, observacao, registradaEm, registradaPor, registradaPorNome, canceladaEm,
                canceladaPorNome, motivoCancelamento);
    }

    /** As unidades ainda em estoque são conferidas pelo caso de uso, com os lotes travados. */
    public void cancelar(String motivo, String nome, Instant em) {
        if (cancelada()) {
            throw new RegraDeNegocioException("ENTRADA_JA_CANCELADA", "Esta entrada já foi cancelada.");
        }
        if (Textos.vazio(motivo)) {
            throw ValidacaoException.doCampo("motivo", "Informe o motivo do cancelamento.");
        }
        canceladaEm = em;
        canceladaPorNome = nome;
        motivoCancelamento = motivo.trim();
    }

    public boolean cancelada() {
        return canceladaEm != null;
    }

    public Long getId() { return id; }
    public List<ItemEntrada> getItens() { return itens; }
    public String getObservacao() { return observacao; }
    public Instant getRegistradaEm() { return registradaEm; }
    public String getRegistradaPor() { return registradaPor; }
    public String getRegistradaPorNome() { return registradaPorNome; }
    public Instant getCanceladaEm() { return canceladaEm; }
    public String getCanceladaPorNome() { return canceladaPorNome; }
    public String getMotivoCancelamento() { return motivoCancelamento; }
}
