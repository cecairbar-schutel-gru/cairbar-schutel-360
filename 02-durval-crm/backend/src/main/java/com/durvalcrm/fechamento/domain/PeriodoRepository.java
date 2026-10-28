package com.durvalcrm.fechamento.domain;

import java.time.YearMonth;
import java.util.List;
import java.util.Optional;

public interface PeriodoRepository {

    Optional<Periodo> buscar(YearMonth mes);

    /** Cria o registro do mês (aberto) se não existir e o trava até o fim da transação. */
    Periodo travar(YearMonth mes);

    void salvar(Periodo periodo);

    /** Meses registrados (os demais estão abertos), do mais recente ao mais antigo. */
    List<Periodo> listar();

    void registrar(EventoPeriodo evento);

    List<EventoPeriodo> eventos(YearMonth mes);

    /** Remove o mês, os eventos e as versões gravadas (só ao desfazer uma importação, US-ADMIN-012). */
    void excluir(YearMonth mes);
}
