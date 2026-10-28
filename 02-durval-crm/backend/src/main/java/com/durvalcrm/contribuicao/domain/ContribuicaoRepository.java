package com.durvalcrm.contribuicao.domain;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ContribuicaoRepository {

    /** Insere ou atualiza; uma chave de idempotência repetida gera {@code RegraDeNegocioException}. */
    Contribuicao salvar(Contribuicao contribuicao);

    Optional<Contribuicao> buscarPorId(long id);

    Optional<Contribuicao> buscarPorChaveIdempotencia(String chave);

    Optional<Contribuicao> buscarPorNumeroRecibo(String numero);

    /** Do doador no ano, da mais recente para a mais antiga. */
    List<Contribuicao> listarPorDoadorNoAno(long doadorId, int ano);

    /** Anos com contribuições do doador, do mais recente para o mais antigo. */
    List<Integer> anosComContribuicao(long doadorId);

    /** Recebidas pelo operador na data financeira. */
    List<Contribuicao> listarDoDiaDoOperador(LocalDate data, String operadorSubject);

    List<Contribuicao> listarUltimasDoOperador(String operadorSubject, int limite);
}
