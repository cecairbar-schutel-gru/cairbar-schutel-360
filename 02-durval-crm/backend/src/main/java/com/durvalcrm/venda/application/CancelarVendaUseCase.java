package com.durvalcrm.venda.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.editora.application.ObrigacoesEditoraUseCase;
import com.durvalcrm.estoque.application.EstoqueParaVendaUseCase;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.venda.domain.LoteVendido;
import com.durvalcrm.venda.domain.MeioPagamento;
import com.durvalcrm.venda.domain.QuemCancela;
import com.durvalcrm.venda.domain.Venda;
import com.durvalcrm.venda.domain.VendaRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cancelamento (US-SALES-009): a venda original é preservada; o estoque volta aos mesmos lotes, as
 * obrigações com editoras são estornadas e cada linha financeira recebe estorno (na data de hoje
 * se o mês da venda estiver fechado). Quem pode cancelar cada venda está em {@link QuemCancela}.
 */
public class CancelarVendaUseCase {

    private final VendaRepository vendas;
    private final EstoqueParaVendaUseCase estoque;
    private final ObrigacoesEditoraUseCase editoras;
    private final MovimentoFinanceiroUseCase financeiro;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public CancelarVendaUseCase(VendaRepository vendas, EstoqueParaVendaUseCase estoque,
            ObrigacoesEditoraUseCase editoras, MovimentoFinanceiroUseCase financeiro,
            RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario, Clock relogio) {
        this.vendas = vendas;
        this.estoque = estoque;
        this.editoras = editoras;
        this.financeiro = financeiro;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    @Transactional
    public Venda cancelar(long id, String motivo) {
        Venda v = CarregarVenda.ou404(vendas, id);
        quemCancela().exigirQuePodeCancelar(v);
        v.cancelar(motivo, usuario.getNome(), relogio.instant());
        exigirCartaoNaoLiquidado(v);

        for (LoteVendido lote : v.getLotes()) {
            estoque.devolverDeVenda(lote.produtoId(), lote.remessaId(), lote.quantidade(), id);
        }
        editoras.estornarDaVenda(id);
        financeiro.estornar(v.getLancamentoId(), "Estorno da venda nº " + v.getNumero());
        Venda salva = vendas.salvar(v);

        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("numero", salva.getNumero());
        detalhes.put("total", salva.total());
        detalhes.put("motivo", salva.getMotivoCancelamento());
        auditoria.registrar("VENDA_CANCELADA", CarregarVenda.ENTIDADE, id, detalhes);
        return salva;
    }

    private QuemCancela quemCancela() {
        boolean pdv = usuario.hasRole("pdv");
        Long ultima = pdv ? CarregarVenda.ultimaDe(vendas, usuario.getSubject()).map(Venda::getId).orElse(null) : null;
        return new QuemCancela(usuario.getSubject(), usuario.hasRole("administrador"), usuario.hasRole("tesoureiro"),
                usuario.hasRole("vendedor"), pdv, ultima);
    }

    /** Se o cartão já foi liquidado, estornar deixaria Cartão a receber negativo (US-FINANCIAL-004). */
    private void exigirCartaoNaoLiquidado(Venda v) {
        BigDecimal cartao = v.valorPorMeio(MeioPagamento.CARTAO);
        if (cartao.signum() == 0) {
            return;
        }
        BigDecimal saldo = financeiro.saldo(financeiro.cartaoAReceber().id());
        if (cartao.compareTo(saldo) > 0) {
            throw new RegraDeNegocioException("CARTAO_JA_LIQUIDADO", "A parte em cartão (" + Venda.brl(cartao)
                    + ") é maior que o saldo atual de Cartão a receber (" + Venda.brl(saldo)
                    + "), pois já foi liquidada. Procure o Tesoureiro para fazer a correção.");
        }
    }
}
