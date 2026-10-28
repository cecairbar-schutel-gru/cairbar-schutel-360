package com.durvalcrm.editora.domain;

import com.durvalcrm.shared.domain.Cnpj;
import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Editora de livros consignados (US-PUBLISHER-001). Inativa não recebe novas remessas, mas o saldo
 * em aberto continua podendo ser pago. O CNPJ pode faltar só nas editoras incluídas por SQL antes do
 * cadastro; toda alteração pelo cadastro o exige.
 */
public record Editora(Long id, String nome, String cnpj, String contatoNome, String telefone, String email,
        DadosPagamento pagamento, String observacoes, boolean ativa) {

    public static final int MAXIMO_NOME = 200;
    public static final int MAXIMO_OBSERVACOES = 1000;
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");

    public Editora {
        Objects.requireNonNull(nome);
        Objects.requireNonNull(pagamento);
    }

    /** Banco, agência e conta, ou chave PIX (US-PUBLISHER-001). */
    public record DadosPagamento(String banco, String agencia, String conta, String chavePix) {

        public static final DadosPagamento NENHUM = new DadosPagamento(null, null, null, null);
    }

    /** O que vem do formulário de cadastro. */
    public record Dados(String nome, String cnpj, String contatoNome, String telefone, String email,
            DadosPagamento pagamento, String observacoes) {
    }

    public static Editora nova(Dados dados) {
        return validar(null, dados, true);
    }

    public Editora alterada(Dados dados) {
        return validar(id, dados, ativa);
    }

    public Editora inativada() {
        if (!ativa) {
            throw new RegraDeNegocioException("EDITORA_JA_INATIVA", "Esta editora já está inativa.");
        }
        return new Editora(id, nome, cnpj, contatoNome, telefone, email, pagamento, observacoes, false);
    }

    public Editora reativada() {
        if (ativa) {
            throw new RegraDeNegocioException("EDITORA_JA_ATIVA", "Esta editora já está ativa.");
        }
        return new Editora(id, nome, cnpj, contatoNome, telefone, email, pagamento, observacoes, true);
    }

    /** US-PUBLISHER-003: só editora ativa recebe remessa. */
    public void exigirAtivaParaRemessa() {
        if (!ativa) {
            throw new RegraDeNegocioException("EDITORA_INATIVA",
                    "A editora " + nome + " está inativa e não pode receber novas remessas.");
        }
    }

    private static Editora validar(Long id, Dados dados, boolean ativa) {
        List<ErroCampo> erros = new ArrayList<>();
        String nome = Textos.compactar(dados.nome());
        if (nome.isEmpty()) {
            erros.add(new ErroCampo("nome", "Informe o nome da editora."));
        } else if (nome.length() > MAXIMO_NOME) {
            erros.add(new ErroCampo("nome", "Use até 200 caracteres."));
        }
        String cnpj = Cnpj.digitos(dados.cnpj());
        if (cnpj.isEmpty()) {
            erros.add(new ErroCampo("cnpj", "Informe o CNPJ."));
        } else if (!Cnpj.valido(cnpj)) {
            erros.add(new ErroCampo("cnpj", "CNPJ inválido."));
        }
        String telefone = Textos.apenasDigitos(dados.telefone());
        if (!telefone.isEmpty() && (telefone.length() < 10 || telefone.length() > 11)) {
            erros.add(new ErroCampo("telefone", "Informe o telefone com DDD."));
        }
        String email = Textos.compactar(dados.email()).toLowerCase(Locale.ROOT);
        if (!email.isEmpty() && !EMAIL.matcher(email).matches()) {
            erros.add(new ErroCampo("email", "E-mail inválido."));
        }
        String observacoes = Textos.compactar(dados.observacoes());
        if (observacoes.length() > MAXIMO_OBSERVACOES) {
            erros.add(new ErroCampo("observacoes", "Use até 1000 caracteres."));
        }
        DadosPagamento p = dados.pagamento() == null ? DadosPagamento.NENHUM : dados.pagamento();
        DadosPagamento pagamento = new DadosPagamento(opcional(p.banco(), 100, "pagamento.banco", erros),
                opcional(p.agencia(), 20, "pagamento.agencia", erros), opcional(p.conta(), 30, "pagamento.conta", erros),
                opcional(p.chavePix(), 100, "pagamento.chavePix", erros));
        String contato = opcional(dados.contatoNome(), MAXIMO_NOME, "contatoNome", erros);
        ValidacaoException.lancarSeHouver(erros);
        return new Editora(id, nome, cnpj, contato, telefone.isEmpty() ? null : telefone,
                email.isEmpty() ? null : email, pagamento,
                observacoes.isEmpty() ? null : observacoes, ativa);
    }

    private static String opcional(String valor, int maximo, String campo, List<ErroCampo> erros) {
        String texto = Textos.compactar(valor);
        if (texto.length() > maximo) {
            erros.add(new ErroCampo(campo, "Use até " + maximo + " caracteres."));
        }
        return texto.isEmpty() ? null : texto;
    }
}
