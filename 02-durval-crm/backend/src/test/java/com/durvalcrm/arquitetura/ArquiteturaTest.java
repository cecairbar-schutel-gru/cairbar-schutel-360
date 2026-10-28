package com.durvalcrm.arquitetura;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

/** Fronteiras da Clean Architecture verificadas no build (durvalcrm-stack-tecnologica.md §3–4). */
@AnalyzeClasses(packages = "com.durvalcrm", importOptions = ImportOption.DoNotIncludeTests.class)
class ArquiteturaTest {

    /** O domínio é Java puro: só a biblioteca padrão e o domínio compartilhado. */
    @ArchTest
    static final ArchRule dominioEhJavaPuro = classes()
            .that().resideInAPackage("com.durvalcrm..domain..")
            .should().onlyDependOnClassesThat()
            .resideInAnyPackage("java..", "com.durvalcrm..domain..");

    /** Casos de uso não conhecem HTTP, JPA, Keycloak nem Spring Security; transação é a única exceção. */
    @ArchTest
    static final ArchRule aplicacaoSemFrameworks = noClasses()
            .that().resideInAPackage("com.durvalcrm..application..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("..adapter..", "..infrastructure..", "com.durvalcrm.shared.security..",
                    "jakarta.persistence..", "jakarta.servlet..", "org.springframework.web..",
                    "org.springframework.security..", "org.springframework.data..", "org.hibernate..");

    @ArchTest
    static final ArchRule aplicacaoSoUsaTransacaoDoSpring = noClasses()
            .that().resideInAPackage("com.durvalcrm..application..")
            .should().dependOnClassesThat(com.tngtech.archunit.base.DescribedPredicate.describe(
                    "Spring fora de org.springframework.transaction",
                    (com.tngtech.archunit.core.domain.JavaClass c) -> c.getPackageName().startsWith("org.springframework")
                            && !c.getPackageName().startsWith("org.springframework.transaction")));

    /** Keycloak/JWT ficam isolados em shared.security. */
    @ArchTest
    static final ArchRule jwtSoEmShared = noClasses()
            .that().resideOutsideOfPackage("com.durvalcrm.shared.security..")
            .should().dependOnClassesThat().resideInAnyPackage("org.springframework.security.oauth2..");

    /** Adapters de entrada e de saída não se conhecem. */
    @ArchTest
    static final ArchRule adaptersIsolados = noClasses()
            .that().resideInAPackage("..adapter.in..")
            .should().dependOnClassesThat().resideInAPackage("..adapter.out..");

    /** Entre módulos, só a API pública (application/domain) é visível: nunca adapters ou infraestrutura alheios. */
    @ArchTest
    static final ArchRule doadorNaoUsaInternosDeOutrosModulos = noClasses()
            .that().resideInAPackage("com.durvalcrm.doador..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("com.durvalcrm.contribuicao.adapter..", "com.durvalcrm.contribuicao.infrastructure..",
                    "com.durvalcrm.administracao.adapter..", "com.durvalcrm.administracao.infrastructure..");

    @ArchTest
    static final ArchRule outrosModulosNaoDependemDeDoador = noClasses()
            .that().resideInAnyPackage("com.durvalcrm.contribuicao..", "com.durvalcrm.administracao..",
                    "com.durvalcrm.financeiro..")
            .should().dependOnClassesThat().resideInAPackage("com.durvalcrm.doador..");

    @ArchTest
    static final ArchRule contribuicaoNaoUsaInternosDeOutrosModulos = noClasses()
            .that().resideInAPackage("com.durvalcrm.contribuicao..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("com.durvalcrm.financeiro.adapter..", "com.durvalcrm.financeiro.infrastructure..",
                    "com.durvalcrm.administracao.adapter..", "com.durvalcrm.administracao.infrastructure..");

    /** O Financeiro é a base: não conhece os módulos que lançam nele. */
    @ArchTest
    static final ArchRule financeiroNaoDependeDeContribuicao = noClasses()
            .that().resideInAPackage("com.durvalcrm.financeiro..")
            .should().dependOnClassesThat().resideInAnyPackage("com.durvalcrm.contribuicao..", "com.durvalcrm.venda..",
                    "com.durvalcrm.intencaogasto..", "com.durvalcrm.conciliacao..", "com.durvalcrm.fechamento..",
                    "com.durvalcrm.contapagar..");

    @ArchTest
    static final ArchRule financeiroNaoUsaInternosDeOutrosModulos = noClasses()
            .that().resideInAPackage("com.durvalcrm.financeiro..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("com.durvalcrm.administracao.adapter..", "com.durvalcrm.administracao.infrastructure..",
                    "com.durvalcrm.estoque..", "com.durvalcrm.editora..", "com.durvalcrm.doador..");

    @ArchTest
    static final ArchRule vendaNaoUsaInternosDeOutrosModulos = noClasses()
            .that().resideInAPackage("com.durvalcrm.venda..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("com.durvalcrm.financeiro.adapter..", "com.durvalcrm.financeiro.infrastructure..",
                    "com.durvalcrm.estoque.adapter..", "com.durvalcrm.estoque.infrastructure..",
                    "com.durvalcrm.editora.adapter..", "com.durvalcrm.editora.infrastructure..",
                    "com.durvalcrm.administracao.adapter..", "com.durvalcrm.administracao.infrastructure..",
                    "com.durvalcrm.contribuicao..", "com.durvalcrm.doador..");

    /** Estoque e Editoras são usados pelas Vendas, nunca o contrário. */
    @ArchTest
    static final ArchRule estoqueEEditorasNaoDependemDeVenda = noClasses()
            .that().resideInAnyPackage("com.durvalcrm.estoque..", "com.durvalcrm.editora..")
            .should().dependOnClassesThat().resideInAnyPackage("com.durvalcrm.venda..", "com.durvalcrm.contribuicao..",
                    "com.durvalcrm.intencaogasto..");

    @ArchTest
    static final ArchRule estoqueNaoUsaInternosDeOutrosModulos = noClasses()
            .that().resideInAPackage("com.durvalcrm.estoque..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("com.durvalcrm.editora.adapter..", "com.durvalcrm.editora.infrastructure..",
                    "com.durvalcrm.administracao.adapter..", "com.durvalcrm.administracao.infrastructure..",
                    "com.durvalcrm.financeiro..", "com.durvalcrm.doador..");

    /** Editoras é usado pelo Estoque (obrigações por baixa), nunca o contrário. */
    @ArchTest
    static final ArchRule editoraNaoDependeDeEstoque = noClasses()
            .that().resideInAPackage("com.durvalcrm.editora..")
            .should().dependOnClassesThat().resideInAPackage("com.durvalcrm.estoque..");

    /** Intenções de gasto usam a API pública do Financeiro e do Estoque, nunca os internos. */
    @ArchTest
    static final ArchRule intencaoGastoNaoUsaInternosDeOutrosModulos = noClasses()
            .that().resideInAPackage("com.durvalcrm.intencaogasto..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("com.durvalcrm.financeiro.adapter..", "com.durvalcrm.financeiro.infrastructure..",
                    "com.durvalcrm.estoque.adapter..", "com.durvalcrm.estoque.infrastructure..",
                    "com.durvalcrm.administracao.adapter..", "com.durvalcrm.administracao.infrastructure..",
                    "com.durvalcrm.venda..", "com.durvalcrm.contribuicao..", "com.durvalcrm.doador..",
                    "com.durvalcrm.editora..");

    /** A conciliação usa a API pública do Financeiro (contas, lançamentos, estornos), nunca os internos. */
    @ArchTest
    static final ArchRule conciliacaoNaoUsaInternosDeOutrosModulos = noClasses()
            .that().resideInAPackage("com.durvalcrm.conciliacao..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("com.durvalcrm.financeiro.adapter..", "com.durvalcrm.financeiro.infrastructure..",
                    "com.durvalcrm.administracao.adapter..", "com.durvalcrm.administracao.infrastructure..",
                    "com.durvalcrm.venda..", "com.durvalcrm.contribuicao..", "com.durvalcrm.doador..",
                    "com.durvalcrm.estoque..", "com.durvalcrm.editora..", "com.durvalcrm.intencaogasto..",
                    "com.durvalcrm.fechamento..");

    /**
     * O fechamento mensal lê a API pública dos módulos (Financeiro, Conciliação, Editoras); Intenções,
     * Estoque e Contribuições entram pelas portas dele, implementadas nos próprios módulos.
     */
    @ArchTest
    static final ArchRule fechamentoNaoUsaInternosDeOutrosModulos = noClasses()
            .that().resideInAPackage("com.durvalcrm.fechamento..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("com.durvalcrm.financeiro.adapter..", "com.durvalcrm.financeiro.infrastructure..",
                    "com.durvalcrm.conciliacao.adapter..", "com.durvalcrm.conciliacao.infrastructure..",
                    "com.durvalcrm.editora.adapter..", "com.durvalcrm.editora.infrastructure..",
                    "com.durvalcrm.administracao.adapter..", "com.durvalcrm.administracao.infrastructure..",
                    "com.durvalcrm.venda..", "com.durvalcrm.contribuicao..", "com.durvalcrm.doador..",
                    "com.durvalcrm.estoque..", "com.durvalcrm.intencaogasto..");

    /**
     * Os módulos que entregam dados ao fechamento só conhecem as portas dele. Os relatórios exportam
     * o demonstrativo, cujas linhas de comparação são do domínio do fechamento.
     */
    @ArchTest
    static final ArchRule modulosSoConhecemAsPortasDoFechamento = noClasses()
            .that().resideOutsideOfPackages("com.durvalcrm.fechamento..", "com.durvalcrm.relatorio..")
            .should().dependOnClassesThat().resideInAnyPackage("com.durvalcrm.fechamento.domain..",
                    "com.durvalcrm.fechamento.adapter..", "com.durvalcrm.fechamento.infrastructure..");

    /**
     * Os relatórios leem a API pública dos módulos (Financeiro, Fechamento, Editoras, Conciliação,
     * Vendas); Contribuições, Vendas, Estoque e Editoras entregam os dados pelas portas do módulo.
     */
    @ArchTest
    static final ArchRule relatorioNaoUsaInternosDeOutrosModulos = noClasses()
            .that().resideInAPackage("com.durvalcrm.relatorio..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("com.durvalcrm.financeiro.adapter..", "com.durvalcrm.financeiro.infrastructure..",
                    "com.durvalcrm.fechamento.adapter..", "com.durvalcrm.fechamento.infrastructure..",
                    "com.durvalcrm.editora.adapter..", "com.durvalcrm.editora.infrastructure..",
                    "com.durvalcrm.conciliacao.adapter..", "com.durvalcrm.conciliacao.infrastructure..",
                    "com.durvalcrm.venda.adapter..", "com.durvalcrm.venda.infrastructure..",
                    "com.durvalcrm.administracao.adapter..", "com.durvalcrm.administracao.infrastructure..",
                    "com.durvalcrm.contribuicao..", "com.durvalcrm.doador..", "com.durvalcrm.estoque..",
                    "com.durvalcrm.intencaogasto..");

    /** Os módulos que entregam dados aos relatórios só conhecem as portas deles. */
    @ArchTest
    static final ArchRule modulosSoConhecemAsPortasDosRelatorios = noClasses()
            .that().resideOutsideOfPackage("com.durvalcrm.relatorio..")
            .should().dependOnClassesThat().resideInAnyPackage("com.durvalcrm.relatorio.domain..",
                    "com.durvalcrm.relatorio.adapter..", "com.durvalcrm.relatorio.infrastructure..");

    /** Ninguém depende dos relatórios além das portas: eles ficam no topo. */
    @ArchTest
    static final ArchRule relatoriosNoTopo = noClasses()
            .that().resideOutsideOfPackage("com.durvalcrm.relatorio..")
            .and().resideOutsideOfPackages("com.durvalcrm..adapter.out.relatorio..")
            .should().dependOnClassesThat().resideInAPackage("com.durvalcrm.relatorio..");

    /** Contas a pagar usam a API pública do Financeiro, nunca os internos nem os demais módulos de negócio. */
    @ArchTest
    static final ArchRule contaPagarNaoUsaInternosDeOutrosModulos = noClasses()
            .that().resideInAPackage("com.durvalcrm.contapagar..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("com.durvalcrm.financeiro.adapter..", "com.durvalcrm.financeiro.infrastructure..",
                    "com.durvalcrm.administracao.adapter..", "com.durvalcrm.administracao.infrastructure..",
                    "com.durvalcrm.venda..", "com.durvalcrm.contribuicao..", "com.durvalcrm.doador..",
                    "com.durvalcrm.estoque..", "com.durvalcrm.editora..", "com.durvalcrm.intencaogasto..");
}
