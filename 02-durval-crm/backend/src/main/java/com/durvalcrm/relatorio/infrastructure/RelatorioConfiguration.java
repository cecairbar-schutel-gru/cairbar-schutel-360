package com.durvalcrm.relatorio.infrastructure;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.conciliacao.application.ConsultarConciliacoesUseCase;
import com.durvalcrm.editora.application.SaldosEditorasUseCase;
import com.durvalcrm.editora.domain.EditoraRepository;
import com.durvalcrm.fechamento.application.DemonstrativoMensalUseCase;
import com.durvalcrm.financeiro.application.ConciliacoesPort;
import com.durvalcrm.financeiro.application.ConsultaFinanceiraPort;
import com.durvalcrm.financeiro.application.ConsultarLancamentosUseCase;
import com.durvalcrm.financeiro.domain.CategoriaRepository;
import com.durvalcrm.financeiro.domain.ContaFinanceiraRepository;
import com.durvalcrm.relatorio.application.EditorasParaRelatorioPort;
import com.durvalcrm.relatorio.application.EstoqueParaRelatorioPort;
import com.durvalcrm.relatorio.application.ExportacoesUseCase;
import com.durvalcrm.relatorio.application.ExportadorPort;
import com.durvalcrm.relatorio.application.MensalidadesParaRelatorioPort;
import com.durvalcrm.relatorio.application.RelatorioEditorasUseCase;
import com.durvalcrm.relatorio.application.RelatorioEstoqueUseCase;
import com.durvalcrm.relatorio.application.RelatorioMensalidadesUseCase;
import com.durvalcrm.relatorio.application.RelatorioVendasUseCase;
import com.durvalcrm.relatorio.application.RelatoriosFinanceirosUseCase;
import com.durvalcrm.relatorio.application.VendasParaRelatorioPort;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.application.DadosOrganizacaoPort;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RelatorioConfiguration {

    @Bean
    RelatoriosFinanceirosUseCase relatoriosFinanceirosUseCase(ContaFinanceiraRepository contas,
            CategoriaRepository categorias, ConsultaFinanceiraPort consulta, ConciliacoesPort conciliacoes, Clock relogio) {
        return new RelatoriosFinanceirosUseCase(contas, categorias, consulta, conciliacoes, relogio);
    }

    @Bean
    RelatorioMensalidadesUseCase relatorioMensalidadesUseCase(MensalidadesParaRelatorioPort mensalidades, Clock relogio) {
        return new RelatorioMensalidadesUseCase(mensalidades, relogio);
    }

    @Bean
    RelatorioVendasUseCase relatorioVendasUseCase(VendasParaRelatorioPort vendas, CurrentUserPort usuario,
            Clock relogio) {
        return new RelatorioVendasUseCase(vendas, usuario, relogio);
    }

    @Bean
    RelatorioEstoqueUseCase relatorioEstoqueUseCase(EstoqueParaRelatorioPort estoque, Clock relogio) {
        return new RelatorioEstoqueUseCase(estoque, relogio);
    }

    @Bean
    RelatorioEditorasUseCase relatorioEditorasUseCase(EditorasParaRelatorioPort editoras, Clock relogio) {
        return new RelatorioEditorasUseCase(editoras, relogio);
    }

    @Bean
    ExportacoesUseCase exportacoesUseCase(RelatoriosFinanceirosUseCase financeiros,
            RelatorioMensalidadesUseCase mensalidades, RelatorioVendasUseCase vendas, RelatorioEstoqueUseCase estoque,
            RelatorioEditorasUseCase editoras, DemonstrativoMensalUseCase demonstrativos,
            SaldosEditorasUseCase saldosEditoras, ConsultarConciliacoesUseCase conciliacoes,
            ConsultarLancamentosUseCase lancamentos, ContaFinanceiraRepository contas, CategoriaRepository categorias,
            EditoraRepository cadastroEditoras, ExportadorPort exportador, DadosOrganizacaoPort organizacao,
            RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario, Clock relogio) {
        return new ExportacoesUseCase(financeiros, mensalidades, vendas, estoque, editoras, demonstrativos, saldosEditoras,
                conciliacoes, lancamentos, contas, categorias, cadastroEditoras, exportador, organizacao, auditoria,
                usuario, relogio);
    }
}
