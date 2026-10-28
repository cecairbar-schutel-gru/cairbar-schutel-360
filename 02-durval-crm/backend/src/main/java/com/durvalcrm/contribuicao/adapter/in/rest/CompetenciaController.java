package com.durvalcrm.contribuicao.adapter.in.rest;

import com.durvalcrm.contribuicao.application.ConsultarCompetenciasUseCase;
import com.durvalcrm.contribuicao.application.GerenciarCompetenciasDoDoadorUseCase;
import com.durvalcrm.contribuicao.application.PainelCompetencias;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Competências do doador (US-CONTRIB-002/003). */
@RestController
public class CompetenciaController {

    private final GerenciarCompetenciasDoDoadorUseCase competencias;
    private final ConsultarCompetenciasUseCase consulta;

    CompetenciaController(GerenciarCompetenciasDoDoadorUseCase competencias, ConsultarCompetenciasUseCase consulta) {
        this.competencias = competencias;
        this.consulta = consulta;
    }

    /** Somente as competências gravadas. */
    @GetMapping("/api/doadores/{doadorId}/competencias")
    @PreAuthorize("hasAnyRole('OPERADOR', 'ADMINISTRADOR')")
    List<CompetenciaResponse> listar(@PathVariable long doadorId) {
        return competencias.listarPorDoador(doadorId).stream().map(CompetenciaResponse::de).toList();
    }

    /** Pendentes, próximos 12 meses e histórico recente, para consulta e seleção. */
    @GetMapping("/api/doadores/{doadorId}/competencias/painel")
    @PreAuthorize("hasAnyRole('OPERADOR', 'ADMINISTRADOR')")
    PainelCompetenciasResponse painel(@PathVariable long doadorId,
            @RequestParam(defaultValue = "false") boolean completo) {
        return PainelCompetenciasResponse.de(consulta.painel(doadorId, completo));
    }

    record PainelCompetenciasResponse(int quantidadePendentes, BigDecimal totalPendente,
            BigDecimal mensalidadeAtual, List<ItemResponse> itens, boolean possuiMaisAntigas) {

        static PainelCompetenciasResponse de(PainelCompetencias p) {
            return new PainelCompetenciasResponse(p.quantidadePendentes(), p.totalPendente(), p.mensalidadeAtual(),
                    p.itens().stream().map(i -> new ItemResponse(i.competencia(), i.valor(), i.situacao(),
                            i.atrasada(), i.selecionavel(), i.dataPagamento(), i.numeroRecibo(), i.contribuicaoId()))
                            .toList(),
                    p.possuiMaisAntigas());
        }
    }

    record ItemResponse(YearMonth competencia, BigDecimal valor, PainelCompetencias.Situacao situacao,
            boolean atrasada, boolean selecionavel, LocalDate dataPagamento, String numeroRecibo,
            Long contribuicaoId) {
    }
}
