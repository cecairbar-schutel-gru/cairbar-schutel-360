package com.durvalcrm.venda.domain;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface VendaRepository {

    /** Insere ou atualiza; uma chave de idempotência repetida gera {@code RegraDeNegocioException}. */
    Venda salvar(Venda venda);

    Optional<Venda> buscarPorId(long id);

    Optional<Venda> buscarPorChaveIdempotencia(String chave);

    /** A venda que refez a venda cancelada informada (US-SALES-010). */
    Optional<Venda> buscarRefeitaDe(long vendaId);

    /** Da mais recente para a mais antiga. */
    List<Venda> listar(FiltroVendas filtro);

    /** As do vendedor e as feitas pelo perfil PDV da cantina, na data financeira informada. */
    List<Venda> listarDoDiaDoVendedorEDoPdv(LocalDate data, String vendedorSubject);
}
