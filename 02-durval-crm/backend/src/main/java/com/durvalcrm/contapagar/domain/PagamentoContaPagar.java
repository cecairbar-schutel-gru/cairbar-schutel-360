package com.durvalcrm.contapagar.domain;

import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.Dinheiro;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Pagamento de um vencimento da conta a pagar. Gera a despesa no Financeiro; se ela for estornada
 * lá (US-FINANCIAL-010), o pagamento fica estornado e o vencimento volta a ficar em aberto.
 */
public record PagamentoContaPagar(Long id, long contaPagarId, LocalDate vencimento, LocalDate pagoEm,
        BigDecimal valor, long contaId, String contaNome, String observacao, Long lancamentoId,
        String chaveIdempotencia, Instant registradoEm, String registradoPorSubject, String registradoPor,
        Instant estornadoEm) {

    public static final int MAXIMO_OBSERVACAO = 500;

    /** {@code origem}: caixa ou conta bancária de onde sai o dinheiro (nula se não encontrada). */
    public static PagamentoContaPagar novo(ContaPagar conta, LocalDate vencimento, LocalDate pagoEm, LocalDate hoje,
            BigDecimal valor, ContaFinanceira origem, String observacao, String chave, String subject, String nome,
            Instant agora) {
        conta.exigirAtiva();
        List<ErroCampo> erros = new ArrayList<>();
        if (vencimento == null) {
            erros.add(new ErroCampo("vencimento", "Escolha o vencimento."));
        } else if (!conta.venceEm(vencimento)) {
            erros.add(new ErroCampo("vencimento", "Esta conta não vence em " + Dinheiro.data(vencimento) + "."));
        }
        if (pagoEm == null) {
            erros.add(new ErroCampo("pagoEm", "Informe a data do pagamento."));
        } else if (pagoEm.isAfter(hoje)) {
            erros.add(new ErroCampo("pagoEm", "A data do pagamento não pode ser futura."));
        }
        if (valor == null || valor.signum() <= 0) {
            erros.add(new ErroCampo("valor", "Informe um valor maior que zero."));
        } else if (valor.scale() > 2) {
            erros.add(new ErroCampo("valor", "Use no máximo duas casas decimais."));
        }
        if (origem == null) {
            erros.add(new ErroCampo("contaId", "Escolha a conta de onde sai o pagamento."));
        } else if (origem.tipo() == TipoConta.CARTAO_A_RECEBER) {
            erros.add(new ErroCampo("contaId", "Escolha um caixa ou uma conta bancária."));
        }
        String texto = Textos.compactar(observacao);
        if (texto.length() > MAXIMO_OBSERVACAO) {
            erros.add(new ErroCampo("observacao", "Use até 500 caracteres."));
        }
        ValidacaoException.lancarSeHouver(erros);
        String chaveFinal = Textos.vazio(chave) ? UUID.randomUUID().toString() : chave.trim();
        return new PagamentoContaPagar(null, conta.id(), vencimento, pagoEm, valor, origem.id(), origem.nome(),
                texto.isEmpty() ? null : texto, null, chaveFinal, agora, subject, nome, null);
    }

    public boolean estornado() {
        return estornadoEm != null;
    }

    public PagamentoContaPagar comId(long novoId) {
        return new PagamentoContaPagar(novoId, contaPagarId, vencimento, pagoEm, valor, contaId, contaNome, observacao,
                lancamentoId, chaveIdempotencia, registradoEm, registradoPorSubject, registradoPor, estornadoEm);
    }

    public PagamentoContaPagar comLancamento(long lancamento) {
        return new PagamentoContaPagar(id, contaPagarId, vencimento, pagoEm, valor, contaId, contaNome, observacao,
                lancamento, chaveIdempotencia, registradoEm, registradoPorSubject, registradoPor, estornadoEm);
    }

    public PagamentoContaPagar estornadoEm(Instant quando) {
        return new PagamentoContaPagar(id, contaPagarId, vencimento, pagoEm, valor, contaId, contaNome, observacao,
                lancamentoId, chaveIdempotencia, registradoEm, registradoPorSubject, registradoPor, quando);
    }
}
