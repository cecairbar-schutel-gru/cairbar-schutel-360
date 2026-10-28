package com.durvalcrm.editora.domain;

import java.util.List;
import java.util.Optional;

public interface EditoraRepository {

    List<Editora> listarAtivas();

    Optional<Editora> obter(long id);

    /** {@code SELECT … FOR UPDATE}: serializa os pagamentos da editora (alocação às obrigações). */
    Optional<Editora> travar(long id);

    /** Insere (sem id) ou atualiza, devolvendo com id. */
    Editora salvar(Editora editora);

    boolean cnpjEmUso(String cnpj, Long excetoId);

    boolean possuiRemessas(long id);

    /** Só para editora sem remessas, obrigações nem pagamentos. */
    void excluir(long id);
}
