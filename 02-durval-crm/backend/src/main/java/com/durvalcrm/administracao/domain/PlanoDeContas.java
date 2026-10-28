package com.durvalcrm.administracao.domain;

import com.durvalcrm.financeiro.domain.TipoCategoria;
import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Regras do plano de contas (US-ADMIN-004, Spec §5): dois níveis (categoria → subcategoria), tipo
 * Receita ou Despesa herdado pelas subcategorias, nomes únicos dentro da mãe, subcategorias
 * "Sistema" renomeáveis mas nunca inativadas, e exclusão só do que nunca foi usado (o resto se
 * inativa). Inativar uma categoria inativa as subcategorias dela.
 */
public final class PlanoDeContas {

    public static final int MAXIMO_NOME = 100;
    /** Tamanho da coluna do código, com folga para o sufixo de desempate ("_2"). */
    private static final int MAXIMO_CODIGO = 60 - 4;

    private final List<CategoriaPlano> categorias;

    public PlanoDeContas(List<CategoriaPlano> categorias) {
        this.categorias = List.copyOf(categorias);
    }

    public List<CategoriaPlano> categorias() {
        return categorias;
    }

    public List<CategoriaPlano> subcategoriasDe(String codigo) {
        return categorias.stream().filter(c -> codigo.equals(c.categoriaPai())).toList();
    }

    /** Nova categoria (sem mãe) ou subcategoria; o código é gerado a partir do nome e nunca muda. */
    public CategoriaPlano nova(String nome, TipoCategoria tipo, String codigoPai) {
        String limpo = Textos.compactar(nome);
        validarNome(limpo, codigoPai, null);
        if (codigoPai == null) {
            if (tipo == null) {
                throw ValidacaoException.doCampo("tipo", "Escolha Receita ou Despesa.");
            }
            return new CategoriaPlano(codigoLivre(base(limpo, MAXIMO_CODIGO)), limpo, tipo, null, false, true, false);
        }
        CategoriaPlano pai = buscar(codigoPai);
        if (pai.subcategoria()) {
            throw ValidacaoException.doCampo("categoriaPai", "Subcategorias não têm outro nível.");
        }
        if (!pai.ativa()) {
            throw new RegraDeNegocioException("CATEGORIA_INATIVA", "Reative a categoria " + pai.nome() + " antes.");
        }
        String codigo = codigoLivre(pai.codigo() + "." + base(limpo, MAXIMO_CODIGO - pai.codigo().length() - 1));
        return new CategoriaPlano(codigo, limpo, pai.tipo(), pai.codigo(), false, true, false);
    }

    public CategoriaPlano renomear(String codigo, String nome) {
        CategoriaPlano c = buscar(codigo);
        String limpo = Textos.compactar(nome);
        validarNome(limpo, c.categoriaPai(), codigo);
        return c.renomeada(limpo);
    }

    /** A categoria inativada e, se for categoria-mãe, as subcategorias ativas dela. */
    public List<CategoriaPlano> inativar(String codigo) {
        CategoriaPlano c = buscar(codigo);
        if (!c.ativa()) {
            throw new RegraDeNegocioException("CATEGORIA_JA_INATIVA", c.nome() + " já está inativa.");
        }
        if (c.sistema()) {
            throw new RegraDeNegocioException("CATEGORIA_SISTEMA",
                    c.nome() + " é usada pelos lançamentos automáticos e não pode ser inativada.");
        }
        List<CategoriaPlano> subs = subcategoriasDe(codigo).stream().filter(CategoriaPlano::ativa).toList();
        if (subs.stream().anyMatch(CategoriaPlano::sistema)) {
            throw new RegraDeNegocioException("CATEGORIA_SISTEMA", c.nome()
                    + " tem subcategorias usadas pelos lançamentos automáticos e não pode ser inativada.");
        }
        return Stream.concat(Stream.of(c), subs.stream())
                .map(x -> x.comAtiva(false)).toList();
    }

    public CategoriaPlano reativar(String codigo) {
        CategoriaPlano c = buscar(codigo);
        if (c.ativa()) {
            throw new RegraDeNegocioException("CATEGORIA_JA_ATIVA", c.nome() + " já está ativa.");
        }
        if (c.subcategoria() && !buscar(c.categoriaPai()).ativa()) {
            throw new RegraDeNegocioException("CATEGORIA_INATIVA",
                    "Reative a categoria " + buscar(c.categoriaPai()).nome() + " antes.");
        }
        return c.comAtiva(true);
    }

    /** Só o que nunca foi usado, não é "Sistema" e não tem subcategorias. */
    public CategoriaPlano exigirExcluivel(String codigo) {
        CategoriaPlano c = buscar(codigo);
        if (c.sistema()) {
            throw new RegraDeNegocioException("CATEGORIA_SISTEMA",
                    c.nome() + " é usada pelos lançamentos automáticos e não pode ser excluída.");
        }
        if (!subcategoriasDe(codigo).isEmpty()) {
            throw new RegraDeNegocioException("CATEGORIA_COM_SUBCATEGORIAS",
                    "Exclua ou mova as subcategorias de " + c.nome() + " antes.");
        }
        if (c.emUso()) {
            throw new RegraDeNegocioException("CATEGORIA_EM_USO",
                    c.nome() + " já foi usada e só pode ser inativada.");
        }
        return c;
    }

    public CategoriaPlano buscar(String codigo) {
        return categorias.stream().filter(c -> c.codigo().equals(codigo)).findFirst()
                .orElseThrow(() -> new RecursoNaoEncontradoException(
                        "CATEGORIA_NAO_ENCONTRADA", "Categoria não encontrada."));
    }

    private void validarNome(String nome, String codigoPai, String excetoCodigo) {
        if (nome.isEmpty()) {
            throw ValidacaoException.doCampo("nome", "Informe o nome.");
        }
        if (nome.length() > MAXIMO_NOME) {
            throw ValidacaoException.doCampo("nome", "Use no máximo " + MAXIMO_NOME + " caracteres.");
        }
        String normalizado = Textos.normalizar(nome);
        boolean repetido = categorias.stream()
                .filter(c -> Objects.equals(c.categoriaPai(), codigoPai) && !c.codigo().equals(excetoCodigo))
                .anyMatch(c -> Textos.normalizar(c.nome()).equals(normalizado));
        if (repetido) {
            throw new ValidacaoException(List.of(new ErroCampo("nome", codigoPai == null
                    ? "Já existe uma categoria com esse nome."
                    : "Já existe uma subcategoria com esse nome nesta categoria.")));
        }
    }

    /** "Despesas com eventos" → "DESPESAS_COM_EVENTOS" (até 40 caracteres ou o espaço que sobra). */
    static String base(String nome, int espaco) {
        String b = Textos.normalizar(nome).toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
        b = b.isEmpty() ? "CATEGORIA" : b;
        int limite = Math.max(1, Math.min(40, espaco));
        return b.length() > limite ? b.substring(0, limite) : b;
    }

    private String codigoLivre(String desejado) {
        Set<String> usados = categorias.stream().map(CategoriaPlano::codigo).collect(Collectors.toSet());
        String codigo = desejado;
        for (int i = 2; usados.contains(codigo); i++) {
            codigo = desejado + "_" + i;
        }
        return codigo;
    }
}
