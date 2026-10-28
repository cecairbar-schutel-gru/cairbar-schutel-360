package com.durvalcrm.financeiro.domain;

import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Caixa (dinheiro em espécie), conta bancária ou Cartão a receber (US-FINANCIAL-001). O saldo é o
 * saldo inicial mais os lançamentos; nenhum lançamento pode ser anterior à data de corte.
 */
public record ContaFinanceira(long id, String codigo, String nome, TipoConta tipo, boolean ativa,
        String localizacao, String banco, String agencia, String numeroConta, BigDecimal saldoInicial,
        LocalDate dataCorte) {

    private static final Pattern CODIGO = Pattern.compile("[a-z0-9][a-z0-9-]{1,59}");

    public ContaFinanceira {
        Objects.requireNonNull(codigo);
        Objects.requireNonNull(nome);
        Objects.requireNonNull(tipo);
        Objects.requireNonNull(saldoInicial);
        Objects.requireNonNull(dataCorte);
    }

    /**
     * Cadastro de caixa ou conta bancária; Cartão a receber é único e criado pelo sistema. O código é
     * gerado do nome.
     */
    public static ContaFinanceira nova(TipoConta tipo, String codigo, Dados dados) {
        List<ErroCampo> erros = new ArrayList<>();
        if (tipo == null) {
            erros.add(new ErroCampo("tipo", "Escolha o tipo da conta."));
        } else if (tipo == TipoConta.CARTAO_A_RECEBER) {
            throw new RegraDeNegocioException("CARTAO_A_RECEBER_UNICO",
                    "Cartão a receber é uma conta única, criada pelo sistema.");
        }
        String cod = Textos.compactar(codigo).toLowerCase(Locale.ROOT);
        if (!CODIGO.matcher(cod).matches()) {
            erros.add(new ErroCampo("codigo", "Use de 2 a 60 letras minúsculas, números ou hífens."));
        }
        validar(tipo, dados, erros);
        ValidacaoException.lancarSeHouver(erros);
        return new ContaFinanceira(0, cod, Textos.compactar(dados.nome()), tipo, true,
                opcional(dados.localizacao()), opcional(dados.banco()), opcional(dados.agencia()),
                opcional(dados.numeroConta()), dados.saldoInicial(), dados.dataCorte());
    }

    /** Saldo inicial e data de corte não mudam depois do primeiro lançamento. */
    public ContaFinanceira alterada(Dados dados, boolean temLancamentos) {
        List<ErroCampo> erros = new ArrayList<>();
        validar(tipo, dados, erros);
        ValidacaoException.lancarSeHouver(erros);
        if (temLancamentos && (dados.saldoInicial().compareTo(saldoInicial) != 0
                || !dados.dataCorte().equals(dataCorte))) {
            throw new RegraDeNegocioException("CONTA_COM_LANCAMENTOS",
                    "O saldo inicial e a data de corte não podem mudar depois do primeiro lançamento.");
        }
        return new ContaFinanceira(id, codigo, Textos.compactar(dados.nome()), tipo, ativa,
                opcional(dados.localizacao()), opcional(dados.banco()), opcional(dados.agencia()),
                opcional(dados.numeroConta()), dados.saldoInicial(), dados.dataCorte());
    }

    /** Só com saldo zero; contas inativas somem dos formulários de pagamento. */
    public ContaFinanceira inativada(BigDecimal saldoAtual) {
        if (tipo == TipoConta.CARTAO_A_RECEBER) {
            throw new RegraDeNegocioException("CARTAO_A_RECEBER_UNICO", "Cartão a receber não pode ser inativada.");
        }
        if (!ativa) {
            throw new RegraDeNegocioException("CONTA_JA_INATIVA", "A conta já está inativa.");
        }
        if (saldoAtual.signum() != 0) {
            throw new RegraDeNegocioException("CONTA_COM_SALDO", "Só é possível inativar a conta com saldo zero. Saldo atual: "
                    + Dinheiro.brl(saldoAtual) + ".");
        }
        return comAtiva(false);
    }

    public ContaFinanceira reativada() {
        if (ativa) {
            throw new RegraDeNegocioException("CONTA_JA_ATIVA", "A conta já está ativa.");
        }
        return comAtiva(true);
    }

    /** Lançamentos com data anterior à data de corte não são aceitos. */
    public void exigirDataAPartirDoCorte(LocalDate data) {
        if (data.isBefore(dataCorte)) {
            throw new RegraDeNegocioException("ANTES_DA_DATA_DE_CORTE", "A data " + Dinheiro.data(data)
                    + " é anterior à data de corte de " + nome + " (" + Dinheiro.data(dataCorte) + ").");
        }
    }

    /** Caixa e Cartão a receber nunca ficam negativos; conta bancária pode, com aviso. */
    public boolean podeFicarNegativa() {
        return tipo == TipoConta.BANCO;
    }

    private ContaFinanceira comAtiva(boolean valor) {
        return new ContaFinanceira(id, codigo, nome, tipo, valor, localizacao, banco, agencia, numeroConta,
                saldoInicial, dataCorte);
    }

    private static void validar(TipoConta tipo, Dados d, List<ErroCampo> erros) {
        String nome = Textos.compactar(d.nome());
        if (nome.isEmpty() || nome.length() > 100) {
            erros.add(new ErroCampo("nome", "Informe o nome da conta (até 100 caracteres)."));
        }
        if (tipo == TipoConta.BANCO) {
            exigir(d.banco(), "banco", "Informe o banco.", 100, erros);
            exigir(d.agencia(), "agencia", "Informe a agência.", 20, erros);
            exigir(d.numeroConta(), "numeroConta", "Informe o número da conta.", 30, erros);
        }
        if (Textos.compactar(d.localizacao()).length() > 100) {
            erros.add(new ErroCampo("localizacao", "Use até 100 caracteres."));
        }
        if (d.saldoInicial() == null) {
            erros.add(new ErroCampo("saldoInicial", "Informe o saldo inicial (pode ser zero)."));
        } else if (d.saldoInicial().scale() > 2) {
            erros.add(new ErroCampo("saldoInicial", "Use no máximo duas casas decimais."));
        } else if (tipo != TipoConta.BANCO && d.saldoInicial().signum() < 0) {
            erros.add(new ErroCampo("saldoInicial", "O saldo inicial do caixa não pode ser negativo."));
        }
        if (d.dataCorte() == null) {
            erros.add(new ErroCampo("dataCorte", "Informe a data de corte."));
        }
    }

    private static void exigir(String valor, String campo, String mensagem, int maximo, List<ErroCampo> erros) {
        String v = Textos.compactar(valor);
        if (v.isEmpty() || v.length() > maximo) {
            erros.add(new ErroCampo(campo, mensagem));
        }
    }

    private static String opcional(String valor) {
        String v = Textos.compactar(valor);
        return v.isEmpty() ? null : v;
    }

    /** Campos editáveis do cadastro. */
    public record Dados(String nome, String localizacao, String banco, String agencia, String numeroConta,
            BigDecimal saldoInicial, LocalDate dataCorte) {
    }
}
