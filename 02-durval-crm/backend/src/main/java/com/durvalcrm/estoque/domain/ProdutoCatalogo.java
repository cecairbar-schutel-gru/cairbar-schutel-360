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
 * Cadastro de um livro (US-INVENTORY-001) ou produto da cantina (US-INVENTORY-002). O preço só muda
 * por {@link #alterarPreco}, que devolve a linha do histórico; vendas passadas guardam o seu.
 */
public final class ProdutoCatalogo {

    public static final int MAXIMO_NOME = 200;
    public static final int MAXIMO_CATEGORIA = 60;
    private static final BigDecimal CEM = BigDecimal.valueOf(100);

    private final Long id;
    private final TipoProduto tipo;
    private String nome;
    private String categoria;
    private String autor;
    private Isbn isbn;
    private Long editoraId;
    private BigDecimal preco;
    private BigDecimal repassePadrao;
    private boolean ativo;

    private ProdutoCatalogo(Long id, TipoProduto tipo, String nome, String categoria, String autor, Isbn isbn,
            Long editoraId, BigDecimal preco, BigDecimal repassePadrao, boolean ativo) {
        this.id = id;
        this.tipo = Objects.requireNonNull(tipo);
        this.nome = Objects.requireNonNull(nome);
        this.categoria = categoria;
        this.autor = autor;
        this.isbn = isbn;
        this.editoraId = editoraId;
        this.preco = Objects.requireNonNull(preco);
        this.repassePadrao = repassePadrao;
        this.ativo = ativo;
    }

    public static ProdutoCatalogo novoLivro(DadosLivro dados, BigDecimal preco) {
        ProdutoCatalogo p = new ProdutoCatalogo(null, TipoProduto.LIVRO, "", null, null, null, null,
                Precos.validar("preco", preco), null, true);
        p.atualizarLivro(dados);
        return p;
    }

    /** Começa ativo e com saldo zero: o estoque entra por compra ou doação. */
    public static ProdutoCatalogo novoCantina(String nome, String categoria, BigDecimal preco) {
        ProdutoCatalogo p = new ProdutoCatalogo(null, TipoProduto.CANTINA, "", null, null, null, null,
                Precos.validar("preco", preco), null, true);
        p.corrigirCantina(nome, categoria);
        return p;
    }

    public static ProdutoCatalogo reconstituir(Long id, TipoProduto tipo, String nome, String categoria, String autor,
            String isbn, Long editoraId, BigDecimal preco, BigDecimal repassePadrao, boolean ativo) {
        return new ProdutoCatalogo(id, tipo, nome, categoria, autor, isbn == null ? null : new Isbn(isbn), editoraId,
                preco, repassePadrao, ativo);
    }

    public void atualizarLivro(DadosLivro dados) {
        exigirTipo(TipoProduto.LIVRO);
        List<ErroCampo> erros = new ArrayList<>();
        String titulo = Textos.compactar(dados.titulo());
        if (titulo.isEmpty()) {
            erros.add(new ErroCampo("titulo", "Informe o título."));
        } else if (titulo.length() > MAXIMO_NOME) {
            erros.add(new ErroCampo("titulo", "Use até " + MAXIMO_NOME + " caracteres."));
        }
        String autorNovo = Textos.compactar(dados.autor());
        if (autorNovo.length() > MAXIMO_NOME) {
            erros.add(new ErroCampo("autor", "Use até " + MAXIMO_NOME + " caracteres."));
        }
        BigDecimal repasse = dados.repassePadrao();
        if (repasse != null && (repasse.signum() < 0 || repasse.compareTo(CEM) > 0 || repasse.scale() > 2)) {
            erros.add(new ErroCampo("repassePadrao", "O repasse deve estar entre 0% e 100%, com até duas casas."));
        }
        if (repasse != null && dados.editoraId() == null) {
            erros.add(new ErroCampo("editoraId", "Informe a editora do título consignado."));
        }
        Isbn novoIsbn = null;
        try {
            novoIsbn = Isbn.deTexto(dados.isbn());
        } catch (ValidacaoException e) {
            erros.addAll(e.getErros());
        }
        ValidacaoException.lancarSeHouver(erros);
        nome = titulo;
        autor = autorNovo.isEmpty() ? null : autorNovo;
        isbn = novoIsbn;
        editoraId = dados.editoraId();
        repassePadrao = repasse;
    }

    /** Nome e categoria; quem pode corrigir depois do primeiro movimento é regra do caso de uso. */
    public void corrigirCantina(String nomeNovo, String categoriaNova) {
        exigirTipo(TipoProduto.CANTINA);
        List<ErroCampo> erros = new ArrayList<>();
        String n = Textos.compactar(nomeNovo);
        String c = Textos.compactar(categoriaNova);
        if (n.isEmpty()) {
            erros.add(new ErroCampo("nome", "Informe o nome."));
        } else if (n.length() > MAXIMO_NOME) {
            erros.add(new ErroCampo("nome", "Use até " + MAXIMO_NOME + " caracteres."));
        }
        if (c.isEmpty()) {
            erros.add(new ErroCampo("categoria", "Informe a categoria."));
        } else if (c.length() > MAXIMO_CATEGORIA) {
            erros.add(new ErroCampo("categoria", "Use até " + MAXIMO_CATEGORIA + " caracteres."));
        }
        ValidacaoException.lancarSeHouver(erros);
        nome = n;
        categoria = c;
    }

    /** Novo preço vigente a partir de agora; devolve a linha do histórico. */
    public AlteracaoPreco alterarPreco(BigDecimal novo, String motivo, String solicitadoPor, String aprovadoPor,
            Instant em) {
        BigDecimal valor = Precos.validar("preco", novo);
        if (Textos.vazio(motivo)) {
            throw ValidacaoException.doCampo("motivo", "Informe o motivo da alteração.");
        }
        if (valor.compareTo(preco) == 0) {
            throw ValidacaoException.doCampo("preco", "O novo preço é igual ao atual.");
        }
        AlteracaoPreco alteracao = new AlteracaoPreco(id, preco, valor, em, solicitadoPor, aprovadoPor, motivo.trim());
        preco = valor;
        return alteracao;
    }

    public void inativar() {
        if (!ativo) {
            throw new RegraDeNegocioException("PRODUTO_JA_INATIVO", "O produto já está inativo.");
        }
        ativo = false;
    }

    public void reativar() {
        if (ativo) {
            throw new RegraDeNegocioException("PRODUTO_JA_ATIVO", "O produto já está ativo.");
        }
        ativo = true;
    }

    private void exigirTipo(TipoProduto esperado) {
        if (tipo != esperado) {
            throw new RegraDeNegocioException("TIPO_PRODUTO_INCORRETO", esperado == TipoProduto.LIVRO
                    ? "Este produto não é um livro." : "Este produto não é da cantina.");
        }
    }

    public Long getId() { return id; }
    public TipoProduto getTipo() { return tipo; }
    public String getNome() { return nome; }
    public String getCategoria() { return categoria; }
    public String getAutor() { return autor; }
    public String getIsbn() { return isbn == null ? null : isbn.valor(); }
    public Long getEditoraId() { return editoraId; }
    public BigDecimal getPreco() { return preco; }
    public BigDecimal getRepassePadrao() { return repassePadrao; }
    public boolean isAtivo() { return ativo; }
}
