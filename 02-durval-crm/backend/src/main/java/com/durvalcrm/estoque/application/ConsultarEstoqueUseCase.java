package com.durvalcrm.estoque.application;

import com.durvalcrm.estoque.domain.CatalogoRepository;
import com.durvalcrm.estoque.domain.EstoqueRepository;
import com.durvalcrm.estoque.domain.Isbn;
import com.durvalcrm.estoque.domain.MovimentoEstoque;
import com.durvalcrm.estoque.domain.ProdutoCatalogo;
import com.durvalcrm.estoque.domain.SolicitacaoRepository;
import com.durvalcrm.estoque.domain.TipoMovimento;
import com.durvalcrm.estoque.domain.TipoProduto;
import com.durvalcrm.estoque.domain.TipoSolicitacao;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.transaction.annotation.Transactional;

/** Estoque disponível (US-INVENTORY-009), página do produto e histórico de movimentos (US-INVENTORY-010). */
public class ConsultarEstoqueUseCase {

    private final ConsultaEstoquePort consulta;
    private final CatalogoRepository catalogo;
    private final EstoqueRepository estoque;
    private final SolicitacaoRepository solicitacoes;
    private final Clock relogio;

    public ConsultarEstoqueUseCase(ConsultaEstoquePort consulta, CatalogoRepository catalogo,
            EstoqueRepository estoque, SolicitacaoRepository solicitacoes, Clock relogio) {
        this.consulta = consulta;
        this.catalogo = catalogo;
        this.estoque = estoque;
        this.solicitacoes = solicitacoes;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public List<ItemEstoque> listar(TipoProduto tipo, String categoria, String termo, boolean somenteSemSaldo,
            SituacaoCatalogo situacao) {
        String compacto = Isbn.compactar(termo);
        String isbn = compacto.matches("\\d{9}[\\dX]|\\d{13}") ? compacto : null;
        return consulta.listar(new FiltroEstoque(tipo, Textos.vazio(categoria) ? null : categoria.trim(),
                Textos.normalizar(termo), isbn, somenteSemSaldo, situacao == null ? SituacaoCatalogo.ATIVOS : situacao));
    }

    @Transactional(readOnly = true)
    public DetalheProduto detalhe(long id) {
        ProdutoCatalogo p = CarregarProduto.ou404(catalogo, id);
        List<LoteDetalhado> lotes = consulta.lotes(id);
        return new DetalheProduto(id, p.getTipo(), p.getNome(), p.getCategoria(), p.getAutor(), p.getIsbn(),
                p.getEditoraId(), consulta.nomeEditora(p.getEditoraId()).orElse(null), p.getPreco(),
                p.getRepassePadrao(), p.isAtivo(), lotes.stream().mapToInt(LoteDetalhado::quantidade).sum(),
                lotes.stream().mapToInt(LoteDetalhado::aguardandoBaixa).sum(), lotes, catalogo.historicoPrecos(id),
                consulta.ultimaVenda(id).orElse(null), estoque.possuiHistorico(id),
                solicitacoes.existePendente(id, TipoSolicitacao.PRECO),
                solicitacoes.existePendente(id, TipoSolicitacao.INATIVACAO));
    }

    /**
     * Do mais novo para o mais antigo. O saldo após cada movimento é calculado a partir do saldo
     * atual, para valer também quando o saldo inicial entrou por carga (sem movimento).
     */
    @Transactional(readOnly = true)
    public List<LinhaMovimento> movimentos(long id, LocalDate de, LocalDate ate, TipoMovimento tipo) {
        CarregarProduto.ou404(catalogo, id);
        if (de != null && ate != null && de.isAfter(ate)) {
            throw ValidacaoException.doCampo("de", "A data inicial deve ser anterior à final.");
        }
        Instant inicio = de == null ? null : de.atStartOfDay(relogio.getZone()).toInstant();
        Instant fim = ate == null ? null : ate.plusDays(1).atStartOfDay(relogio.getZone()).toInstant();

        List<MovimentoComRemessa> todos = consulta.movimentos(id);
        Set<Long> estornados = new HashSet<>();
        todos.forEach(m -> {
            if (m.movimento().estornaMovimentoId() != null) {
                estornados.add(m.movimento().estornaMovimentoId());
            }
        });
        int saldo = consulta.lotes(id).stream().mapToInt(LoteDetalhado::quantidade).sum();
        List<LinhaMovimento> linhas = new ArrayList<>();
        for (int i = todos.size() - 1; i >= 0; i--) {
            MovimentoEstoque m = todos.get(i).movimento();
            boolean noPeriodo = (inicio == null || !m.ocorridoEm().isBefore(inicio))
                    && (fim == null || m.ocorridoEm().isBefore(fim));
            if (noPeriodo && (tipo == null || m.tipo() == tipo)) {
                linhas.add(new LinhaMovimento(m.id(), m.ocorridoEm(), m.tipo(), m.quantidade(), m.remessaId(),
                        todos.get(i).remessaCodigo(), m.usuarioNome(), m.referenciaTipo(), m.referenciaId(),
                        m.estornaMovimentoId(), estornados.contains(m.id()), saldo));
            }
            saldo -= m.quantidade();
        }
        return linhas;
    }
}
