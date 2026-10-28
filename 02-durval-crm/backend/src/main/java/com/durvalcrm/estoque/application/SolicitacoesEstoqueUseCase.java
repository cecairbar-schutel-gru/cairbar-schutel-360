package com.durvalcrm.estoque.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.editora.application.ObrigacaoGerada;
import com.durvalcrm.editora.application.ObrigacoesEditoraUseCase;
import com.durvalcrm.estoque.domain.AlteracaoPreco;
import com.durvalcrm.estoque.domain.CatalogoRepository;
import com.durvalcrm.estoque.domain.EstoqueRepository;
import com.durvalcrm.estoque.domain.FotoSolicitacao;
import com.durvalcrm.estoque.domain.Lote;
import com.durvalcrm.estoque.domain.MotivoBaixa;
import com.durvalcrm.estoque.domain.MovimentoEstoque;
import com.durvalcrm.estoque.domain.ProdutoCatalogo;
import com.durvalcrm.estoque.domain.SaidaDeEstoque;
import com.durvalcrm.estoque.domain.Solicitacao;
import com.durvalcrm.estoque.domain.SolicitacaoRepository;
import com.durvalcrm.estoque.domain.StatusSolicitacao;
import com.durvalcrm.estoque.domain.TipoMovimento;
import com.durvalcrm.estoque.domain.TipoProduto;
import com.durvalcrm.estoque.domain.TipoSolicitacao;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.springframework.transaction.annotation.Transactional;

/**
 * Solicitações do Vendedor e decisões do Administrador: baixa (US-INVENTORY-007/008), preço da
 * cantina (011/012) e inativação (014/015), além do ajuste após contagem (016). Enquanto o pedido
 * está pendente, estoque, preço e status não mudam; a aprovação aplica tudo na mesma transação.
 */
public class SolicitacoesEstoqueUseCase {

    public static final String REFERENCIA = "SOLICITACAO_ESTOQUE";
    public static final String REFERENCIA_AJUSTE = "AJUSTE";
    public static final String ENTIDADE = "SOLICITACAO_ESTOQUE";
    public static final int LIMITE_LISTA = 200;

    private final SolicitacaoRepository solicitacoes;
    private final CatalogoRepository catalogo;
    private final EstoqueRepository estoque;
    private final ConsultaEstoquePort consulta;
    private final ObrigacoesEditoraUseCase editoras;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public SolicitacoesEstoqueUseCase(SolicitacaoRepository solicitacoes, CatalogoRepository catalogo,
            EstoqueRepository estoque, ConsultaEstoquePort consulta, ObrigacoesEditoraUseCase editoras,
            RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario, Clock relogio) {
        this.solicitacoes = solicitacoes;
        this.catalogo = catalogo;
        this.estoque = estoque;
        this.consulta = consulta;
        this.editoras = editoras;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    /** A quantidade não passa do saldo do lote menos o que já aguarda baixa nele. */
    @Transactional
    public Solicitacao solicitarBaixa(NovaBaixaCommand c) {
        if (c.produtoId() == null) {
            throw ValidacaoException.doCampo("produtoId", "Escolha o produto.");
        }
        ProdutoCatalogo p = CarregarProduto.ou404(catalogo, c.produtoId());
        Solicitacao nova = Solicitacao.baixa(p.getId(), c.remessaId(), c.quantidade(), c.motivo(), c.justificativa(),
                c.foto(), usuario.getSubject(), usuario.getNome(), relogio.instant());
        Lote lote = estoque.lotes(p.getId()).stream()
                .filter(l -> Objects.equals(l.remessaId(), c.remessaId())).findFirst()
                .orElseThrow(() -> ValidacaoException.doCampo("remessaId", c.remessaId() == null
                        ? "Este produto não tem estoque próprio." : "Esta remessa não tem unidades deste produto."));
        int disponivel = lote.quantidade() - solicitacoes.pendenteDeBaixa(p.getId(), c.remessaId());
        if (c.quantidade() > disponivel) {
            throw ValidacaoException.doCampo("quantidade", disponivel <= 0
                    ? "Não há unidades disponíveis para baixa neste lote."
                    : "A quantidade passa do saldo disponível para baixa (" + disponivel + ").");
        }
        Solicitacao salva = solicitacoes.salvar(nova);
        auditar("SOLICITACAO_CRIADA", salva, Map.of());
        return salva;
    }

    @Transactional
    public Solicitacao solicitarPreco(long produtoId, BigDecimal novoPreco, String motivo) {
        ProdutoCatalogo p = cantinaAtiva(produtoId);
        exigirSemPendente(produtoId, TipoSolicitacao.PRECO, "Já existe um pedido de preço pendente para este produto.");
        Solicitacao salva = solicitacoes.salvar(Solicitacao.preco(produtoId, p.getPreco(), novoPreco, motivo,
                usuario.getSubject(), usuario.getNome(), relogio.instant()));
        auditar("SOLICITACAO_CRIADA", salva, Map.of());
        return salva;
    }

    @Transactional
    public Solicitacao solicitarInativacao(long produtoId, String motivo) {
        cantinaAtiva(produtoId);
        exigirSemPendente(produtoId, TipoSolicitacao.INATIVACAO,
                "Já existe um pedido de inativação pendente para este produto.");
        Solicitacao salva = solicitacoes.salvar(Solicitacao.inativacao(produtoId, motivo, usuario.getSubject(),
                usuario.getNome(), relogio.instant()));
        auditar("SOLICITACAO_CRIADA", salva, Map.of());
        return salva;
    }

    @Transactional
    public Solicitacao cancelar(long id) {
        Solicitacao s = carregar(id);
        s.cancelar(usuario.getSubject(), relogio.instant());
        Solicitacao salva = solicitacoes.salvar(s);
        auditar("SOLICITACAO_CANCELADA", salva, Map.of());
        return salva;
    }

    @Transactional
    public Solicitacao aprovar(long id) {
        Solicitacao s = carregar(id);
        ProdutoCatalogo p = CarregarProduto.ou404(catalogo, s.getProdutoId());
        Instant agora = relogio.instant();
        s.aprovar(usuario.getSubject(), usuario.getNome(), agora);
        Map<String, Object> detalhes = new LinkedHashMap<>();
        switch (s.getTipo()) {
            case BAIXA -> aplicarBaixa(s, p, agora).ifPresent(o -> {
                detalhes.put("obrigacaoId", o.id());
                detalhes.put("valorObrigacao", o.valor().toPlainString());
            });
            case PRECO -> {
                AlteracaoPreco alteracao = p.alterarPreco(s.getNovoPreco(), s.getJustificativa(),
                        s.getSolicitanteNome(), usuario.getNome(), agora);
                catalogo.salvar(p);
                catalogo.registrarPreco(alteracao);
                detalhes.putAll(CatalogoUseCase.precoDetalhes(alteracao));
            }
            case INATIVACAO -> {
                CatalogoUseCase.exigirSemSaldo(SaidaDeEstoque.saldo(estoque.travarLotes(p.getId())));
                p.inativar();
                catalogo.salvar(p);
            }
        }
        Solicitacao salva = solicitacoes.salvar(s);
        detalhes.put("autoAprovada", salva.autoAprovada());
        auditar("SOLICITACAO_APROVADA", salva, detalhes);
        return salva;
    }

    @Transactional
    public Solicitacao rejeitar(long id, String motivo) {
        Solicitacao s = carregar(id);
        s.rejeitar(usuario.getSubject(), usuario.getNome(), motivo, relogio.instant());
        Solicitacao salva = solicitacoes.salvar(s);
        auditar("SOLICITACAO_REJEITADA", salva, Map.of("motivo", salva.getMotivoDecisao()));
        return salva;
    }

    /** O Vendedor vê só as próprias; o Administrador, a fila inteira. */
    @Transactional(readOnly = true)
    public List<ResumoSolicitacao> listar(StatusSolicitacao status, boolean somenteMinhas) {
        boolean todas = !somenteMinhas && usuario.hasRole("administrador");
        return consulta.solicitacoes(status, todas ? null : usuario.getSubject(), LIMITE_LISTA);
    }

    @Transactional(readOnly = true)
    public ResumoSolicitacao resumo(long id) {
        Solicitacao s = carregarVisivel(id);
        return consulta.solicitacao(s.getId()).orElseThrow();
    }

    @Transactional(readOnly = true)
    public FotoSolicitacao foto(long id) {
        FotoSolicitacao foto = carregarVisivel(id).getFoto();
        if (foto == null) {
            throw new RecursoNaoEncontradoException("FOTO_NAO_ENCONTRADA", "Esta solicitação não tem foto.");
        }
        return foto;
    }

    /**
     * Ajuste após contagem física (US-INVENTORY-016): um movimento "Ajuste" com a diferença. A
     * diminuição numa remessa consignada é tratada como baixa por extravio já aprovada.
     */
    @Transactional
    public ResultadoAjuste ajustar(long produtoId, Long remessaId, Integer contada, String motivo) {
        ProdutoCatalogo p = CarregarProduto.ou404(catalogo, produtoId);
        if (contada == null || contada < 0) {
            throw ValidacaoException.doCampo("quantidadeContada", "Informe a quantidade contada (zero ou mais).");
        }
        if (Textos.vazio(motivo)) {
            throw ValidacaoException.doCampo("motivo", "Informe o motivo do ajuste.");
        }
        Optional<Lote> lote = estoque.travarLotes(produtoId).stream()
                .filter(l -> Objects.equals(l.remessaId(), remessaId)).findFirst();
        if (remessaId != null && lote.isEmpty()) {
            throw ValidacaoException.doCampo("remessaId", "Esta remessa não tem lote deste produto.");
        }
        int saldo = lote.map(Lote::quantidade).orElse(0);
        int diferenca = contada - saldo;
        if (diferenca == 0) {
            throw ValidacaoException.doCampo("quantidadeContada", "A contagem é igual ao saldo do sistema.");
        }
        Instant agora = relogio.instant();
        if (remessaId != null && diferenca < 0) {
            Solicitacao baixa = Solicitacao.baixa(produtoId, remessaId, -diferenca, MotivoBaixa.EXTRAVIO,
                    "Ajuste após contagem: " + motivo.trim(), null, usuario.getSubject(), usuario.getNome(), agora);
            baixa.aprovar(usuario.getSubject(), usuario.getNome(), agora);
            Solicitacao salva = solicitacoes.salvar(baixa);
            Map<String, Object> detalhes = new LinkedHashMap<>();
            detalhes.put("ajuste", true);
            aplicarBaixa(salva, p, agora).ifPresent(o -> detalhes.put("obrigacaoId", o.id()));
            auditar("SOLICITACAO_APROVADA", salva, detalhes);
            return new ResultadoAjuste(saldo, contada, diferenca, TipoMovimento.BAIXA_EXTRAVIO, salva.getId());
        }
        estoque.ajustarLote(produtoId, remessaId, diferenca);
        estoque.registrar(MovimentoEstoque.novo(produtoId, remessaId, TipoMovimento.AJUSTE, diferenca, agora,
                usuario.getSubject(), usuario.getNome(), REFERENCIA_AJUSTE, null));
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("remessaId", remessaId);
        detalhes.put("saldoAnterior", saldo);
        detalhes.put("quantidadeContada", contada);
        detalhes.put("motivo", motivo.trim());
        auditoria.registrar("ESTOQUE_AJUSTADO", CarregarProduto.ENTIDADE, produtoId, detalhes);
        return new ResultadoAjuste(saldo, contada, diferenca, TipoMovimento.AJUSTE, null);
    }

    /**
     * Tira as unidades do lote pedido; bloqueia se o saldo atual não cobre (houve vendas). Consignado
     * por dano ou extravio gera obrigação pelo preço vigente, sem receita.
     */
    private Optional<ObrigacaoGerada> aplicarBaixa(Solicitacao s, ProdutoCatalogo p, Instant agora) {
        int saldo = estoque.travarLotes(p.getId()).stream()
                .filter(l -> Objects.equals(l.remessaId(), s.getRemessaId()))
                .mapToInt(Lote::quantidade).sum();
        if (saldo < s.getQuantidade()) {
            throw new RegraDeNegocioException("SALDO_INSUFICIENTE", "O saldo atual do lote é " + saldo
                    + " e não cobre a baixa de " + s.getQuantidade() + ". Rejeite ou peça uma nova solicitação.");
        }
        estoque.ajustarLote(p.getId(), s.getRemessaId(), -s.getQuantidade());
        estoque.registrar(MovimentoEstoque.novo(p.getId(), s.getRemessaId(), TipoMovimento.baixa(s.getMotivoBaixa()),
                -s.getQuantidade(), agora, usuario.getSubject(), usuario.getNome(), REFERENCIA, s.getId()));
        if (s.getRemessaId() != null && s.getMotivoBaixa().geraObrigacaoConsignado()) {
            return Optional.of(editoras.registrarPorBaixa(s.getId(), s.getRemessaId(), p.getId(), s.getQuantidade(),
                    p.getPreco()));
        }
        return Optional.empty();
    }

    private ProdutoCatalogo cantinaAtiva(long produtoId) {
        ProdutoCatalogo p = CarregarProduto.ou404(catalogo, produtoId);
        if (p.getTipo() != TipoProduto.CANTINA) {
            throw new RegraDeNegocioException("SOMENTE_CANTINA",
                    "Este pedido é só para produtos da cantina; livros são alterados pelo Administrador.");
        }
        if (!p.isAtivo()) {
            throw new RegraDeNegocioException("PRODUTO_INATIVO", "O produto está inativo.");
        }
        return p;
    }

    private void exigirSemPendente(long produtoId, TipoSolicitacao tipo, String mensagem) {
        if (solicitacoes.existePendente(produtoId, tipo)) {
            throw new RegraDeNegocioException("SOLICITACAO_PENDENTE_EXISTENTE", mensagem);
        }
    }

    private Solicitacao carregar(long id) {
        return solicitacoes.obter(id).orElseThrow(() -> new RecursoNaoEncontradoException(
                "SOLICITACAO_NAO_ENCONTRADA", "Solicitação não encontrada."));
    }

    private Solicitacao carregarVisivel(long id) {
        Solicitacao s = carregar(id);
        if (!usuario.hasRole("administrador") && !s.getSolicitante().equals(usuario.getSubject())) {
            throw new RecursoNaoEncontradoException("SOLICITACAO_NAO_ENCONTRADA", "Solicitação não encontrada.");
        }
        return s;
    }

    private void auditar(String acao, Solicitacao s, Map<String, Object> extras) {
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("tipo", s.getTipo().name());
        detalhes.put("produtoId", s.getProdutoId());
        detalhes.put("remessaId", s.getRemessaId());
        detalhes.put("quantidade", s.getQuantidade());
        detalhes.put("motivoBaixa", s.getMotivoBaixa() == null ? null : s.getMotivoBaixa().name());
        detalhes.put("novoPreco", s.getNovoPreco() == null ? null : s.getNovoPreco().toPlainString());
        detalhes.put("justificativa", s.getJustificativa());
        detalhes.putAll(extras);
        auditoria.registrar(acao, ENTIDADE, s.getId(), detalhes);
    }
}
