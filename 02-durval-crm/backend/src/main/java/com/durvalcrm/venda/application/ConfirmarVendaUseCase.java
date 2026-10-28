package com.durvalcrm.venda.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.editora.application.ObrigacaoGerada;
import com.durvalcrm.editora.application.ObrigacoesEditoraUseCase;
import com.durvalcrm.estoque.application.EstoqueParaVendaUseCase;
import com.durvalcrm.estoque.domain.Produto;
import com.durvalcrm.estoque.domain.Retirada;
import com.durvalcrm.estoque.domain.TipoProduto;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.financeiro.application.NovoLancamento;
import com.durvalcrm.financeiro.domain.CategoriaFinanceira;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.LinhaCategoria;
import com.durvalcrm.financeiro.domain.LinhaConta;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.TipoCartao;
import com.durvalcrm.shared.domain.ValidacaoException;
import com.durvalcrm.venda.domain.ItemVenda;
import com.durvalcrm.venda.domain.LoteVendido;
import com.durvalcrm.venda.domain.PagamentoVenda;
import com.durvalcrm.venda.domain.Venda;
import com.durvalcrm.venda.domain.VendaRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

/**
 * Confirma a venda numa única transação (US-SALES-006): reconfere preço e saldo de cada item com
 * os lotes travados, grava a venda numerada, tira o estoque por FIFO, cria as obrigações dos
 * consignados e lança receitas e contas no financeiro. Qualquer falha desfaz tudo.
 */
public class ConfirmarVendaUseCase {

    static final String ORIGEM = "VENDA";

    private final VendaRepository vendas;
    private final NumeracaoVendaPort numeracao;
    private final EstoqueParaVendaUseCase estoque;
    private final ObrigacoesEditoraUseCase editoras;
    private final MovimentoFinanceiroUseCase financeiro;
    private final OpcoesVendaUseCase opcoes;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public ConfirmarVendaUseCase(VendaRepository vendas, NumeracaoVendaPort numeracao, EstoqueParaVendaUseCase estoque,
            ObrigacoesEditoraUseCase editoras, MovimentoFinanceiroUseCase financeiro, OpcoesVendaUseCase opcoes,
            RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario, Clock relogio) {
        this.vendas = vendas;
        this.numeracao = numeracao;
        this.estoque = estoque;
        this.editoras = editoras;
        this.financeiro = financeiro;
        this.opcoes = opcoes;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    @Transactional
    public Venda confirmar(ConfirmarVendaCommand cmd) {
        if (Textos.vazio(cmd.chaveIdempotencia()) || cmd.chaveIdempotencia().length() > 100) {
            throw ValidacaoException.doCampo("chaveIdempotencia", "Chave de idempotência inválida.");
        }
        // Clique duplo ou nova tentativa: devolve a venda já registrada com a mesma chave.
        Optional<Venda> repetida = vendas.buscarPorChaveIdempotencia(cmd.chaveIdempotencia());
        if (repetida.isPresent()) {
            return repetida.get();
        }
        if (cmd.refazVendaId() != null && CatalogoVendaUseCase.somentePdv(usuario)) {
            throw new RegraDeNegocioException("SO_PDV", "O perfil PDV não refaz vendas.");
        }
        validarRefazer(cmd.refazVendaId());
        List<ItemVenda> itens = itensComPrecoESaldo(cmd.itens());
        List<PagamentoVenda> pagamentos = pagamentos(cmd);

        LocalDate hoje = LocalDate.now(relogio);
        Venda venda = vendas.salvar(Venda.confirmar(itens, pagamentos, usuario.getSubject(),
                usuario.getNome(), CatalogoVendaUseCase.somentePdv(usuario), relogio.instant(), hoje, cmd.chaveIdempotencia(), cmd.refazVendaId(),
                numeracao::proximo));

        for (ItemVenda item : venda.getItens()) {
            for (Retirada r : estoque.retirarParaVenda(item.produtoId(), item.quantidade(), venda.getId())) {
                if (!r.consignada()) {
                    venda.registrarLote(LoteVendido.proprio(item.produtoId(), r.quantidade()));
                    continue;
                }
                ObrigacaoGerada o = editoras.registrarPorVenda(venda.getId(), r.remessaId(), item.produtoId(),
                        r.quantidade(), item.precoUnitario());
                venda.registrarLote(new LoteVendido(item.produtoId(), r.remessaId(), o.remessaCodigo(), r.quantidade(),
                        o.repassePercentual(), o.id(), o.valor()));
            }
        }
        venda.vincularLancamento(financeiro.lancar(lancamento(venda)));
        Venda salva = vendas.salvar(venda);

        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("numero", salva.getNumero());
        detalhes.put("total", salva.total());
        if (salva.getRefazVendaId() != null) {
            detalhes.put("refazVendaId", salva.getRefazVendaId());
        }
        auditoria.registrar("VENDA_CONFIRMADA", CarregarVenda.ENTIDADE, salva.getId(), detalhes);
        return salva;
    }

    /** Só uma venda cancelada pode ser refeita, e uma única vez (US-SALES-010). */
    private void validarRefazer(Long refazVendaId) {
        if (refazVendaId == null) {
            return;
        }
        Venda original = CarregarVenda.ou404(vendas, refazVendaId);
        if (!original.isCancelada()) {
            throw new RegraDeNegocioException("VENDA_NAO_CANCELADA", "Só uma venda cancelada pode ser refeita.");
        }
        vendas.buscarRefeitaDe(refazVendaId).ifPresent(v -> {
            throw new RegraDeNegocioException("VENDA_JA_REFEITA",
                    "A venda nº " + original.getNumero() + " já foi refeita como nº " + v.getNumero() + ".");
        });
    }

    /**
     * Preço e saldo vigentes na confirmação. Os lotes ficam travados até o fim da transação, então
     * duas vendas simultâneas não vendem a mesma unidade.
     */
    private List<ItemVenda> itensComPrecoESaldo(List<ConfirmarVendaCommand.Item> pedidos) {
        for (ConfirmarVendaCommand.Item p : pedidos) {
            if (p.produtoId() == null || p.quantidade() == null || p.quantidade() <= 0) {
                throw ValidacaoException.doCampo("itens", "Informe o produto e uma quantidade positiva em cada item.");
            }
        }
        List<Long> ids = pedidos.stream().map(ConfirmarVendaCommand.Item::produtoId).toList();
        Map<Long, Produto> produtos = estoque.consultar(ids).stream()
                .collect(Collectors.toMap(Produto::id, Function.identity()));

        List<ErroCampo> indisponiveis = new ArrayList<>();
        List<ErroCampo> precos = new ArrayList<>();
        for (ConfirmarVendaCommand.Item p : pedidos) {
            Produto produto = produtos.get(p.produtoId());
            if (produto == null || !produto.ativo()) {
                indisponiveis.add(new ErroCampo(campo(p.produtoId()), "Produto inativo: não pode ser vendido."));
            } else if (p.precoUnitario() != null && p.precoUnitario().compareTo(produto.preco()) != 0) {
                precos.add(new ErroCampo(campo(p.produtoId()), "O preço de " + produto.nome() + " agora é "
                        + Venda.brl(produto.preco()) + "."));
            }
        }
        if (!indisponiveis.isEmpty()) {
            throw new RegraDeNegocioException("PRODUTO_INATIVO",
                    "Há produto inativo no carrinho. Remova-o para continuar.", indisponiveis);
        }
        if (!precos.isEmpty()) {
            throw new RegraDeNegocioException("PRECO_ALTERADO",
                    "O preço de algum produto mudou. Confira o carrinho antes de confirmar.", precos);
        }

        Map<Long, Integer> saldos = estoque.travarSaldos(ids);
        List<ErroCampo> faltas = new ArrayList<>();
        for (ConfirmarVendaCommand.Item p : pedidos) {
            int saldo = saldos.getOrDefault(p.produtoId(), 0);
            if (p.quantidade() > saldo) {
                faltas.add(new ErroCampo(campo(p.produtoId()), saldo == 0 ? "Sem estoque."
                        : "Só " + saldo + (saldo == 1 ? " disponível." : " disponíveis.")));
            }
        }
        if (!faltas.isEmpty()) {
            throw new RegraDeNegocioException("ESTOQUE_INSUFICIENTE",
                    "Estoque insuficiente para algum item. Nada foi registrado.", faltas);
        }
        return pedidos.stream().map(p -> {
            Produto produto = produtos.get(p.produtoId());
            return new ItemVenda(produto.id(), produto.nome(), produto.tipo(), p.quantidade(), produto.preco());
        }).toList();
    }

    /** "itens[12]": o frontend destaca a linha do produto 12. */
    private static String campo(long produtoId) {
        return "itens[" + produtoId + "]";
    }

    private List<PagamentoVenda> pagamentos(ConfirmarVendaCommand cmd) {
        List<PagamentoVenda> resultado = new ArrayList<>();
        for (ConfirmarVendaCommand.Pagamento p : cmd.pagamentos()) {
            if (p.meio() == null || p.valor() == null) {
                throw ValidacaoException.doCampo("pagamentos", "Informe o meio e o valor de cada pagamento.");
            }
            ContaFinanceira conta = opcoes.contaDe(p.meio());
            resultado.add(new PagamentoVenda(p.meio(), conta.id(), conta.nome(), p.valor(), p.tipoCartao()));
        }
        return resultado;
    }

    /**
     * Uma linha por conta e uma por subcategoria de receita (Livros e Cantina), pelo valor bruto. A
     * linha de Cartão a receber leva o tipo do cartão (há um único pagamento em cartão por venda).
     */
    private static NovoLancamento lancamento(Venda v) {
        Map<Long, BigDecimal> porConta = new LinkedHashMap<>();
        Map<Long, TipoCartao> tipoPorConta = new LinkedHashMap<>();
        for (PagamentoVenda p : v.getPagamentos()) {
            porConta.merge(p.contaId(), p.valor(), BigDecimal::add);
            if (p.tipoCartao() != null) {
                tipoPorConta.put(p.contaId(), p.tipoCartao());
            }
        }
        List<LinhaConta> contas = porConta.entrySet().stream()
                .map(e -> new LinhaConta(e.getKey(), e.getValue(), tipoPorConta.get(e.getKey()))).toList();
        List<LinhaCategoria> categorias = new ArrayList<>();
        BigDecimal livros = v.totalPorTipo(TipoProduto.LIVRO);
        BigDecimal cantina = v.totalPorTipo(TipoProduto.CANTINA);
        if (livros.signum() > 0) {
            categorias.add(new LinhaCategoria(CategoriaFinanceira.VENDAS_LIVROS, livros));
        }
        if (cantina.signum() > 0) {
            categorias.add(new LinhaCategoria(CategoriaFinanceira.VENDAS_CANTINA, cantina));
        }
        return new NovoLancamento(v.getDataFinanceira(), ORIGEM, v.getId(), "Venda nº " + v.getNumero(), contas,
                categorias);
    }
}
