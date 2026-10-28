package com.durvalcrm.editora.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Objects;

/**
 * Valor devido à editora por unidades consignadas vendidas ou perdidas: preço unitário cobrado ×
 * quantidade × percentual de repasse da remessa (US-PUBLISHER-003), arredondado ao centavo.
 */
public final class Obrigacao {

    private static final BigDecimal CEM = BigDecimal.valueOf(100);

    private final Long id;
    private final long editoraId;
    private final long remessaId;
    private final long produtoId;
    private final OrigemObrigacao origem;
    private final long origemId;
    private final int quantidade;
    private final BigDecimal precoUnitario;
    private final BigDecimal repassePercentual;
    private final BigDecimal valor;
    private BigDecimal valorPago;
    private StatusObrigacao status;
    private final Instant criadaEm;
    private Instant estornadaEm;

    private Obrigacao(Long id, long editoraId, long remessaId, long produtoId, OrigemObrigacao origem, long origemId,
            int quantidade, BigDecimal precoUnitario, BigDecimal repassePercentual, BigDecimal valor,
            BigDecimal valorPago, StatusObrigacao status, Instant criadaEm, Instant estornadaEm) {
        this.id = id;
        this.editoraId = editoraId;
        this.remessaId = remessaId;
        this.produtoId = produtoId;
        this.origem = Objects.requireNonNull(origem);
        this.origemId = origemId;
        this.quantidade = quantidade;
        this.precoUnitario = Objects.requireNonNull(precoUnitario);
        this.repassePercentual = Objects.requireNonNull(repassePercentual);
        this.valor = Objects.requireNonNull(valor);
        this.valorPago = Objects.requireNonNull(valorPago);
        this.status = Objects.requireNonNull(status);
        this.criadaEm = Objects.requireNonNull(criadaEm);
        this.estornadaEm = estornadaEm;
    }

    public static Obrigacao porVenda(ItemRemessa item, long vendaId, int quantidade, BigDecimal precoUnitario,
            Instant agora) {
        if (quantidade <= 0) {
            throw new IllegalArgumentException("A quantidade deve ser positiva.");
        }
        return new Obrigacao(null, item.editoraId(), item.remessaId(), item.produtoId(), OrigemObrigacao.VENDA, vendaId,
                quantidade, precoUnitario, item.repassePercentual(), calcular(quantidade, precoUnitario,
                        item.repassePercentual()),
                BigDecimal.ZERO, StatusObrigacao.ABERTA, agora, null);
    }

    /**
     * Dano ou extravio de consignado aprovado (US-INVENTORY-008): preço do livro na aprovação ×
     * percentual da remessa × quantidade, sem receita.
     */
    public static Obrigacao porBaixa(ItemRemessa item, long solicitacaoId, int quantidade, BigDecimal precoUnitario,
            Instant agora) {
        if (quantidade <= 0) {
            throw new IllegalArgumentException("A quantidade deve ser positiva.");
        }
        return new Obrigacao(null, item.editoraId(), item.remessaId(), item.produtoId(), OrigemObrigacao.BAIXA,
                solicitacaoId, quantidade, precoUnitario, item.repassePercentual(),
                calcular(quantidade, precoUnitario, item.repassePercentual()), BigDecimal.ZERO, StatusObrigacao.ABERTA,
                agora, null);
    }

    public static BigDecimal calcular(int quantidade, BigDecimal precoUnitario, BigDecimal repassePercentual) {
        return precoUnitario.multiply(BigDecimal.valueOf(quantidade)).multiply(repassePercentual)
                .divide(CEM, 2, RoundingMode.HALF_UP);
    }

    public static Obrigacao reconstituir(Long id, long editoraId, long remessaId, long produtoId, OrigemObrigacao origem,
            long origemId, int quantidade, BigDecimal precoUnitario, BigDecimal repassePercentual, BigDecimal valor,
            BigDecimal valorPago, StatusObrigacao status, Instant criadaEm, Instant estornadaEm) {
        return new Obrigacao(id, editoraId, remessaId, produtoId, origem, origemId, quantidade, precoUnitario,
                repassePercentual, valor, valorPago, status, criadaEm, estornadaEm);
    }

    /**
     * Estorna pelo cancelamento da origem. Devolve o valor já pago, que vira crédito da editora
     * (US-PUBLISHER-008); zero se nada foi pago.
     */
    public BigDecimal estornar(Instant agora) {
        if (status == StatusObrigacao.ESTORNADA) {
            throw new IllegalStateException("Obrigação já estornada.");
        }
        status = StatusObrigacao.ESTORNADA;
        estornadaEm = agora;
        return valorPago;
    }

    /** Parte de um pagamento (US-PUBLISHER-008); a obrigação pode ficar parcialmente paga. */
    public void pagar(BigDecimal parte) {
        if (status == StatusObrigacao.ESTORNADA || parte.signum() <= 0 || parte.compareTo(getValorAberto()) > 0) {
            throw new IllegalStateException("Alocação inválida para a obrigação " + id + ".");
        }
        valorPago = valorPago.add(parte);
        status = valorPago.compareTo(valor) == 0 ? StatusObrigacao.PAGA : StatusObrigacao.PARCIALMENTE_PAGA;
    }

    /**
     * Desfaz a parte de um pagamento estornado (US-FINANCIAL-010). Numa obrigação já estornada, só o
     * valor pago diminui (o crédito que ela gerou é reduzido pelo chamador).
     */
    public void reabrir(BigDecimal parte) {
        if (parte.signum() <= 0 || parte.compareTo(valorPago) > 0) {
            throw new IllegalStateException("Reabertura inválida para a obrigação " + id + ".");
        }
        valorPago = valorPago.subtract(parte);
        if (status != StatusObrigacao.ESTORNADA) {
            status = valorPago.signum() == 0 ? StatusObrigacao.ABERTA : StatusObrigacao.PARCIALMENTE_PAGA;
        }
    }

    /** Quanto falta pagar; zero se estornada. */
    public BigDecimal getValorAberto() {
        return status == StatusObrigacao.ESTORNADA ? BigDecimal.ZERO : valor.subtract(valorPago);
    }

    public Long getId() { return id; }
    public long getEditoraId() { return editoraId; }
    public long getRemessaId() { return remessaId; }
    public long getProdutoId() { return produtoId; }
    public OrigemObrigacao getOrigem() { return origem; }
    public long getOrigemId() { return origemId; }
    public int getQuantidade() { return quantidade; }
    public BigDecimal getPrecoUnitario() { return precoUnitario; }
    public BigDecimal getRepassePercentual() { return repassePercentual; }
    public BigDecimal getValor() { return valor; }
    public BigDecimal getValorPago() { return valorPago; }
    public StatusObrigacao getStatus() { return status; }
    public Instant getCriadaEm() { return criadaEm; }
    public Instant getEstornadaEm() { return estornadaEm; }
}
