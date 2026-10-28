package com.durvalcrm.shared.adapter.in.rest;

import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Traduz exceções de domínio para HTTP: 404, 409 (regra) e 422 (validação). */
@RestControllerAdvice
public class TratadorDeErros {

    @ExceptionHandler(ValidacaoException.class)
    ResponseEntity<RespostaErro> validacao(ValidacaoException e) {
        return ResponseEntity.unprocessableContent()
                .body(new RespostaErro(e.getCodigo(), e.getMessage(), e.getErros()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<RespostaErro> requisicaoInvalida(MethodArgumentNotValidException e) {
        List<ErroCampo> erros = e.getBindingResult().getFieldErrors().stream()
                .map(f -> new ErroCampo(f.getField(), f.getDefaultMessage()))
                .toList();
        return ResponseEntity.unprocessableContent()
                .body(new RespostaErro("VALIDACAO", "Dados inválidos.", erros));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<RespostaErro> corpoIlegivel(HttpMessageNotReadableException e) {
        return ResponseEntity.badRequest()
                .body(new RespostaErro("REQUISICAO_INVALIDA", "Requisição inválida.", List.of()));
    }

    @ExceptionHandler(RegraDeNegocioException.class)
    ResponseEntity<RespostaErro> regra(RegraDeNegocioException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new RespostaErro(e.getCodigo(), e.getMessage(), e.getErros()));
    }

    @ExceptionHandler(RecursoNaoEncontradoException.class)
    ResponseEntity<RespostaErro> naoEncontrado(RecursoNaoEncontradoException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new RespostaErro(e.getCodigo(), e.getMessage(), List.of()));
    }

    @ExceptionHandler(AuthorizationDeniedException.class)
    ResponseEntity<RespostaErro> acessoNegado(AuthorizationDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(RespostaErro.acessoNegado());
    }
}
