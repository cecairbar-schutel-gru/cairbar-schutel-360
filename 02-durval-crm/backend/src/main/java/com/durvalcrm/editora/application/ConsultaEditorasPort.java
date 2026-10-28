package com.durvalcrm.editora.application;

import com.durvalcrm.editora.domain.MeioPagamentoEditora;
import com.durvalcrm.editora.domain.OrigemObrigacao;
import com.durvalcrm.editora.domain.StatusObrigacao;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Consultas de leitura das telas de Editoras. Datas de instantes (criação e estorno de obrigações,
 * estorno de pagamentos) são o dia no fuso da organização.
 */
public interface ConsultaEditorasPort {

    record ResumoEditora(long id, String nome, String cnpj, String contatoNome, String telefone, boolean ativa,
            int remessasAbertas, BigDecimal saldoDevido) {
    }

    /** {@code ativas} nulo: todas. */
    List<ResumoEditora> listar(Boolean ativas);

    /**
     * Situação exibida: CANCELADA, ENCERRADA (cancelada não; todos os itens em zero) ou ABERTA.
     */
    record ResumoRemessa(long id, String codigo, long editoraId, String editoraNome, LocalDate recebidaEm,
            String numeroDocumento, String situacao, int recebidas, int restantes) {
    }

    List<ResumoRemessa> remessas(Long editoraId, String situacao);

    /** Quantidades por título desde o recebimento; o restante é o saldo atual do lote. */
    record ItemRemessaDetalhado(long produtoId, String titulo, String autor, String isbn, int recebida,
            BigDecimal repassePercentual, int vendida, int devolvida, int baixada, int ajustes, int restante,
            BigDecimal obrigacoes) {
    }

    List<ItemRemessaDetalhado> itensDaRemessa(long remessaId);

    record UltimoPagamento(LocalDate data, BigDecimal valor) {
    }

    Optional<UltimoPagamento> ultimoPagamento(long editoraId);

    record SaldoEditora(long editoraId, String nome, boolean ativa, BigDecimal saldoDevido,
            LocalDate obrigacaoMaisAntiga, LocalDate ultimoPagamento) {
    }

    /** Editoras que já tiveram obrigação ou pagamento, com o saldo de hoje. */
    List<SaldoEditora> saldos(LocalDate hoje);

    record LinhaObrigacao(long id, LocalDate data, OrigemObrigacao origem, long origemId, Long origemNumero,
            String remessaCodigo, long produtoId, String titulo, int quantidade, BigDecimal precoUnitario,
            BigDecimal repassePercentual, BigDecimal valor, BigDecimal valorPago, BigDecimal valorAberto,
            StatusObrigacao status, LocalDate estornadaEm) {
    }

    /** Obrigações da editora (todas, da mais antiga para a mais nova) com data de criação no período. */
    List<LinhaObrigacao> obrigacoes(long editoraId, LocalDate de, LocalDate ate);

    /** Obrigações estornadas no período. */
    List<LinhaObrigacao> obrigacoesEstornadas(long editoraId, LocalDate de, LocalDate ate);

    record LinhaPagamento(long id, LocalDate pagoEm, BigDecimal valor, BigDecimal creditoAplicado, String contaNome,
            MeioPagamentoEditora meio, String observacao, String registradoPor, Long lancamentoId,
            LocalDate estornadoEm) {
    }

    /** Pagamentos com data no período ou estornados no período. */
    List<LinhaPagamento> pagamentos(long editoraId, LocalDate de, LocalDate ate);

    /** Obrigações − estornos − pagamentos não estornados, como estavam no fim do dia. */
    BigDecimal saldoEm(long editoraId, LocalDate data);

    /** O mesmo para todas as editoras, só as com saldo diferente de zero. */
    Map<Long, BigDecimal> saldosEm(LocalDate data);

    record LinhaDevolucao(long devolucaoId, LocalDate data, String remessaCodigo, String titulo, int quantidade,
            String observacao) {
    }

    List<LinhaDevolucao> devolucoes(long editoraId, LocalDate de, LocalDate ate);

    /** Seção de estoque da apuração (US-PUBLISHER-007), por remessa e título. */
    record EstoqueRemessa(long remessaId, String remessaCodigo, long produtoId, String titulo, int inicial,
            int recebida, int vendida, int devolvida, int baixada, int outros, int fim) {
    }

    List<EstoqueRemessa> estoque(long editoraId, LocalDate de, LocalDate ate);

    /** Títulos das obrigações pedidas (prévia e recibo do pagamento). */
    Map<Long, LinhaObrigacao> obrigacoesPorId(List<Long> ids);
}
