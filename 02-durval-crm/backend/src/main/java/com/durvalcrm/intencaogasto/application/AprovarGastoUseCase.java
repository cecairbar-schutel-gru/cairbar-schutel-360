package com.durvalcrm.intencaogasto.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.financeiro.application.ConsultarLancamentosUseCase;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.financeiro.application.ResultadoLancamento;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.intencaogasto.application.Comandos.AprovacaoCommand;
import com.durvalcrm.intencaogasto.application.Comandos.CorrecaoCommand;
import com.durvalcrm.intencaogasto.application.ConsultaIntencoesPort.ResumoIntencao;
import com.durvalcrm.intencaogasto.domain.Aprovacao;
import com.durvalcrm.intencaogasto.domain.Autor;
import com.durvalcrm.intencaogasto.domain.IntencaoGasto;
import com.durvalcrm.intencaogasto.domain.IntencaoGastoRepository;
import com.durvalcrm.intencaogasto.domain.StatusIntencao;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.Textos;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lado da Tesouraria (Tesoureiro ou Administrador): fila de pendentes e de divergentes
 * (US-EXPENSE-002), aprovação com a despesa gerada na mesma transação (004), rejeição (005) e
 * resolução das compras divergentes por correção ou cancelamento (007).
 */
public class AprovarGastoUseCase {

    private final IntencaoGastoRepository repositorio;
    private final ConsultaIntencoesPort consulta;
    private final Intencoes intencoes;
    private final MovimentoFinanceiroUseCase movimento;
    private final RegistrarAuditoriaUseCase auditoria;
    private final Clock relogio;

    public AprovarGastoUseCase(IntencaoGastoRepository repositorio, ConsultaIntencoesPort consulta,
            ConsultarLancamentosUseCase financeiro, MovimentoFinanceiroUseCase movimento,
            RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario, Clock relogio) {
        this.repositorio = repositorio;
        this.consulta = consulta;
        this.intencoes = new Intencoes(repositorio, financeiro, movimento, usuario, relogio);
        this.movimento = movimento;
        this.auditoria = auditoria;
        this.relogio = relogio;
    }

    /**
     * Pendentes ou divergentes: das mais antigas para as mais novas (a fila). Sem situação: todas, das
     * mais novas para as mais antigas.
     */
    @Transactional(readOnly = true)
    public List<ResumoIntencao> fila(StatusIntencao status) {
        return consulta.listar(status == null ? List.of() : List.of(status), null, status != null);
    }

    /** Contadores dos painéis do Tesoureiro, do Administrador e do Vendedor. */
    @Transactional(readOnly = true)
    public Contadores contadores() {
        return new Contadores(consulta.contar(StatusIntencao.PENDENTE), consulta.contar(StatusIntencao.DIVERGENTE),
                consulta.contar(StatusIntencao.AGUARDANDO_RECEBIMENTO));
    }

    /** US-EXPENSE-004: a despesa entra atomicamente, com as regras de saldo e período do Financeiro. */
    @Transactional
    public Resultado aprovar(long id, AprovacaoCommand cmd) {
        IntencaoGasto i = intencoes.travar(id);
        ContaFinanceira conta = cmd.contaId() == null ? null : movimento.conta(cmd.contaId()).orElse(null);
        i.aprovar(cmd.valor(), intencoes.categoria(cmd.categoria()).orElse(null), cmd.meio(), conta, cmd.data(),
                LocalDate.now(relogio), cmd.nota(), intencoes.autor());
        ResultadoLancamento despesa = intencoes.lancarDespesa(i);
        i.registrarLancamento(despesa.id());
        repositorio.salvar(i);
        Aprovacao a = i.getAprovacao();
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("valorSolicitado", i.getValorSolicitado());
        detalhes.put("valorAprovado", a.valor());
        detalhes.put("categoriaSolicitada", i.getCategoria());
        detalhes.put("categoriaAprovada", a.categoria());
        detalhes.put("meio", a.meio().name());
        detalhes.put("contaId", a.contaId());
        detalhes.put("data", a.data().toString());
        detalhes.put("nota", a.nota());
        detalhes.put("lancamentoId", despesa.id());
        detalhes.put("autoaprovada", i.getSolicitante().equals(i.getDecididaPor()));
        auditoria.registrar("INTENCAO_GASTO_APROVADA", Intencoes.ENTIDADE, id, detalhes);
        return new Resultado(i, despesa.id(), despesa.avisos());
    }

    /** US-EXPENSE-005: nenhum lançamento. */
    @Transactional
    public Resultado rejeitar(long id, String motivo) {
        IntencaoGasto i = intencoes.travar(id);
        i.rejeitar(motivo, intencoes.autor());
        repositorio.salvar(i);
        auditoria.registrar("INTENCAO_GASTO_REJEITADA", Intencoes.ENTIDADE, id, Map.of("motivo", i.getMotivoRejeicao()));
        return new Resultado(i, null, List.of());
    }

    /**
     * US-EXPENSE-007 "Corrigir": quantidades acordadas e, se o valor pago mudou, estorno da despesa
     * (US-FINANCIAL-010) e novo lançamento com o valor correto. Volta para o Vendedor conferir.
     */
    @Transactional
    public Resultado corrigir(long id, CorrecaoCommand cmd) {
        IntencaoGasto i = intencoes.travar(id);
        Autor autor = intencoes.autor();
        long anterior = i.getAprovacao().lancamentoId();
        boolean valorMudou = i.corrigir(cmd.quantidades(), cmd.valor(), cmd.motivo(), autor);
        Long novo = null;
        List<String> avisos = new ArrayList<>();
        if (valorMudou) {
            intencoes.estornarDespesa(i, "correção", Textos.compactar(cmd.motivo()));
            ResultadoLancamento despesa = intencoes.lancarDespesa(i);
            i.registrarLancamento(despesa.id());
            novo = despesa.id();
            avisos.addAll(despesa.avisos());
        }
        repositorio.salvar(i);
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("itens", i.getItens().stream()
                .map(it -> Map.of("produtoId", it.produtoId(), "quantidade", it.quantidade())).toList());
        detalhes.put("valor", i.getAprovacao().valor());
        detalhes.put("lancamentoAnterior", anterior);
        detalhes.put("lancamentoNovo", novo);
        detalhes.put("motivo", Textos.compactar(cmd.motivo()));
        auditoria.registrar("INTENCAO_GASTO_CORRIGIDA", Intencoes.ENTIDADE, id, detalhes);
        return new Resultado(i, novo, avisos);
    }

    /** US-EXPENSE-007 "Cancelar": estorna a despesa; nada entra no estoque. */
    @Transactional
    public Resultado cancelar(long id, String motivo) {
        IntencaoGasto i = intencoes.travar(id);
        boolean jaEstornada = intencoes.despesaJaEstornada(i);
        i.cancelarDivergente(motivo, jaEstornada, intencoes.autor());
        if (!jaEstornada) {
            intencoes.estornarDespesa(i, "compra cancelada", i.getMotivoCancelamento());
        }
        repositorio.salvar(i);
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("motivo", i.getMotivoCancelamento());
        detalhes.put("lancamentoEstornado", i.getAprovacao().lancamentoId());
        detalhes.put("jaEstornadoNoFinanceiro", jaEstornada);
        auditoria.registrar("INTENCAO_GASTO_CANCELADA", Intencoes.ENTIDADE, id, detalhes);
        return new Resultado(i, null, List.of());
    }

    /** {@code lancamentoId}: despesa gerada (aprovação) ou a que substituiu a anterior (correção). */
    public record Resultado(IntencaoGasto intencao, Long lancamentoId, List<String> avisos) {
    }

    public record Contadores(long pendentes, long divergentes, long aguardandoRecebimento) {
    }
}
