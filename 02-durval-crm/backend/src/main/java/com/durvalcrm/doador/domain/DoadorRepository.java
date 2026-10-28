package com.durvalcrm.doador.domain;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/** Porta de saída do agregado Doador. Buscas nunca retornam doadores anonimizados. */
public interface DoadorRepository {

    Doador salvar(Doador doador);

    Optional<Doador> buscarPorId(long id);

    /** Nome normalizado (sem acentos, minúsculo) contendo todas as partes informadas. */
    List<Doador> buscarPorPartesDoNome(List<String> partesNormalizadas);

    /** Telefones terminados nos dígitos informados. */
    List<Doador> buscarPorFinalDoTelefone(String digitos);

    /** E-mails que contêm o trecho informado (sem diferenciar maiúsculas). */
    List<Doador> buscarPorTrechoDoEmail(String trecho);

    List<Doador> buscarPorTelefone(String digitos);

    List<Doador> buscarPorEmail(String email);

    /** Similaridade de trigramas do nome normalizado maior ou igual ao limite (0–1). */
    List<Doador> buscarPorNomeSimilar(String nomeNormalizado, double limite);

    boolean existeOutroComCpf(Cpf cpf, long excetoId);

    /** Doadores ativos nascidos em algum dos meses (1–12). */
    List<Doador> listarAtivosNascidosNosMeses(Set<Integer> meses);

    long contarAtivosSemDataNascimento();

    /** Ids dos doadores ativos (geração mensal de competências, US-CONTRIB-001). */
    List<Long> listarIdsAtivos();

    long contarAtivos();

    /** Dentre os ids, os anonimizados. */
    Set<Long> anonimizados(Collection<Long> ids);

    /** Tem contribuição, nota ou competência que não esteja pendente? */
    boolean possuiMovimentos(long id);

    /** Exclui o doador importado, os contatos, os consentimentos e as competências pendentes (US-ADMIN-012). */
    void excluirImportado(long id);
}
