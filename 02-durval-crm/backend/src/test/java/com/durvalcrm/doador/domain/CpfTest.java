package com.durvalcrm.doador.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class CpfTest {

    @Test
    void aceitaCpfComDigitosVerificadoresValidosComOuSemMascara() {
        assertThat(Cpf.valido("529.982.247-25")).isTrue();
        assertThat(new Cpf("529.982.247-25").digitos()).isEqualTo("52998224725");
    }

    @Test
    void recusaDigitoErradoRepetidosETamanhoInvalido() {
        assertThat(Cpf.valido("52998224724")).isFalse();
        assertThat(Cpf.valido("11111111111")).isFalse();
        assertThat(Cpf.valido("1234")).isFalse();
    }

    @Test
    void telefoneBrasileiroExigeDddECelularComNove() {
        assertThat(Telefone.valido("(11) 98765-4321")).isTrue();
        assertThat(Telefone.valido("1132654321")).isTrue();
        assertThat(Telefone.valido("11887654321")).isFalse();
        assertThat(Telefone.valido("0198765432")).isFalse();
        assertThat(Telefone.valido("987654321")).isFalse();
    }
}
