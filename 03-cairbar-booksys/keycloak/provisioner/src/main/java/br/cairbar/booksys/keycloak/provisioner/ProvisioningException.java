package br.cairbar.booksys.keycloak.provisioner;

/** Estado do servidor que impede o provisionamento de continuar com segurança. */
public final class ProvisioningException extends RuntimeException {

    public ProvisioningException(String message) {
        super(message);
    }
}
