package com.durvalcrm.editora.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.editora.application.ConsultaEditorasPort.ItemRemessaDetalhado;
import com.durvalcrm.editora.application.ConsultaEditorasPort.ResumoRemessa;
import com.durvalcrm.editora.domain.Devolucao;
import com.durvalcrm.editora.domain.DevolucaoRepository;
import com.durvalcrm.editora.domain.Editora;
import com.durvalcrm.editora.domain.EditoraRepository;
import com.durvalcrm.editora.domain.PedidoLivros;
import com.durvalcrm.editora.domain.PedidoLivrosRepository;
import com.durvalcrm.editora.domain.Remessa;
import com.durvalcrm.editora.domain.RemessaRepository;
import com.durvalcrm.editora.domain.StatusRemessa;
import com.durvalcrm.editora.domain.TituloConsignado;
import com.durvalcrm.financeiro.application.PeriodoFinanceiroPort;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.application.DadosOrganizacao;
import com.durvalcrm.shared.application.DadosOrganizacaoPort;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

/**
 * Remessas de consignados (US-PUBLISHER-003): registro com código automático e entrada no estoque,
 * página com as quantidades por título, cancelamento enquanto nenhuma unidade se moveu e devolução
 * por remessa (US-PUBLISHER-005), sem efeito financeiro, com o comprovante para a editora assinar.
 * A remessa pode ser registrada contra um pedido de livros aberto, que passa a recebido.
 */
public class RemessasUseCase {

    static final String ENTIDADE = "Remessa";
    static final Set<String> SITUACOES = Set.of("ABERTA", "ENCERRADA", "CANCELADA");

    private final RemessaRepository remessas;
    private final PedidoLivrosRepository pedidos;
    private final DevolucaoRepository devolucoes;
    private final EditoraRepository editoras;
    private final ConsultaEditorasPort consulta;
    private final EstoqueConsignadoPort estoque;
    private final DadosOrganizacaoPort organizacao;
    private final PeriodoFinanceiroPort periodos;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public RemessasUseCase(RemessaRepository remessas, PedidoLivrosRepository pedidos, DevolucaoRepository devolucoes,
            EditoraRepository editoras,
            ConsultaEditorasPort consulta, EstoqueConsignadoPort estoque, DadosOrganizacaoPort organizacao,
            PeriodoFinanceiroPort periodos, RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario,
            Clock relogio) {
        this.remessas = remessas;
        this.pedidos = pedidos;
        this.devolucoes = devolucoes;
        this.editoras = editoras;
        this.consulta = consulta;
        this.estoque = estoque;
        this.organizacao = organizacao;
        this.periodos = periodos;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    /** {@code pedidoId}: pedido de livros aberto que a remessa atende (opcional). */
    public record NovaRemessa(Long editoraId, LocalDate recebidaEm, String numeroDocumento,
            List<Remessa.ItemPedido> itens, Long pedidoId) {
    }

    public record NovaDevolucao(LocalDate devolvidaEm, String observacao, Map<Long, Integer> quantidades) {
    }

    /** {@code situacao}: a exibida (ABERTA, ENCERRADA ou CANCELADA). */
    public record DetalheRemessa(Remessa remessa, String editoraNome, String situacao,
            List<ItemRemessaDetalhado> itens, List<DetalheDevolucao> devolucoes, boolean podeCancelar,
            boolean podeDevolver) {
    }

    public record ItemDevolvido(long produtoId, String titulo, String isbn, int quantidade) {
    }

    /** Comprovante de devolução para a editora assinar (US-PUBLISHER-005). */
    public record DetalheDevolucao(Devolucao devolucao, String remessaCodigo, long editoraId, String editoraNome,
            String editoraCnpj, List<ItemDevolvido> itens, DadosOrganizacao organizacao) {
    }

    static RecursoNaoEncontradoException naoEncontrada() {
        return new RecursoNaoEncontradoException("REMESSA_NAO_ENCONTRADA", "Remessa não encontrada.");
    }

    @Transactional(readOnly = true)
    public List<ResumoRemessa> listar(Long editoraId, String situacao) {
        if (situacao != null && !SITUACOES.contains(situacao)) {
            throw ValidacaoException.doCampo("situacao", "Situação desconhecida.");
        }
        return consulta.remessas(editoraId, situacao);
    }

    @Transactional(readOnly = true)
    public DetalheRemessa detalhe(long id) {
        Remessa r = remessas.obter(id).orElseThrow(RemessasUseCase::naoEncontrada);
        Editora e = editoras.obter(r.getEditoraId()).orElseThrow();
        List<ItemRemessaDetalhado> itens = consulta.itensDaRemessa(id);
        boolean cancelada = r.getStatus() == StatusRemessa.CANCELADA;
        boolean zerada = itens.stream().allMatch(i -> i.restante() == 0);
        String situacao = cancelada ? "CANCELADA" : zerada ? "ENCERRADA" : "ABERTA";
        boolean podeCancelar = !cancelada && !estoque.houveMovimentoAlemDaEntrada(id)
                && !remessas.possuiBaixaPendente(id);
        Map<Long, TituloConsignado> titulos = titulos(r);
        List<DetalheDevolucao> lista = devolucoes.daRemessa(id).stream()
                .map(d -> detalheDevolucao(d, r, e, titulos)).toList();
        return new DetalheRemessa(r, e.nome(), situacao, itens, lista, podeCancelar, !cancelada && !zerada);
    }

    @Transactional
    public Remessa registrar(NovaRemessa cmd) {
        if (cmd.editoraId() == null) {
            throw ValidacaoException.doCampo("editoraId", "Escolha a editora.");
        }
        Editora editora = editoras.obter(cmd.editoraId()).orElseThrow(() -> ValidacaoException.doCampo("editoraId",
                "Editora não encontrada."));
        Map<Long, TituloConsignado> titulos = estoque.titulosDaEditora(editora.id()).stream()
                .collect(Collectors.toMap(TituloConsignado::produtoId, Function.identity()));
        // Remessa e devolução são movimentos datados: não entram num mês fechado (US-CLOSING-008).
        periodos.exigirAberto(cmd.recebidaEm());
        Instant agora = relogio.instant();
        Remessa nova = Remessa.nova(editora, cmd.recebidaEm(), cmd.numeroDocumento(), cmd.itens(), titulos,
                LocalDate.now(relogio), usuario.getNome(), agora);
        PedidoLivros pedido = cmd.pedidoId() == null ? null : pedidos.travar(cmd.pedidoId())
                .orElseThrow(() -> ValidacaoException.doCampo("pedidoId", "Pedido de livros não encontrado."));
        if (pedido != null) {
            pedido.exigirRecebivelPor(editora.id());
        }
        Remessa salva = remessas.salvar(nova);
        for (Remessa.Item i : salva.getItens()) {
            estoque.entrarRemessa(salva.getId(), i.produtoId(), i.quantidade());
        }
        if (pedido != null) {
            pedido.receber(salva);
            pedidos.salvar(pedido);
            auditoria.registrar("PEDIDO_LIVROS_RECEBIDO", PedidosLivrosUseCase.ENTIDADE, pedido.getId(),
                    Map.of("remessa", salva.getCodigo()));
        }
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("codigo", salva.getCodigo());
        detalhes.put("editoraId", editora.id());
        detalhes.put("recebidaEm", salva.getRecebidaEm().toString());
        detalhes.put("numeroDocumento", salva.getNumeroDocumento());
        detalhes.put("pedidoId", cmd.pedidoId());
        detalhes.put("itens", salva.getItens().stream().map(i -> Map.of("produtoId", i.produtoId(), "quantidade",
                i.quantidade(), "repassePercentual", i.repassePercentual())).toList());
        auditoria.registrar("REMESSA_REGISTRADA", ENTIDADE, salva.getId(), detalhes);
        return salva;
    }

    /** Só se nenhuma unidade se moveu além da entrada; a entrada é estornada no estoque. */
    @Transactional
    public Remessa cancelar(long id, String motivo) {
        Remessa r = remessas.travar(id).orElseThrow(RemessasUseCase::naoEncontrada);
        List<Long> produtos = r.getItens().stream().map(Remessa.Item::produtoId).toList();
        estoque.travarSaldos(id, produtos);
        if (r.getStatus() != StatusRemessa.CANCELADA
                && (estoque.houveMovimentoAlemDaEntrada(id) || remessas.possuiBaixaPendente(id))) {
            throw new RegraDeNegocioException("REMESSA_COM_MOVIMENTOS",
                    "Unidades desta remessa já foram vendidas, devolvidas, baixadas ou ajustadas (ou há baixa pendente). "
                            + "Ela não pode mais ser cancelada.");
        }
        r.cancelar(motivo, usuario.getNome(), relogio.instant());
        estoque.cancelarEntrada(id, produtos);
        remessas.salvar(r);
        // O pedido atendido por esta remessa volta a esperar a entrega correta.
        pedidos.travarDaRemessa(id).ifPresent(p -> {
            p.reabrir();
            pedidos.salvar(p);
        });
        auditoria.registrar("REMESSA_CANCELADA", ENTIDADE, id, Map.of("codigo", r.getCodigo(), "motivo",
                r.getMotivoCancelamento()));
        return r;
    }

    /** US-PUBLISHER-005: nenhuma obrigação nem lançamento; só o movimento de estoque. */
    @Transactional
    public DetalheDevolucao devolver(long remessaId, NovaDevolucao cmd) {
        Remessa r = remessas.travar(remessaId).orElseThrow(RemessasUseCase::naoEncontrada);
        periodos.exigirAberto(cmd.devolvidaEm());
        Map<Long, TituloConsignado> titulos = titulos(r);
        Map<Long, Integer> saldos = estoque.travarSaldos(remessaId, titulos.keySet());
        Map<Long, String> nomes = titulos.values().stream()
                .collect(Collectors.toMap(TituloConsignado::produtoId, TituloConsignado::nome));
        Devolucao nova = Devolucao.nova(r, cmd.devolvidaEm(), cmd.observacao(),
                cmd.quantidades() == null ? Map.of() : cmd.quantidades(), saldos, nomes, LocalDate.now(relogio),
                usuario.getSubject(), usuario.getNome(), relogio.instant());
        Devolucao salva = devolucoes.salvar(nova);
        for (Devolucao.Item i : salva.itens()) {
            estoque.devolver(remessaId, i.produtoId(), i.quantidade(), salva.id());
        }
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("remessa", r.getCodigo());
        detalhes.put("devolvidaEm", salva.devolvidaEm().toString());
        detalhes.put("observacao", salva.observacao());
        detalhes.put("itens", salva.itens().stream()
                .map(i -> Map.of("produtoId", i.produtoId(), "quantidade", i.quantidade())).toList());
        auditoria.registrar("DEVOLUCAO_EDITORA_REGISTRADA", ENTIDADE, remessaId, detalhes);
        return detalheDevolucao(salva, r, editoras.obter(r.getEditoraId()).orElseThrow(), titulos);
    }

    @Transactional(readOnly = true)
    public DetalheDevolucao devolucao(long id) {
        Devolucao d = devolucoes.obter(id).orElseThrow(() -> new RecursoNaoEncontradoException(
                "DEVOLUCAO_NAO_ENCONTRADA", "Devolução não encontrada."));
        Remessa r = remessas.obter(d.remessaId()).orElseThrow();
        return detalheDevolucao(d, r, editoras.obter(r.getEditoraId()).orElseThrow(), titulos(r));
    }

    private Map<Long, TituloConsignado> titulos(Remessa r) {
        return estoque.titulos(r.getItens().stream().map(Remessa.Item::produtoId).toList());
    }

    private DetalheDevolucao detalheDevolucao(Devolucao d, Remessa r, Editora e, Map<Long, TituloConsignado> titulos) {
        List<ItemDevolvido> itens = d.itens().stream().map(i -> {
            TituloConsignado t = titulos.get(i.produtoId());
            return new ItemDevolvido(i.produtoId(), t == null ? "Título " + i.produtoId() : t.nome(),
                    t == null ? null : t.isbn(), i.quantidade());
        }).toList();
        return new DetalheDevolucao(d, r.getCodigo(), e.id(), e.nome(), e.cnpj(), itens, organizacao.atuais());
    }
}
