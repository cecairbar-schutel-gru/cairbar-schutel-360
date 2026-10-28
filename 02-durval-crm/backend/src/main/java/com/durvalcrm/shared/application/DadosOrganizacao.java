package com.durvalcrm.shared.application;

/**
 * Identificação da organização nos recibos, comprovantes e relatórios (US-ADMIN-005).
 *
 * @param nome nome de exibição
 * @param logo PNG ou JPG; nulo usa o logotipo da instalação
 */
public record DadosOrganizacao(String nome, String cnpj, String endereco, String rodape, String razaoSocial,
        String telefone, String email, byte[] logo) {

    public DadosOrganizacao(String nome, String cnpj, String endereco, String rodape) {
        this(nome, cnpj, endereco, rodape, nome, null, null, null);
    }
}
