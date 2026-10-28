package com.durvalcrm.intencaogasto.application;

import com.durvalcrm.intencaogasto.domain.AnexoIntencao;
import com.durvalcrm.intencaogasto.domain.EventoIntencao;
import com.durvalcrm.intencaogasto.domain.StatusIntencao;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** Consultas de leitura das intenções de gasto (filas, "Minhas intenções", histórico e anexos). */
public interface ConsultaIntencoesPort {

    /**
     * Intenções filtradas por situação e, se informado, pelo solicitante. {@code maisAntigasPrimeiro}:
     * ordem da fila (US-EXPENSE-002); senão, das mais novas para as mais antigas (US-EXPENSE-008).
     */
    List<ResumoIntencao> listar(List<StatusIntencao> status, String solicitante, boolean maisAntigasPrimeiro);

    List<EventoIntencao> historico(long intencaoId);

    List<InfoAnexo> anexos(long intencaoId);

    Optional<AnexoIntencao> anexo(long intencaoId, int ordem);

    long contar(StatusIntencao status);

    Optional<Instant> ultimaVisita(String usuario);

    void registrarVisita(String usuario, Instant em);

    /** Nome da subcategoria ("Despesas operacionais › Material de limpeza"). */
    record ResumoIntencao(long id, Instant criadaEm, String solicitante, String solicitanteNome, String descricao,
            String categoria, String categoriaNome, BigDecimal valorSolicitado, BigDecimal valorAprovado,
            StatusIntencao status, Instant statusAlteradoEm, int anexos, List<ItemResumo> itens) {
    }

    record ItemResumo(long produtoId, String produtoNome, int quantidade, Integer quantidadeRecebida) {
    }

    record InfoAnexo(int ordem, String nome, String tipo, int tamanho) {
    }
}
