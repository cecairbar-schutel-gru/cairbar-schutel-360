package com.durvalcrm.administracao.domain;

import java.util.List;

public interface ModeloMensagemRepository {

    List<ModeloMensagem> listar();

    ModeloMensagem buscar(TipoModelo tipo);

    void salvar(ModeloMensagem modelo);
}
