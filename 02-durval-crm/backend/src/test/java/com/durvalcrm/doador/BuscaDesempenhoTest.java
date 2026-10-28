package com.durvalcrm.doador;

import static org.assertj.core.api.Assertions.assertThat;

import com.durvalcrm.doador.application.BuscarDoadoresUseCase;
import jakarta.persistence.EntityManager;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** US-DONOR-001: a busca responde em menos de 1 segundo com 10.000 doadores. */
@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
@Transactional
class BuscaDesempenhoTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18-alpine");

    @MockitoBean
    JwtDecoder jwtDecoder;

    @Autowired EntityManager em;
    @Autowired BuscarDoadoresUseCase buscar;

    @Test
    void buscasRespondemEmMenosDeUmSegundoCom10MilDoadores() {
        em.createNativeQuery("""
                insert into doador (nome, nome_busca, status, criado_em)
                select 'Doador ' || md5(g::text) || ' Silva', 'doador ' || md5(g::text) || ' silva',
                       case when g % 10 = 0 then 'INATIVO' else 'ATIVO' end, now()
                from generate_series(1, 10000) g""").executeUpdate();
        em.createNativeQuery("""
                insert into doador_contato (doador_id, ordem, tipo, tipo_telefone, valor, principal)
                select id, 0, 'TELEFONE', 'CELULAR', '119' || lpad(id::text, 8, '0'), true from doador""").executeUpdate();
        em.createNativeQuery("analyze doador; analyze doador_contato").executeUpdate();

        assertThat(cronometrar(() -> buscar.buscar("00002345"))).isLessThan(Duration.ofSeconds(1));
        assertThat(cronometrar(() -> buscar.buscar("doador 3a"))).isLessThan(Duration.ofSeconds(1));
        assertThat(buscar.buscar("00002345")).isNotEmpty();
    }

    private static Duration cronometrar(Runnable busca) {
        busca.run(); // aquecimento
        long inicio = System.nanoTime();
        busca.run();
        return Duration.ofNanos(System.nanoTime() - inicio);
    }
}
