package com.durvalcrm.doador.adapter.out.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class EnderecoEmbeddable {

    @Column(name = "endereco_cep")
    private String cep;
    @Column(name = "endereco_logradouro")
    private String logradouro;
    @Column(name = "endereco_numero")
    private String numero;
    @Column(name = "endereco_complemento")
    private String complemento;
    @Column(name = "endereco_bairro")
    private String bairro;
    @Column(name = "endereco_cidade")
    private String cidade;
    @Column(name = "endereco_uf")
    private String uf;

    protected EnderecoEmbeddable() {
    }

    EnderecoEmbeddable(String cep, String logradouro, String numero, String complemento, String bairro, String cidade,
            String uf) {
        this.cep = cep;
        this.logradouro = logradouro;
        this.numero = numero;
        this.complemento = complemento;
        this.bairro = bairro;
        this.cidade = cidade;
        this.uf = uf;
    }

    String getCep() { return cep; }
    String getLogradouro() { return logradouro; }
    String getNumero() { return numero; }
    String getComplemento() { return complemento; }
    String getBairro() { return bairro; }
    String getCidade() { return cidade; }
    String getUf() { return uf; }
}
