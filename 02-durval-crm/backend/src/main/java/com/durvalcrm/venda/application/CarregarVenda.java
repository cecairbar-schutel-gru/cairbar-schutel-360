package com.durvalcrm.venda.application;

import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
import com.durvalcrm.venda.domain.FiltroVendas;
import com.durvalcrm.venda.domain.Venda;
import com.durvalcrm.venda.domain.VendaRepository;
import java.util.Optional;

final class CarregarVenda {

    static final String ENTIDADE = "VENDA";

    private CarregarVenda() {
    }

    static Venda ou404(VendaRepository repositorio, long id) {
        return repositorio.buscarPorId(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("VENDA_NAO_ENCONTRADA", "Venda não encontrada."));
    }

    /** A venda mais recente registrada pelo usuário, qualquer que seja a situação (PDV, US-SALES-022). */
    static Optional<Venda> ultimaDe(VendaRepository repositorio, String vendedorSubject) {
        return repositorio.listar(new FiltroVendas(null, null, vendedorSubject, null, null, null, 1)).stream()
                .findFirst();
    }
}
