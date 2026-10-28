package com.durvalcrm.doador.application;

import com.durvalcrm.contribuicao.application.GerenciarCompetenciasDoDoadorUseCase;
import com.durvalcrm.doador.domain.Doador;
import com.durvalcrm.doador.domain.DoadorRepository;
import com.durvalcrm.doador.domain.StatusDoador;
import com.durvalcrm.shared.domain.Textos;
import java.text.Collator;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.transaction.annotation.Transactional;

/**
 * Busca única por nome, telefone ou e-mail (US-DONOR-001). Nome ignora acentos e maiúsculas e
 * aceita partes; telefone ignora a formatação e casa pelos dígitos finais. Ativos vêm antes dos
 * inativos; anonimizados nunca aparecem.
 */
public class BuscarDoadoresUseCase {

    public static final int MINIMO_CARACTERES = 3;
    private static final Pattern SO_TELEFONE = Pattern.compile("^[\\d\\s()+-]+$");

    private final DoadorRepository repositorio;
    private final ResumidorDeDoadores resumidor;

    public BuscarDoadoresUseCase(DoadorRepository repositorio,
            GerenciarCompetenciasDoDoadorUseCase competencias) {
        this.repositorio = repositorio;
        this.resumidor = new ResumidorDeDoadores(competencias);
    }

    @Transactional(readOnly = true)
    public List<ResumoDoador> buscar(String termo) {
        String bruto = termo == null ? "" : termo.trim();
        if (bruto.length() < MINIMO_CARACTERES) {
            return List.of();
        }
        String digitos = Textos.apenasDigitos(bruto);
        List<Doador> encontrados;
        if (SO_TELEFONE.matcher(bruto).matches() && digitos.length() >= MINIMO_CARACTERES) {
            encontrados = repositorio.buscarPorFinalDoTelefone(digitos);
        } else if (bruto.contains("@")) {
            encontrados = repositorio.buscarPorTrechoDoEmail(bruto.toLowerCase(Locale.ROOT));
        } else {
            encontrados = repositorio.buscarPorPartesDoNome(Arrays.asList(Textos.normalizar(bruto).split(" ")));
        }
        Collator collator = Collator.getInstance(Locale.of("pt", "BR"));
        List<Doador> ordenados = encontrados.stream()
                .filter(d -> d.getStatus() != StatusDoador.ANONIMIZADO)
                .sorted(Comparator.comparingInt((Doador d) -> d.getStatus() == StatusDoador.ATIVO ? 0 : 1)
                        .thenComparing(Doador::getNome, collator))
                .toList();
        return List.copyOf(resumidor.resumir(ordenados).values());
    }
}
