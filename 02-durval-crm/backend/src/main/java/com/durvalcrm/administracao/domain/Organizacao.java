package com.durvalcrm.administracao.domain;

import com.durvalcrm.shared.domain.Cnpj;
import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Dados de identificação da organização (US-ADMIN-005) usados em recibos, comprovantes, apurações,
 * relatórios e exportações; valem para os documentos gerados depois da alteração. O fuso horário é
 * fixo no da organização.
 *
 * @param pix         nula enquanto o PDV da cantina não oferece o QR Code PIX
 * @param atualizacao nula enquanto valem os dados da instalação
 */
public record Organizacao(String razaoSocial, String nomeExibicao, String cnpj, String endereco, String telefone,
        String email, Logo logo, String rodapeRecibo, ChavePix pix, Autor atualizacao) {

    public static final String FUSO_HORARIO = "America/Sao_Paulo";
    public static final int MAXIMO_LOGO = 1024 * 1024;
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    /** PNG ou JPG de até 1 MB. */
    public record Logo(byte[] conteudo, String tipo) {
    }

    /** Normaliza (CNPJ e telefone só com dígitos, espaços extras) e valida; devolve os dados limpos. */
    public static Organizacao validar(String razaoSocial, String nomeExibicao, String cnpj, String endereco,
            String telefone, String email, Logo logo, String rodapeRecibo, ChavePix.Tipo tipoPix, String chavePix,
            String cidadePix, Autor autor) {
        List<ErroCampo> erros = new ArrayList<>();
        String razao = Textos.compactar(razaoSocial);
        String nome = Textos.compactar(nomeExibicao);
        String digitosCnpj = Cnpj.digitos(cnpj);
        String digitosTelefone = Textos.apenasDigitos(telefone);
        String mail = Textos.compactar(email);
        if (razao.isEmpty()) {
            erros.add(new ErroCampo("razaoSocial", "Informe a razão social."));
        } else if (razao.length() > 200) {
            erros.add(new ErroCampo("razaoSocial", "Use no máximo 200 caracteres."));
        }
        if (nome.isEmpty()) {
            erros.add(new ErroCampo("nomeExibicao", "Informe o nome de exibição."));
        } else if (nome.length() > 200) {
            erros.add(new ErroCampo("nomeExibicao", "Use no máximo 200 caracteres."));
        }
        if (!digitosCnpj.isEmpty() && !Cnpj.valido(digitosCnpj)) {
            erros.add(new ErroCampo("cnpj", "CNPJ inválido."));
        }
        if (!digitosTelefone.isEmpty() && (digitosTelefone.length() < 10 || digitosTelefone.length() > 11)) {
            erros.add(new ErroCampo("telefone", "Telefone inválido. Informe DDD e 10 ou 11 dígitos."));
        }
        if (!mail.isEmpty() && (mail.length() > 254 || !EMAIL.matcher(mail).matches())) {
            erros.add(new ErroCampo("email", "E-mail inválido."));
        }
        if (Textos.compactar(endereco).length() > 300) {
            erros.add(new ErroCampo("endereco", "Use no máximo 300 caracteres."));
        }
        if (Textos.compactar(rodapeRecibo).length() > 300) {
            erros.add(new ErroCampo("rodapeRecibo", "Use no máximo 300 caracteres."));
        }
        if (logo != null) {
            if (logo.conteudo().length > MAXIMO_LOGO) {
                erros.add(new ErroCampo("logo", "O logotipo deve ter até 1 MB."));
            } else if (!tipoReal(logo.conteudo()).equals(logo.tipo())) {
                erros.add(new ErroCampo("logo", "Envie o logotipo em PNG ou JPG."));
            }
        }
        ChavePix pix = validarPix(tipoPix, chavePix, cidadePix, erros);
        ValidacaoException.lancarSeHouver(erros);
        return new Organizacao(razao, nome, digitosCnpj.isEmpty() ? null : digitosCnpj, vazioNulo(endereco),
                digitosTelefone.isEmpty() ? null : digitosTelefone, mail.isEmpty() ? null : mail, logo,
                vazioNulo(rodapeRecibo), pix, autor);
    }

    /** Sem tipo e sem chave, o PDV não oferece o QR Code PIX. */
    private static ChavePix validarPix(ChavePix.Tipo tipo, String chave, String cidade, List<ErroCampo> erros) {
        String cidadeLimpa = Textos.compactar(cidade);
        if (tipo == null) {
            if (!Textos.vazio(chave)) {
                erros.add(new ErroCampo("tipoChavePix", "Informe o tipo da chave PIX."));
            }
            return null;
        }
        String normalizada = ChavePix.normalizarChave(tipo, chave);
        String erroChave = ChavePix.erroChave(tipo, normalizada);
        if (erroChave != null) {
            erros.add(new ErroCampo("chavePix", erroChave));
        }
        if (cidadeLimpa.isEmpty()) {
            erros.add(new ErroCampo("cidadePix", "Informe a cidade da organização para o QR Code PIX."));
        } else if (Textos.normalizar(cidadeLimpa).length() > ChavePix.MAXIMO_CIDADE) {
            erros.add(new ErroCampo("cidadePix", "Use no máximo 15 caracteres."));
        }
        return new ChavePix(tipo, normalizada, cidadeLimpa);
    }

    /** Tipo pela assinatura do arquivo, não pela extensão: image/png, image/jpeg ou vazio. */
    public static String tipoReal(byte[] b) {
        if (b.length > 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') {
            return "image/png";
        }
        if (b.length > 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        return "";
    }

    private static String vazioNulo(String valor) {
        String v = Textos.compactar(valor);
        return v.isEmpty() ? null : v;
    }
}
