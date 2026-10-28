package com.durvalcrm.editora.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.editora.application.ConsultaEditorasPort.EstoqueRemessa;
import com.durvalcrm.editora.application.ConsultaEditorasPort.LinhaDevolucao;
import com.durvalcrm.editora.application.ConsultaEditorasPort.LinhaObrigacao;
import com.durvalcrm.editora.application.ConsultaEditorasPort.LinhaPagamento;
import com.durvalcrm.editora.application.ConsultaEditorasPort.SaldoEditora;
import com.durvalcrm.editora.domain.Editora;
import com.durvalcrm.editora.domain.EditoraRepository;
import com.durvalcrm.editora.domain.ObrigacaoRepository;
import com.durvalcrm.editora.domain.OrigemObrigacao;
import com.durvalcrm.editora.domain.StatusObrigacao;
import com.durvalcrm.editora.domain.TransferenciaSaldo;
import com.durvalcrm.editora.domain.TransferenciaSaldoRepository;
import com.durvalcrm.financeiro.application.PeriodoFinanceiroPort;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.application.DadosOrganizacao;
import com.durvalcrm.shared.application.DadosOrganizacaoPort;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

/**
 * Saldo devido por editora (US-PUBLISHER-006), apuração mensal (007) e a etapa "Editoras" do
 * fechamento: cada editora com saldo no fim do mês é paga ou tem o saldo transferido formalmente ao
 * mês seguinte (010). Saldo devido = obrigações − estornos − pagamentos.
 */
public class SaldosEditorasUseCase {

    static final String ENTIDADE = "Editora";

    private final EditoraRepository editoras;
    private final ObrigacaoRepository obrigacoes;
    private final TransferenciaSaldoRepository transferencias;
    private final ConsultaEditorasPort consulta;
    private final DadosOrganizacaoPort organizacao;
    private final PeriodoFinanceiroPort periodos;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public SaldosEditorasUseCase(EditoraRepository editoras, ObrigacaoRepository obrigacoes,
            TransferenciaSaldoRepository transferencias, ConsultaEditorasPort consulta, DadosOrganizacaoPort organizacao,
            PeriodoFinanceiroPort periodos, RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario,
            Clock relogio) {
        this.editoras = editoras;
        this.obrigacoes = obrigacoes;
        this.transferencias = transferencias;
        this.consulta = consulta;
        this.organizacao = organizacao;
        this.periodos = periodos;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    public record QuadroSaldos(List<SaldoEditora> editoras, BigDecimal total) {
    }

    /** Detalhe do saldo: obrigações (abertas, pagas e estornadas) e pagamentos. */
    public record SaldoDetalhado(Editora editora, BigDecimal totalObrigacoes, BigDecimal totalEstornos,
            BigDecimal totalPagamentos, BigDecimal saldoDevido, BigDecimal creditoDisponivel,
            List<LinhaObrigacao> obrigacoes, List<LinhaPagamento> pagamentos) {
    }

    /**
     * Apuração mensal: seção financeira (saldo inicial + obrigações por venda e por dano/extravio −
     * estornos − pagamentos = saldo final), seção de estoque e as linhas de detalhe.
     * {@code pagamentos} já desconta os pagamentos estornados no mês.
     */
    public record Apuracao(DadosOrganizacao organizacao, Editora editora, YearMonth mes, BigDecimal saldoInicial,
            TransferenciaSaldo transferenciaAnterior, BigDecimal obrigacoesVendas, BigDecimal obrigacoesBaixas,
            BigDecimal estornos, BigDecimal pagamentos, BigDecimal saldoFinal, List<EstoqueRemessa> estoque,
            List<LinhaObrigacao> vendas, List<LinhaObrigacao> baixas, List<LinhaObrigacao> estornadas,
            List<LinhaDevolucao> devolucoes, List<LinhaPagamento> linhasPagamentos) {
    }

    /** PENDENTE (sem pagamento nem transferência) ou TRANSFERIDA. */
    public record ItemFechamento(long editoraId, String nome, BigDecimal saldoNoFimDoMes, String situacao,
            TransferenciaSaldo transferencia) {
    }

    /** O item "Editoras" do checklist passa só quando nada está pendente. */
    public record FechamentoEditoras(YearMonth mes, List<ItemFechamento> editoras, boolean concluido) {
    }

    @Transactional(readOnly = true)
    public QuadroSaldos saldos() {
        List<SaldoEditora> lista = consulta.saldos(LocalDate.now(relogio)).stream()
                .sorted(Comparator.comparing(SaldoEditora::saldoDevido).reversed()
                        .thenComparing(SaldoEditora::nome, String.CASE_INSENSITIVE_ORDER))
                .toList();
        return new QuadroSaldos(lista, lista.stream().map(SaldoEditora::saldoDevido)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    @Transactional(readOnly = true)
    public SaldoDetalhado detalhe(long editoraId) {
        Editora e = editoras.obter(editoraId).orElseThrow(CadastroEditorasUseCase::naoEncontrada);
        List<LinhaObrigacao> lista = consulta.obrigacoes(editoraId, null, null);
        List<LinhaPagamento> pagos = consulta.pagamentos(editoraId, null, null);
        BigDecimal total = soma(lista.stream().map(LinhaObrigacao::valor).toList());
        BigDecimal estornos = soma(lista.stream().filter(o -> o.status() == StatusObrigacao.ESTORNADA)
                .map(LinhaObrigacao::valor).toList());
        BigDecimal pagamentos = soma(pagos.stream().filter(p -> p.estornadoEm() == null).map(LinhaPagamento::valor)
                .toList());
        return new SaldoDetalhado(e, total, estornos, pagamentos, total.subtract(estornos).subtract(pagamentos),
                obrigacoes.creditoDisponivel(editoraId), lista, pagos);
    }

    @Transactional(readOnly = true)
    public Apuracao apuracao(long editoraId, YearMonth mes) {
        Editora e = editoras.obter(editoraId).orElseThrow(CadastroEditorasUseCase::naoEncontrada);
        if (mes == null) {
            throw ValidacaoException.doCampo("mes", "Escolha o mês.");
        }
        LocalDate de = mes.atDay(1);
        LocalDate ate = mes.atEndOfMonth();
        BigDecimal inicial = consulta.saldoEm(editoraId, de.minusDays(1));
        List<LinhaObrigacao> criadas = consulta.obrigacoes(editoraId, de, ate);
        List<LinhaObrigacao> vendas = criadas.stream().filter(o -> o.origem() == OrigemObrigacao.VENDA).toList();
        List<LinhaObrigacao> baixas = criadas.stream().filter(o -> o.origem() == OrigemObrigacao.BAIXA).toList();
        List<LinhaObrigacao> estornadas = consulta.obrigacoesEstornadas(editoraId, de, ate);
        List<LinhaPagamento> linhasPagamentos = consulta.pagamentos(editoraId, de, ate);
        BigDecimal pagos = soma(linhasPagamentos.stream().filter(p -> dentro(p.pagoEm(), de, ate))
                .map(LinhaPagamento::valor).toList());
        BigDecimal desfeitos = soma(linhasPagamentos.stream().filter(p -> dentro(p.estornadoEm(), de, ate))
                .map(LinhaPagamento::valor).toList());
        BigDecimal somaVendas = soma(vendas.stream().map(LinhaObrigacao::valor).toList());
        BigDecimal somaBaixas = soma(baixas.stream().map(LinhaObrigacao::valor).toList());
        BigDecimal somaEstornos = soma(estornadas.stream().map(LinhaObrigacao::valor).toList());
        BigDecimal pagamentos = pagos.subtract(desfeitos);
        BigDecimal fim = inicial.add(somaVendas).add(somaBaixas).subtract(somaEstornos).subtract(pagamentos);
        return new Apuracao(organizacao.atuais(), e, mes, inicial,
                transferencias.obter(editoraId, mes.minusMonths(1)).orElse(null), somaVendas, somaBaixas, somaEstornos,
                pagamentos, fim, consulta.estoque(editoraId, de, ate), vendas, baixas, estornadas,
                consulta.devolucoes(editoraId, de, ate), linhasPagamentos);
    }

    @Transactional(readOnly = true)
    public FechamentoEditoras fechamento(YearMonth mes) {
        if (mes == null) {
            throw ValidacaoException.doCampo("mes", "Escolha o mês.");
        }
        Map<Long, BigDecimal> saldos = consulta.saldosEm(mes.atEndOfMonth());
        Map<Long, TransferenciaSaldo> feitas = transferencias.doMes(mes).stream()
                .collect(Collectors.toMap(TransferenciaSaldo::editoraId, Function.identity()));
        List<ItemFechamento> itens = new ArrayList<>();
        for (Map.Entry<Long, BigDecimal> s : saldos.entrySet()) {
            if (s.getValue().signum() <= 0) {
                continue;
            }
            TransferenciaSaldo t = feitas.get(s.getKey());
            itens.add(new ItemFechamento(s.getKey(), nome(s.getKey()), s.getValue(),
                    t == null ? "PENDENTE" : "TRANSFERIDA", t));
        }
        itens.sort(Comparator.comparing(ItemFechamento::nome, String.CASE_INSENSITIVE_ORDER));
        return new FechamentoEditoras(mes, itens, itens.stream().allMatch(i -> i.transferencia() != null));
    }

    /** Para o checklist do fechamento mensal (US-CLOSING-001), quando ele existir. */
    @Transactional(readOnly = true)
    public boolean editorasResolvidas(YearMonth mes) {
        return fechamento(mes).concluido();
    }

    /** Sem lançamento: as obrigações continuam abertas, com as datas originais. */
    @Transactional
    public TransferenciaSaldo transferir(Long editoraId, YearMonth mes, String nota) {
        if (editoraId == null) {
            throw ValidacaoException.doCampo("editoraId", "Escolha a editora.");
        }
        Editora e = editoras.travar(editoraId).orElseThrow(CadastroEditorasUseCase::naoEncontrada);
        if (mes != null) {
            // A transferência é parte do fechamento do mês: depois de fechado, não muda (US-CLOSING-008).
            periodos.exigirAberto(mes.atDay(1));
        }
        if (mes != null && transferencias.obter(editoraId, mes).isPresent()) {
            throw new RegraDeNegocioException("SALDO_JA_TRANSFERIDO",
                    "O saldo de " + e.nome() + " deste mês já foi transferido.");
        }
        BigDecimal saldo = mes == null ? BigDecimal.ZERO : consulta.saldoEm(editoraId, mes.atEndOfMonth());
        TransferenciaSaldo nova = TransferenciaSaldo.nova(editoraId, mes, YearMonth.now(relogio), saldo, nota,
                usuario.getSubject(), usuario.getNome(), relogio.instant());
        TransferenciaSaldo salva = transferencias.salvar(nova);
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("mes", salva.mes().toString());
        detalhes.put("valor", salva.valor());
        detalhes.put("nota", salva.nota());
        auditoria.registrar("SALDO_EDITORA_TRANSFERIDO", ENTIDADE, editoraId, detalhes);
        return salva;
    }

    private String nome(long editoraId) {
        return editoras.obter(editoraId).map(Editora::nome).orElse("Editora " + editoraId);
    }

    private static boolean dentro(LocalDate data, LocalDate de, LocalDate ate) {
        return data != null && !data.isBefore(de) && !data.isAfter(ate);
    }

    private static BigDecimal soma(List<BigDecimal> valores) {
        return valores.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
