package com.durvalcrm.intencaogasto.domain;

import com.durvalcrm.financeiro.domain.Categoria;
import com.durvalcrm.financeiro.domain.CategoriaFinanceira;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.Dinheiro;
import com.durvalcrm.financeiro.domain.TipoCategoria;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.intencaogasto.domain.EventoIntencao.TipoEvento;
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
import java.util.stream.Collectors;

/**
 * Intenção de gasto (Jornada C, Spec §3): o Vendedor pede, o Tesoureiro ou o Administrador aprova
 * (podendo ajustar só o valor total) ou rejeita. Compras da cantina listam os produtos; depois da
 * aprovação o Vendedor confere o recebimento e, se divergir, a entrada no estoque fica bloqueada até
 * a correção ou o cancelamento. Os efeitos no Financeiro e no Estoque ficam com os casos de uso.
 */
public final class IntencaoGasto {

    public static final int MAXIMO_DESCRICAO = 200;
    public static final int MAXIMO_TEXTO = 1000;
    public static final int MAXIMO_QUANTIDADE = 100_000;

    /** Subcategorias com fluxo próprio, fora das intenções (US-EXPENSE-001). */
    private static final Set<String> FORA_DAS_INTENCOES = Set.of(CategoriaFinanceira.REPASSE_EDITORAS,
            CategoriaFinanceira.TAXAS_CARTAO);

    private final Long id;
    private final String descricao;
    private final String categoria;
    private final BigDecimal valorSolicitado;
    private final String justificativa;
    private List<ItemCompra> itens;
    private StatusIntencao status;
    private final String solicitante;
    private final String solicitanteNome;
    private final Instant criadaEm;
    private Instant statusAlteradoEm;
    private Aprovacao aprovacao;
    private String decididaPor;
    private String decididaPorNome;
    private Instant decididaEm;
    private String motivoRejeicao;
    private String recebidaPor;
    private String recebidaPorNome;
    private Instant recebidaEm;
    private String divergencia;
    private String canceladaPor;
    private String canceladaPorNome;
    private Instant canceladaEm;
    private String motivoCancelamento;
    private final List<EventoIntencao> novosEventos = new ArrayList<>();

    private IntencaoGasto(Long id, String descricao, String categoria, BigDecimal valorSolicitado,
            String justificativa, List<ItemCompra> itens, StatusIntencao status, String solicitante,
            String solicitanteNome, Instant criadaEm, Instant statusAlteradoEm) {
        this.id = id;
        this.descricao = Objects.requireNonNull(descricao);
        this.categoria = Objects.requireNonNull(categoria);
        this.valorSolicitado = Objects.requireNonNull(valorSolicitado);
        this.justificativa = Objects.requireNonNull(justificativa);
        this.itens = List.copyOf(itens);
        this.status = Objects.requireNonNull(status);
        this.solicitante = Objects.requireNonNull(solicitante);
        this.solicitanteNome = solicitanteNome;
        this.criadaEm = Objects.requireNonNull(criadaEm);
        this.statusAlteradoEm = Objects.requireNonNull(statusAlteradoEm);
    }

    /** Subcategoria de despesa ativa que pode ser pedida (sem Repasse às editoras e Taxas de cartão). */
    public static boolean categoriaDisponivel(Categoria c) {
        return c != null && c.subcategoria() && c.ativa() && c.tipo() == TipoCategoria.DESPESA
                && !FORA_DAS_INTENCOES.contains(c.codigo());
    }

    public static boolean compraDaCantina(String categoria) {
        return CategoriaFinanceira.COMPRA_CANTINA.equals(categoria);
    }

    /**
     * US-EXPENSE-001. Na compra da cantina os itens são obrigatórios (produto já validado pelo caso
     * de uso); nas demais, não há itens. O valor é sempre um total único.
     */
    public static IntencaoGasto nova(String descricao, Categoria categoria, BigDecimal valor, String justificativa,
            List<ItemCompra> itens, Autor autor) {
        List<ErroCampo> erros = new ArrayList<>();
        String texto = Textos.compactar(descricao);
        if (texto.isEmpty() || texto.length() > MAXIMO_DESCRICAO) {
            erros.add(new ErroCampo("descricao", "Descreva o gasto (até 200 caracteres)."));
        }
        if (!categoriaDisponivel(categoria)) {
            erros.add(new ErroCampo("categoria", "Escolha uma subcategoria de despesa ativa."));
        }
        exigirValor(valor, "valor", erros);
        String motivo = texto(justificativa, "justificativa", "Explique o motivo da despesa.", erros);
        List<ItemCompra> lista = itens == null ? List.of() : itens;
        if (categoria != null && compraDaCantina(categoria.codigo())) {
            validarItens(lista, erros);
        } else if (!lista.isEmpty()) {
            erros.add(new ErroCampo("itens", "Só a compra de produtos da cantina tem lista de itens."));
        }
        ValidacaoException.lancarSeHouver(erros);
        IntencaoGasto nova = new IntencaoGasto(null, texto, categoria.codigo(), valor, motivo, lista,
                StatusIntencao.PENDENTE, autor.subject(), autor.nome(), autor.em(), autor.em());
        nova.evento(TipoEvento.CRIADA, autor, "Pedido de " + Dinheiro.brl(valor) + " em " + categoria.nomeCompleto()
                + (lista.isEmpty() ? "" : ": " + descreverItens(lista)) + ".");
        return nova;
    }

    public static IntencaoGasto reconstituir(Long id, String descricao, String categoria, BigDecimal valorSolicitado,
            String justificativa, List<ItemCompra> itens, StatusIntencao status, String solicitante,
            String solicitanteNome, Instant criadaEm, Instant statusAlteradoEm, Aprovacao aprovacao,
            String decididaPor, String decididaPorNome, Instant decididaEm, String motivoRejeicao, String recebidaPor,
            String recebidaPorNome, Instant recebidaEm, String divergencia, String canceladaPor,
            String canceladaPorNome, Instant canceladaEm, String motivoCancelamento) {
        IntencaoGasto i = new IntencaoGasto(id, descricao, categoria, valorSolicitado, justificativa, itens, status,
                solicitante, solicitanteNome, criadaEm, statusAlteradoEm);
        i.aprovacao = aprovacao;
        i.decididaPor = decididaPor;
        i.decididaPorNome = decididaPorNome;
        i.decididaEm = decididaEm;
        i.motivoRejeicao = motivoRejeicao;
        i.recebidaPor = recebidaPor;
        i.recebidaPorNome = recebidaPorNome;
        i.recebidaEm = recebidaEm;
        i.divergencia = divergencia;
        i.canceladaPor = canceladaPor;
        i.canceladaPorNome = canceladaPorNome;
        i.canceladaEm = canceladaEm;
        i.motivoCancelamento = motivoCancelamento;
        return i;
    }

    public boolean compraDaCantina() {
        return compraDaCantina(categoria);
    }

    /**
     * US-EXPENSE-004: confirma ou ajusta o valor total, a subcategoria, o meio, a conta e a data. Os
     * itens nunca são aprovados um a um. Mudou valor ou categoria: a nota é obrigatória. A despesa é
     * gravada pelo caso de uso, que depois chama {@link #registrarLancamento}.
     */
    public void aprovar(BigDecimal valor, Categoria categoriaAprovada, MeioPagamentoGasto meio, ContaFinanceira conta,
            LocalDate data, LocalDate hoje, String nota, Autor autor) {
        exigir(StatusIntencao.PENDENTE);
        List<ErroCampo> erros = new ArrayList<>();
        exigirValor(valor, "valor", erros);
        if (!categoriaDisponivel(categoriaAprovada)) {
            erros.add(new ErroCampo("categoria", "Escolha uma subcategoria de despesa ativa."));
        } else if (compraDaCantina(categoriaAprovada.codigo()) != compraDaCantina()) {
            erros.add(new ErroCampo("categoria", compraDaCantina()
                    ? "Uma compra da cantina continua em Compra de produtos da cantina."
                    : "Só pedidos com lista de produtos entram em Compra de produtos da cantina."));
        }
        if (meio == null) {
            erros.add(new ErroCampo("meio", "Escolha o meio de pagamento."));
        }
        if (conta == null || !conta.ativa()) {
            erros.add(new ErroCampo("contaId", "Escolha a conta de origem."));
        } else if (meio != null && (meio.saiDoCaixa() ? conta.tipo() != TipoConta.CAIXA : conta.tipo() != TipoConta.BANCO)) {
            erros.add(new ErroCampo("contaId", meio.saiDoCaixa()
                    ? "Pagamento em dinheiro sai de um caixa."
                    : "PIX, transferência e boleto saem de uma conta bancária."));
        }
        if (data == null) {
            erros.add(new ErroCampo("data", "Informe a data do pagamento."));
        } else if (data.isAfter(hoje)) {
            erros.add(new ErroCampo("data", "A data do pagamento não pode ser futura."));
        }
        String texto = Textos.compactar(nota);
        boolean ajustada = valor != null && valor.compareTo(valorSolicitado) != 0
                || categoriaAprovada != null && !categoriaAprovada.codigo().equals(categoria);
        if (ajustada && texto.isEmpty()) {
            erros.add(new ErroCampo("nota", "Explique o ajuste de valor ou de categoria."));
        } else if (texto.length() > MAXIMO_TEXTO) {
            erros.add(new ErroCampo("nota", "Use até 1000 caracteres."));
        }
        ValidacaoException.lancarSeHouver(erros);
        aprovacao = new Aprovacao(valor, categoriaAprovada.codigo(), categoriaAprovada.nomeCompleto(), meio, conta.id(),
                conta.nome(), data, texto.isEmpty() ? null : texto, null);
        decididaPor = autor.subject();
        decididaPorNome = autor.nome();
        decididaEm = autor.em();
        mudar(compraDaCantina() ? StatusIntencao.AGUARDANDO_RECEBIMENTO : StatusIntencao.APROVADA, autor);
        evento(TipoEvento.APROVADA, autor, "Aprovada: " + Dinheiro.brl(valor) + " em " + categoriaAprovada.nomeCompleto()
                + ", " + rotulo(meio) + " de " + conta.nome() + ", pagamento em " + Dinheiro.data(data) + "."
                + (texto.isEmpty() ? "" : " Nota: " + texto));
    }

    /** Liga a despesa gravada (aprovação) ou a que a substitui (correção com novo valor). */
    public void registrarLancamento(long lancamentoId) {
        if (aprovacao == null) {
            throw new IllegalStateException("Intenção sem aprovação.");
        }
        aprovacao = aprovacao.comLancamento(lancamentoId);
    }

    /** US-EXPENSE-005: nada é lançado. */
    public void rejeitar(String motivo, Autor autor) {
        exigir(StatusIntencao.PENDENTE);
        String texto = motivoObrigatorio(motivo, "Informe o motivo da rejeição.");
        motivoRejeicao = texto;
        decididaPor = autor.subject();
        decididaPorNome = autor.nome();
        decididaEm = autor.em();
        mudar(StatusIntencao.REJEITADA, autor);
        evento(TipoEvento.REJEITADA, autor, "Rejeitada: " + texto);
    }

    /** US-EXPENSE-009: só quem pediu, e só enquanto pendente. */
    public void retirar(String motivo, Autor autor) {
        exigir(StatusIntencao.PENDENTE);
        if (!solicitante.equals(autor.subject())) {
            throw new RegraDeNegocioException("INTENCAO_DE_OUTRO_USUARIO", "Só quem fez o pedido pode retirá-lo.");
        }
        String texto = motivoObrigatorio(motivo, "Informe o motivo da desistência.");
        cancelar(texto, autor);
        evento(TipoEvento.RETIRADA, autor, "Retirada pelo solicitante: " + texto);
    }

    /**
     * US-EXPENSE-006: quantidade recebida de cada item. Tudo confere: devolve {@code true} e o caso de
     * uso dá entrada no estoque. Diferença ou item faltando: a divergência é obrigatória e nada entra.
     */
    public boolean receber(Map<Long, Integer> recebidas, String descricaoDivergencia, Autor autor) {
        exigir(StatusIntencao.AGUARDANDO_RECEBIMENTO);
        List<ErroCampo> erros = new ArrayList<>();
        Map<Long, Integer> quantidades = recebidas == null ? Map.of() : recebidas;
        Set<Long> pedidos = itens.stream().map(ItemCompra::produtoId).collect(Collectors.toSet());
        for (Long produto : quantidades.keySet()) {
            if (!pedidos.contains(produto)) {
                erros.add(new ErroCampo("itens[" + produto + "]", "Este produto não faz parte da compra."));
            }
        }
        List<ItemCompra> conferidos = new ArrayList<>();
        for (ItemCompra item : itens) {
            Integer q = quantidades.get(item.produtoId());
            if (q == null || q < 0 || q > MAXIMO_QUANTIDADE) {
                erros.add(new ErroCampo("itens[" + item.produtoId() + "]", "Informe quanto chegou de " + item.produtoNome()
                        + " (zero se não chegou)."));
            } else {
                conferidos.add(item.recebido(q));
            }
        }
        ValidacaoException.lancarSeHouver(erros);
        boolean confere = conferidos.stream().allMatch(ItemCompra::conferido);
        String texto = Textos.compactar(descricaoDivergencia);
        if (!confere && texto.isEmpty()) {
            throw ValidacaoException.doCampo("divergencia", "Descreva a divergência para a Tesouraria.");
        }
        if (texto.length() > MAXIMO_TEXTO) {
            throw ValidacaoException.doCampo("divergencia", "Use até 1000 caracteres.");
        }
        itens = List.copyOf(conferidos);
        recebidaPor = autor.subject();
        recebidaPorNome = autor.nome();
        recebidaEm = autor.em();
        if (confere) {
            mudar(StatusIntencao.RECEBIDA, autor);
            evento(TipoEvento.RECEBIDA, autor, "Recebimento conferido: " + descreverItens(itens) + ". Estoque atualizado.");
        } else {
            divergencia = texto;
            mudar(StatusIntencao.DIVERGENTE, autor);
            evento(TipoEvento.DIVERGENTE, autor, "Recebimento divergente: " + itens.stream()
                    .map(i -> i.produtoNome() + " " + i.quantidadeRecebida() + " de " + i.quantidade())
                    .collect(Collectors.joining(", ")) + ". " + texto);
        }
        return confere;
    }

    /**
     * US-EXPENSE-007 "Corrigir": quantidades acordadas (zero tira o item) e, se o valor pago mudou, o
     * novo valor. Volta a aguardar o recebimento. Devolve {@code true} quando o valor mudou: o caso
     * de uso estorna a despesa e lança a nova.
     */
    public boolean corrigir(Map<Long, Integer> quantidades, BigDecimal novoValor, String motivo, Autor autor) {
        exigir(StatusIntencao.DIVERGENTE);
        List<ErroCampo> erros = new ArrayList<>();
        Map<Long, Integer> acordadas = quantidades == null ? Map.of() : quantidades;
        List<ItemCompra> corrigidos = new ArrayList<>();
        List<String> mudancas = new ArrayList<>();
        for (ItemCompra item : itens) {
            Integer q = acordadas.get(item.produtoId());
            if (q == null || q < 0 || q > MAXIMO_QUANTIDADE) {
                erros.add(new ErroCampo("itens[" + item.produtoId() + "]", "Informe a quantidade acordada de "
                        + item.produtoNome() + " (zero para tirar o item)."));
                continue;
            }
            if (q != item.quantidade()) {
                mudancas.add(item.produtoNome() + " " + item.quantidade() + " → " + q);
            }
            if (q > 0) {
                corrigidos.add(item.comQuantidade(q));
            }
        }
        if (erros.isEmpty() && corrigidos.isEmpty()) {
            erros.add(new ErroCampo("itens", "A compra precisa de ao menos um item. Para desistir, cancele a compra."));
        }
        BigDecimal valorAtual = aprovacao.valor();
        BigDecimal valor = novoValor == null ? valorAtual : novoValor;
        exigirValor(valor, "valor", erros);
        String texto = texto(motivo, "motivo", "Informe o motivo da correção.", erros);
        ValidacaoException.lancarSeHouver(erros);
        boolean valorMudou = valor.compareTo(valorAtual) != 0;
        if (valorMudou) {
            mudancas.add("valor " + Dinheiro.brl(valorAtual) + " → " + Dinheiro.brl(valor));
            aprovacao = aprovacao.comValor(valor);
        }
        itens = List.copyOf(corrigidos);
        divergencia = null;
        recebidaPor = null;
        recebidaPorNome = null;
        recebidaEm = null;
        mudar(StatusIntencao.AGUARDANDO_RECEBIMENTO, autor);
        evento(TipoEvento.CORRIGIDA, autor, "Corrigida" + (mudancas.isEmpty() ? "" : ": " + String.join("; ", mudancas))
                + ". Motivo: " + texto + (valorMudou ? " Despesa estornada e lançada com o novo valor." : ""));
        return valorMudou;
    }

    /**
     * US-EXPENSE-007 "Cancelar": nada entra no estoque e a despesa é estornada pelo caso de uso
     * (se ainda não foi estornada direto no Financeiro). Devolve o lançamento a estornar.
     */
    public long cancelarDivergente(String motivo, boolean despesaJaEstornada, Autor autor) {
        exigir(StatusIntencao.DIVERGENTE);
        String texto = motivoObrigatorio(motivo, "Informe o motivo do cancelamento.");
        cancelar(texto, autor);
        evento(TipoEvento.CANCELADA, autor, "Compra cancelada após divergência: " + texto
                + (despesaJaEstornada ? " A despesa já havia sido estornada no Financeiro." : " Despesa estornada."));
        return aprovacao.lancamentoId();
    }

    private void cancelar(String motivo, Autor autor) {
        motivoCancelamento = motivo;
        canceladaPor = autor.subject();
        canceladaPorNome = autor.nome();
        canceladaEm = autor.em();
        mudar(StatusIntencao.CANCELADA, autor);
    }

    private void mudar(StatusIntencao novo, Autor autor) {
        status = novo;
        statusAlteradoEm = autor.em();
    }

    private void evento(TipoEvento tipo, Autor autor, String descricao) {
        novosEventos.add(new EventoIntencao(tipo, autor.subject(), autor.nome(), autor.em(), descricao));
    }

    private void exigir(StatusIntencao esperado) {
        if (status != esperado) {
            throw new RegraDeNegocioException("INTENCAO_EM_OUTRA_SITUACAO",
                    "A intenção nº " + id + " está " + rotulo(status) + ".");
        }
    }

    private static void validarItens(List<ItemCompra> itens, List<ErroCampo> erros) {
        if (itens.isEmpty()) {
            erros.add(new ErroCampo("itens", "Liste os produtos da cantina e as quantidades."));
            return;
        }
        Set<Long> vistos = new HashSet<>();
        for (ItemCompra i : itens) {
            if (i.quantidade() <= 0 || i.quantidade() > MAXIMO_QUANTIDADE) {
                erros.add(new ErroCampo("itens[" + i.produtoId() + "]", "Informe uma quantidade inteira positiva."));
            }
            if (!vistos.add(i.produtoId())) {
                erros.add(new ErroCampo("itens[" + i.produtoId() + "]", i.produtoNome() + " aparece mais de uma vez."));
            }
        }
    }

    private static void exigirValor(BigDecimal valor, String campo, List<ErroCampo> erros) {
        if (valor == null || valor.signum() <= 0) {
            erros.add(new ErroCampo(campo, "Informe um valor maior que zero."));
        } else if (valor.scale() > 2) {
            erros.add(new ErroCampo(campo, "Use no máximo duas casas decimais."));
        } else if (valor.precision() - valor.scale() > 10) {
            erros.add(new ErroCampo(campo, "Valor alto demais."));
        }
    }

    private static String texto(String valor, String campo, String mensagem, List<ErroCampo> erros) {
        String texto = Textos.compactar(valor);
        if (texto.isEmpty()) {
            erros.add(new ErroCampo(campo, mensagem));
        } else if (texto.length() > MAXIMO_TEXTO) {
            erros.add(new ErroCampo(campo, "Use até 1000 caracteres."));
        }
        return texto;
    }

    private static String motivoObrigatorio(String motivo, String mensagem) {
        List<ErroCampo> erros = new ArrayList<>();
        String texto = texto(motivo, "motivo", mensagem, erros);
        ValidacaoException.lancarSeHouver(erros);
        return texto;
    }

    private static String descreverItens(List<ItemCompra> itens) {
        return itens.stream().map(i -> (i.quantidadeRecebida() == null ? i.quantidade() : i.quantidadeRecebida())
                + " × " + i.produtoNome()).collect(Collectors.joining(", "));
    }

    public static String rotulo(StatusIntencao s) {
        return switch (s) {
            case PENDENTE -> "pendente";
            case APROVADA -> "aprovada";
            case AGUARDANDO_RECEBIMENTO -> "aguardando recebimento";
            case DIVERGENTE -> "divergente";
            case RECEBIDA -> "recebida";
            case REJEITADA -> "rejeitada";
            case CANCELADA -> "cancelada";
        };
    }

    public static String rotulo(MeioPagamentoGasto m) {
        return switch (m) {
            case DINHEIRO -> "dinheiro";
            case PIX -> "PIX";
            case TRANSFERENCIA -> "transferência";
            case BOLETO -> "boleto";
        };
    }

    public Long getId() { return id; }
    public String getDescricao() { return descricao; }
    public String getCategoria() { return categoria; }
    public BigDecimal getValorSolicitado() { return valorSolicitado; }
    public String getJustificativa() { return justificativa; }
    public List<ItemCompra> getItens() { return itens; }
    public StatusIntencao getStatus() { return status; }
    public String getSolicitante() { return solicitante; }
    public String getSolicitanteNome() { return solicitanteNome; }
    public Instant getCriadaEm() { return criadaEm; }
    public Instant getStatusAlteradoEm() { return statusAlteradoEm; }
    public Aprovacao getAprovacao() { return aprovacao; }
    public String getDecididaPor() { return decididaPor; }
    public String getDecididaPorNome() { return decididaPorNome; }
    public Instant getDecididaEm() { return decididaEm; }
    public String getMotivoRejeicao() { return motivoRejeicao; }
    public String getRecebidaPor() { return recebidaPor; }
    public String getRecebidaPorNome() { return recebidaPorNome; }
    public Instant getRecebidaEm() { return recebidaEm; }
    public String getDivergencia() { return divergencia; }
    public String getCanceladaPor() { return canceladaPor; }
    public String getCanceladaPorNome() { return canceladaPorNome; }
    public Instant getCanceladaEm() { return canceladaEm; }
    public String getMotivoCancelamento() { return motivoCancelamento; }
    public List<EventoIntencao> getNovosEventos() { return List.copyOf(novosEventos); }
}
