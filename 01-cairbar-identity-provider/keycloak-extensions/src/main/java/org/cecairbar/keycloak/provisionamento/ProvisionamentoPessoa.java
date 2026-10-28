package org.cecairbar.keycloak.provisionamento;

import java.util.List;
import java.util.function.LongSupplier;
import java.util.function.Predicate;
import java.util.regex.Pattern;
import org.keycloak.models.UserModel;

/**
 * Completa a identidade de uma pessoa recém-criada (seção 7.3): personId gerado pelo sistema,
 * situações iniciais e nome completo. Nunca sobrescreve um valor já preenchido e nunca deriva o
 * personId de PII (regra 2): ele vem de uma sequência do banco.
 */
final class ProvisionamentoPessoa {

    static final String PERSON_ID = "personId";
    static final String FULL_NAME = "fullName";
    static final String IDENTITY_STATUS = "identityStatus";
    static final String CARD_STATUS = "cardStatus";
    static final String RELATIONSHIPS = "relationships";
    static final String PARTICIPANT = "PARTICIPANT";

    static final Pattern PERSON_ID_PATTERN = Pattern.compile("^PER-[0-9]{8}$");
    static final long PERSON_ID_MAX = 99_999_999L;
    // Um personId atribuído à mão pode coincidir com o próximo da sequência: pula alguns.
    static final int TENTATIVAS = 100;

    private final LongSupplier sequencia;
    private final Predicate<String> emUso;

    /**
     * @param sequencia próximo valor da sequência cecairbar_person_id_seq
     * @param emUso     se o personId já pertence a outra pessoa do realm
     */
    ProvisionamentoPessoa(LongSupplier sequencia, Predicate<String> emUso) {
        this.sequencia = sequencia;
        this.emUso = emUso;
    }

    static String formatar(long numero) {
        if (numero < 1 || numero > PERSON_ID_MAX) {
            throw new IllegalStateException("Sequência de personId fora do intervalo: " + numero);
        }
        return String.format("PER-%08d", numero);
    }

    String proximoPersonId() {
        for (int i = 0; i < TENTATIVAS; i++) {
            String personId = formatar(sequencia.getAsLong());
            if (!emUso.test(personId)) {
                return personId;
            }
        }
        throw new IllegalStateException("Nenhum personId livre após " + TENTATIVAS + " tentativas");
    }

    /**
     * @param autocadastro a pessoa se cadastrou sozinha: entra como participante (relationships)
     */
    void provisionar(UserModel usuario, boolean autocadastro) {
        if (vazio(usuario.getFirstAttribute(PERSON_ID))) {
            usuario.setSingleAttribute(PERSON_ID, proximoPersonId());
        }
        preencherSeVazio(usuario, IDENTITY_STATUS, "ACTIVE");
        preencherSeVazio(usuario, CARD_STATUS, "NOT_ISSUED");

        String nome = String.join(" ", naoNulo(usuario.getFirstName()), naoNulo(usuario.getLastName())).trim();
        if (!nome.isEmpty()) {
            preencherSeVazio(usuario, FULL_NAME, nome);
        }

        if (autocadastro && usuario.getAttributeStream(RELATIONSHIPS).findAny().isEmpty()) {
            usuario.setAttribute(RELATIONSHIPS, List.of(PARTICIPANT));
        }
    }

    private static void preencherSeVazio(UserModel usuario, String atributo, String valor) {
        if (vazio(usuario.getFirstAttribute(atributo))) {
            usuario.setSingleAttribute(atributo, valor);
        }
    }

    private static boolean vazio(String valor) {
        return valor == null || valor.isBlank();
    }

    private static String naoNulo(String valor) {
        return valor == null ? "" : valor;
    }
}
