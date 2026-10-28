package com.durvalcrm.venda.application;

import com.durvalcrm.estoque.application.EstoqueParaVendaUseCase;
import com.durvalcrm.estoque.domain.Produto;
import com.durvalcrm.shared.application.DadosOrganizacaoPort;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.venda.domain.FiltroVendas;
import com.durvalcrm.venda.domain.ItemVenda;
import com.durvalcrm.venda.domain.MeioPagamento;
import com.durvalcrm.venda.domain.PagamentoVenda;
import com.durvalcrm.venda.domain.StatusVenda;
import com.durvalcrm.venda.domain.Venda;
import com.durvalcrm.venda.domain.VendaRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

/** Lista, detalhe, comprovante, painel do Vendedor e dados para refazer (US-SALES-008, 010, 011, 021). */
public class ConsultarVendasUseCase {

    public static final int LIMITE_LISTA = 500;

    private final VendaRepository vendas;
    private final EstoqueParaVendaUseCase estoque;
    private final DadosOrganizacaoPort organizacao;
    private final GeradorComprovanteVendaPdfPort pdf;
    private final OpcoesVendaUseCase opcoes;
    private final Clock relogio;

    public ConsultarVendasUseCase(VendaRepository vendas, EstoqueParaVendaUseCase estoque,
            DadosOrganizacaoPort organizacao, GeradorComprovanteVendaPdfPort pdf, OpcoesVendaUseCase opcoes,
            Clock relogio) {
        this.vendas = vendas;
        this.estoque = estoque;
        this.organizacao = organizacao;
        this.pdf = pdf;
        this.opcoes = opcoes;
        this.relogio = relogio;
    }

    /**
     * Vendas visíveis ao usuário (as próprias, ou todas para a tesouraria), da mais recente para a mais
     * antiga. Sem período, mostra as de hoje; a busca por número ignora o período.
     */
    @Transactional(readOnly = true)
    public List<ResumoVenda> listar(LocalDate de, LocalDate ate, StatusVenda status, Boolean pdv, Long numero) {
        LocalDate hoje = LocalDate.now(relogio);
        String vendedor = opcoes.vendedorVisivel();
        FiltroVendas filtro = numero != null
                ? new FiltroVendas(null, null, vendedor, status, pdv, numero, LIMITE_LISTA)
                : new FiltroVendas(de != null ? de : hoje, ate != null ? ate : (de != null ? de : hoje), vendedor,
                        status, pdv, null, LIMITE_LISTA);
        return vendas.listar(filtro).stream()
                .map(v -> new ResumoVenda(v.getId(), v.getNumero(), v.getConfirmadaEm(), v.getVendedorNome(), v.total(),
                        v.getPagamentos().stream().map(PagamentoVenda::meio).distinct().sorted().toList(),
                        v.getStatus(), v.isPdv()))
                .toList();
    }

    @Transactional(readOnly = true)
    public DetalheVenda detalhe(long id) {
        Venda v = CarregarVenda.ou404(vendas, id);
        opcoes.exigirAcesso(v);
        return detalhe(v);
    }

    /** Última venda registrada pelo próprio usuário, para o botão "Última venda" do PDV (US-SALES-022). */
    @Transactional(readOnly = true)
    public Optional<DetalheVenda> ultimaDoUsuario() {
        return CarregarVenda.ultimaDe(vendas, opcoes.vendedorAtual()).map(this::detalhe);
    }

    private DetalheVenda detalhe(Venda v) {
        long id = v.getId();
        DetalheVenda.Referencia refaz = v.getRefazVendaId() == null ? null
                : vendas.buscarPorId(v.getRefazVendaId())
                        .map(o -> new DetalheVenda.Referencia(o.getId(), o.getNumero())).orElse(null);
        DetalheVenda.Referencia refeita = vendas.buscarRefeitaDe(id)
                .map(o -> new DetalheVenda.Referencia(o.getId(), o.getNumero())).orElse(null);
        List<DetalheVenda.Item> itens = v.getItens().stream().map(i -> new DetalheVenda.Item(i.produtoId(),
                i.produtoNome(), i.tipo(), i.quantidade(), i.precoUnitario(), i.subtotal(),
                v.getLotes().stream().filter(l -> l.produtoId() == i.produtoId())
                        .map(l -> new DetalheVenda.Lote(l.remessaId(), l.remessaCodigo(), l.quantidade(),
                                l.repassePercentual(), l.obrigacaoId(), l.valorObrigacao()))
                        .toList()))
                .toList();
        return new DetalheVenda(v.getId(), v.getNumero(), v.getConfirmadaEm(), v.getVendedorNome(), v.isPdv(), itens, v.getPagamentos(), v.total(), v.getStatus(), v.getCanceladaEm(),
                v.getCanceladaPor(), v.getMotivoCancelamento(), refaz, refeita, organizacao.atuais());
    }

    @Transactional(readOnly = true)
    public byte[] comprovantePdf(long id, LayoutComprovante layout) {
        return pdf.gerar(detalhe(id), layout);
    }

    /** O carrinho é montado de novo com o preço e o saldo atuais; o pagamento é informado outra vez. */
    @Transactional(readOnly = true)
    public VendaParaRefazer paraRefazer(long id) {
        Venda v = CarregarVenda.ou404(vendas, id);
        opcoes.exigirAcesso(v);
        if (!v.isCancelada()) {
            throw new RegraDeNegocioException("VENDA_NAO_CANCELADA", "Só uma venda cancelada pode ser refeita.");
        }
        vendas.buscarRefeitaDe(id).ifPresent(r -> {
            throw new RegraDeNegocioException("VENDA_JA_REFEITA",
                    "A venda nº " + v.getNumero() + " já foi refeita como nº " + r.getNumero() + ".");
        });
        Map<Long, Produto> atuais = estoque.consultar(v.getItens().stream().map(ItemVenda::produtoId).toList())
                .stream().collect(Collectors.toMap(Produto::id, Function.identity()));
        return new VendaParaRefazer(v.getId(), v.getNumero(), v.getItens().stream().map(i -> {
            Produto p = atuais.get(i.produtoId());
            return new VendaParaRefazer.Item(i.produtoId(), i.produtoNome(), i.tipo(), i.quantidade(),
                    i.precoUnitario(), p == null ? i.precoUnitario() : p.preco(), p == null ? 0 : p.saldo(),
                    p != null && p.ativo());
        }).toList());
    }

    @Transactional(readOnly = true)
    public PainelVendedor painelVendedor() {
        LocalDate hoje = LocalDate.now(relogio);
        List<Venda> doDia = vendas.listarDoDiaDoVendedorEDoPdv(hoje, opcoes.vendedorAtual());
        List<Venda> concluidas = doDia.stream().filter(v -> !v.isCancelada()).toList();
        return new PainelVendedor(hoje, concluidas.size(), somaPorMeio(concluidas, MeioPagamento.DINHEIRO),
                somaPorMeio(concluidas, MeioPagamento.PIX), somaPorMeio(concluidas, MeioPagamento.CARTAO),
                doDia.size() - concluidas.size());
    }

    private static BigDecimal somaPorMeio(List<Venda> lista, MeioPagamento meio) {
        return Venda.soma(lista.stream().map(v -> v.valorPorMeio(meio)).toList());
    }
}
