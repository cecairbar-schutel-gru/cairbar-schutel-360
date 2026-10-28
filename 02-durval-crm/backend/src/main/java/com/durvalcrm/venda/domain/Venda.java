package com.durvalcrm.venda.domain;

import com.durvalcrm.estoque.domain.TipoProduto;
import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.TipoCartao;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.function.LongSupplier;

/**
 * Venda de livros e produtos da cantina (Jornada B). A soma dos meios de pagamento é
 * exatamente o total, sem desconto nem troco registrado (US-SALES-005). Cancelar preserva a venda
 * original (US-SALES-009).
 */
public final class Venda {

    public static final int MINIMO_MOTIVO_CANCELAMENTO = 10;

    private final Long id;
    private final long numero;
    private final String vendedorSubject;
    private final String vendedorNome;
    /** Feita pelo perfil PDV da cantina: entra no relatório e no painel de todo Vendedor. */
    private final boolean pdv;
    private final Instant confirmadaEm;
    private final LocalDate dataFinanceira;
    private final List<ItemVenda> itens;
    private final List<PagamentoVenda> pagamentos;
    private final String chaveIdempotencia;
    private final Long refazVendaId;
    private final List<LoteVendido> lotes;
    private Long lancamentoId;
    private StatusVenda status;
    private Instant canceladaEm;
    private String canceladaPor;
    private String motivoCancelamento;

    private Venda(Long id, long numero, String vendedorSubject, String vendedorNome, boolean pdv,
            Instant confirmadaEm, LocalDate dataFinanceira, List<ItemVenda> itens, List<PagamentoVenda> pagamentos,
            String chaveIdempotencia, Long refazVendaId, List<LoteVendido> lotes, Long lancamentoId,
            StatusVenda status, Instant canceladaEm, String canceladaPor, String motivoCancelamento) {
        this.id = id;
        this.numero = numero;
        this.vendedorSubject = Objects.requireNonNull(vendedorSubject);
        this.vendedorNome = vendedorNome;
        this.pdv = pdv;
        this.confirmadaEm = Objects.requireNonNull(confirmadaEm);
        this.dataFinanceira = Objects.requireNonNull(dataFinanceira);
        this.itens = List.copyOf(itens);
        this.pagamentos = List.copyOf(pagamentos);
        this.chaveIdempotencia = chaveIdempotencia;
        this.refazVendaId = refazVendaId;
        this.lotes = new ArrayList<>(lotes);
        this.lancamentoId = lancamentoId;
        this.status = Objects.requireNonNull(status);
        this.canceladaEm = canceladaEm;
        this.canceladaPor = canceladaPor;
        this.motivoCancelamento = motivoCancelamento;
    }

    /**
     * Valida itens e pagamentos e só então pede o número, para não consumir a sequência com uma
     * venda inválida.
     */
    public static Venda confirmar(List<ItemVenda> itens, List<PagamentoVenda> pagamentos, String vendedorSubject,
            String vendedorNome, boolean pdv, Instant agora, LocalDate dataFinanceira,
            String chaveIdempotencia, Long refazVendaId, LongSupplier proximoNumero) {
        validar(itens, pagamentos);
        return new Venda(null, proximoNumero.getAsLong(), vendedorSubject, vendedorNome, pdv, agora,
                dataFinanceira, itens, pagamentos, chaveIdempotencia, refazVendaId, List.of(), null,
                StatusVenda.CONCLUIDA, null, null, null);
    }

    public static Venda reconstituir(Long id, long numero, String vendedorSubject, String vendedorNome, boolean pdv,
            Instant confirmadaEm, LocalDate dataFinanceira, List<ItemVenda> itens,
            List<PagamentoVenda> pagamentos, String chaveIdempotencia, Long refazVendaId, List<LoteVendido> lotes,
            Long lancamentoId, StatusVenda status, Instant canceladaEm, String canceladaPor,
            String motivoCancelamento) {
        return new Venda(id, numero, vendedorSubject, vendedorNome, pdv, confirmadaEm, dataFinanceira,
                itens, pagamentos, chaveIdempotencia, refazVendaId, lotes, lancamentoId, status, canceladaEm,
                canceladaPor, motivoCancelamento);
    }

    private static void validar(List<ItemVenda> itens, List<PagamentoVenda> pagamentos) {
        List<ErroCampo> erros = new ArrayList<>();
        if (itens.isEmpty()) {
            erros.add(new ErroCampo("itens", "Adicione ao menos um produto."));
        }
        if (itens.stream().anyMatch(i -> i.quantidade() <= 0)) {
            erros.add(new ErroCampo("itens", "As quantidades devem ser positivas."));
        }
        if (new HashSet<>(itens.stream().map(ItemVenda::produtoId).toList()).size() != itens.size()) {
            erros.add(new ErroCampo("itens", "Cada produto deve aparecer uma única vez no carrinho."));
        }
        if (pagamentos.isEmpty()) {
            erros.add(new ErroCampo("pagamentos", "Informe ao menos uma forma de pagamento."));
        }
        if (pagamentos.stream().anyMatch(p -> !valorValido(p.valor()))) {
            erros.add(new ErroCampo("pagamentos", "Os valores devem ser positivos, com até duas casas decimais."));
        }
        if (contar(pagamentos, MeioPagamento.DINHEIRO) > 1 || contar(pagamentos, MeioPagamento.CARTAO) > 1) {
            erros.add(new ErroCampo("pagamentos", "Informe um único valor em dinheiro e um único valor em cartão."));
        }
        pagamentos.forEach(p -> TipoCartao.conferir(p.meio() == MeioPagamento.CARTAO, p.tipoCartao())
                .ifPresent(erros::add));
        ValidacaoException.lancarSeHouver(erros);

        BigDecimal total = soma(itens.stream().map(ItemVenda::subtotal).toList());
        BigDecimal recebido = soma(pagamentos.stream().map(PagamentoVenda::valor).toList());
        int comparacao = recebido.compareTo(total);
        if (comparacao < 0) {
            throw ValidacaoException.doCampo("pagamentos", "Faltam " + brl(total.subtract(recebido))
                    + " para fechar o total de " + brl(total) + ".");
        }
        if (comparacao > 0) {
            throw ValidacaoException.doCampo("pagamentos", "Os pagamentos passam o total de " + brl(total) + " em "
                    + brl(recebido.subtract(total)) + ". Registre só o valor da venda; o troco não entra.");
        }
    }

    private static boolean valorValido(BigDecimal valor) {
        return valor != null && valor.signum() > 0 && valor.stripTrailingZeros().scale() <= 2;
    }

    private static long contar(List<PagamentoVenda> pagamentos, MeioPagamento meio) {
        return pagamentos.stream().filter(p -> p.meio() == meio).count();
    }

    public void registrarLote(LoteVendido lote) {
        if (id == null || lancamentoId != null) {
            throw new IllegalStateException("Lotes só são registrados durante a confirmação.");
        }
        lotes.add(lote);
    }

    public void vincularLancamento(long lancamentoId) {
        if (this.lancamentoId != null) {
            throw new IllegalStateException("Venda já lançada no financeiro.");
        }
        this.lancamentoId = lancamentoId;
    }

    /** O original permanece, com quem cancelou, quando e por quê (US-SALES-009). */
    public void cancelar(String motivo, String autor, Instant agora) {
        if (status == StatusVenda.CANCELADA) {
            throw new RegraDeNegocioException("VENDA_JA_CANCELADA", "Esta venda já foi cancelada.");
        }
        if (motivo == null || motivo.trim().length() < MINIMO_MOTIVO_CANCELAMENTO) {
            throw ValidacaoException.doCampo("motivo",
                    "Informe o motivo com pelo menos " + MINIMO_MOTIVO_CANCELAMENTO + " caracteres.");
        }
        status = StatusVenda.CANCELADA;
        canceladaEm = agora;
        canceladaPor = autor;
        motivoCancelamento = motivo.trim();
    }

    public BigDecimal total() {
        return soma(itens.stream().map(ItemVenda::subtotal).toList());
    }

    public BigDecimal totalPorTipo(TipoProduto tipo) {
        return soma(itens.stream().filter(i -> i.tipo() == tipo).map(ItemVenda::subtotal).toList());
    }

    public BigDecimal valorPorMeio(MeioPagamento meio) {
        return soma(pagamentos.stream().filter(p -> p.meio() == meio).map(PagamentoVenda::valor).toList());
    }

    public boolean isCancelada() {
        return status == StatusVenda.CANCELADA;
    }

    public static BigDecimal soma(List<BigDecimal> valores) {
        return valores.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** "R$ 1.234,56", com espaço comum (o formato do JDK usa espaço não separável). */
    public static String brl(BigDecimal valor) {
        return NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR")).format(valor).replace('\u00A0', ' ');
    }

    public Long getId() { return id; }
    public long getNumero() { return numero; }
    public String getVendedorSubject() { return vendedorSubject; }
    public String getVendedorNome() { return vendedorNome; }
    public boolean isPdv() { return pdv; }
    public Instant getConfirmadaEm() { return confirmadaEm; }
    public LocalDate getDataFinanceira() { return dataFinanceira; }
    public List<ItemVenda> getItens() { return itens; }
    public List<PagamentoVenda> getPagamentos() { return pagamentos; }
    public String getChaveIdempotencia() { return chaveIdempotencia; }
    public Long getRefazVendaId() { return refazVendaId; }
    public List<LoteVendido> getLotes() { return List.copyOf(lotes); }
    public Long getLancamentoId() { return lancamentoId; }
    public StatusVenda getStatus() { return status; }
    public Instant getCanceladaEm() { return canceladaEm; }
    public String getCanceladaPor() { return canceladaPor; }
    public String getMotivoCancelamento() { return motivoCancelamento; }
}
