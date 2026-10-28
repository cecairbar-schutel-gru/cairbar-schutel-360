package com.durvalcrm.intencaogasto.application;

import com.durvalcrm.financeiro.application.ConsultarLancamentosUseCase;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.intencaogasto.application.DetalheIntencao.Acoes;
import com.durvalcrm.intencaogasto.domain.AnexoIntencao;
import com.durvalcrm.intencaogasto.domain.IntencaoGasto;
import com.durvalcrm.intencaogasto.domain.IntencaoGastoRepository;
import com.durvalcrm.intencaogasto.domain.StatusIntencao;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.YearMonth;
import java.util.Set;
import org.springframework.transaction.annotation.Transactional;

/**
 * Detalhe e anexos de uma intenção. Tesoureiro e Administrador veem todas; o Vendedor, as próprias e
 * as compras da cantina a partir da aprovação. Para os demais a intenção "não existe".
 */
public class ConsultarIntencaoUseCase {

    private static final Set<StatusIntencao> DO_RECEBIMENTO = Set.of(StatusIntencao.AGUARDANDO_RECEBIMENTO,
            StatusIntencao.DIVERGENTE, StatusIntencao.RECEBIDA);

    private final ConsultaIntencoesPort consulta;
    private final Intencoes intencoes;
    private final ConsultarLancamentosUseCase financeiro;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public ConsultarIntencaoUseCase(IntencaoGastoRepository repositorio, ConsultaIntencoesPort consulta,
            ConsultarLancamentosUseCase financeiro, MovimentoFinanceiroUseCase movimento, CurrentUserPort usuario,
            Clock relogio) {
        this.consulta = consulta;
        this.intencoes = new Intencoes(repositorio, financeiro, movimento, usuario, relogio);
        this.financeiro = financeiro;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public DetalheIntencao detalhe(long id) {
        IntencaoGasto i = visivel(id);
        boolean tesouraria = tesouraria();
        boolean propria = i.getSolicitante().equals(usuario.getSubject());
        StatusIntencao s = i.getStatus();
        Acoes acoes = new Acoes(tesouraria && s == StatusIntencao.PENDENTE,
                tesouraria && s == StatusIntencao.DIVERGENTE,
                propria && s == StatusIntencao.PENDENTE,
                usuario.hasRole("vendedor") && s == StatusIntencao.AGUARDANDO_RECEBIMENTO,
                propria && usuario.hasRole("vendedor") && s == StatusIntencao.REJEITADA);
        BigDecimal gastoNoMes = tesouraria ? financeiro.despesasNoMes(i.getCategoria(), YearMonth.now(relogio)) : null;
        return new DetalheIntencao(i, intencoes.nomeCategoria(i.getCategoria()), consulta.anexos(id),
                consulta.historico(id), gastoNoMes, acoes);
    }

    /** Aberto no navegador (US-EXPENSE-002), para quem pode ver a intenção. */
    @Transactional(readOnly = true)
    public AnexoIntencao anexo(long id, int ordem) {
        visivel(id);
        return consulta.anexo(id, ordem).orElseThrow(() -> new RecursoNaoEncontradoException("ANEXO_NAO_ENCONTRADO",
                "Anexo não encontrado."));
    }

    private IntencaoGasto visivel(long id) {
        IntencaoGasto i = intencoes.obter(id);
        boolean vendedor = usuario.hasRole("vendedor") && i.compraDaCantina() && DO_RECEBIMENTO.contains(i.getStatus());
        if (tesouraria() || i.getSolicitante().equals(usuario.getSubject()) || vendedor) {
            return i;
        }
        throw Intencoes.naoEncontrada();
    }

    private boolean tesouraria() {
        return usuario.hasRole("tesoureiro") || usuario.hasRole("administrador");
    }
}
