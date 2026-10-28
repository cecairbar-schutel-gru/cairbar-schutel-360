package com.durvalcrm.administracao.application;

import com.durvalcrm.administracao.domain.CategoriaPlano;
import com.durvalcrm.administracao.domain.PlanoDeContas;
import com.durvalcrm.administracao.domain.PlanoDeContasRepository;
import com.durvalcrm.financeiro.domain.TipoCategoria;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manutenção do plano de contas (US-ADMIN-004). Os formulários do Financeiro e das Intenções de gasto
 * oferecem só as ativas; os relatórios mostram também as inativas que tiveram lançamentos.
 */
public class PlanoDeContasUseCase {

    static final String ENTIDADE = "Categoria";

    private final PlanoDeContasRepository repositorio;
    private final RegistrarAuditoriaUseCase auditoria;

    public PlanoDeContasUseCase(PlanoDeContasRepository repositorio, RegistrarAuditoriaUseCase auditoria) {
        this.repositorio = repositorio;
        this.auditoria = auditoria;
    }

    /** Receitas antes de despesas; categorias por nome, cada uma com as subcategorias por nome. */
    @Transactional(readOnly = true)
    public List<CategoriaComSubcategorias> listar() {
        PlanoDeContas plano = plano();
        Comparator<CategoriaPlano> porNome = Comparator.comparing(CategoriaPlano::nome, String.CASE_INSENSITIVE_ORDER);
        return plano.categorias().stream()
                .filter(c -> !c.subcategoria())
                .sorted(Comparator.comparing(CategoriaPlano::tipo).thenComparing(porNome))
                .map(c -> new CategoriaComSubcategorias(c, plano.subcategoriasDe(c.codigo()).stream().sorted(porNome)
                        .toList()))
                .toList();
    }

    @Transactional
    public CategoriaPlano criar(String nome, TipoCategoria tipo, String categoriaPai) {
        CategoriaPlano nova = plano().nova(nome, tipo, vazioNulo(categoriaPai));
        repositorio.inserir(nova);
        auditoria.registrarAlteracao("CATEGORIA_CRIADA", ENTIDADE, nova.codigo(), null, resumo(nova), null);
        return nova;
    }

    @Transactional
    public CategoriaPlano renomear(String codigo, String nome) {
        PlanoDeContas plano = plano();
        CategoriaPlano antes = plano.buscar(codigo);
        CategoriaPlano depois = plano.renomear(codigo, nome);
        repositorio.atualizar(depois);
        auditoria.registrarAlteracao("CATEGORIA_RENOMEADA", ENTIDADE, codigo, Map.of("nome", antes.nome()),
                Map.of("nome", depois.nome()), null);
        return depois;
    }

    @Transactional
    public List<CategoriaPlano> inativar(String codigo) {
        List<CategoriaPlano> inativadas = plano().inativar(codigo);
        inativadas.forEach(repositorio::atualizar);
        auditoria.registrarAlteracao("CATEGORIA_INATIVADA", ENTIDADE, codigo, null,
                Map.of("inativadas", inativadas.stream().map(CategoriaPlano::nome).toList()), null);
        return inativadas;
    }

    @Transactional
    public CategoriaPlano reativar(String codigo) {
        CategoriaPlano reativada = plano().reativar(codigo);
        repositorio.atualizar(reativada);
        auditoria.registrarAlteracao("CATEGORIA_REATIVADA", ENTIDADE, codigo, null, resumo(reativada), null);
        return reativada;
    }

    @Transactional
    public void excluir(String codigo) {
        CategoriaPlano c = plano().exigirExcluivel(codigo);
        repositorio.excluir(codigo);
        auditoria.registrarAlteracao("CATEGORIA_EXCLUIDA", ENTIDADE, codigo, resumo(c), null, null);
    }

    private PlanoDeContas plano() {
        return new PlanoDeContas(repositorio.listar());
    }

    private static Map<String, Object> resumo(CategoriaPlano c) {
        return c.categoriaPai() == null
                ? Map.of("nome", c.nome(), "tipo", c.tipo().name())
                : Map.of("nome", c.nome(), "tipo", c.tipo().name(), "categoriaPai", c.categoriaPai());
    }

    private static String vazioNulo(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    public record CategoriaComSubcategorias(CategoriaPlano categoria, List<CategoriaPlano> subcategorias) {
    }
}
