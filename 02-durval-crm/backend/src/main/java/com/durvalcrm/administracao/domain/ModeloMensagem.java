package com.durvalcrm.administracao.domain;

import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Texto do WhatsApp e assunto e corpo do e-mail de um tipo de mensagem (US-ADMIN-003). */
public record ModeloMensagem(TipoModelo tipo, String whatsapp, String emailAssunto, String emailCorpo,
        Autor atualizacao) {

    private static final Pattern VARIAVEL = Pattern.compile("\\{([^{}]*)}");

    public ModeloMensagem {
        Objects.requireNonNull(tipo);
    }

    /** Campos obrigatórios, tamanhos e variáveis desconhecidas ("{nome}" sim, "{doador}" não). */
    public static void validar(TipoModelo tipo, String whatsapp, String emailAssunto, String emailCorpo) {
        List<ErroCampo> erros = new ArrayList<>();
        campo(erros, tipo, "whatsapp", whatsapp, 1000);
        campo(erros, tipo, "emailAssunto", emailAssunto, 200);
        campo(erros, tipo, "emailCorpo", emailCorpo, 4000);
        ValidacaoException.lancarSeHouver(erros);
    }

    public static Set<String> variaveisDesconhecidas(TipoModelo tipo, String texto) {
        Set<String> desconhecidas = new LinkedHashSet<>();
        Matcher m = VARIAVEL.matcher(texto == null ? "" : texto);
        while (m.find()) {
            if (!tipo.variaveis().contains(m.group(1))) {
                desconhecidas.add("{" + m.group(1) + "}");
            }
        }
        return desconhecidas;
    }

    private static void campo(List<ErroCampo> erros, TipoModelo tipo, String nome, String valor, int maximo) {
        if (valor == null || valor.isBlank()) {
            erros.add(new ErroCampo(nome, "Preencha o texto."));
        } else if (valor.length() > maximo) {
            erros.add(new ErroCampo(nome, "Use no máximo " + maximo + " caracteres."));
        } else {
            Set<String> desconhecidas = variaveisDesconhecidas(tipo, valor);
            if (!desconhecidas.isEmpty()) {
                erros.add(new ErroCampo(nome, "Variável desconhecida: " + String.join(", ", desconhecidas) + "."));
            }
        }
    }
}
