package com.durvalcrm.doador.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.doador.domain.Cpf;
import com.durvalcrm.doador.domain.DadosCadastrais;
import com.durvalcrm.doador.domain.Doador;
import com.durvalcrm.doador.domain.DoadorRepository;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/** Perfil completo e consentimentos (US-DONOR-003); toda alteração é auditada com antes/depois. */
public class AtualizarDoadorUseCase {

    private final DoadorRepository repositorio;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public AtualizarDoadorUseCase(DoadorRepository repositorio, RegistrarAuditoriaUseCase auditoria,
            CurrentUserPort usuario, Clock relogio) {
        this.repositorio = repositorio;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    @Transactional
    public Doador atualizar(long id, DadosCadastrais dados) {
        Doador doador = CarregarDoador.ou404(repositorio, id);
        Map<String, Object> anterior = AuditoriaDoador.instantaneo(doador);
        doador.atualizar(dados, usuario.getNome(), relogio.instant(), LocalDate.now(relogio));
        if (!Textos.vazio(dados.cpf()) && repositorio.existeOutroComCpf(new Cpf(dados.cpf()), id)) {
            throw ValidacaoException.doCampo("cpf", "Já existe um doador com este CPF.");
        }
        Doador salvo = repositorio.salvar(doador);
        Map<String, Object> alteracoes = AuditoriaDoador.diferencas(anterior, AuditoriaDoador.instantaneo(salvo));
        if (!alteracoes.isEmpty()) {
            auditoria.registrar("DOADOR_ATUALIZADO", AuditoriaDoador.ENTIDADE, id, alteracoes);
        }
        return salvo;
    }
}
