package com.durvalcrm.administracao.application;

import com.durvalcrm.administracao.domain.Autor;
import com.durvalcrm.administracao.domain.ModeloMensagem;
import com.durvalcrm.administracao.domain.ModeloMensagemRepository;
import com.durvalcrm.administracao.domain.TipoModelo;
import com.durvalcrm.shared.application.CurrentUserPort;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/** Modelos de agradecimento e de aniversário (US-ADMIN-003), usados pelo Operador ao preparar mensagens. */
public class ModelosMensagemUseCase {

    private final ModeloMensagemRepository repositorio;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public ModelosMensagemUseCase(ModeloMensagemRepository repositorio, RegistrarAuditoriaUseCase auditoria,
            CurrentUserPort usuario, Clock relogio) {
        this.repositorio = repositorio;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public List<ModeloMensagem> listar() {
        return repositorio.listar();
    }

    @Transactional
    public ModeloMensagem salvar(TipoModelo tipo, String whatsapp, String emailAssunto, String emailCorpo) {
        ModeloMensagem.validar(tipo, whatsapp, emailAssunto, emailCorpo);
        ModeloMensagem anterior = repositorio.buscar(tipo);
        ModeloMensagem novo = new ModeloMensagem(tipo, whatsapp.strip(), emailAssunto.strip(), emailCorpo.strip(),
                new Autor(usuario.getSubject(), usuario.getNome(), relogio.instant()));
        repositorio.salvar(novo);
        auditoria.registrarAlteracao("MODELO_MENSAGEM_ALTERADO", "ModeloMensagem", tipo.name(), textos(anterior),
                textos(novo), null);
        return novo;
    }

    private static Map<String, Object> textos(ModeloMensagem m) {
        Map<String, Object> t = new LinkedHashMap<>();
        t.put("whatsapp", m.whatsapp());
        t.put("emailAssunto", m.emailAssunto());
        t.put("emailCorpo", m.emailCorpo());
        return t;
    }
}
