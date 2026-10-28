package com.durvalcrm.editora.domain;

import java.util.List;
import java.util.Optional;

public interface DevolucaoRepository {

    Devolucao salvar(Devolucao devolucao);

    Optional<Devolucao> obter(long id);

    List<Devolucao> daRemessa(long remessaId);
}
