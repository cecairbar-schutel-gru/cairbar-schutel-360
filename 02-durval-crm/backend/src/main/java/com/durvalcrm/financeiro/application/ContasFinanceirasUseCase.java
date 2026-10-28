package com.durvalcrm.financeiro.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.ContaFinanceiraRepository;
import com.durvalcrm.financeiro.domain.ContasRecebimentoRepository;
import com.durvalcrm.financeiro.domain.LancamentoRepository;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cadastro de caixas e contas bancárias (US-FINANCIAL-001), com auditoria. O Tesoureiro cadastra e altera só contas
 * bancárias; caixas, inativação e exclusão ficam com o Administrador. Uma conta de recebimento (dinheiro ou PIX) só
 * é inativada ou excluída depois de o Administrador definir outra.
 */
public class ContasFinanceirasUseCase {

    static final String ENTIDADE = "ContaFinanceira";

    private final ContaFinanceiraRepository contas;
    private final LancamentoRepository lancamentos;
    private final ContasRecebimentoRepository recebimento;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;

    public ContasFinanceirasUseCase(ContaFinanceiraRepository contas, LancamentoRepository lancamentos,
            ContasRecebimentoRepository recebimento, RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario) {
        this.contas = contas;
        this.lancamentos = lancamentos;
        this.recebimento = recebimento;
        this.auditoria = auditoria;
        this.usuario = usuario;
    }

    @Transactional(readOnly = true)
    public List<ContaComSaldo> listar() {
        return contas.listar().stream().map(this::comSaldo).toList();
    }

    @Transactional(readOnly = true)
    public ContaComSaldo obter(long id) {
        return comSaldo(carregar(id));
    }

    @Transactional
    public ContaComSaldo cadastrar(TipoConta tipo, ContaFinanceira.Dados dados) {
        exigirPermissao(tipo);
        ContaFinanceira nova = ContaFinanceira.nova(tipo, codigoDoNome(tipo, dados.nome()), dados);
        if (contas.codigoEmUso(nova.codigo())) {
            throw ValidacaoException.doCampo("codigo", "Já existe uma conta com o código " + nova.codigo() + ".");
        }
        ContaFinanceira salva = contas.salvar(nova);
        auditoria.registrar("CONTA_CADASTRADA", ENTIDADE, salva.id(), retrato(salva));
        return comSaldo(salva);
    }

    @Transactional
    public ContaComSaldo alterar(long id, ContaFinanceira.Dados dados) {
        ContaFinanceira atual = travar(id);
        exigirPermissao(atual.tipo());
        ContaFinanceira alterada = atual.alterada(dados, lancamentos.contaTemLancamentos(id));
        ContaFinanceira salva = contas.salvar(alterada);
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("antes", retrato(atual));
        detalhes.put("depois", retrato(salva));
        auditoria.registrar("CONTA_ALTERADA", ENTIDADE, id, detalhes);
        return comSaldo(salva);
    }

    @Transactional
    public ContaComSaldo inativar(long id) {
        ContaFinanceira conta = travar(id);
        exigirForaDoRecebimento(conta, "inativá-la");
        ContaFinanceira salva = contas.salvar(conta.inativada(lancamentos.saldo(id)));
        auditoria.registrar("CONTA_INATIVADA", ENTIDADE, id, Map.of("nome", salva.nome()));
        return comSaldo(salva);
    }

    @Transactional
    public ContaComSaldo reativar(long id) {
        ContaFinanceira salva = contas.salvar(travar(id).reativada());
        auditoria.registrar("CONTA_REATIVADA", ENTIDADE, id, Map.of("nome", salva.nome()));
        return comSaldo(salva);
    }

    /** Só contas sem lançamentos; as demais podem ser inativadas. */
    @Transactional
    public void excluir(long id) {
        ContaFinanceira conta = travar(id);
        if (conta.tipo() == TipoConta.CARTAO_A_RECEBER) {
            throw new RegraDeNegocioException("CARTAO_A_RECEBER_UNICO", "Cartão a receber não pode ser excluída.");
        }
        exigirForaDoRecebimento(conta, "excluí-la");
        if (lancamentos.contaTemLancamentos(id)) {
            throw new RegraDeNegocioException("CONTA_COM_LANCAMENTOS",
                    "Contas com lançamentos não podem ser excluídas. Inative a conta quando o saldo for zero.");
        }
        contas.excluir(id);
        auditoria.registrar("CONTA_EXCLUIDA", ENTIDADE, id, retrato(conta));
    }

    private void exigirForaDoRecebimento(ContaFinanceira conta, String acao) {
        if (recebimento.obter().recebe(conta.id())) {
            throw new RegraDeNegocioException("CONTA_DE_RECEBIMENTO", conta.nome() + " recebe os pagamentos das vendas"
                    + " e contribuições. Defina outra conta de recebimento antes de " + acao + ".");
        }
    }

    /** Fora do Administrador, só contas bancárias. */
    private void exigirPermissao(TipoConta tipo) {
        if (tipo != TipoConta.BANCO && !usuario.hasRole("administrador")) {
            throw new RegraDeNegocioException("SO_CONTA_BANCARIA",
                    "O Tesoureiro cadastra e altera só contas bancárias; caixas ficam com o Administrador.");
        }
    }

    private ContaFinanceira carregar(long id) {
        return contas.buscarPorId(id).orElseThrow(ContasFinanceirasUseCase::naoEncontrada);
    }

    private ContaFinanceira travar(long id) {
        return contas.travar(id).orElseThrow(ContasFinanceirasUseCase::naoEncontrada);
    }

    static RecursoNaoEncontradoException naoEncontrada() {
        return new RecursoNaoEncontradoException("CONTA_NAO_ENCONTRADA", "Conta não encontrada.");
    }

    private ContaComSaldo comSaldo(ContaFinanceira c) {
        return new ContaComSaldo(c, lancamentos.saldo(c.id()), lancamentos.contaTemLancamentos(c.id()));
    }

    /** "banco-a-cc-principal" ou "caixa-cantina": gerado do nome, com sufixo numérico se já existir. */
    private String codigoDoNome(TipoConta tipo, String nome) {
        String prefixo = tipo == TipoConta.BANCO ? "banco-" : "caixa-";
        String base = Textos.normalizar(nome).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        if (base.startsWith(prefixo)) {
            base = base.substring(prefixo.length());
        }
        base = prefixo + (base.isEmpty() ? "conta" : base.length() > 40 ? base.substring(0, 40) : base);
        base = base.replaceAll("-$", "");
        String codigo = base;
        for (int i = 2; contas.codigoEmUso(codigo); i++) {
            codigo = base + "-" + i;
        }
        return codigo;
    }

    private static Map<String, Object> retrato(ContaFinanceira c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("codigo", c.codigo());
        m.put("nome", c.nome());
        m.put("tipo", c.tipo().name());
        m.put("localizacao", c.localizacao());
        m.put("banco", c.banco());
        m.put("agencia", c.agencia());
        m.put("numeroConta", c.numeroConta());
        m.put("saldoInicial", c.saldoInicial());
        m.put("dataCorte", c.dataCorte().toString());
        m.put("ativa", c.ativa());
        return m;
    }

    /** Conta com o saldo atual; com lançamentos, saldo inicial e data de corte ficam travados. */
    public record ContaComSaldo(ContaFinanceira conta, BigDecimal saldo, boolean temLancamentos) {
    }
}
