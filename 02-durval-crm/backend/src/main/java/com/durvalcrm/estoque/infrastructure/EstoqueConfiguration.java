package com.durvalcrm.estoque.infrastructure;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.editora.application.ConsultarEditorasUseCase;
import com.durvalcrm.editora.application.ObrigacoesEditoraUseCase;
import com.durvalcrm.estoque.application.CatalogoUseCase;
import com.durvalcrm.estoque.application.ConsultaEstoquePort;
import com.durvalcrm.estoque.application.ConsultarEstoqueUseCase;
import com.durvalcrm.estoque.application.EntradaEstoqueUseCase;
import com.durvalcrm.estoque.application.EstoqueParaVendaUseCase;
import com.durvalcrm.estoque.application.SolicitacoesEstoqueUseCase;
import com.durvalcrm.estoque.domain.CatalogoRepository;
import com.durvalcrm.estoque.domain.EntradaDoacaoRepository;
import com.durvalcrm.estoque.domain.EstoqueRepository;
import com.durvalcrm.estoque.domain.ProdutoRepository;
import com.durvalcrm.estoque.domain.SolicitacaoRepository;
import com.durvalcrm.shared.application.CurrentUserPort;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class EstoqueConfiguration {

    @Bean
    EstoqueParaVendaUseCase estoqueParaVendaUseCase(ProdutoRepository produtos, EstoqueRepository estoque,
            CurrentUserPort usuario, Clock relogio) {
        return new EstoqueParaVendaUseCase(produtos, estoque, usuario, relogio);
    }

    @Bean
    CatalogoUseCase catalogoUseCase(CatalogoRepository catalogo, EstoqueRepository estoque,
            ConsultaEstoquePort consulta, ConsultarEditorasUseCase editoras, RegistrarAuditoriaUseCase auditoria,
            CurrentUserPort usuario, Clock relogio) {
        return new CatalogoUseCase(catalogo, estoque, consulta, editoras, auditoria, usuario, relogio);
    }

    @Bean
    ConsultarEstoqueUseCase consultarEstoqueUseCase(ConsultaEstoquePort consulta, CatalogoRepository catalogo,
            EstoqueRepository estoque, SolicitacaoRepository solicitacoes, Clock relogio) {
        return new ConsultarEstoqueUseCase(consulta, catalogo, estoque, solicitacoes, relogio);
    }

    @Bean
    EntradaEstoqueUseCase entradaEstoqueUseCase(EntradaDoacaoRepository entradas, CatalogoRepository catalogo,
            EstoqueRepository estoque, ConsultaEstoquePort consulta, RegistrarAuditoriaUseCase auditoria,
            CurrentUserPort usuario, Clock relogio) {
        return new EntradaEstoqueUseCase(entradas, catalogo, estoque, consulta, auditoria, usuario, relogio);
    }

    @Bean
    SolicitacoesEstoqueUseCase solicitacoesEstoqueUseCase(SolicitacaoRepository solicitacoes,
            CatalogoRepository catalogo, EstoqueRepository estoque, ConsultaEstoquePort consulta,
            ObrigacoesEditoraUseCase editoras, RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario,
            Clock relogio) {
        return new SolicitacoesEstoqueUseCase(solicitacoes, catalogo, estoque, consulta, editoras, auditoria, usuario,
                relogio);
    }
}
