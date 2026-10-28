package com.durvalcrm.intencaogasto.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.estoque.application.EntradaEstoqueUseCase;
import com.durvalcrm.estoque.domain.ItemEntrada;
import com.durvalcrm.financeiro.application.ConsultarLancamentosUseCase;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.intencaogasto.application.Comandos.RecebimentoCommand;
import com.durvalcrm.intencaogasto.application.ConsultaIntencoesPort.ResumoIntencao;
import com.durvalcrm.intencaogasto.domain.IntencaoGasto;
import com.durvalcrm.intencaogasto.domain.IntencaoGastoRepository;
import com.durvalcrm.intencaogasto.domain.StatusIntencao;
import com.durvalcrm.shared.application.CurrentUserPort;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lado do Vendedor (US-EXPENSE-006): compras da cantina aprovadas à espera da conferência e o
 * recebimento. Tudo confere: estoque próprio com o movimento "Recebimento de compra" ligado à
 * intenção. Diferença: divergente, sem nenhum movimento de estoque (Spec §3).
 */
public class ReceberCompraUseCase {

    private final IntencaoGastoRepository repositorio;
    private final ConsultaIntencoesPort consulta;
    private final Intencoes intencoes;
    private final EntradaEstoqueUseCase entradas;
    private final RegistrarAuditoriaUseCase auditoria;

    public ReceberCompraUseCase(IntencaoGastoRepository repositorio, ConsultaIntencoesPort consulta,
            ConsultarLancamentosUseCase financeiro, MovimentoFinanceiroUseCase movimento,
            EntradaEstoqueUseCase entradas, RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario,
            Clock relogio) {
        this.repositorio = repositorio;
        this.consulta = consulta;
        this.intencoes = new Intencoes(repositorio, financeiro, movimento, usuario, relogio);
        this.entradas = entradas;
        this.auditoria = auditoria;
    }

    /** Das aprovadas há mais tempo para as mais recentes. */
    @Transactional(readOnly = true)
    public List<ResumoIntencao> aguardando() {
        return consulta.listar(List.of(StatusIntencao.AGUARDANDO_RECEBIMENTO), null, true);
    }

    /** Recebida uma única vez: depois de recebida (ou divergente) a situação já não permite. */
    @Transactional
    public IntencaoGasto receber(long id, RecebimentoCommand cmd) {
        IntencaoGasto i = intencoes.travar(id);
        boolean confere = i.receber(cmd.quantidades(), cmd.divergencia(), intencoes.autor());
        if (confere) {
            entradas.registrarCompra(id, i.getItens().stream()
                    .map(it -> new ItemEntrada(it.produtoId(), it.quantidade())).toList());
        }
        repositorio.salvar(i);
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("itens", i.getItens().stream().map(it -> Map.of("produtoId", it.produtoId(), "pedida",
                it.quantidade(), "recebida", it.quantidadeRecebida())).toList());
        detalhes.put("divergencia", i.getDivergencia());
        auditoria.registrar(confere ? "COMPRA_RECEBIDA" : "COMPRA_DIVERGENTE", Intencoes.ENTIDADE, id, detalhes);
        return i;
    }
}
