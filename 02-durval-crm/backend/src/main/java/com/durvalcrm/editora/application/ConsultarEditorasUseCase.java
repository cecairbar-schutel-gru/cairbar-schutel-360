package com.durvalcrm.editora.application;

import com.durvalcrm.editora.domain.Editora;
import com.durvalcrm.editora.domain.EditoraRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.transaction.annotation.Transactional;

/** API do módulo Editoras para o cadastro de títulos (US-INVENTORY-001). */
public class ConsultarEditorasUseCase {

    private final EditoraRepository editoras;

    public ConsultarEditorasUseCase(EditoraRepository editoras) {
        this.editoras = editoras;
    }

    @Transactional(readOnly = true)
    public List<Editora> ativas() {
        return editoras.listarAtivas();
    }

    @Transactional(readOnly = true)
    public Optional<Editora> obter(long id) {
        return editoras.obter(id);
    }
}
