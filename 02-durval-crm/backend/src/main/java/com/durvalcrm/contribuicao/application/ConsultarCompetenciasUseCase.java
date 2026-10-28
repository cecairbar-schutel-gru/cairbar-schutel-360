package com.durvalcrm.contribuicao.application;

import com.durvalcrm.contribuicao.application.PainelCompetencias.Item;
import com.durvalcrm.contribuicao.application.PainelCompetencias.Situacao;
import com.durvalcrm.contribuicao.domain.Competencia;
import com.durvalcrm.contribuicao.domain.CompetenciaRepository;
import com.durvalcrm.contribuicao.domain.Valores;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lista única de competências (US-CONTRIB-002): todas as pendentes, os próximos 12 meses e as
 * pagas/canceladas dos últimos 24 meses (as mais antigas só com {@code completo}).
 */
public class ConsultarCompetenciasUseCase {

    public static final int MESES_FUTUROS = 12;
    public static final int MESES_HISTORICO = 24;

    private final CompetenciaRepository repositorio;
    private final DoadoresPort doadores;
    private final MensalidadeVigentePort mensalidade;
    private final Clock relogio;

    public ConsultarCompetenciasUseCase(CompetenciaRepository repositorio, DoadoresPort doadores,
            MensalidadeVigentePort mensalidade, Clock relogio) {
        this.repositorio = repositorio;
        this.doadores = doadores;
        this.mensalidade = mensalidade;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public PainelCompetencias painel(long doadorId, boolean completo) {
        DoadoresPort.DoadorResumo doador = CarregarContribuicao.doadorOu404(doadores, doadorId);
        YearMonth atual = YearMonth.now(relogio);
        YearMonth inicioHistorico = atual.minusMonths(MESES_HISTORICO - 1L);
        // US-CONTRIB-003: o antecipado é cobrado pelo valor vigente na data do pagamento.
        BigDecimal valorAtual = mensalidade.valorPara(atual);

        List<Competencia> gravadas = repositorio.listarPorDoador(doadorId);
        List<Item> itens = new ArrayList<>();
        boolean maisAntigas = false;
        for (Competencia c : gravadas) {
            if (c.isPendente() || completo || !c.getMes().isBefore(inicioHistorico)) {
                itens.add(item(c, atual));
            } else {
                maisAntigas = true;
            }
        }
        if (doador.ativo()) {
            Set<YearMonth> meses = gravadas.stream().map(Competencia::getMes).collect(Collectors.toSet());
            for (int i = 0; i <= MESES_FUTUROS; i++) {
                YearMonth mes = atual.plusMonths(i);
                if (!meses.contains(mes)) {
                    itens.add(new Item(mes, valorAtual, Situacao.FUTURA, false, null, null, null));
                }
            }
        }
        itens.sort(Comparator.comparing(Item::competencia));

        List<Competencia> pendentes = gravadas.stream().filter(Competencia::isPendente).toList();
        return new PainelCompetencias(pendentes.size(),
                Valores.soma(pendentes.stream().map(Competencia::getValor).toList()), valorAtual, itens, maisAntigas);
    }

    private static Item item(Competencia c, YearMonth atual) {
        Situacao situacao = switch (c.getStatus()) {
            case PENDENTE -> Situacao.PENDENTE;
            case PAGA -> Situacao.PAGA;
            case CANCELADA -> Situacao.CANCELADA;
        };
        return new Item(c.getMes(), c.getValor(), situacao, c.isPendente() && c.getMes().isBefore(atual),
                c.getDataPagamento(), c.getNumeroRecibo(), c.getContribuicaoId());
    }
}
