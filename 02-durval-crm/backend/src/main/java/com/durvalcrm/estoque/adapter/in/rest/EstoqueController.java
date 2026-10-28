package com.durvalcrm.estoque.adapter.in.rest;

import com.durvalcrm.estoque.adapter.in.rest.EstoqueRequests.AjusteRequest;
import com.durvalcrm.estoque.adapter.in.rest.EstoqueRequests.BaixaRequest;
import com.durvalcrm.estoque.adapter.in.rest.EstoqueRequests.CantinaRequest;
import com.durvalcrm.estoque.adapter.in.rest.EstoqueRequests.EntradaDoacaoRequest;
import com.durvalcrm.estoque.adapter.in.rest.EstoqueRequests.LivroRequest;
import com.durvalcrm.estoque.adapter.in.rest.EstoqueRequests.MotivoRequest;
import com.durvalcrm.estoque.adapter.in.rest.EstoqueRequests.PrecoRequest;
import com.durvalcrm.estoque.adapter.in.rest.EstoqueRequests.SolicitacaoInativacaoRequest;
import com.durvalcrm.estoque.adapter.in.rest.EstoqueRequests.SolicitacaoPrecoRequest;
import com.durvalcrm.estoque.adapter.in.rest.EstoqueResponses.EntradaRegistradaResponse;
import com.durvalcrm.estoque.adapter.in.rest.EstoqueResponses.ProdutoResponse;
import com.durvalcrm.estoque.adapter.in.rest.EstoqueResponses.SolicitacaoRegistradaResponse;
import com.durvalcrm.estoque.application.CatalogoUseCase;
import com.durvalcrm.estoque.application.ConsultarEstoqueUseCase;
import com.durvalcrm.estoque.application.DetalheProduto;
import com.durvalcrm.estoque.application.EntradaEstoqueUseCase;
import com.durvalcrm.estoque.application.ItemEstoque;
import com.durvalcrm.estoque.application.LinhaMovimento;
import com.durvalcrm.estoque.application.OpcoesCatalogo;
import com.durvalcrm.estoque.application.ProdutoSimilar;
import com.durvalcrm.estoque.application.ResultadoAjuste;
import com.durvalcrm.estoque.application.ResumoEntradaDoacao;
import com.durvalcrm.estoque.application.ResumoSolicitacao;
import com.durvalcrm.estoque.application.SituacaoCatalogo;
import com.durvalcrm.estoque.application.SolicitacoesEstoqueUseCase;
import com.durvalcrm.estoque.domain.FotoSolicitacao;
import com.durvalcrm.estoque.domain.StatusSolicitacao;
import com.durvalcrm.estoque.domain.TipoMovimento;
import com.durvalcrm.estoque.domain.TipoProduto;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * API do módulo Estoque (US-INVENTORY-001 a 016). {@code @PreAuthorize} responde só "pode acessar o
 * endpoint?"; saldo, pendências, quem pede e quem decide são regras dos casos de uso.
 */
@RestController
@RequestMapping("/api/estoque")
class EstoqueController {

    private static final String CONSULTA = "hasAnyRole('VENDEDOR', 'TESOUREIRO', 'ADMINISTRADOR')";
    private static final String ESTOQUISTA = "hasAnyRole('VENDEDOR', 'ADMINISTRADOR')";
    private static final String ADMINISTRADOR = "hasRole('ADMINISTRADOR')";

    private final CatalogoUseCase catalogo;
    private final ConsultarEstoqueUseCase consultar;
    private final EntradaEstoqueUseCase entradas;
    private final SolicitacoesEstoqueUseCase solicitacoes;

    EstoqueController(CatalogoUseCase catalogo, ConsultarEstoqueUseCase consultar, EntradaEstoqueUseCase entradas,
            SolicitacoesEstoqueUseCase solicitacoes) {
        this.catalogo = catalogo;
        this.consultar = consultar;
        this.entradas = entradas;
        this.solicitacoes = solicitacoes;
    }

    /** US-INVENTORY-009 e wireframe 10. */
    @GetMapping("/produtos")
    @PreAuthorize(CONSULTA)
    List<ItemEstoque> listar(@RequestParam(required = false) TipoProduto tipo,
            @RequestParam(required = false) String categoria, @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "false") boolean somenteSemSaldo,
            @RequestParam(defaultValue = "ATIVOS") SituacaoCatalogo situacao) {
        return consultar.listar(tipo, categoria, q, somenteSemSaldo, situacao);
    }

    @GetMapping("/opcoes")
    @PreAuthorize(ESTOQUISTA)
    OpcoesCatalogo opcoes() {
        return catalogo.opcoes();
    }

    /** Aviso de nome parecido (US-INVENTORY-002). */
    @GetMapping("/produtos/similares")
    @PreAuthorize(ESTOQUISTA)
    List<ProdutoSimilar> similares(@RequestParam String nome, @RequestParam(required = false) TipoProduto tipo,
            @RequestParam(required = false) Long excetoId) {
        return catalogo.similares(nome, tipo, excetoId);
    }

    @GetMapping("/produtos/{id}")
    @PreAuthorize(CONSULTA)
    DetalheProduto detalhe(@PathVariable long id) {
        return consultar.detalhe(id);
    }

    /** US-INVENTORY-010. */
    @GetMapping("/produtos/{id}/movimentos")
    @PreAuthorize(CONSULTA)
    List<LinhaMovimento> movimentos(@PathVariable long id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
            @RequestParam(required = false) TipoMovimento tipo) {
        return consultar.movimentos(id, de, ate, tipo);
    }

    /** US-INVENTORY-001. */
    @PostMapping("/livros")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(ESTOQUISTA)
    ProdutoResponse cadastrarLivro(@RequestBody LivroRequest dados) {
        return ProdutoResponse.de(catalogo.cadastrarLivro(dados.paraDados(), dados.preco()));
    }

    @PutMapping("/livros/{id}")
    @PreAuthorize(ESTOQUISTA)
    ProdutoResponse atualizarLivro(@PathVariable long id, @RequestBody LivroRequest dados) {
        return ProdutoResponse.de(catalogo.atualizarLivro(id, dados.paraDados()));
    }

    /** US-INVENTORY-013. */
    @PostMapping("/livros/{id}/preco")
    @PreAuthorize(ESTOQUISTA)
    ProdutoResponse alterarPrecoLivro(@PathVariable long id, @RequestBody PrecoRequest dados) {
        return ProdutoResponse.de(catalogo.alterarPrecoLivro(id, dados.preco(), dados.motivo()));
    }

    /** US-INVENTORY-002. */
    @PostMapping("/cantina")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(ESTOQUISTA)
    ProdutoResponse cadastrarCantina(@RequestBody CantinaRequest dados) {
        return ProdutoResponse.de(catalogo.cadastrarCantina(dados.nome(), dados.categoria(), dados.preco()));
    }

    @PutMapping("/cantina/{id}")
    @PreAuthorize(ESTOQUISTA)
    ProdutoResponse corrigirCantina(@PathVariable long id, @RequestBody CantinaRequest dados) {
        return ProdutoResponse.de(catalogo.corrigirCantina(id, dados.nome(), dados.categoria()));
    }

    @PostMapping("/produtos/{id}/inativacao")
    @PreAuthorize(ADMINISTRADOR)
    ProdutoResponse inativar(@PathVariable long id, @RequestBody MotivoRequest dados) {
        return ProdutoResponse.de(catalogo.inativar(id, dados.motivo()));
    }

    /** US-INVENTORY-015: o Administrador reativa direto. */
    @PostMapping("/produtos/{id}/reativacao")
    @PreAuthorize(ADMINISTRADOR)
    ProdutoResponse reativar(@PathVariable long id) {
        return ProdutoResponse.de(catalogo.reativar(id));
    }

    @DeleteMapping("/produtos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize(ADMINISTRADOR)
    void excluir(@PathVariable long id) {
        catalogo.excluir(id);
    }

    /** US-INVENTORY-016. */
    @PostMapping("/produtos/{id}/ajuste")
    @PreAuthorize(ADMINISTRADOR)
    ResultadoAjuste ajustar(@PathVariable long id, @RequestBody AjusteRequest dados) {
        return solicitacoes.ajustar(id, dados.remessaId(), dados.quantidadeContada(), dados.motivo());
    }

    /** US-INVENTORY-006. */
    @GetMapping("/entradas-doacao")
    @PreAuthorize(ESTOQUISTA)
    List<ResumoEntradaDoacao> entradasDoacao() {
        return entradas.listarDoacoes();
    }

    @PostMapping("/entradas-doacao")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(ESTOQUISTA)
    EntradaRegistradaResponse registrarDoacao(@RequestBody EntradaDoacaoRequest dados) {
        return EntradaRegistradaResponse.de(entradas.registrarDoacao(dados.paraItens(), dados.observacao()));
    }

    @PostMapping("/entradas-doacao/{id}/cancelamento")
    @PreAuthorize(ADMINISTRADOR)
    EntradaRegistradaResponse cancelarDoacao(@PathVariable long id, @RequestBody MotivoRequest dados) {
        return EntradaRegistradaResponse.de(entradas.cancelarDoacao(id, dados.motivo()));
    }

    /** Fila do Administrador (US-ADMIN-021) ou "Minhas solicitações" (US-SALES-021). */
    @GetMapping("/solicitacoes")
    @PreAuthorize(ESTOQUISTA)
    List<ResumoSolicitacao> listarSolicitacoes(@RequestParam(required = false) StatusSolicitacao status,
            @RequestParam(defaultValue = "false") boolean minhas) {
        return solicitacoes.listar(status, minhas);
    }

    @GetMapping("/solicitacoes/{id}")
    @PreAuthorize(ESTOQUISTA)
    ResumoSolicitacao solicitacao(@PathVariable long id) {
        return solicitacoes.resumo(id);
    }

    @GetMapping("/solicitacoes/{id}/foto")
    @PreAuthorize(ESTOQUISTA)
    ResponseEntity<byte[]> foto(@PathVariable long id) {
        FotoSolicitacao foto = solicitacoes.foto(id);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(foto.tipo())).body(foto.conteudo());
    }

    /** US-INVENTORY-007. */
    @PostMapping("/solicitacoes/baixa")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(ESTOQUISTA)
    SolicitacaoRegistradaResponse solicitarBaixa(@RequestBody BaixaRequest dados) {
        return SolicitacaoRegistradaResponse.de(solicitacoes.solicitarBaixa(dados.paraComando()));
    }

    /** US-INVENTORY-011. */
    @PostMapping("/solicitacoes/preco")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(ESTOQUISTA)
    SolicitacaoRegistradaResponse solicitarPreco(@RequestBody SolicitacaoPrecoRequest dados) {
        return SolicitacaoRegistradaResponse.de(solicitacoes.solicitarPreco(produto(dados.produtoId()),
                dados.novoPreco(), dados.motivo()));
    }

    /** US-INVENTORY-014. */
    @PostMapping("/solicitacoes/inativacao")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(ESTOQUISTA)
    SolicitacaoRegistradaResponse solicitarInativacao(@RequestBody SolicitacaoInativacaoRequest dados) {
        return SolicitacaoRegistradaResponse.de(solicitacoes.solicitarInativacao(produto(dados.produtoId()),
                dados.motivo()));
    }

    @PostMapping("/solicitacoes/{id}/cancelamento")
    @PreAuthorize(ESTOQUISTA)
    SolicitacaoRegistradaResponse cancelarSolicitacao(@PathVariable long id) {
        return SolicitacaoRegistradaResponse.de(solicitacoes.cancelar(id));
    }

    /** US-INVENTORY-008, 012 e 015. */
    @PostMapping("/solicitacoes/{id}/aprovacao")
    @PreAuthorize(ADMINISTRADOR)
    SolicitacaoRegistradaResponse aprovar(@PathVariable long id) {
        return SolicitacaoRegistradaResponse.de(solicitacoes.aprovar(id));
    }

    @PostMapping("/solicitacoes/{id}/rejeicao")
    @PreAuthorize(ADMINISTRADOR)
    SolicitacaoRegistradaResponse rejeitar(@PathVariable long id, @RequestBody MotivoRequest dados) {
        return SolicitacaoRegistradaResponse.de(solicitacoes.rejeitar(id, dados.motivo()));
    }

    private static long produto(Long id) {
        if (id == null) {
            throw ValidacaoException.doCampo("produtoId", "Escolha o produto.");
        }
        return id;
    }
}
