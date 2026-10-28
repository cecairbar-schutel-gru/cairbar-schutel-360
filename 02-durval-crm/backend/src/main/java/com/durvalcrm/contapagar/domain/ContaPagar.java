package com.durvalcrm.contapagar.domain;

import com.durvalcrm.financeiro.domain.Categoria;
import com.durvalcrm.financeiro.domain.CategoriaFinanceira;
import com.durvalcrm.financeiro.domain.Dinheiro;
import com.durvalcrm.financeiro.domain.TipoCategoria;
import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Conta a pagar: despesa única ou recorrente (mensal ou anual) com vencimento no dia do primeiro
 * vencimento. Os vencimentos são calculados, não gravados; cada um é pago uma vez, com o valor do
 * dia (o previsto é só a sugestão, ex.: conta de luz). Encerrada, deixa de ter vencimentos em aberto.
 * Recorrência e primeiro vencimento não mudam depois do primeiro pagamento.
 */
public record ContaPagar(Long id, String descricao, String favorecido, String categoria, BigDecimal valorPrevisto,
        Recorrencia recorrencia, LocalDate primeiroVencimento, LocalDate fimRecorrencia, Long contaFinanceiraId,
        String observacoes, boolean ativa) {

    public static final int MAXIMO_DESCRICAO = 200;
    public static final int MAXIMO_OBSERVACOES = 1000;
    /** Teto de vencimentos calculados de uma vez (100 anos de conta mensal). */
    private static final int MAXIMO_VENCIMENTOS = 1200;

    public ContaPagar {
        Objects.requireNonNull(descricao);
        Objects.requireNonNull(categoria);
        Objects.requireNonNull(valorPrevisto);
        Objects.requireNonNull(recorrencia);
        Objects.requireNonNull(primeiroVencimento);
    }

    /** O que vem do formulário de cadastro. */
    public record Dados(String descricao, String favorecido, String categoria, BigDecimal valorPrevisto,
            Recorrencia recorrencia, LocalDate primeiroVencimento, LocalDate fimRecorrencia, Long contaFinanceiraId,
            String observacoes) {
    }

    /** {@code categoria}: a subcategoria escolhida, buscada no plano de contas (nula se não existe). */
    public static ContaPagar nova(Dados dados, Categoria categoria) {
        return validar(null, dados, categoria, true);
    }

    /** {@code ultimoPago}: maior vencimento com pagamento válido (nulo se nenhum). */
    public ContaPagar alterada(Dados dados, Categoria categoria, LocalDate ultimoPago, boolean temPagamentos) {
        exigirAtiva();
        if (temPagamentos && (dados.recorrencia() != recorrencia
                || !primeiroVencimento.equals(dados.primeiroVencimento()))) {
            throw new RegraDeNegocioException("CONTA_PAGAR_COM_PAGAMENTOS",
                    "A recorrência e o primeiro vencimento não mudam depois do primeiro pagamento.");
        }
        ContaPagar alterada = validar(id, dados, categoria, ativa);
        if (ultimoPago != null && alterada.fimRecorrencia() != null && alterada.fimRecorrencia().isBefore(ultimoPago)) {
            throw ValidacaoException.doCampo("fimRecorrencia",
                    "O vencimento de " + Dinheiro.data(ultimoPago) + " já foi pago: o fim não pode ser anterior.");
        }
        return alterada;
    }

    /** Sem mais nada a pagar: os vencimentos em aberto deixam de existir; os pagos continuam no histórico. */
    public ContaPagar encerrada() {
        exigirAtiva();
        return new ContaPagar(id, descricao, favorecido, categoria, valorPrevisto, recorrencia, primeiroVencimento,
                fimRecorrencia, contaFinanceiraId, observacoes, false);
    }

    public ContaPagar reativada() {
        if (ativa) {
            throw new RegraDeNegocioException("CONTA_PAGAR_JA_ATIVA", "Esta conta a pagar já está ativa.");
        }
        return new ContaPagar(id, descricao, favorecido, categoria, valorPrevisto, recorrencia, primeiroVencimento,
                fimRecorrencia, contaFinanceiraId, observacoes, true);
    }

    /** Paga a única: sem mais nada a pagar, deixa de estar ativa (exibida como "Quitada"). */
    public ContaPagar aposPagamento() {
        return recorrencia == Recorrencia.UNICA ? encerrada() : this;
    }

    /** Estornado o pagamento da única quitada, o vencimento volta a ficar em aberto e ela é reativada. */
    public ContaPagar aposEstorno() {
        return recorrencia == Recorrencia.UNICA && !ativa ? reativada() : this;
    }

    /** {@code temPagamentoValido}: o vencimento tem pagamento não estornado. */
    public boolean quitada(boolean temPagamentoValido) {
        return recorrencia == Recorrencia.UNICA && !ativa && temPagamentoValido;
    }

    public void exigirAtiva() {
        if (!ativa) {
            throw new RegraDeNegocioException("CONTA_PAGAR_ENCERRADA",
                    "A conta a pagar \"" + descricao + "\" está encerrada. Reative-a para alterar ou pagar.");
        }
    }

    /** Vencimentos entre {@code de} e {@code ate} (inclusive); nenhum se a conta estiver encerrada. */
    public List<LocalDate> vencimentos(LocalDate de, LocalDate ate) {
        List<LocalDate> datas = new ArrayList<>();
        if (!ativa) {
            return datas;
        }
        for (int n = 0; n < MAXIMO_VENCIMENTOS; n++) {
            LocalDate d = vencimento(n);
            if (d.isAfter(ate) || (fimRecorrencia != null && d.isAfter(fimRecorrencia))) {
                break;
            }
            if (!d.isBefore(de)) {
                datas.add(d);
            }
            if (recorrencia == Recorrencia.UNICA) {
                break;
            }
        }
        return datas;
    }

    public boolean venceEm(LocalDate data) {
        return data != null && vencimentos(data, data).contains(data);
    }

    /** N-ésimo vencimento, sempre a partir do primeiro: dia 31 vira o último dia dos meses mais curtos. */
    private LocalDate vencimento(int n) {
        return switch (recorrencia) {
            case UNICA -> primeiroVencimento;
            case MENSAL -> primeiroVencimento.plusMonths(n);
            case ANUAL -> primeiroVencimento.plusYears(n);
        };
    }

    private static ContaPagar validar(Long id, Dados dados, Categoria categoria, boolean ativa) {
        List<ErroCampo> erros = new ArrayList<>();
        String descricao = Textos.compactar(dados.descricao());
        if (descricao.isEmpty() || descricao.length() > MAXIMO_DESCRICAO) {
            erros.add(new ErroCampo("descricao", "Descreva a conta (até 200 caracteres)."));
        }
        String favorecido = Textos.compactar(dados.favorecido());
        if (favorecido.length() > MAXIMO_DESCRICAO) {
            erros.add(new ErroCampo("favorecido", "Use até 200 caracteres."));
        }
        if (categoria == null || !categoria.subcategoria() || !categoria.ativa()
                || categoria.tipo() != TipoCategoria.DESPESA || CategoriaFinanceira.temFluxoProprio(categoria)) {
            erros.add(new ErroCampo("categoria", "Escolha uma subcategoria ativa de despesa."));
        }
        BigDecimal valor = dados.valorPrevisto();
        if (valor == null || valor.signum() <= 0) {
            erros.add(new ErroCampo("valorPrevisto", "Informe um valor maior que zero."));
        } else if (valor.scale() > 2) {
            erros.add(new ErroCampo("valorPrevisto", "Use no máximo duas casas decimais."));
        }
        if (dados.recorrencia() == null) {
            erros.add(new ErroCampo("recorrencia", "Escolha a recorrência."));
        }
        if (dados.primeiroVencimento() == null) {
            erros.add(new ErroCampo("primeiroVencimento", "Informe o vencimento."));
        }
        LocalDate fim = dados.recorrencia() == Recorrencia.UNICA ? null : dados.fimRecorrencia();
        if (fim != null && dados.primeiroVencimento() != null && fim.isBefore(dados.primeiroVencimento())) {
            erros.add(new ErroCampo("fimRecorrencia", "O fim deve ser igual ou posterior ao primeiro vencimento."));
        }
        String observacoes = Textos.compactar(dados.observacoes());
        if (observacoes.length() > MAXIMO_OBSERVACOES) {
            erros.add(new ErroCampo("observacoes", "Use até 1000 caracteres."));
        }
        ValidacaoException.lancarSeHouver(erros);
        return new ContaPagar(id, descricao, favorecido.isEmpty() ? null : favorecido, categoria.codigo(), valor,
                dados.recorrencia(), dados.primeiroVencimento(), fim, dados.contaFinanceiraId(),
                observacoes.isEmpty() ? null : observacoes, ativa);
    }
}
