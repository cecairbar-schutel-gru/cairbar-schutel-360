package com.durvalcrm.contapagar.infrastructure;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.contapagar.application.ContasPagarUseCase;
import com.durvalcrm.contapagar.domain.ContaPagarRepository;
import com.durvalcrm.contapagar.domain.PagamentoContaPagarRepository;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.financeiro.domain.CategoriaRepository;
import com.durvalcrm.shared.application.CurrentUserPort;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ContaPagarConfiguration {

    @Bean
    ContasPagarUseCase contasPagarUseCase(ContaPagarRepository contas, PagamentoContaPagarRepository pagamentos,
            CategoriaRepository categorias, MovimentoFinanceiroUseCase movimento, RegistrarAuditoriaUseCase auditoria,
            CurrentUserPort usuario, Clock relogio) {
        return new ContasPagarUseCase(contas, pagamentos, categorias, movimento, auditoria, usuario, relogio);
    }
}
