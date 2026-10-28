package org.cecairbar.keycloak.provisionamento;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.keycloak.models.UserModel;

class ProvisionamentoPessoaTest {

    private final AtomicLong sequencia = new AtomicLong(0);

    private ProvisionamentoPessoa provisionamento(Set<String> emUso) {
        return new ProvisionamentoPessoa(sequencia::incrementAndGet, emUso::contains);
    }

    private static UserModel usuario(String personId, String firstName, String lastName) {
        UserModel usuario = mock(UserModel.class);
        when(usuario.getFirstAttribute(ProvisionamentoPessoa.PERSON_ID)).thenReturn(personId);
        when(usuario.getFirstName()).thenReturn(firstName);
        when(usuario.getLastName()).thenReturn(lastName);
        when(usuario.getAttributeStream(ProvisionamentoPessoa.RELATIONSHIPS)).thenReturn(Stream.empty());
        return usuario;
    }

    @Test
    void formataNoPadraoDaEspecificacao() {
        assertEquals("PER-00000001", ProvisionamentoPessoa.formatar(1));
        assertEquals("PER-99999999", ProvisionamentoPessoa.formatar(99_999_999));
        assertTrue(ProvisionamentoPessoa.PERSON_ID_PATTERN.matcher(ProvisionamentoPessoa.formatar(42)).matches());
    }

    @Test
    void recusaValoresForaDoIntervalo() {
        assertThrows(IllegalStateException.class, () -> ProvisionamentoPessoa.formatar(0));
        assertThrows(IllegalStateException.class, () -> ProvisionamentoPessoa.formatar(100_000_000));
    }

    @Test
    void pulaPersonIdJaAtribuido() {
        assertEquals("PER-00000003", provisionamento(Set.of("PER-00000001", "PER-00000002")).proximoPersonId());
    }

    @Test
    void desisteQuandoNaoHaPersonIdLivre() {
        ProvisionamentoPessoa todosEmUso = new ProvisionamentoPessoa(sequencia::incrementAndGet, id -> true);
        assertThrows(IllegalStateException.class, todosEmUso::proximoPersonId);
    }

    @Test
    void autocadastroRecebeIdentidadeCompletaEParticipante() {
        UserModel usuario = usuario(null, "Maria", "Exemplo");

        provisionamento(Set.of()).provisionar(usuario, true);

        verify(usuario).setSingleAttribute(ProvisionamentoPessoa.PERSON_ID, "PER-00000001");
        verify(usuario).setSingleAttribute(ProvisionamentoPessoa.IDENTITY_STATUS, "ACTIVE");
        verify(usuario).setSingleAttribute(ProvisionamentoPessoa.CARD_STATUS, "NOT_ISSUED");
        verify(usuario).setSingleAttribute(ProvisionamentoPessoa.FULL_NAME, "Maria Exemplo");
        verify(usuario).setAttribute(ProvisionamentoPessoa.RELATIONSHIPS, List.of(ProvisionamentoPessoa.PARTICIPANT));
    }

    // Seção 20: o personId existente nunca é alterado.
    @Test
    void naoAlteraPersonIdExistente() {
        UserModel usuario = usuario("PER-00000007", "Maria", "Exemplo");

        provisionamento(Set.of()).provisionar(usuario, true);

        verify(usuario, never()).setSingleAttribute(eq(ProvisionamentoPessoa.PERSON_ID), org.mockito.ArgumentMatchers.anyString());
        assertEquals(0, sequencia.get());
    }

    @Test
    void criacaoPeloAdministradorNaoDefineRelacionamentos() {
        UserModel usuario = usuario(null, "Maria", "Exemplo");

        provisionamento(Set.of()).provisionar(usuario, false);

        verify(usuario).setSingleAttribute(ProvisionamentoPessoa.PERSON_ID, "PER-00000001");
        verify(usuario, never()).setAttribute(eq(ProvisionamentoPessoa.RELATIONSHIPS), anyList());
    }

    @Test
    void semNomeNaoPreencheFullName() {
        UserModel usuario = usuario(null, null, " ");

        provisionamento(Set.of()).provisionar(usuario, true);

        verify(usuario, never()).setSingleAttribute(eq(ProvisionamentoPessoa.FULL_NAME), org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void extraiUserIdSoDoRecursoDoUsuario() {
        assertEquals("abc", ProvisionamentoEventListenerProvider.userIdDoRecurso("users/abc"));
        assertEquals(null, ProvisionamentoEventListenerProvider.userIdDoRecurso("users/abc/groups/def"));
        assertEquals(null, ProvisionamentoEventListenerProvider.userIdDoRecurso("groups/abc"));
        assertEquals(null, ProvisionamentoEventListenerProvider.userIdDoRecurso(null));
    }
}
