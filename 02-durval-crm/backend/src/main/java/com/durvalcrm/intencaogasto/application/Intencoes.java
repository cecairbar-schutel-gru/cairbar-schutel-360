package com.durvalcrm.intencaogasto.application;

import com.durvalcrm.financeiro.application.ConsultarLancamentosUseCase;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.financeiro.application.NovoLancamento;
import com.durvalcrm.financeiro.application.ResultadoLancamento;
import com.durvalcrm.financeiro.domain.Categoria;
import com.durvalcrm.financeiro.domain.OrigemLancamento;
import com.durvalcrm.intencaogasto.domain.Aprovacao;
import com.durvalcrm.intencaogasto.domain.Autor;
import com.durvalcrm.intencaogasto.domain.IntencaoGasto;
import com.durvalcrm.intencaogasto.domain.IntencaoGastoRepository;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
import java.time.Clock;
import java.util.Optional;

/** Apoio comum aos casos de uso: carga da intenção, autor, categorias e a despesa no Financeiro. */
final class Intencoes {

    static final String ENTIDADE = "IntencaoGasto";

    private final IntencaoGastoRepository repositorio;
    private final ConsultarLancamentosUseCase financeiro;
    private final MovimentoFinanceiroUseCase movimento;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    Intencoes(IntencaoGastoRepository repositorio, ConsultarLancamentosUseCase financeiro,
            MovimentoFinanceiroUseCase movimento, CurrentUserPort usuario, Clock relogio) {
        this.repositorio = repositorio;
        this.financeiro = financeiro;
        this.movimento = movimento;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    static RecursoNaoEncontradoException naoEncontrada() {
        return new RecursoNaoEncontradoException("INTENCAO_NAO_ENCONTRADA", "Intenção de gasto não encontrada.");
    }

    IntencaoGasto obter(long id) {
        return repositorio.obter(id).orElseThrow(Intencoes::naoEncontrada);
    }

    IntencaoGasto travar(long id) {
        return repositorio.travar(id).orElseThrow(Intencoes::naoEncontrada);
    }

    Autor autor() {
        return new Autor(usuario.getSubject(), usuario.getNome(), relogio.instant());
    }

    Optional<Categoria> categoria(String codigo) {
        return codigo == null ? Optional.empty()
                : financeiro.categorias().stream().filter(c -> c.codigo().equals(codigo.trim())).findFirst();
    }

    String nomeCategoria(String codigo) {
        return categoria(codigo).map(Categoria::nomeCompleto).orElse(codigo);
    }

    /** Despesa da aprovação, com origem "Intenção de gasto nº n" (US-EXPENSE-004). */
    ResultadoLancamento lancarDespesa(IntencaoGasto i) {
        Aprovacao a = i.getAprovacao();
        return movimento.lancarComAvisos(new NovoLancamento(a.data(), OrigemLancamento.INTENCAO_GASTO, i.getId(),
                descricao(i), a.linhasConta(), a.linhasCategoria()));
    }

    /** Estorna a despesa, salvo se já foi estornada direto no Financeiro; devolve se estornou agora. */
    boolean estornarDespesa(IntencaoGasto i, String complemento, String motivo) {
        long lancamento = i.getAprovacao().lancamentoId();
        if (movimento.estornado(lancamento)) {
            return false;
        }
        movimento.estornar(lancamento, "Estorno: intenção de gasto nº " + i.getId() + " (" + complemento + ")", motivo);
        return true;
    }

    boolean despesaJaEstornada(IntencaoGasto i) {
        return movimento.estornado(i.getAprovacao().lancamentoId());
    }

    private static String descricao(IntencaoGasto i) {
        String texto = "Intenção de gasto nº " + i.getId() + ": " + i.getDescricao();
        return texto.length() <= 200 ? texto : texto.substring(0, 199) + "…";
    }
}
