package com.durvalcrm.doador.adapter.in.contribuicao;

import com.durvalcrm.contribuicao.application.DoadoresPort;
import com.durvalcrm.doador.domain.DoadorRepository;
import com.durvalcrm.doador.domain.StatusDoador;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Entrega ao módulo Contribuições os dados do doador de que ele precisa. Fica no módulo Doador
 * para que Contribuições nunca dependa dele (ver {@code ArquiteturaTest}).
 */
@Component
class DoadoresParaContribuicaoAdapter implements DoadoresPort {

    private final DoadorRepository repositorio;

    DoadoresParaContribuicaoAdapter(DoadorRepository repositorio) {
        this.repositorio = repositorio;
    }

    @Override
    public Optional<DoadorResumo> buscar(long doadorId) {
        return repositorio.buscarPorId(doadorId).map(d -> new DoadorResumo(d.getId(), d.getNome(),
                d.getStatus() == StatusDoador.ATIVO, d.getStatus() == StatusDoador.ANONIMIZADO));
    }

    @Override
    public List<Long> listarIdsAtivos() {
        return repositorio.listarIdsAtivos();
    }
}
