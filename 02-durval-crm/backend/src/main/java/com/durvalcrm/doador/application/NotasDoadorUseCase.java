package com.durvalcrm.doador.application;

import com.durvalcrm.doador.domain.Doador;
import com.durvalcrm.doador.domain.DoadorRepository;
import com.durvalcrm.doador.domain.NotaDoador;
import com.durvalcrm.doador.domain.NotaDoadorRepository;
import com.durvalcrm.shared.application.CurrentUserPort;
import java.time.Clock;
import java.util.List;
import org.springframework.transaction.annotation.Transactional;

/** Notas do doador (US-DONOR-012): só inclusão e consulta, mais recentes primeiro. */
public class NotasDoadorUseCase {

    private final DoadorRepository doadores;
    private final NotaDoadorRepository notas;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public NotasDoadorUseCase(DoadorRepository doadores, NotaDoadorRepository notas, CurrentUserPort usuario,
            Clock relogio) {
        this.doadores = doadores;
        this.notas = notas;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public List<NotaDoador> listar(long doadorId) {
        CarregarDoador.ou404(doadores, doadorId);
        return notas.listarPorDoador(doadorId);
    }

    @Transactional
    public NotaDoador adicionar(long doadorId, String texto) {
        Doador doador = CarregarDoador.ou404(doadores, doadorId);
        return notas.salvar(NotaDoador.criar(doador, texto, usuario.getSubject(), usuario.getNome(), relogio.instant()));
    }
}
