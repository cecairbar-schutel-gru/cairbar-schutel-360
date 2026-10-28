package com.durvalcrm.editora.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.editora.application.ConsultaEditorasPort.ResumoEditora;
import com.durvalcrm.editora.application.ConsultaEditorasPort.ResumoRemessa;
import com.durvalcrm.editora.application.ConsultaEditorasPort.UltimoPagamento;
import com.durvalcrm.editora.domain.Editora;
import com.durvalcrm.editora.domain.EditoraRepository;
import com.durvalcrm.editora.domain.TituloConsignado;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cadastro de editoras (US-PUBLISHER-001): CNPJ validado e único, inativação (sem novas remessas,
 * mas com o saldo ainda pagável) e exclusão só sem remessas. A página da editora mostra as remessas
 * abertas, o saldo devido e o último pagamento.
 */
public class CadastroEditorasUseCase {

    static final String ENTIDADE = "Editora";

    private final EditoraRepository editoras;
    private final ConsultaEditorasPort consulta;
    private final EstoqueConsignadoPort estoque;
    private final RegistrarAuditoriaUseCase auditoria;
    private final Clock relogio;

    public CadastroEditorasUseCase(EditoraRepository editoras, ConsultaEditorasPort consulta,
            EstoqueConsignadoPort estoque, RegistrarAuditoriaUseCase auditoria, Clock relogio) {
        this.editoras = editoras;
        this.consulta = consulta;
        this.estoque = estoque;
        this.auditoria = auditoria;
        this.relogio = relogio;
    }

    public record DetalheEditora(Editora editora, boolean possuiRemessas, BigDecimal saldoDevido,
            UltimoPagamento ultimoPagamento, List<ResumoRemessa> remessasAbertas) {
    }

    static RecursoNaoEncontradoException naoEncontrada() {
        return new RecursoNaoEncontradoException("EDITORA_NAO_ENCONTRADA", "Editora não encontrada.");
    }

    /** {@code situacao}: ATIVAS (padrão), INATIVAS ou TODAS. */
    @Transactional(readOnly = true)
    public List<ResumoEditora> listar(String situacao) {
        Boolean ativas = switch (situacao == null ? "ATIVAS" : situacao) {
            case "ATIVAS" -> true;
            case "INATIVAS" -> false;
            case "TODAS" -> null;
            default -> throw ValidacaoException.doCampo("situacao", "Situação desconhecida.");
        };
        return consulta.listar(ativas);
    }

    @Transactional(readOnly = true)
    public DetalheEditora detalhe(long id) {
        Editora e = editoras.obter(id).orElseThrow(CadastroEditorasUseCase::naoEncontrada);
        return new DetalheEditora(e, editoras.possuiRemessas(id), consulta.saldoEm(id, LocalDate.now(relogio)),
                consulta.ultimoPagamento(id).orElse(null), consulta.remessas(id, "ABERTA"));
    }

    /** Títulos da editora para a nova remessa, com o percentual padrão (US-INVENTORY-001). */
    @Transactional(readOnly = true)
    public List<TituloConsignado> titulos(long editoraId) {
        editoras.obter(editoraId).orElseThrow(CadastroEditorasUseCase::naoEncontrada);
        return estoque.titulosDaEditora(editoraId).stream()
                .sorted(Comparator.comparing(TituloConsignado::nome, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Transactional
    public Editora cadastrar(Editora.Dados dados) {
        Editora nova = Editora.nova(dados);
        exigirCnpjLivre(nova);
        Editora salva = editoras.salvar(nova);
        auditoria.registrar("EDITORA_CADASTRADA", ENTIDADE, salva.id(), instantaneo(salva));
        return salva;
    }

    @Transactional
    public Editora alterar(long id, Editora.Dados dados) {
        Editora atual = editoras.obter(id).orElseThrow(CadastroEditorasUseCase::naoEncontrada);
        Editora alterada = atual.alterada(dados);
        exigirCnpjLivre(alterada);
        Editora salva = editoras.salvar(alterada);
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("antes", instantaneo(atual));
        detalhes.put("depois", instantaneo(salva));
        auditoria.registrar("EDITORA_ALTERADA", ENTIDADE, id, detalhes);
        return salva;
    }

    @Transactional
    public Editora inativar(long id) {
        Editora salva = editoras.salvar(editoras.obter(id).orElseThrow(CadastroEditorasUseCase::naoEncontrada)
                .inativada());
        auditoria.registrar("EDITORA_INATIVADA", ENTIDADE, id, Map.of());
        return salva;
    }

    @Transactional
    public Editora reativar(long id) {
        Editora salva = editoras.salvar(editoras.obter(id).orElseThrow(CadastroEditorasUseCase::naoEncontrada)
                .reativada());
        auditoria.registrar("EDITORA_REATIVADA", ENTIDADE, id, Map.of());
        return salva;
    }

    @Transactional
    public void excluir(long id) {
        Editora e = editoras.obter(id).orElseThrow(CadastroEditorasUseCase::naoEncontrada);
        if (editoras.possuiRemessas(id)) {
            throw new RegraDeNegocioException("EDITORA_COM_REMESSAS",
                    "A editora já tem remessas e não pode ser excluída. Inative-a.");
        }
        if (!estoque.titulosDaEditora(id).isEmpty()) {
            throw new RegraDeNegocioException("EDITORA_COM_TITULOS",
                    "Há títulos do catálogo ligados a esta editora. Inative-a ou mude a editora dos títulos.");
        }
        editoras.excluir(id);
        auditoria.registrar("EDITORA_EXCLUIDA", ENTIDADE, id, instantaneo(e));
    }

    private void exigirCnpjLivre(Editora e) {
        if (editoras.cnpjEmUso(e.cnpj(), e.id())) {
            throw ValidacaoException.doCampo("cnpj", "Já existe uma editora com este CNPJ.");
        }
    }

    private static Map<String, Object> instantaneo(Editora e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("nome", e.nome());
        m.put("cnpj", e.cnpj());
        m.put("contatoNome", e.contatoNome());
        m.put("telefone", e.telefone());
        m.put("email", e.email());
        m.put("banco", e.pagamento().banco());
        m.put("agencia", e.pagamento().agencia());
        m.put("conta", e.pagamento().conta());
        m.put("chavePix", e.pagamento().chavePix());
        m.put("observacoes", e.observacoes());
        return m;
    }
}
