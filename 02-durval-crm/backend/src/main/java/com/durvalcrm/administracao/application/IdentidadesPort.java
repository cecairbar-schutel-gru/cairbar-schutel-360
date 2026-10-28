package com.durvalcrm.administracao.application;

import java.time.Instant;
import java.util.List;

/**
 * Usuários do realm no provedor de identidade (Keycloak), só leitura (US-ADMIN-001): o DurvalCRM
 * nunca cria, altera nem exclui usuários ou papéis.
 */
public interface IdentidadesPort {

    /** Falso quando a instalação não tem as credenciais de leitura do realm. */
    boolean configurado();

    /** Usuários com algum papel do DurvalCRM. */
    List<Identidade> usuarios();

    /** Endereço do usuário no console de administração. */
    String linkConsole(String id);

    /**
     * @param papeis papéis do DurvalCRM (operador, vendedor, pdv, tesoureiro, administrador)
     */
    record Identidade(String id, String usuario, String nome, String email, List<String> papeis, boolean habilitado,
            Instant ultimoLogin) {
    }
}
