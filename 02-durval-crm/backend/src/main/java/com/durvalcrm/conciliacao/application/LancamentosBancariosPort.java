package com.durvalcrm.conciliacao.application;

import com.durvalcrm.financeiro.domain.Lancamento;
import com.durvalcrm.financeiro.domain.NaturezaLancamento;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * Lançamentos de uma conta bancária vistos pela conciliação: as linhas da conta no Financeiro, as
 * marcações da sessão e os pendentes gravados na conclusão. Cada lançamento entra pelo movimento
 * líquido dele na conta (soma das suas linhas nela).
 */
public interface LancamentosBancariosPort {

    /**
     * Lançamentos ainda não conciliados da conta com data entre o corte e o fim do extrato, já com a
     * marcação da sessão, na ordem de data e id.
     */
    List<LancamentoBancario> candidatos(long conciliacaoId, long contaId, LocalDate dataCorte, LocalDate dataFim);

    /** Marca os lançamentos na sessão (os já marcados ficam como estão); devolve quantos entraram. */
    int marcar(long conciliacaoId, long contaId, Collection<Long> lancamentos, Lancamento.Autor autor,
            boolean adicionado);

    int desmarcar(long conciliacaoId, Collection<Long> lancamentos);

    /** Desmarca o que ficou depois de uma nova data final do extrato. */
    int desmarcarDepoisDe(long conciliacaoId, LocalDate data);

    BigDecimal totalMarcado(long conciliacaoId);

    /**
     * Conclusão: as linhas marcadas passam a apontar para a sessão (definitivo) e os candidatos não
     * marcados são gravados como pendentes. Devolve {conciliados, pendentes}.
     */
    int[] efetivar(long conciliacaoId, long contaId, LocalDate dataCorte, LocalDate dataFim);

    /** Lançamentos conciliados pela sessão (marcações, com autor e data). */
    List<LancamentoBancario> conciliados(long conciliacaoId);

    /** Pendentes gravados na conclusão da sessão. */
    List<LancamentoBancario> pendentes(long conciliacaoId);

    /** Lançamentos não conciliados (a partir do corte) por conta bancária. */
    Map<Long, Long> naoConciliadosPorConta();

    /** Sessões concluídas, da mais recente para a mais antiga; sem conta, todas. */
    List<ResumoConciliacao> concluidas(Long contaId);

    /**
     * @param valor        movimento líquido do lançamento na conta (+ entra, − sai)
     * @param marcadoPor   nome de quem marcou (nulo se não marcado)
     * @param adicionado   registrado na tela da conciliação (US-RECONCILIATION-005)
     */
    record LancamentoBancario(long id, LocalDate data, String descricao, String origemTipo, Long origemId,
            NaturezaLancamento natureza, BigDecimal valor, Long estornaLancamentoId, Long estornadoPorId,
            Long corrigeLancamentoId, boolean marcado, String marcadoPor, Instant marcadoEm, boolean adicionado) {
    }

    record ResumoConciliacao(long id, long contaId, String contaNome, LocalDate dataFim, BigDecimal saldoExtrato,
            long conciliados, long pendentes, String concluidaPor, Instant concluidaEm) {
    }
}
