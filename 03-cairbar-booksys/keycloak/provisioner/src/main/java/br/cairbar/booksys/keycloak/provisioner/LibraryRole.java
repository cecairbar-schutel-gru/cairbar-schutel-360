package br.cairbar.booksys.keycloak.provisioner;

/**
 * Perfis da biblioteca (especificação de produto §1.2, especificação técnica §5.1). São realm roles
 * do realm {@code cecairbar}, compartilhadas com o DurvalCRM: o projeto de identidade
 * ({@code 01-cairbar-identity-provider}) as cria e atribui aos grupos; aqui elas só entram no escopo
 * da SPA. Não são compostas, porque {@code operador} e {@code administrador} também valem no
 * DurvalCRM: a herança (Bibliotecário ⊇ Operador, Administrador ⊇ todos) é regra da aplicação.
 */
public enum LibraryRole {

    /** Perfil padrão (grupo /participantes): encomendas, empréstimos e jornada do leitor. */
    SCHUTELISTA("schutelista"),
    /** Empréstimos, devoluções, listas de espera e listas temáticas. */
    OPERADOR("operador"),
    /** Funções do Operador e gestão completa do acervo. */
    BIBLIOTECARIO("bibliotecario"),
    /** Acesso completo. */
    ADMINISTRADOR("administrador");

    private final String roleName;

    LibraryRole(String roleName) {
        this.roleName = roleName;
    }

    /** Nome da realm role no Keycloak. */
    public String roleName() {
        return roleName;
    }
}
