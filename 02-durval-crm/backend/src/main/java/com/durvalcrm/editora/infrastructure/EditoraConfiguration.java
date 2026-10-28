package com.durvalcrm.editora.infrastructure;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.editora.application.CadastroEditorasUseCase;
import com.durvalcrm.editora.application.ConsultaEditorasPort;
import com.durvalcrm.editora.application.ConsultarEditorasUseCase;
import com.durvalcrm.editora.application.EstoqueConsignadoPort;
import com.durvalcrm.editora.application.ObrigacoesEditoraUseCase;
import com.durvalcrm.editora.application.PagarEditoraUseCase;
import com.durvalcrm.editora.application.PedidosLivrosUseCase;
import com.durvalcrm.editora.application.RemessasUseCase;
import com.durvalcrm.editora.application.SaldosEditorasUseCase;
import com.durvalcrm.editora.domain.DevolucaoRepository;
import com.durvalcrm.editora.domain.EditoraRepository;
import com.durvalcrm.editora.domain.ObrigacaoRepository;
import com.durvalcrm.editora.domain.PagamentoEditoraRepository;
import com.durvalcrm.editora.domain.PedidoLivrosRepository;
import com.durvalcrm.editora.domain.RemessaRepository;
import com.durvalcrm.editora.domain.TransferenciaSaldoRepository;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.financeiro.application.PeriodoFinanceiroPort;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.application.DadosOrganizacaoPort;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class EditoraConfiguration {

    @Bean
    ObrigacoesEditoraUseCase obrigacoesEditoraUseCase(RemessaRepository remessas, ObrigacaoRepository obrigacoes,
            Clock relogio) {
        return new ObrigacoesEditoraUseCase(remessas, obrigacoes, relogio);
    }

    @Bean
    ConsultarEditorasUseCase consultarEditorasUseCase(EditoraRepository editoras) {
        return new ConsultarEditorasUseCase(editoras);
    }

    @Bean
    CadastroEditorasUseCase cadastroEditorasUseCase(EditoraRepository editoras, ConsultaEditorasPort consulta,
            EstoqueConsignadoPort estoque, RegistrarAuditoriaUseCase auditoria, Clock relogio) {
        return new CadastroEditorasUseCase(editoras, consulta, estoque, auditoria, relogio);
    }

    @Bean
    RemessasUseCase remessasUseCase(RemessaRepository remessas, PedidoLivrosRepository pedidos,
            DevolucaoRepository devolucoes, EditoraRepository editoras, ConsultaEditorasPort consulta, EstoqueConsignadoPort estoque,
            DadosOrganizacaoPort organizacao, PeriodoFinanceiroPort periodos, RegistrarAuditoriaUseCase auditoria,
            CurrentUserPort usuario, Clock relogio) {
        return new RemessasUseCase(remessas, pedidos, devolucoes, editoras, consulta, estoque, organizacao, periodos, auditoria,
                usuario, relogio);
    }

    @Bean
    PedidosLivrosUseCase pedidosLivrosUseCase(PedidoLivrosRepository pedidos, EditoraRepository editoras,
            RemessaRepository remessas, EstoqueConsignadoPort estoque, RegistrarAuditoriaUseCase auditoria,
            CurrentUserPort usuario, Clock relogio) {
        return new PedidosLivrosUseCase(pedidos, editoras, remessas, estoque, auditoria, usuario, relogio);
    }

    @Bean
    PagarEditoraUseCase pagarEditoraUseCase(EditoraRepository editoras, ObrigacaoRepository obrigacoes,
            PagamentoEditoraRepository pagamentos, ConsultaEditorasPort consulta, MovimentoFinanceiroUseCase movimento,
            DadosOrganizacaoPort organizacao, RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario,
            Clock relogio) {
        return new PagarEditoraUseCase(editoras, obrigacoes, pagamentos, consulta, movimento, organizacao, auditoria,
                usuario, relogio);
    }

    @Bean
    SaldosEditorasUseCase saldosEditorasUseCase(EditoraRepository editoras, ObrigacaoRepository obrigacoes,
            TransferenciaSaldoRepository transferencias, ConsultaEditorasPort consulta, DadosOrganizacaoPort organizacao,
            PeriodoFinanceiroPort periodos, RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario, Clock relogio) {
        return new SaldosEditorasUseCase(editoras, obrigacoes, transferencias, consulta, organizacao, periodos, auditoria,
                usuario, relogio);
    }
}
