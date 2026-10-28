package com.durvalcrm.administracao.application;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import org.springframework.transaction.annotation.Transactional;

/** Lista só de leitura dos usuários e papéis (US-ADMIN-001), vinda do Keycloak. */
public class UsuariosUseCase {

    private final IdentidadesPort identidades;

    public UsuariosUseCase(IdentidadesPort identidades) {
        this.identidades = identidades;
    }

    @Transactional(readOnly = true)
    public ListaUsuarios listar() {
        if (!identidades.configurado()) {
            return new ListaUsuarios(false, null, List.of());
        }
        List<IdentidadesPort.Identidade> lista;
        try {
            lista = identidades.usuarios();
        } catch (RuntimeException e) {
            return new ListaUsuarios(true, "Não foi possível consultar o Keycloak agora. Tente novamente.", List.of());
        }
        List<Usuario> usuarios = lista.stream()
                .map(this::usuario)
                .sorted(Comparator.comparing(Usuario::nome, String.CASE_INSENSITIVE_ORDER))
                .toList();
        return new ListaUsuarios(true, null, usuarios);
    }

    private Usuario usuario(IdentidadesPort.Identidade i) {
        String nome = i.nome() == null || i.nome().isBlank() ? i.usuario() : i.nome();
        return new Usuario(i.id(), i.usuario(), nome, i.email(), i.papeis(), i.habilitado(), i.ultimoLogin(),
                identidades.linkConsole(i.id()));
    }

    public record Usuario(String id, String usuario, String nome, String email, List<String> papeis,
            boolean habilitado, Instant ultimoLogin, String linkConsole) {
    }

    /** @param erro falha ao consultar o Keycloak */
    public record ListaUsuarios(boolean configurado, String erro, List<Usuario> usuarios) {
    }
}
