package com.durvalcrm.financeiro.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.ContaFinanceiraRepository;
import com.durvalcrm.financeiro.domain.ContasRecebimento;
import com.durvalcrm.financeiro.domain.ContasRecebimentoRepository;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/**
 * Contas de recebimento: para onde vai cada forma de pagamento das vendas e contribuições. O
 * Administrador define a conta do dinheiro (um caixa) e a do PIX (uma conta bancária); o cartão vai
 * sempre para Cartão a receber. Quem vende ou recebe só informa a forma e o valor.
 */
public class ContasRecebimentoUseCase {

    static final String ENTIDADE = "ContasRecebimento";

    private final ContasRecebimentoRepository repositorio;
    private final ContaFinanceiraRepository contas;
    private final MovimentoFinanceiroUseCase movimento;
    private final RegistrarAuditoriaUseCase auditoria;

    public ContasRecebimentoUseCase(ContasRecebimentoRepository repositorio, ContaFinanceiraRepository contas,
            MovimentoFinanceiroUseCase movimento, RegistrarAuditoriaUseCase auditoria) {
        this.repositorio = repositorio;
        this.contas = contas;
        this.movimento = movimento;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public Destinos destinos() {
        ContasRecebimento atuais = repositorio.obter();
        return new Destinos(conta(atuais.dinheiroContaId()), conta(atuais.pixContaId()), contas.cartaoAReceber());
    }

    @Transactional
    public Destinos definir(Long dinheiroContaId, Long pixContaId) {
        List<ErroCampo> erros = new ArrayList<>();
        exigirAtiva(dinheiroContaId, TipoConta.CAIXA, "dinheiroContaId", "O dinheiro deve entrar num caixa ativo.", erros);
        exigirAtiva(pixContaId, TipoConta.BANCO, "pixContaId", "O PIX deve entrar numa conta bancária ativa.", erros);
        ValidacaoException.lancarSeHouver(erros);
        ContasRecebimento antes = repositorio.obter();
        ContasRecebimento depois = new ContasRecebimento(dinheiroContaId, pixContaId);
        repositorio.salvar(depois, movimento.autor());
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("antes", retrato(antes));
        detalhes.put("depois", retrato(depois));
        auditoria.registrar("CONTAS_RECEBIMENTO_ALTERADAS", ENTIDADE, 1, detalhes);
        return destinos();
    }

    /** Conta do dinheiro recebido; sem conta definida ou ativa, nada é registrado. */
    @Transactional(readOnly = true)
    public ContaFinanceira contaDoDinheiro() {
        return exigirDefinida(repositorio.obter().dinheiroContaId(), "dinheiro");
    }

    @Transactional(readOnly = true)
    public ContaFinanceira contaDoPix() {
        return exigirDefinida(repositorio.obter().pixContaId(), "PIX");
    }

    @Transactional(readOnly = true)
    public ContaFinanceira contaDoCartao() {
        return contas.cartaoAReceber();
    }

    /** A conta recebe dinheiro ou PIX: não pode ser inativada nem excluída antes de trocar o destino. */
    @Transactional(readOnly = true)
    public boolean recebe(long contaId) {
        return repositorio.obter().recebe(contaId);
    }

    private ContaFinanceira exigirDefinida(Long contaId, String forma) {
        ContaFinanceira conta = conta(contaId);
        if (conta == null || !conta.ativa()) {
            throw new RegraDeNegocioException("CONTA_RECEBIMENTO_NAO_DEFINIDA", "Nenhuma conta ativa recebe " + forma
                    + ". Peça ao Administrador para definir as contas de recebimento.");
        }
        return conta;
    }

    private void exigirAtiva(Long contaId, TipoConta tipo, String campo, String mensagem, List<ErroCampo> erros) {
        if (contaId == null) {
            return;
        }
        ContaFinanceira conta = conta(contaId);
        if (conta == null || conta.tipo() != tipo || !conta.ativa()) {
            erros.add(new ErroCampo(campo, mensagem));
        }
    }

    private ContaFinanceira conta(Long id) {
        return id == null ? null : contas.buscarPorId(id).orElse(null);
    }

    private static Map<String, Object> retrato(ContasRecebimento c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("dinheiroContaId", c.dinheiroContaId());
        m.put("pixContaId", c.pixContaId());
        return m;
    }

    /** {@code dinheiro} e {@code pix} nulos quando ainda não definidos. */
    public record Destinos(ContaFinanceira dinheiro, ContaFinanceira pix, ContaFinanceira cartao) {
    }
}
