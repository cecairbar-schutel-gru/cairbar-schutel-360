package com.durvalcrm.doador.adapter.out.persistence;

import com.durvalcrm.doador.domain.NotaDoador;
import com.durvalcrm.doador.domain.NotaDoadorRepository;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
class NotaDoadorPersistenceAdapter implements NotaDoadorRepository {

    private final SpringDataNotaDoadorRepository repositorio;

    NotaDoadorPersistenceAdapter(SpringDataNotaDoadorRepository repositorio) {
        this.repositorio = repositorio;
    }

    @Override
    public NotaDoador salvar(NotaDoador nota) {
        return paraDominio(repositorio.save(new NotaDoadorJpaEntity(nota.doadorId(), nota.texto(), nota.autorSubject(),
                nota.autorNome(), nota.criadaEm())));
    }

    @Override
    public List<NotaDoador> listarPorDoador(long doadorId) {
        return repositorio.findByDoadorIdOrderByCriadaEmDescIdDesc(doadorId).stream()
                .map(NotaDoadorPersistenceAdapter::paraDominio)
                .toList();
    }

    @Override
    public void excluirPorDoador(long doadorId) {
        repositorio.excluirPorDoador(doadorId);
    }

    private static NotaDoador paraDominio(NotaDoadorJpaEntity j) {
        return new NotaDoador(j.getId(), j.getDoadorId(), j.getTexto(), j.getAutorSubject(), j.getAutorNome(),
                j.getCriadaEm());
    }
}
