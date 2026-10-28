package com.durvalcrm.estoque.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.editora.application.ConsultarEditorasUseCase;
import com.durvalcrm.estoque.domain.AlteracaoPreco;
import com.durvalcrm.estoque.domain.CatalogoRepository;
import com.durvalcrm.estoque.domain.DadosLivro;
import com.durvalcrm.estoque.domain.EstoqueRepository;
import com.durvalcrm.estoque.domain.ProdutoCatalogo;
import com.durvalcrm.estoque.domain.SaidaDeEstoque;
import com.durvalcrm.estoque.domain.TipoProduto;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeSet;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cadastros de livros (US-INVENTORY-001, só Administrador) e da cantina (US-INVENTORY-002), preço
 * direto de livro (US-INVENTORY-013), inativação, reativação e exclusão sem histórico.
 */
public class CatalogoUseCase {

    /** Sugestões iniciais de categoria da cantina (US-INVENTORY-002). */
    public static final List<String> CATEGORIAS_PADRAO = List.of("Bebidas", "Salgados", "Doces");

    private final CatalogoRepository catalogo;
    private final EstoqueRepository estoque;
    private final ConsultaEstoquePort consulta;
    private final ConsultarEditorasUseCase editoras;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public CatalogoUseCase(CatalogoRepository catalogo, EstoqueRepository estoque, ConsultaEstoquePort consulta,
            ConsultarEditorasUseCase editoras, RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario,
            Clock relogio) {
        this.catalogo = catalogo;
        this.estoque = estoque;
        this.consulta = consulta;
        this.editoras = editoras;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public OpcoesCatalogo opcoes() {
        TreeSet<String> categorias = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        categorias.addAll(CATEGORIAS_PADRAO);
        categorias.addAll(consulta.categoriasCantina());
        return new OpcoesCatalogo(editoras.ativas().stream()
                .map(e -> new OpcoesCatalogo.EditoraOpcao(e.id(), e.nome())).toList(), List.copyOf(categorias));
    }

    /** Aviso de nome parecido antes de cadastrar (US-INVENTORY-002). */
    @Transactional(readOnly = true)
    public List<ProdutoSimilar> similares(String nome, TipoProduto tipo, Long excetoId) {
        String normalizado = Textos.normalizar(nome);
        return normalizado.length() < 3 ? List.of() : consulta.similares(normalizado, tipo, excetoId);
    }

    @Transactional
    public ProdutoCatalogo cadastrarLivro(DadosLivro dados, BigDecimal preco) {
        ProdutoCatalogo novo = ProdutoCatalogo.novoLivro(dados, preco);
        exigirEditoraEIsbn(novo);
        ProdutoCatalogo salvo = catalogo.salvar(novo);
        auditoria.registrar("PRODUTO_CADASTRADO", CarregarProduto.ENTIDADE, salvo.getId(), instantaneo(salvo));
        return salvo;
    }

    @Transactional
    public ProdutoCatalogo atualizarLivro(long id, DadosLivro dados) {
        ProdutoCatalogo p = CarregarProduto.ou404(catalogo, id);
        Map<String, Object> antes = instantaneo(p);
        p.atualizarLivro(dados);
        exigirEditoraEIsbn(p);
        return salvarComAuditoria(p, antes);
    }

    @Transactional
    public ProdutoCatalogo cadastrarCantina(String nome, String categoria, BigDecimal preco) {
        ProdutoCatalogo salvo = catalogo.salvar(ProdutoCatalogo.novoCantina(nome, categoria, preco));
        auditoria.registrar("PRODUTO_CADASTRADO", CarregarProduto.ENTIDADE, salvo.getId(), instantaneo(salvo));
        return salvo;
    }

    /** O Vendedor corrige só enquanto não há movimentos; depois, só o Administrador. */
    @Transactional
    public ProdutoCatalogo corrigirCantina(long id, String nome, String categoria) {
        ProdutoCatalogo p = CarregarProduto.ou404(catalogo, id);
        if (!usuario.hasRole("administrador") && estoque.possuiHistorico(id)) {
            throw new RegraDeNegocioException("PRODUTO_COM_MOVIMENTOS",
                    "Este produto já tem movimentos: só o Administrador pode corrigir o nome e a categoria.");
        }
        Map<String, Object> antes = instantaneo(p);
        p.corrigirCantina(nome, categoria);
        return salvarComAuditoria(p, antes);
    }

    /** Vale para as próximas vendas; vendas, obrigações e repasses de remessas existentes não mudam. */
    @Transactional
    public ProdutoCatalogo alterarPrecoLivro(long id, BigDecimal preco, String motivo) {
        ProdutoCatalogo p = CarregarProduto.ou404(catalogo, id);
        if (p.getTipo() != TipoProduto.LIVRO) {
            throw new RegraDeNegocioException("PRECO_POR_SOLICITACAO",
                    "O preço da cantina muda por solicitação aprovada pelo Administrador.");
        }
        AlteracaoPreco alteracao = p.alterarPreco(preco, motivo, null, usuario.getNome(), relogio.instant());
        catalogo.salvar(p);
        catalogo.registrarPreco(alteracao);
        auditoria.registrar("PRECO_ALTERADO", CarregarProduto.ENTIDADE, id, precoDetalhes(alteracao));
        return p;
    }

    /**
     * Livro com saldo pode ser inativado (a tela avisa a quantidade); produto da cantina com saldo
     * não, como na aprovação do pedido (US-INVENTORY-015).
     */
    @Transactional
    public ProdutoCatalogo inativar(long id, String motivo) {
        ProdutoCatalogo p = CarregarProduto.ou404(catalogo, id);
        if (Textos.vazio(motivo)) {
            throw ValidacaoException.doCampo("motivo", "Informe o motivo da inativação.");
        }
        int saldo = SaidaDeEstoque.saldo(estoque.travarLotes(id));
        if (p.getTipo() == TipoProduto.CANTINA) {
            exigirSemSaldo(saldo);
        }
        p.inativar();
        catalogo.salvar(p);
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("motivo", motivo.trim());
        detalhes.put("saldo", saldo);
        auditoria.registrar("PRODUTO_INATIVADO", CarregarProduto.ENTIDADE, id, detalhes);
        return p;
    }

    @Transactional
    public ProdutoCatalogo reativar(long id) {
        ProdutoCatalogo p = CarregarProduto.ou404(catalogo, id);
        p.reativar();
        catalogo.salvar(p);
        auditoria.registrar("PRODUTO_REATIVADO", CarregarProduto.ENTIDADE, id, Map.of());
        return p;
    }

    /** Produto com movimentos não é excluído, só inativado. */
    @Transactional
    public void excluir(long id) {
        ProdutoCatalogo p = CarregarProduto.ou404(catalogo, id);
        if (estoque.possuiHistorico(id)) {
            throw new RegraDeNegocioException("PRODUTO_COM_MOVIMENTOS",
                    "Este produto já tem movimentos e não pode ser excluído. Inative-o.");
        }
        catalogo.excluir(id);
        auditoria.registrar("PRODUTO_EXCLUIDO", CarregarProduto.ENTIDADE, id, instantaneo(p));
    }

    static void exigirSemSaldo(int saldo) {
        if (saldo > 0) {
            throw new RegraDeNegocioException("PRODUTO_COM_SALDO", "Dê baixa ou venda as " + saldo
                    + (saldo == 1 ? " unidade restante" : " unidades restantes") + " antes de inativar.");
        }
    }

    static Map<String, Object> precoDetalhes(AlteracaoPreco a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("precoAnterior", a.precoAnterior().toPlainString());
        m.put("precoNovo", a.precoNovo().toPlainString());
        m.put("motivo", a.motivo());
        m.put("solicitadoPor", a.solicitadoPor());
        return m;
    }

    private void exigirEditoraEIsbn(ProdutoCatalogo p) {
        if (p.getEditoraId() != null && editoras.obter(p.getEditoraId()).isEmpty()) {
            throw ValidacaoException.doCampo("editoraId", "Editora não encontrada.");
        }
        if (p.getIsbn() != null && catalogo.isbnEmUso(p.getIsbn(), p.getId())) {
            throw ValidacaoException.doCampo("isbn", "Este ISBN já está cadastrado em outro título.");
        }
    }

    private ProdutoCatalogo salvarComAuditoria(ProdutoCatalogo p, Map<String, Object> antes) {
        ProdutoCatalogo salvo = catalogo.salvar(p);
        Map<String, Object> depois = instantaneo(salvo);
        Map<String, Object> alteracoes = new LinkedHashMap<>();
        for (String campo : depois.keySet()) {
            if (!Objects.equals(antes.get(campo), depois.get(campo))) {
                Map<String, Object> par = new LinkedHashMap<>();
                par.put("anterior", antes.get(campo));
                par.put("novo", depois.get(campo));
                alteracoes.put(campo, par);
            }
        }
        if (!alteracoes.isEmpty()) {
            auditoria.registrar("PRODUTO_ALTERADO", CarregarProduto.ENTIDADE, salvo.getId(), alteracoes);
        }
        return salvo;
    }

    private static Map<String, Object> instantaneo(ProdutoCatalogo p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("tipo", p.getTipo().name());
        m.put("nome", p.getNome());
        m.put("categoria", p.getCategoria());
        m.put("autor", p.getAutor());
        m.put("isbn", p.getIsbn());
        m.put("editoraId", p.getEditoraId());
        m.put("preco", p.getPreco().toPlainString());
        m.put("repassePadrao", p.getRepassePadrao() == null ? null : p.getRepassePadrao().toPlainString());
        return m;
    }
}
