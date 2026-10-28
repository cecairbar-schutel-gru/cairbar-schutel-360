package com.durvalcrm.doador.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class DoadorTest {

    private static final Instant AGORA = Instant.parse("2026-10-15T12:00:00Z");
    private static final LocalDate HOJE = LocalDate.of(2026, 10, 15);

    private static Doador maria() {
        return Doador.reconstituir(7L, "Maria Souza", null, null, StatusDoador.ATIVO,
                List.of(new Telefone(TipoTelefone.CELULAR, "11987654321", true)), List.of(), null,
                Consentimento.naoInformado(), Consentimento.naoInformado(), AGORA, null, null);
    }

    private static List<String> campos(ValidacaoException e) {
        return e.getErros().stream().map(ErroCampo::campo).toList();
    }

    @Test
    void cadastroRapidoExigeNomeCompletoEUmContato() {
        assertThatThrownBy(() -> Doador.cadastrarRapido("Maria", "", " ", ValorConsentimento.NAO_INFORMADO,
                ValorConsentimento.NAO_INFORMADO, "op", AGORA))
                .isInstanceOfSatisfying(ValidacaoException.class,
                        e -> assertThat(campos(e)).containsExactly("nome", "telefone"));
    }

    @Test
    void cadastroRapidoNasceAtivoComTelefoneNormalizadoEConsentimentoDatado() {
        Doador d = Doador.cadastrarRapido("  Maria   Souza ", "(11) 98765-4321", "", ValorConsentimento.SIM,
                ValorConsentimento.NAO_INFORMADO, "Ana", AGORA);

        assertThat(d.getStatus()).isEqualTo(StatusDoador.ATIVO);
        assertThat(d.getNome()).isEqualTo("Maria Souza");
        assertThat(d.telefonePrincipal()).map(Telefone::numero).contains("11987654321");
        assertThat(d.getConsentimentoWhatsapp()).isEqualTo(new Consentimento(ValorConsentimento.SIM, AGORA, "Ana"));
        assertThat(d.getConsentimentoEmail().registradoEm()).isNull();
    }

    @Test
    void atualizarValidaCpfNascimentoFuturoEGaranteUmPrincipal() {
        Doador d = maria();
        assertThatThrownBy(() -> d.atualizar(new DadosCadastrais("Maria Souza", "123", HOJE.plusDays(1), List.of(),
                List.of(), null, ValorConsentimento.NAO_INFORMADO, ValorConsentimento.NAO_INFORMADO), "adm", AGORA, HOJE))
                .isInstanceOfSatisfying(ValidacaoException.class,
                        e -> assertThat(campos(e)).containsExactly("cpf", "dataNascimento"));

        d.atualizar(new DadosCadastrais("Maria Souza", "529.982.247-25", null,
                List.of(new Telefone(TipoTelefone.CELULAR, "11987654321", false),
                        new Telefone(TipoTelefone.FIXO, "1132654321", true),
                        new Telefone(TipoTelefone.CELULAR, "11912345678", true)),
                List.of(), null, ValorConsentimento.NAO, ValorConsentimento.NAO_INFORMADO), "adm", AGORA, HOJE);

        assertThat(d.getTelefones()).extracting(Telefone::principal).containsExactly(false, true, false);
        assertThat(d.getCpf()).map(Cpf::digitos).contains("52998224725");
        assertThat(d.getConsentimentoWhatsapp().registradoPor()).isEqualTo("adm");
    }

    @Test
    void inativarExigeMotivoEDecisaoESoValeParaAtivos() {
        Doador d = maria();
        assertThatThrownBy(() -> d.inativar(" ", null, AGORA))
                .isInstanceOfSatisfying(ValidacaoException.class,
                        e -> assertThat(campos(e)).containsExactly("motivo", "pendencias"));

        d.inativar("Pediu para parar", DecisaoPendencias.MANTER, AGORA);
        assertThat(d.getStatus()).isEqualTo(StatusDoador.INATIVO);
        assertThat(d.getInativadoEm()).isEqualTo(AGORA);
        assertThatThrownBy(() -> d.inativar("de novo", DecisaoPendencias.MANTER, AGORA))
                .isInstanceOf(RegraDeNegocioException.class);
    }

    @Test
    void reativarSoParaInativos() {
        Doador d = maria();
        assertThatThrownBy(() -> d.reativar("x")).isInstanceOf(RegraDeNegocioException.class);
        d.inativar("Pausa", DecisaoPendencias.CANCELAR, AGORA);
        d.reativar("Voltou");
        assertThat(d.getStatus()).isEqualTo(StatusDoador.ATIVO);
        assertThat(d.getInativadoEm()).isNull();
    }

    @Test
    void anonimizarConfereNomeApagaDadosEImpedeReativacao() {
        Doador d = maria();
        assertThatThrownBy(() -> d.anonimizar("LGPD", "Outra Pessoa", null, AGORA))
                .isInstanceOfSatisfying(ValidacaoException.class,
                        e -> assertThat(campos(e)).containsExactly("nomeConfirmacao", "pendencias"));

        boolean estavaAtivo = d.anonimizar("LGPD", "maria souza", DecisaoPendencias.CANCELAR, AGORA);

        assertThat(estavaAtivo).isTrue();
        assertThat(d.getNome()).isEqualTo("Doador anonimizado #7");
        assertThat(d.getTelefones()).isEmpty();
        assertThat(d.getCpf()).isEmpty();
        assertThat(d.getStatus()).isEqualTo(StatusDoador.ANONIMIZADO);
        assertThatThrownBy(() -> d.reativar("x")).isInstanceOf(RegraDeNegocioException.class);
        assertThatThrownBy(() -> NotaDoador.criar(d, "oi", "s", "n", AGORA)).isInstanceOf(RegraDeNegocioException.class);
    }

    @Test
    void notaTemLimiteDe500Caracteres() {
        assertThatThrownBy(() -> NotaDoador.criar(maria(), "x".repeat(501), "s", "n", AGORA))
                .isInstanceOf(ValidacaoException.class);
        assertThat(NotaDoador.criar(maria(), "  Prefere pagar aos domingos ", "s", "n", AGORA).texto())
                .isEqualTo("Prefere pagar aos domingos");
    }
}
