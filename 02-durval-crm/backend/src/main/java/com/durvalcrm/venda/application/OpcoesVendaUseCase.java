package com.durvalcrm.venda.application;

import com.durvalcrm.financeiro.application.ContasRecebimentoUseCase;
import com.durvalcrm.financeiro.application.ContasRecebimentoUseCase.Destinos;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.venda.domain.MeioPagamento;
import com.durvalcrm.venda.domain.Venda;
import org.springframework.transaction.annotation.Transactional;

/**
 * Contas de recebimento das vendas e quem vê cada venda: Tesoureiro e Administrador veem todas; o
 * Vendedor, as que ele fez.
 */
public class OpcoesVendaUseCase {

    private final ContasRecebimentoUseCase recebimento;
    private final CurrentUserPort usuario;

    public OpcoesVendaUseCase(ContasRecebimentoUseCase recebimento, CurrentUserPort usuario) {
        this.recebimento = recebimento;
        this.usuario = usuario;
    }

    @Transactional(readOnly = true)
    public OpcoesVenda opcoes() {
        Destinos d = recebimento.destinos();
        return new OpcoesVenda(d.dinheiro(), d.pix(), d.cartao());
    }

    /** Dinheiro no caixa, PIX na conta bancária e cartão em Cartão a receber, como definiu o Administrador. */
    ContaFinanceira contaDe(MeioPagamento meio) {
        return switch (meio) {
            case DINHEIRO -> recebimento.contaDoDinheiro();
            case PIX -> recebimento.contaDoPix();
            case CARTAO -> recebimento.contaDoCartao();
        };
    }

    boolean veTodasAsVendas() {
        return usuario.hasRole("tesoureiro") || usuario.hasRole("administrador");
    }

    String vendedorAtual() {
        return usuario.getSubject();
    }

    /** {@code null} quando o usuário vê as vendas de todos. */
    String vendedorVisivel() {
        return veTodasAsVendas() ? null : usuario.getSubject();
    }

    void exigirAcesso(Venda venda) {
        String vendedor = vendedorVisivel();
        if (vendedor != null && !vendedor.equals(venda.getVendedorSubject())) {
            throw new RegraDeNegocioException("VENDA_DE_OUTRO_VENDEDOR", "Esta venda foi feita por outro vendedor.");
        }
    }
}
