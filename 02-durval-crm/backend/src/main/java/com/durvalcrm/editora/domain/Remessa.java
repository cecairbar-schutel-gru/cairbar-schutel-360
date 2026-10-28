package com.durvalcrm.editora.domain;

import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Remessa de livros consignados (US-PUBLISHER-003). O código (R-AAAA-NNNN) é gerado ao gravar; depois
 * disso itens, quantidades e percentuais de repasse não mudam: um erro se corrige cancelando a
 * remessa (só se nenhuma unidade se moveu) e registrando de novo.
 */
public final class Remessa {

    public static final int MAXIMO_DOCUMENTO = 60;
    public static final int MAXIMO_MOTIVO = 500;
    private static final BigDecimal CEM = BigDecimal.valueOf(100);

    /** Título recebido, com o percentual fixado nesta remessa. */
    public record Item(long produtoId, int quantidade, BigDecimal repassePercentual) {

        public Item {
            Objects.requireNonNull(repassePercentual);
        }
    }

    /** Linha do formulário; percentual nulo usa o padrão do título. */
    public record ItemPedido(Long produtoId, Integer quantidade, BigDecimal repassePercentual) {
    }

    private final Long id;
    private final String codigo;
    private final long editoraId;
    private final LocalDate recebidaEm;
    private final String numeroDocumento;
    private StatusRemessa status;
    private final List<Item> itens;
    private final Instant registradaEm;
    private final String registradaPor;
    private Instant canceladaEm;
    private String canceladaPor;
    private String motivoCancelamento;

    private Remessa(Long id, String codigo, long editoraId, LocalDate recebidaEm, String numeroDocumento,
            StatusRemessa status, List<Item> itens, Instant registradaEm, String registradaPor, Instant canceladaEm,
            String canceladaPor, String motivoCancelamento) {
        this.id = id;
        this.codigo = codigo;
        this.editoraId = editoraId;
        this.recebidaEm = Objects.requireNonNull(recebidaEm);
        this.numeroDocumento = numeroDocumento;
        this.status = Objects.requireNonNull(status);
        this.itens = List.copyOf(itens);
        this.registradaEm = registradaEm;
        this.registradaPor = registradaPor;
        this.canceladaEm = canceladaEm;
        this.canceladaPor = canceladaPor;
        this.motivoCancelamento = motivoCancelamento;
    }

    /**
     * Valida e monta a remessa ainda sem código. {@code titulos}: livros da editora, por id do
     * produto.
     */
    public static Remessa nova(Editora editora, LocalDate recebidaEm, String numeroDocumento,
            List<ItemPedido> pedidos, Map<Long, TituloConsignado> titulos, LocalDate hoje, String autor,
            Instant agora) {
        editora.exigirAtivaParaRemessa();
        List<ErroCampo> erros = new ArrayList<>();
        if (recebidaEm == null) {
            erros.add(new ErroCampo("recebidaEm", "Informe a data de recebimento."));
        } else if (recebidaEm.isAfter(hoje)) {
            erros.add(new ErroCampo("recebidaEm", "A data de recebimento não pode ser futura."));
        }
        String documento = Textos.compactar(numeroDocumento);
        if (documento.length() > MAXIMO_DOCUMENTO) {
            erros.add(new ErroCampo("numeroDocumento", "Use até 60 caracteres."));
        }
        List<Item> itens = new ArrayList<>();
        Set<Long> vistos = new HashSet<>();
        if (pedidos == null || pedidos.isEmpty()) {
            erros.add(new ErroCampo("itens", "Inclua ao menos um título."));
        } else {
            for (ItemPedido p : pedidos) {
                Item item = item(p, titulos, editora, vistos, erros);
                if (item != null) {
                    itens.add(item);
                }
            }
        }
        ValidacaoException.lancarSeHouver(erros);
        return new Remessa(null, null, editora.id(), recebidaEm, documento.isEmpty() ? null : documento,
                StatusRemessa.ABERTA, itens, agora, autor, null, null, null);
    }

    private static Item item(ItemPedido p, Map<Long, TituloConsignado> titulos, Editora editora, Set<Long> vistos,
            List<ErroCampo> erros) {
        if (p.produtoId() == null) {
            erros.add(new ErroCampo("itens", "Escolha o título de cada linha."));
            return null;
        }
        String campo = "itens[" + p.produtoId() + "]";
        TituloConsignado t = titulos.get(p.produtoId());
        if (t == null || !Objects.equals(t.editoraId(), editora.id())) {
            erros.add(new ErroCampo(campo, "O título não é da editora " + editora.nome() + "."));
            return null;
        }
        if (!vistos.add(p.produtoId())) {
            erros.add(new ErroCampo(campo, t.nome() + " aparece mais de uma vez."));
            return null;
        }
        if (!t.ativo()) {
            erros.add(new ErroCampo(campo, t.nome() + " está inativo."));
            return null;
        }
        if (p.quantidade() == null || p.quantidade() <= 0) {
            erros.add(new ErroCampo(campo, "Informe a quantidade de " + t.nome() + " (maior que zero)."));
            return null;
        }
        BigDecimal percentual = p.repassePercentual() != null ? p.repassePercentual() : t.repassePadrao();
        if (percentual == null) {
            erros.add(new ErroCampo(campo, "Informe o percentual de repasse de " + t.nome() + "."));
            return null;
        }
        if (percentual.signum() < 0 || percentual.compareTo(CEM) > 0 || percentual.stripTrailingZeros().scale() > 2) {
            erros.add(new ErroCampo(campo, "O percentual de repasse vai de 0 a 100, com até duas casas."));
            return null;
        }
        return new Item(p.produtoId(), p.quantidade(), percentual);
    }

    public static Remessa reconstituir(Long id, String codigo, long editoraId, LocalDate recebidaEm,
            String numeroDocumento, StatusRemessa status, List<Item> itens, Instant registradaEm, String registradaPor,
            Instant canceladaEm, String canceladaPor, String motivoCancelamento) {
        return new Remessa(id, codigo, editoraId, recebidaEm, numeroDocumento, status, itens, registradaEm,
                registradaPor, canceladaEm, canceladaPor, motivoCancelamento);
    }

    /** O código vem da sequência do ano de recebimento. */
    public static String codigo(int ano, int numero) {
        return String.format("R-%d-%04d", ano, numero);
    }

    /** O Estoque confirma antes que nenhuma unidade se moveu além da entrada da remessa. */
    public void cancelar(String motivo, String autor, Instant agora) {
        if (status == StatusRemessa.CANCELADA) {
            throw new RegraDeNegocioException("REMESSA_CANCELADA", "Esta remessa já foi cancelada.");
        }
        String texto = Textos.compactar(motivo);
        if (texto.isEmpty()) {
            throw ValidacaoException.doCampo("motivo", "Informe o motivo do cancelamento.");
        }
        if (texto.length() > MAXIMO_MOTIVO) {
            throw ValidacaoException.doCampo("motivo", "Use até 500 caracteres.");
        }
        status = StatusRemessa.CANCELADA;
        motivoCancelamento = texto;
        canceladaPor = autor;
        canceladaEm = agora;
    }

    public void exigirNaoCancelada() {
        if (status == StatusRemessa.CANCELADA) {
            throw new RegraDeNegocioException("REMESSA_CANCELADA", "A remessa " + codigo + " está cancelada.");
        }
    }

    public Long getId() { return id; }
    public String getCodigo() { return codigo; }
    public long getEditoraId() { return editoraId; }
    public LocalDate getRecebidaEm() { return recebidaEm; }
    public String getNumeroDocumento() { return numeroDocumento; }
    public StatusRemessa getStatus() { return status; }
    public List<Item> getItens() { return itens; }
    public Instant getRegistradaEm() { return registradaEm; }
    public String getRegistradaPor() { return registradaPor; }
    public Instant getCanceladaEm() { return canceladaEm; }
    public String getCanceladaPor() { return canceladaPor; }
    public String getMotivoCancelamento() { return motivoCancelamento; }
}
