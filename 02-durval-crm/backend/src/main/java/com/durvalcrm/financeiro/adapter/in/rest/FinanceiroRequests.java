package com.durvalcrm.financeiro.adapter.in.rest;

import com.durvalcrm.financeiro.application.ComandosFinanceiros.Correcao;
import com.durvalcrm.financeiro.application.ComandosFinanceiros.EstornoCommand;
import com.durvalcrm.financeiro.application.ComandosFinanceiros.LancamentoManualCommand;
import com.durvalcrm.financeiro.application.ComandosFinanceiros.LiquidacaoCommand;
import com.durvalcrm.financeiro.application.ComandosFinanceiros.TransferenciaCommand;
import com.durvalcrm.financeiro.domain.AnexoLancamento;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.TipoCategoria;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.shared.domain.TipoCartao;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Base64;

/** DTOs HTTP de entrada do módulo Financeiro; as regras ficam no domínio. */
final class FinanceiroRequests {

    private FinanceiroRequests() {
    }

    record ContaRequest(TipoConta tipo, String nome, String localizacao, String banco, String agencia,
            String numeroConta, BigDecimal saldoInicial, LocalDate dataCorte) {

        ContaFinanceira.Dados paraDados() {
            return new ContaFinanceira.Dados(nome, localizacao, banco, agencia, numeroConta, saldoInicial, dataCorte);
        }
    }

    record TransferenciaRequest(Long contaOrigemId, Long contaDestinoId, BigDecimal valor, LocalDate data,
            String descricao, String chaveIdempotencia) {

        TransferenciaCommand paraComando() {
            return new TransferenciaCommand(contaOrigemId, contaDestinoId, valor, data, descricao, chaveIdempotencia);
        }
    }

    record LiquidacaoRequest(Long contaBancariaId, LocalDate data, BigDecimal bruto, BigDecimal taxa,
            TipoCartao tipoCartao, String referencia, String chaveIdempotencia) {

        LiquidacaoCommand paraComando() {
            return new LiquidacaoCommand(contaBancariaId, data, bruto, taxa, tipoCartao, referencia, chaveIdempotencia);
        }
    }

    /** Anexo em Base64 (PDF, JPG ou PNG de até 5 MB). */
    record AnexoRequest(String nome, String tipo, String conteudoBase64) {

        AnexoLancamento paraAnexo() {
            try {
                return new AnexoLancamento(nome, tipo,
                        Base64.getDecoder().decode(conteudoBase64 == null ? "" : conteudoBase64));
            } catch (IllegalArgumentException e) {
                throw ValidacaoException.doCampo("anexo", "Não foi possível ler o anexo.");
            }
        }
    }

    record LancamentoManualRequest(Long contaId, LocalDate data, TipoCategoria tipo, String categoria, BigDecimal valor,
            String descricao, AnexoRequest anexo, String chaveIdempotencia) {

        LancamentoManualCommand paraComando() {
            return new LancamentoManualCommand(contaId, data, tipo, categoria, valor, descricao,
                    anexo == null ? null : anexo.paraAnexo(), chaveIdempotencia);
        }
    }

    record CorrecaoRequest(LocalDate data, Long contaId, Long contaDestinoId, TipoCategoria tipo, String categoria,
            BigDecimal valor, BigDecimal taxa, String descricao, String referencia) {

        Correcao paraCorrecao() {
            return new Correcao(data, contaId, contaDestinoId, tipo, categoria, valor, taxa, descricao, referencia);
        }
    }

    record EstornoRequest(String motivo, CorrecaoRequest correcao) {

        EstornoCommand paraComando() {
            return new EstornoCommand(motivo, correcao == null ? null : correcao.paraCorrecao());
        }
    }

    record ReclassificacaoRequest(Integer ordem, String categoria, String motivo) {
    }

    record ContasRecebimentoRequest(Long dinheiroContaId, Long pixContaId) {
    }
}
