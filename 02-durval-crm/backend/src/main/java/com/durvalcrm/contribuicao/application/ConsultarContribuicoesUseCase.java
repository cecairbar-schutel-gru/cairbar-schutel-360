package com.durvalcrm.contribuicao.application;

import com.durvalcrm.contribuicao.domain.CompetenciaPaga;
import com.durvalcrm.contribuicao.domain.Contribuicao;
import com.durvalcrm.contribuicao.domain.ContribuicaoRepository;
import com.durvalcrm.contribuicao.domain.MeioPagamento;
import com.durvalcrm.contribuicao.domain.Pagamento;
import com.durvalcrm.contribuicao.domain.Valores;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.application.DadosOrganizacaoPort;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.transaction.annotation.Transactional;

/** Recibo, histórico do doador e painel do Operador (US-CONTRIB-009, 012 e 021). */
public class ConsultarContribuicoesUseCase {

    public static final int ULTIMAS_DO_OPERADOR = 10;

    private final ContribuicaoRepository contribuicoes;
    private final DoadoresPort doadores;
    private final DadosOrganizacaoPort organizacao;
    private final GeradorReciboPdfPort pdf;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public ConsultarContribuicoesUseCase(ContribuicaoRepository contribuicoes, DoadoresPort doadores,
            DadosOrganizacaoPort organizacao, GeradorReciboPdfPort pdf, CurrentUserPort usuario,
            Clock relogio) {
        this.contribuicoes = contribuicoes;
        this.doadores = doadores;
        this.organizacao = organizacao;
        this.pdf = pdf;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public Recibo recibo(long id, boolean segundaVia) {
        Contribuicao c = visivel(CarregarContribuicao.ou404(contribuicoes, id));
        return new Recibo(c.getId(), c.getNumeroRecibo(), c.getRecebidaEm(), c.getTipo(), c.getDoadorId(), nomeDoDoador(c),
                c.getCompetencias(), c.getValorDoacao(), c.getPagamentos(), c.total(), c.getObservacao(),
                c.getOperadorNome(), c.getStatus(), c.getCanceladaEm(), c.getMotivoCancelamento(),
                segundaVia, organizacao.atuais());
    }

    @Transactional(readOnly = true)
    public byte[] reciboPdf(long id, LayoutRecibo layout, boolean segundaVia) {
        return pdf.gerar(recibo(id, segundaVia), layout);
    }

    /** O Vendedor (sem outro papel com acesso aos recibos) vê só as doações que registrou. */
    private Contribuicao visivel(Contribuicao c) {
        boolean soVendedor = !usuario.hasRole("operador") && !usuario.hasRole("tesoureiro")
                && !usuario.hasRole("administrador");
        if (soVendedor && !c.getOperadorSubject().equals(usuario.getSubject())) {
            throw new RecursoNaoEncontradoException("CONTRIBUICAO_NAO_ENCONTRADA", "Contribuição não encontrada.");
        }
        return c;
    }

    @Transactional(readOnly = true)
    public long idPorNumeroRecibo(String numero) {
        return contribuicoes.buscarPorNumeroRecibo(numero == null ? "" : numero.trim())
                .map(this::visivel)
                .map(Contribuicao::getId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("RECIBO_NAO_ENCONTRADO", "Recibo não encontrado."));
    }

    /** Ano padrão: o atual. O total do ano exclui as canceladas. */
    @Transactional(readOnly = true)
    public HistoricoContribuicoes historico(long doadorId, Integer ano) {
        CarregarContribuicao.doadorOu404(doadores, doadorId);
        int anoEscolhido = ano != null ? ano : LocalDate.now(relogio).getYear();
        List<Contribuicao> lista = contribuicoes.listarPorDoadorNoAno(doadorId, anoEscolhido);
        List<Integer> anos = new ArrayList<>(contribuicoes.anosComContribuicao(doadorId));
        if (!anos.contains(anoEscolhido)) {
            anos.add(anoEscolhido);
            anos.sort((a, b) -> b - a);
        }
        BigDecimal total = Valores.soma(lista.stream().filter(c -> !c.isCancelada()).map(Contribuicao::total).toList());
        return new HistoricoContribuicoes(anoEscolhido, anos, total, lista.stream().map(c -> new HistoricoContribuicoes.Item(
                c.getId(), c.getRecebidaEm(), c.getNumeroRecibo(), c.getTipo(),
                c.getCompetencias().stream().map(CompetenciaPaga::mes).toList(), c.getValorDoacao(), c.total(),
                c.getPagamentos().stream().map(Pagamento::meio).distinct().sorted().toList(), c.getStatus(),
                c.getMotivoCancelamento())).toList());
    }

    @Transactional(readOnly = true)
    public PainelOperador painelOperador() {
        LocalDate hoje = LocalDate.now(relogio);
        List<Contribuicao> doDia = contribuicoes.listarDoDiaDoOperador(hoje, usuario.getSubject()).stream()
                .filter(c -> !c.isCancelada()).toList();

        List<PainelOperador.Ultima> ultimas = contribuicoes.listarUltimasDoOperador(usuario.getSubject(),
                ULTIMAS_DO_OPERADOR).stream()
                .map(c -> new PainelOperador.Ultima(c.getId(), c.getRecebidaEm(), c.getNumeroRecibo(), c.getTipo(),
                        nomeDoDoador(c), c.total(), c.getStatus()))
                .toList();
        return new PainelOperador(hoje, doDia.size(), somaPorMeio(doDia, MeioPagamento.DINHEIRO),
                somaPorMeio(doDia, MeioPagamento.PIX), somaPorMeio(doDia, MeioPagamento.CARTAO), ultimas);
    }

    private static BigDecimal somaPorMeio(List<Contribuicao> lista, MeioPagamento meio) {
        return Valores.soma(lista.stream().map(c -> c.valorPorMeio(meio)).toList());
    }

    private String nomeDoDoador(Contribuicao c) {
        if (c.isAnonima()) {
            return Recibo.NOME_ANONIMO;
        }
        return doadores.buscar(c.getDoadorId()).map(DoadoresPort.DoadorResumo::nome).orElse("—");
    }
}
