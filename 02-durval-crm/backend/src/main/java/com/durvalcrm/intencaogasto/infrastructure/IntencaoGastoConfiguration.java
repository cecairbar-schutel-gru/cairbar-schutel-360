package com.durvalcrm.intencaogasto.infrastructure;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.estoque.application.ConsultarEstoqueUseCase;
import com.durvalcrm.estoque.application.EntradaEstoqueUseCase;
import com.durvalcrm.financeiro.application.ConsultarLancamentosUseCase;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.intencaogasto.application.AprovarGastoUseCase;
import com.durvalcrm.intencaogasto.application.ConsultaIntencoesPort;
import com.durvalcrm.intencaogasto.application.ConsultarIntencaoUseCase;
import com.durvalcrm.intencaogasto.application.ReceberCompraUseCase;
import com.durvalcrm.intencaogasto.application.SolicitarGastoUseCase;
import com.durvalcrm.intencaogasto.domain.IntencaoGastoRepository;
import com.durvalcrm.shared.application.CurrentUserPort;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class IntencaoGastoConfiguration {

    @Bean
    SolicitarGastoUseCase solicitarGastoUseCase(IntencaoGastoRepository repositorio, ConsultaIntencoesPort consulta,
            ConsultarLancamentosUseCase financeiro, MovimentoFinanceiroUseCase movimento,
            ConsultarEstoqueUseCase estoque, RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario,
            Clock relogio) {
        return new SolicitarGastoUseCase(repositorio, consulta, financeiro, movimento, estoque, auditoria, usuario,
                relogio);
    }

    @Bean
    AprovarGastoUseCase aprovarGastoUseCase(IntencaoGastoRepository repositorio, ConsultaIntencoesPort consulta,
            ConsultarLancamentosUseCase financeiro, MovimentoFinanceiroUseCase movimento,
            RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario, Clock relogio) {
        return new AprovarGastoUseCase(repositorio, consulta, financeiro, movimento, auditoria, usuario, relogio);
    }

    @Bean
    ReceberCompraUseCase receberCompraUseCase(IntencaoGastoRepository repositorio, ConsultaIntencoesPort consulta,
            ConsultarLancamentosUseCase financeiro, MovimentoFinanceiroUseCase movimento,
            EntradaEstoqueUseCase entradas, RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario,
            Clock relogio) {
        return new ReceberCompraUseCase(repositorio, consulta, financeiro, movimento, entradas, auditoria, usuario,
                relogio);
    }

    @Bean
    ConsultarIntencaoUseCase consultarIntencaoUseCase(IntencaoGastoRepository repositorio,
            ConsultaIntencoesPort consulta, ConsultarLancamentosUseCase financeiro, MovimentoFinanceiroUseCase movimento,
            CurrentUserPort usuario, Clock relogio) {
        return new ConsultarIntencaoUseCase(repositorio, consulta, financeiro, movimento, usuario, relogio);
    }
}
