package com.durvalcrm.doador.application;

import com.durvalcrm.contribuicao.application.GerenciarCompetenciasDoDoadorUseCase;
import com.durvalcrm.doador.domain.Doador;
import com.durvalcrm.doador.domain.DoadorRepository;
import com.durvalcrm.doador.domain.StatusDoador;
import com.durvalcrm.shared.domain.Textos;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/** Possíveis duplicidades durante o cadastro rápido: mesmo telefone, mesmo e-mail ou nome muito parecido. */
public class VerificarDuplicatasUseCase {

    /** Similaridade de trigramas mínima do nome (notas técnicas do módulo). */
    public static final double LIMITE_SIMILARIDADE_NOME = 0.6;

    private final DoadorRepository repositorio;
    private final ResumidorDeDoadores resumidor;

    public VerificarDuplicatasUseCase(DoadorRepository repositorio, GerenciarCompetenciasDoDoadorUseCase competencias) {
        this.repositorio = repositorio;
        this.resumidor = new ResumidorDeDoadores(competencias);
    }

    @Transactional(readOnly = true)
    public List<PossivelDuplicata> verificar(String nome, String telefone, String email) {
        Map<Long, Doador> doadores = new LinkedHashMap<>();
        Map<Long, List<MotivoDuplicidade>> motivos = new LinkedHashMap<>();
        String digitos = Textos.apenasDigitos(telefone);
        if (digitos.length() >= 10) {
            registrar(repositorio.buscarPorTelefone(digitos), MotivoDuplicidade.TELEFONE, doadores, motivos);
        }
        if (!Textos.vazio(email)) {
            registrar(repositorio.buscarPorEmail(email.trim()), MotivoDuplicidade.EMAIL, doadores, motivos);
        }
        if (Textos.compactar(nome).length() >= 3) {
            registrar(repositorio.buscarPorNomeSimilar(Textos.normalizar(nome), LIMITE_SIMILARIDADE_NOME),
                    MotivoDuplicidade.NOME_SIMILAR, doadores, motivos);
        }
        Map<Long, ResumoDoador> resumos = resumidor.resumir(List.copyOf(doadores.values()));
        return motivos.entrySet().stream()
                .map(e -> new PossivelDuplicata(resumos.get(e.getKey()), List.copyOf(e.getValue())))
                .toList();
    }

    private static void registrar(List<Doador> encontrados, MotivoDuplicidade motivo, Map<Long, Doador> doadores,
            Map<Long, List<MotivoDuplicidade>> motivos) {
        for (Doador d : encontrados) {
            if (d.getStatus() == StatusDoador.ANONIMIZADO) {
                continue;
            }
            doadores.putIfAbsent(d.getId(), d);
            List<MotivoDuplicidade> lista = motivos.computeIfAbsent(d.getId(), k -> new ArrayList<>());
            if (!lista.contains(motivo)) {
                lista.add(motivo);
            }
        }
    }
}
