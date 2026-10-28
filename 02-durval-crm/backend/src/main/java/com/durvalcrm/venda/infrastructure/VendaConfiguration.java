package com.durvalcrm.venda.infrastructure;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.editora.application.ObrigacoesEditoraUseCase;
import com.durvalcrm.estoque.application.EstoqueParaVendaUseCase;
import com.durvalcrm.financeiro.application.ContasRecebimentoUseCase;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.application.DadosOrganizacaoPort;
import com.durvalcrm.venda.application.CancelarVendaUseCase;
import com.durvalcrm.venda.application.CatalogoVendaUseCase;
import com.durvalcrm.venda.application.ConfirmarVendaUseCase;
import com.durvalcrm.venda.application.ConsultarVendasUseCase;
import com.durvalcrm.venda.application.GeradorComprovanteVendaPdfPort;
import com.durvalcrm.venda.application.NumeracaoVendaPort;
import com.durvalcrm.venda.application.OpcoesVendaUseCase;
import com.durvalcrm.venda.domain.VendaRepository;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class VendaConfiguration {

    @Bean
    OpcoesVendaUseCase opcoesVendaUseCase(ContasRecebimentoUseCase recebimento, CurrentUserPort usuario) {
        return new OpcoesVendaUseCase(recebimento, usuario);
    }

    @Bean
    CatalogoVendaUseCase catalogoVendaUseCase(EstoqueParaVendaUseCase estoque, CurrentUserPort usuario) {
        return new CatalogoVendaUseCase(estoque, usuario);
    }

    @Bean
    ConfirmarVendaUseCase confirmarVendaUseCase(VendaRepository vendas, NumeracaoVendaPort numeracao,
            EstoqueParaVendaUseCase estoque, ObrigacoesEditoraUseCase editoras, MovimentoFinanceiroUseCase financeiro,
            OpcoesVendaUseCase opcoes, RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario, Clock relogio) {
        return new ConfirmarVendaUseCase(vendas, numeracao, estoque, editoras, financeiro, opcoes, auditoria, usuario,
                relogio);
    }

    @Bean
    CancelarVendaUseCase cancelarVendaUseCase(VendaRepository vendas, EstoqueParaVendaUseCase estoque,
            ObrigacoesEditoraUseCase editoras, MovimentoFinanceiroUseCase financeiro, RegistrarAuditoriaUseCase auditoria,
            CurrentUserPort usuario, Clock relogio) {
        return new CancelarVendaUseCase(vendas, estoque, editoras, financeiro, auditoria, usuario, relogio);
    }

    @Bean
    ConsultarVendasUseCase consultarVendasUseCase(VendaRepository vendas, EstoqueParaVendaUseCase estoque,
            DadosOrganizacaoPort organizacao, GeradorComprovanteVendaPdfPort pdf, OpcoesVendaUseCase opcoes,
            Clock relogio) {
        return new ConsultarVendasUseCase(vendas, estoque, organizacao, pdf, opcoes, relogio);
    }
}
