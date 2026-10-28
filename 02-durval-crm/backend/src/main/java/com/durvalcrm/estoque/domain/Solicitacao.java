package com.durvalcrm.estoque.domain;

import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Pedido do Vendedor que o Administrador decide (US-INVENTORY-007/011/014): baixa, alteração de
 * preço da cantina ou inativação. Enquanto pendente nada muda no estoque nem no catálogo.
 */
public final class Solicitacao {

    public static final int MAXIMO_JUSTIFICATIVA = 500;

    private final Long id;
    private final TipoSolicitacao tipo;
    private final long produtoId;
    private final Long remessaId;
    private final Integer quantidade;
    private final MotivoBaixa motivoBaixa;
    private final BigDecimal precoAtual;
    private final BigDecimal novoPreco;
    private final String justificativa;
    private final FotoSolicitacao foto;
    private StatusSolicitacao status;
    private final String solicitante;
    private final String solicitanteNome;
    private final Instant solicitadaEm;
    private String decididaPor;
    private String decididaPorNome;
    private Instant decididaEm;
    private String motivoDecisao;

    private Solicitacao(Long id, TipoSolicitacao tipo, long produtoId, Long remessaId, Integer quantidade,
            MotivoBaixa motivoBaixa, BigDecimal precoAtual, BigDecimal novoPreco, String justificativa,
            FotoSolicitacao foto, StatusSolicitacao status, String solicitante, String solicitanteNome,
            Instant solicitadaEm, String decididaPor, String decididaPorNome, Instant decididaEm,
            String motivoDecisao) {
        this.id = id;
        this.tipo = Objects.requireNonNull(tipo);
        this.produtoId = produtoId;
        this.remessaId = remessaId;
        this.quantidade = quantidade;
        this.motivoBaixa = motivoBaixa;
        this.precoAtual = precoAtual;
        this.novoPreco = novoPreco;
        this.justificativa = Objects.requireNonNull(justificativa);
        this.foto = foto;
        this.status = Objects.requireNonNull(status);
        this.solicitante = Objects.requireNonNull(solicitante);
        this.solicitanteNome = solicitanteNome;
        this.solicitadaEm = Objects.requireNonNull(solicitadaEm);
        this.decididaPor = decididaPor;
        this.decididaPorNome = decididaPorNome;
        this.decididaEm = decididaEm;
        this.motivoDecisao = motivoDecisao;
    }

    /**
     * Baixa de {@code quantidade} unidades do lote (remessa nula = estoque próprio). O limite de saldo
     * do lote é conferido pelo caso de uso, que conhece o saldo e os outros pedidos pendentes.
     */
    public static Solicitacao baixa(long produtoId, Long remessaId, Integer quantidade, MotivoBaixa motivo,
            String justificativa, FotoSolicitacao foto, String solicitante, String nome, Instant em) {
        List<ErroCampo> erros = new ArrayList<>();
        if (quantidade == null || quantidade <= 0) {
            erros.add(new ErroCampo("quantidade", "Informe uma quantidade inteira positiva."));
        }
        if (motivo == null) {
            erros.add(new ErroCampo("motivo", "Escolha o motivo: vencimento, dano ou extravio."));
        }
        String texto = justificativa(justificativa, "justificativa", erros);
        ValidacaoException.lancarSeHouver(erros);
        return new Solicitacao(null, TipoSolicitacao.BAIXA, produtoId, remessaId, quantidade, motivo, null, null, texto,
                foto, StatusSolicitacao.PENDENTE, solicitante, nome, em, null, null, null, null);
    }

    /** Novo preço da cantina; o atual continua valendo até a aprovação (Spec §4). */
    public static Solicitacao preco(long produtoId, BigDecimal precoAtual, BigDecimal novoPreco, String motivo,
            String solicitante, String nome, Instant em) {
        List<ErroCampo> erros = new ArrayList<>();
        BigDecimal valor = null;
        try {
            valor = Precos.validar("novoPreco", novoPreco);
            if (valor.compareTo(precoAtual) == 0) {
                erros.add(new ErroCampo("novoPreco", "O novo preço é igual ao atual."));
            }
        } catch (ValidacaoException e) {
            erros.addAll(e.getErros());
        }
        String texto = justificativa(motivo, "motivo", erros);
        ValidacaoException.lancarSeHouver(erros);
        return new Solicitacao(null, TipoSolicitacao.PRECO, produtoId, null, null, null, precoAtual, valor, texto, null,
                StatusSolicitacao.PENDENTE, solicitante, nome, em, null, null, null, null);
    }

    /** O produto continua ativo até a aprovação. */
    public static Solicitacao inativacao(long produtoId, String motivo, String solicitante, String nome, Instant em) {
        List<ErroCampo> erros = new ArrayList<>();
        String texto = justificativa(motivo, "motivo", erros);
        ValidacaoException.lancarSeHouver(erros);
        return new Solicitacao(null, TipoSolicitacao.INATIVACAO, produtoId, null, null, null, null, null, texto, null,
                StatusSolicitacao.PENDENTE, solicitante, nome, em, null, null, null, null);
    }

    public static Solicitacao reconstituir(Long id, TipoSolicitacao tipo, long produtoId, Long remessaId,
            Integer quantidade, MotivoBaixa motivoBaixa, BigDecimal precoAtual, BigDecimal novoPreco,
            String justificativa, FotoSolicitacao foto, StatusSolicitacao status, String solicitante,
            String solicitanteNome, Instant solicitadaEm, String decididaPor, String decididaPorNome,
            Instant decididaEm, String motivoDecisao) {
        return new Solicitacao(id, tipo, produtoId, remessaId, quantidade, motivoBaixa, precoAtual, novoPreco,
                justificativa, foto, status, solicitante, solicitanteNome, solicitadaEm, decididaPor, decididaPorNome,
                decididaEm, motivoDecisao);
    }

    private static String justificativa(String valor, String campo, List<ErroCampo> erros) {
        String texto = valor == null ? "" : valor.trim();
        if (texto.isEmpty()) {
            erros.add(new ErroCampo(campo, campo.equals("motivo") ? "Informe o motivo." : "Informe a justificativa."));
        } else if (texto.length() > MAXIMO_JUSTIFICATIVA) {
            erros.add(new ErroCampo(campo, "Use até " + MAXIMO_JUSTIFICATIVA + " caracteres."));
        }
        return texto;
    }

    /** Só quem pediu, e só enquanto pendente. */
    public void cancelar(String quem, Instant em) {
        exigirPendente();
        if (!solicitante.equals(quem)) {
            throw new RegraDeNegocioException("SOLICITACAO_DE_OUTRO_USUARIO",
                    "Só quem fez a solicitação pode cancelá-la.");
        }
        status = StatusSolicitacao.CANCELADA;
        decididaPor = quem;
        decididaPorNome = solicitanteNome;
        decididaEm = em;
    }

    /** Os efeitos (saldo, preço, status do produto) são aplicados pelo caso de uso na mesma transação. */
    public void aprovar(String quem, String nome, Instant em) {
        exigirPendente();
        status = StatusSolicitacao.APROVADA;
        decididaPor = quem;
        decididaPorNome = nome;
        decididaEm = em;
    }

    public void rejeitar(String quem, String nome, String motivo, Instant em) {
        exigirPendente();
        if (Textos.vazio(motivo)) {
            throw ValidacaoException.doCampo("motivo", "Informe o motivo da rejeição.");
        }
        status = StatusSolicitacao.REJEITADA;
        decididaPor = quem;
        decididaPorNome = nome;
        decididaEm = em;
        motivoDecisao = motivo.trim();
    }

    /** Administrador que também é Vendedor decidindo o próprio pedido; a auditoria registra. */
    public boolean autoAprovada() {
        return status == StatusSolicitacao.APROVADA && solicitante.equals(decididaPor);
    }

    private void exigirPendente() {
        if (status != StatusSolicitacao.PENDENTE) {
            throw new RegraDeNegocioException("SOLICITACAO_NAO_PENDENTE", "Esta solicitação já foi "
                    + switch (status) {
                        case APROVADA -> "aprovada.";
                        case REJEITADA -> "rejeitada.";
                        default -> "cancelada.";
                    });
        }
    }

    public Long getId() { return id; }
    public TipoSolicitacao getTipo() { return tipo; }
    public long getProdutoId() { return produtoId; }
    public Long getRemessaId() { return remessaId; }
    public Integer getQuantidade() { return quantidade; }
    public MotivoBaixa getMotivoBaixa() { return motivoBaixa; }
    public BigDecimal getPrecoAtual() { return precoAtual; }
    public BigDecimal getNovoPreco() { return novoPreco; }
    public String getJustificativa() { return justificativa; }
    public FotoSolicitacao getFoto() { return foto; }
    public StatusSolicitacao getStatus() { return status; }
    public String getSolicitante() { return solicitante; }
    public String getSolicitanteNome() { return solicitanteNome; }
    public Instant getSolicitadaEm() { return solicitadaEm; }
    public String getDecididaPor() { return decididaPor; }
    public String getDecididaPorNome() { return decididaPorNome; }
    public Instant getDecididaEm() { return decididaEm; }
    public String getMotivoDecisao() { return motivoDecisao; }
}
