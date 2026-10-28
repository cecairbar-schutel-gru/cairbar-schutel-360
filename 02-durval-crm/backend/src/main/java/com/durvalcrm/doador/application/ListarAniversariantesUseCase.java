package com.durvalcrm.doador.application;

import com.durvalcrm.doador.domain.Doador;
import com.durvalcrm.doador.domain.DoadorRepository;
import com.durvalcrm.doador.domain.Email;
import com.durvalcrm.doador.domain.Telefone;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.text.Collator;
import java.time.LocalDate;
import java.time.MonthDay;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.transaction.annotation.Transactional;

/** Aniversariantes ativos de um período, ordenados pelo dia (US-DONOR-007). */
public class ListarAniversariantesUseCase {

    private static final long MAXIMO_DIAS = 366;

    private final DoadorRepository repositorio;

    public ListarAniversariantesUseCase(DoadorRepository repositorio) {
        this.repositorio = repositorio;
    }

    @Transactional(readOnly = true)
    public ResultadoAniversariantes listar(LocalDate de, LocalDate ate) {
        if (de == null || ate == null || ate.isBefore(de) || de.plusDays(MAXIMO_DIAS).isBefore(ate)) {
            throw ValidacaoException.doCampo("periodo", "Informe um período válido de até um ano.");
        }
        Set<Integer> meses = new TreeSet<>();
        for (LocalDate d = de.withDayOfMonth(1); !d.isAfter(ate); d = d.plusMonths(1)) {
            meses.add(d.getMonthValue());
        }
        List<Aniversariante> itens = new ArrayList<>();
        for (Doador doador : repositorio.listarAtivosNascidosNosMeses(meses)) {
            LocalDate nascimento = doador.getDataNascimento();
            for (int ano = de.getYear(); ano <= ate.getYear(); ano++) {
                // 29/02 em ano não bissexto é comemorado em 28/02 (MonthDay.atYear ajusta).
                LocalDate aniversario = MonthDay.from(nascimento).atYear(ano);
                if (!aniversario.isBefore(de) && !aniversario.isAfter(ate)) {
                    itens.add(new Aniversariante(doador.getId(), doador.getNome(), aniversario,
                            ano - nascimento.getYear(), doador.getConsentimentoWhatsapp().valor(),
                            doador.getConsentimentoEmail().valor(),
                            doador.telefonePrincipal().map(Telefone::numero).orElse(null),
                            doador.emailPrincipal().map(Email::endereco).orElse(null)));
                }
            }
        }
        Collator collator = Collator.getInstance(Locale.of("pt", "BR"));
        itens.sort(Comparator.comparing(Aniversariante::dataAniversario).thenComparing(Aniversariante::nome, collator));
        return new ResultadoAniversariantes(List.copyOf(itens), repositorio.contarAtivosSemDataNascimento());
    }
}
