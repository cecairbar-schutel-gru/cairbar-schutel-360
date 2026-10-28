package com.durvalcrm.administracao.application;

import com.durvalcrm.shared.domain.ErroCampo;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Collection;
import java.util.List;
import java.util.Set;

/**
 * O que a Administração precisa do módulo Doador, implementado por ele: anonimizados (para esconder
 * dados pessoais na auditoria), contagem para o painel e a importação de doadores (US-ADMIN-012).
 */
public interface DoadoresAdministracaoPort {

    Set<String> anonimizados(Collection<String> ids);

    long contarAtivos();

    /** Mesmo telefone, mesmo e-mail ou nome muito parecido (US-DONOR-002). */
    List<Duplicata> duplicatas(String nome, String telefone, String email);

    /** Erros do doador como ele seria cadastrado (nome, contatos, CPF e data de nascimento). */
    List<ErroCampo> validar(DoadorImportado doador);

    /** CPF já cadastrado em outro doador. */
    boolean cpfEmUso(String cpf);

    /** Cadastra Ativo com as competências pendentes informadas e a do mês atual; devolve o id. */
    long cadastrar(DoadorImportado doador);

    /** Sem contribuições, notas nem competência paga ou cancelada. */
    boolean intocado(long doadorId);

    void excluirImportado(long doadorId);

    /**
     * @param consentimentoWhatsapp SIM, NAO ou NAO_INFORMADO
     */
    record DoadorImportado(String nome, String telefone, String email, LocalDate dataNascimento, String cpf,
            String consentimentoWhatsapp, String consentimentoEmail, List<YearMonth> competenciasPendentes) {
    }

    record Duplicata(long id, String nome, List<String> motivos) {
    }
}
