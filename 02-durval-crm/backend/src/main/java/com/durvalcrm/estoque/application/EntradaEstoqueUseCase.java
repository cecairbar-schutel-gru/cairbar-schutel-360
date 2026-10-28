package com.durvalcrm.estoque.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.estoque.domain.CatalogoRepository;
import com.durvalcrm.estoque.domain.EntradaDoacao;
import com.durvalcrm.estoque.domain.EntradaDoacaoRepository;
import com.durvalcrm.estoque.domain.EstoqueRepository;
import com.durvalcrm.estoque.domain.ItemEntrada;
import com.durvalcrm.estoque.domain.Lote;
import com.durvalcrm.estoque.domain.MovimentoEstoque;
import com.durvalcrm.estoque.domain.ProdutoCatalogo;
import com.durvalcrm.estoque.domain.TipoMovimento;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/**
 * Entradas de estoque próprio: doação (US-INVENTORY-006), que entra na hora e sem lançamento
 * financeiro, e recebimento de compra da cantina, chamado pelo módulo Intenções de gasto
 * (US-EXPENSE-006).
 */
public class EntradaEstoqueUseCase {

    public static final String REFERENCIA_DOACAO = "ENTRADA_DOACAO";
    public static final String REFERENCIA_COMPRA = "INTENCAO_GASTO";
    public static final int LIMITE_LISTA = 50;

    private final EntradaDoacaoRepository entradas;
    private final CatalogoRepository catalogo;
    private final EstoqueRepository estoque;
    private final ConsultaEstoquePort consulta;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public EntradaEstoqueUseCase(EntradaDoacaoRepository entradas, CatalogoRepository catalogo,
            EstoqueRepository estoque, ConsultaEstoquePort consulta, RegistrarAuditoriaUseCase auditoria,
            CurrentUserPort usuario, Clock relogio) {
        this.entradas = entradas;
        this.catalogo = catalogo;
        this.estoque = estoque;
        this.consulta = consulta;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    @Transactional
    public EntradaDoacao registrarDoacao(List<ItemEntrada> itens, String observacao) {
        Instant agora = relogio.instant();
        EntradaDoacao nova = EntradaDoacao.nova(itens, observacao, usuario.getSubject(), usuario.getNome(), agora);
        exigirAtivos(nova.getItens());
        EntradaDoacao salva = entradas.salvar(nova);
        entrar(salva.getItens(), TipoMovimento.ENTRADA_DOACAO, REFERENCIA_DOACAO, salva.getId(), agora);

        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("itens", itensAuditoria(salva.getItens()));
        detalhes.put("observacao", salva.getObservacao());
        auditoria.registrar("ENTRADA_DOACAO_REGISTRADA", REFERENCIA_DOACAO, salva.getId(), detalhes);
        return EntradaDoacao.reconstituir(salva.getId(), nova.getItens(), salva.getObservacao(),
                salva.getRegistradaEm(), salva.getRegistradaPor(), salva.getRegistradaPorNome(), null, null, null);
    }

    /** Estorna cada movimento da entrada; bloqueado se alguma unidade já saiu do estoque próprio. */
    @Transactional
    public EntradaDoacao cancelarDoacao(long id, String motivo) {
        EntradaDoacao entrada = entradas.obter(id).orElseThrow(() -> new RecursoNaoEncontradoException(
                "ENTRADA_NAO_ENCONTRADA", "Entrada por doação não encontrada."));
        Instant agora = relogio.instant();
        entrada.cancelar(motivo, usuario.getNome(), agora);

        List<MovimentoEstoque> movimentos = estoque.movimentosDaReferencia(REFERENCIA_DOACAO, id).stream()
                .filter(m -> m.tipo() == TipoMovimento.ENTRADA_DOACAO).toList();
        List<ErroCampo> faltas = new ArrayList<>();
        for (MovimentoEstoque m : movimentos) {
            int proprio = estoque.travarLotes(m.produtoId()).stream().filter(l -> !l.consignado())
                    .mapToInt(Lote::quantidade).sum();
            if (proprio < m.quantidade()) {
                String nome = catalogo.obter(m.produtoId()).map(ProdutoCatalogo::getNome).orElse("produto");
                faltas.add(new ErroCampo("itens[" + m.produtoId() + "]", "Restam só " + proprio + " de " + m.quantidade()
                        + " unidades de " + nome + " no estoque próprio."));
            }
        }
        if (!faltas.isEmpty()) {
            throw new RegraDeNegocioException("UNIDADES_JA_SAIRAM",
                    "Parte das unidades doadas já saiu do estoque. A entrada não pode ser cancelada.", faltas);
        }
        for (MovimentoEstoque m : movimentos) {
            MovimentoEstoque estorno = m.estorno(agora, usuario.getSubject(), usuario.getNome());
            estoque.ajustarLote(m.produtoId(), null, estorno.quantidade());
            estoque.registrar(estorno);
        }
        entradas.salvar(entrada);
        auditoria.registrar("ENTRADA_DOACAO_CANCELADA", REFERENCIA_DOACAO, id,
                Map.of("motivo", entrada.getMotivoCancelamento()));
        return entrada;
    }

    @Transactional(readOnly = true)
    public List<ResumoEntradaDoacao> listarDoacoes() {
        return consulta.entradasDoacao(LIMITE_LISTA);
    }

    /**
     * Recebimento conferido de uma compra aprovada da cantina: entra como estoque próprio com o
     * movimento "Recebimento de compra" ligado à intenção de gasto. A transação é do chamador.
     */
    @Transactional
    public void registrarCompra(long intencaoGastoId, List<ItemEntrada> itens) {
        if (itens.isEmpty() || itens.stream().anyMatch(i -> i.quantidade() <= 0)) {
            throw ValidacaoException.doCampo("itens", "Informe ao menos um item com quantidade positiva.");
        }
        exigirAtivos(itens);
        entrar(itens, TipoMovimento.ENTRADA_COMPRA, REFERENCIA_COMPRA, intencaoGastoId, relogio.instant());
    }

    private void exigirAtivos(List<ItemEntrada> itens) {
        List<ErroCampo> erros = new ArrayList<>();
        for (ItemEntrada i : itens) {
            ProdutoCatalogo p = catalogo.obter(i.produtoId()).orElse(null);
            if (p == null) {
                erros.add(new ErroCampo("itens[" + i.produtoId() + "]", "Produto não encontrado."));
            } else if (!p.isAtivo()) {
                erros.add(new ErroCampo("itens[" + i.produtoId() + "]", p.getNome() + " está inativo."));
            }
        }
        ValidacaoException.lancarSeHouver(erros);
    }

    private void entrar(List<ItemEntrada> itens, TipoMovimento tipo, String referencia, long referenciaId,
            Instant agora) {
        for (ItemEntrada i : itens) {
            estoque.travarLotes(i.produtoId());
            estoque.ajustarLote(i.produtoId(), null, i.quantidade());
            estoque.registrar(MovimentoEstoque.novo(i.produtoId(), null, tipo, i.quantidade(), agora,
                    usuario.getSubject(), usuario.getNome(), referencia, referenciaId));
        }
    }

    private static List<Map<String, Object>> itensAuditoria(List<ItemEntrada> itens) {
        return itens.stream().map(i -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("produtoId", i.produtoId());
            m.put("quantidade", i.quantidade());
            return m;
        }).toList();
    }
}
