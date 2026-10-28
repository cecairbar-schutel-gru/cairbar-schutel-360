package com.durvalcrm.administracao.application;

import com.durvalcrm.administracao.application.DoadoresAdministracaoPort.DoadorImportado;
import com.durvalcrm.administracao.application.DoadoresAdministracaoPort.Duplicata;
import com.durvalcrm.administracao.domain.Autor;
import com.durvalcrm.administracao.domain.CategoriaPlano;
import com.durvalcrm.administracao.domain.EventoAuditoriaRepository;
import com.durvalcrm.administracao.domain.Importacao;
import com.durvalcrm.administracao.domain.ImportacaoRepository;
import com.durvalcrm.administracao.domain.PlanilhaCsv;
import com.durvalcrm.administracao.domain.PlanoDeContasRepository;
import com.durvalcrm.administracao.domain.TipoImportacao;
import com.durvalcrm.administracao.domain.ValoresPlanilha;
import com.durvalcrm.fechamento.application.FechamentoMensalUseCase;
import com.durvalcrm.financeiro.application.ContasFinanceirasUseCase;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.financeiro.application.PeriodoFinanceiroPort;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.LinhaCategoria;
import com.durvalcrm.financeiro.domain.LinhaConta;
import com.durvalcrm.financeiro.domain.TipoCategoria;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

/**
 * Importação do histórico (US-ADMIN-012): modelo CSV → envio → validação linha a linha → prévia com
 * totais → confirmação. Tudo ou nada: com qualquer erro nada é importado. O histórico financeiro é
 * anterior à data de corte de cada conta, marcado "Importação" e fecha os meses que cobre; os
 * doadores passam pela checagem de duplicidade (US-DONOR-002) e o Administrador decide cada
 * possível duplicata na prévia. A importação pode ser desfeita por inteiro enquanto nada foi feito
 * sobre o que ela criou.
 */
public class ImportacaoUseCase {

    static final String ENTIDADE = "Importacao";

    public static final List<String> COLUNAS_FINANCEIRO = List.of("data", "conta", "tipo", "subcategoria", "descricao",
            "valor");
    public static final List<String> COLUNAS_DOADORES = List.of("nome", "telefone", "email", "data_de_nascimento",
            "cpf", "consentimento_whatsapp", "consentimento_email", "competencias_pendentes");

    private static final DateTimeFormatter MES = DateTimeFormatter.ofPattern("MM/yyyy");
    private static final DateTimeFormatter DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final List<String> ACOES_DA_IMPORTACAO = List.of("DOADOR_IMPORTADO");

    private final ImportacaoRepository importacoes;
    private final PlanoDeContasRepository plano;
    private final ContasFinanceirasUseCase contas;
    private final MovimentoFinanceiroUseCase financeiro;
    private final PeriodoFinanceiroPort periodos;
    private final FechamentoMensalUseCase fechamento;
    private final DoadoresAdministracaoPort doadores;
    private final EventoAuditoriaRepository eventos;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public ImportacaoUseCase(ImportacaoRepository importacoes, PlanoDeContasRepository plano,
            ContasFinanceirasUseCase contas, MovimentoFinanceiroUseCase financeiro, PeriodoFinanceiroPort periodos,
            FechamentoMensalUseCase fechamento, DoadoresAdministracaoPort doadores, EventoAuditoriaRepository eventos,
            RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario, Clock relogio) {
        this.importacoes = importacoes;
        this.plano = plano;
        this.contas = contas;
        this.financeiro = financeiro;
        this.periodos = periodos;
        this.fechamento = fechamento;
        this.doadores = doadores;
        this.eventos = eventos;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    /** Modelo CSV (";" e UTF-8 com BOM, como o Excel abre) com o cabeçalho e linhas de exemplo. */
    public byte[] modelo(TipoImportacao tipo) {
        String conteudo = tipo == TipoImportacao.FINANCEIRO
                ? """
                Data;Conta;Tipo;Subcategoria;Descrição;Valor
                15/03/2026;Caixa Secretaria;Receita;Receitas de contribuições › Mensalidades;Mensalidades de março;1.250,00
                20/03/2026;Banco do Brasil;Despesa;Despesas operacionais › Energia elétrica;Conta de luz de março;312,45
                """
                : """
                Nome;Telefone;E-mail;Data de nascimento;CPF;Consentimento WhatsApp;Consentimento e-mail;Competências pendentes
                Maria da Silva;(11) 98765-4321;maria@exemplo.com;12/10/1970;;Sim;Não;08/2026, 09/2026
                João Pereira;;joao@exemplo.com;;;;Sim;
                """;
        return ("\uFEFF" + conteudo.replace("\n", "\r\n")).getBytes(StandardCharsets.UTF_8);
    }

    @Transactional(readOnly = true)
    public Previa previa(TipoImportacao tipo, String arquivo, byte[] conteudo) {
        return analisar(tipo, arquivo, conteudo).previa();
    }

    /**
     * Confirma: 422 com qualquer erro de linha; 409 {@code DUPLICATAS_SEM_DECISAO} se alguma possível
     * duplicata ficou sem decisão.
     *
     * @param decisoes por número de linha: IMPORTAR (é outra pessoa) ou IGNORAR (já cadastrado)
     */
    @Transactional
    public Importacao confirmar(TipoImportacao tipo, String arquivo, byte[] conteudo, Map<Integer, String> decisoes) {
        Analise a = analisar(tipo, arquivo, conteudo);
        if (!a.erros().isEmpty()) {
            throw new ValidacaoException(a.erros().stream()
                    .map(e -> new ErroCampo("linha " + e.linha() + (e.coluna() == null ? "" : " · " + e.coluna()),
                            e.mensagem()))
                    .toList());
        }
        Map<Integer, String> d = decisoes == null ? Map.of() : decisoes;
        List<Integer> semDecisao = a.duplicatas().stream().map(DuplicataLinha::linha)
                .filter(l -> !"IMPORTAR".equals(d.get(l)) && !"IGNORAR".equals(d.get(l))).toList();
        if (!semDecisao.isEmpty()) {
            throw new RegraDeNegocioException("DUPLICATAS_SEM_DECISAO", "Decida as possíveis duplicatas das linhas "
                    + semDecisao.stream().map(String::valueOf).collect(Collectors.joining(", ")) + ".");
        }
        Autor autor = autor();
        Importacao registrada = importacoes.inserir(new Importacao(null, tipo, nomeArquivo(arquivo), autor,
                a.linhas(), 0, List.of(), List.of(), false, null));
        long id = registrada.id();
        List<Long> criados = new ArrayList<>();
        List<YearMonth> meses = List.of();
        if (tipo == TipoImportacao.FINANCEIRO) {
            for (LinhaFinanceira l : a.financeiras()) {
                BigDecimal sinal = l.tipo() == TipoCategoria.RECEITA ? l.valor() : l.valor().negate();
                criados.add(financeiro.importar(l.data(), id, l.descricao(),
                        List.of(new LinhaConta(l.conta().id(), sinal)),
                        List.of(new LinhaCategoria(l.subcategoria().codigo(), sinal))));
            }
            meses = a.meses();
            fechamento.fecharImportados(meses, id);
        } else {
            for (LinhaDoador l : a.doadoresValidos()) {
                if (!"IGNORAR".equals(d.get(l.linha()))) {
                    criados.add(doadores.cadastrar(l.doador()));
                }
            }
        }
        Importacao concluida = new Importacao(id, tipo, registrada.arquivo(), autor, a.linhas(), criados.size(), criados,
                meses, false, null);
        importacoes.registrarResultado(concluida);
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("tipo", tipo.name());
        detalhes.put("arquivo", concluida.arquivo());
        detalhes.put("linhas", a.linhas());
        detalhes.put("importadas", criados.size());
        if (!meses.isEmpty()) {
            detalhes.put("mesesFechados", meses.stream().map(YearMonth::toString).toList());
        }
        auditoria.registrar("IMPORTACAO_CONCLUIDA", ENTIDADE, id, detalhes);
        return concluida;
    }

    @Transactional(readOnly = true)
    public List<ResumoImportacao> listar() {
        return importacoes.listar().stream().map(i -> new ResumoImportacao(i, !i.desfeita() && intocada(i))).toList();
    }

    /** 409 {@code IMPORTACAO_COM_MOVIMENTOS} se algo foi feito sobre o que ela criou. */
    @Transactional
    public Importacao desfazer(long id) {
        Importacao i = importacoes.travar(id).orElseThrow(() -> new RecursoNaoEncontradoException(
                "IMPORTACAO_NAO_ENCONTRADA", "Importação não encontrada."));
        if (i.desfeita()) {
            throw new RegraDeNegocioException("IMPORTACAO_DESFEITA", "Esta importação já foi desfeita.");
        }
        if (!intocada(i)) {
            throw new RegraDeNegocioException("IMPORTACAO_COM_MOVIMENTOS", i.tipo() == TipoImportacao.FINANCEIRO
                    ? "Algum lançamento importado já foi corrigido ou um mês fechado pela importação foi reaberto."
                    : "Algum doador importado já recebeu contribuição, nota ou alteração.");
        }
        if (i.tipo() == TipoImportacao.FINANCEIRO) {
            financeiro.desfazerImportacao(id);
            fechamento.desfazerImportados(i.mesesFechados());
        } else {
            i.criados().forEach(doadores::excluirImportado);
        }
        Autor autor = autor();
        importacoes.marcarDesfeita(id, autor);
        auditoria.registrar("IMPORTACAO_DESFEITA", ENTIDADE, id, Map.of("removidos", i.criados().size()));
        return new Importacao(id, i.tipo(), i.arquivo(), i.autor(), i.linhasTotal(), i.linhasImportadas(),
                i.criados(), i.mesesFechados(), true, autor);
    }

    private boolean intocada(Importacao i) {
        if (i.tipo() == TipoImportacao.FINANCEIRO) {
            return financeiro.importacaoIntocada(i.id()) && fechamento.importadosIntocados(i.mesesFechados());
        }
        return i.criados().stream().allMatch(d -> doadores.intocado(d)
                && !eventos.existeOutraAcao(ConsultarAuditoriaUseCase.ENTIDADE_DOADOR, String.valueOf(d),
                        ACOES_DA_IMPORTACAO));
    }

    private Analise analisar(TipoImportacao tipo, String arquivo, byte[] conteudo) {
        if (tipo == null) {
            throw ValidacaoException.doCampo("tipo", "Escolha o tipo da planilha.");
        }
        if (conteudo == null || conteudo.length == 0) {
            throw ValidacaoException.doCampo("arquivo", "Envie o arquivo.");
        }
        String nome = nomeArquivo(arquivo).toLowerCase();
        if (!nome.endsWith(".csv") && !nome.endsWith(".txt")) {
            throw ValidacaoException.doCampo("arquivo",
                    "Envie a planilha em CSV (no Excel: Arquivo › Salvar como › CSV).");
        }
        String texto = texto(conteudo);
        return tipo == TipoImportacao.FINANCEIRO
                ? analisarFinanceiro(arquivo, PlanilhaCsv.ler(texto, COLUNAS_FINANCEIRO))
                : analisarDoadores(arquivo, PlanilhaCsv.ler(texto, COLUNAS_DOADORES));
    }

    private Analise analisarFinanceiro(String arquivo, List<PlanilhaCsv.Linha> linhas) {
        List<ContaFinanceira> todasContas = contas.listar().stream().map(ContasFinanceirasUseCase.ContaComSaldo::conta)
                .filter(c -> c.tipo() != TipoConta.CARTAO_A_RECEBER).toList();
        List<CategoriaPlano> categorias = plano.listar();
        Map<String, CategoriaPlano> porCodigo = categorias.stream()
                .collect(Collectors.toMap(CategoriaPlano::codigo, c -> c));
        List<ErroLinha> erros = new ArrayList<>();
        List<LinhaFinanceira> validas = new ArrayList<>();
        Map<YearMonth, Boolean> fechados = new HashMap<>();
        for (PlanilhaCsv.Linha l : linhas) {
            int antes = erros.size();
            Optional<LocalDate> data = ValoresPlanilha.data(l.valor("data"));
            if (data.isEmpty()) {
                erros.add(new ErroLinha(l.numero(), "Data", "Informe a data como dd/mm/aaaa."));
            }
            Optional<ContaFinanceira> conta = conta(todasContas, l.valor("conta"));
            if (conta.isEmpty()) {
                erros.add(new ErroLinha(l.numero(), "Conta", l.valor("conta").isEmpty() ? "Informe a conta."
                        : "Conta \"" + l.valor("conta") + "\" não encontrada entre os caixas e contas bancárias."));
            } else if (data.isPresent() && !data.get().isBefore(conta.get().dataCorte())) {
                erros.add(new ErroLinha(l.numero(), "Data", "O histórico de " + conta.get().nome()
                        + " deve ser anterior à data de corte (" + DATA.format(conta.get().dataCorte()) + ")."));
            }
            Optional<TipoCategoria> tipo = switch (Textos.normalizar(l.valor("tipo"))) {
                case "receita" -> Optional.of(TipoCategoria.RECEITA);
                case "despesa" -> Optional.of(TipoCategoria.DESPESA);
                default -> Optional.empty();
            };
            if (tipo.isEmpty()) {
                erros.add(new ErroLinha(l.numero(), "Tipo", "Informe Receita ou Despesa."));
            }
            Optional<CategoriaPlano> sub = tipo.flatMap(t -> subcategoria(categorias, porCodigo, t, l.valor("subcategoria")));
            if (tipo.isPresent() && sub.isEmpty()) {
                erros.add(new ErroLinha(l.numero(), "Subcategoria", l.valor("subcategoria").isEmpty()
                        ? "Informe a subcategoria."
                        : "Subcategoria de " + tipo.get().name().toLowerCase() + " \"" + l.valor("subcategoria")
                                + "\" não encontrada. Use \"Categoria › Subcategoria\" do plano de contas."));
            }
            String descricao = Textos.compactar(l.valor("descricao"));
            if (descricao.isEmpty()) {
                erros.add(new ErroLinha(l.numero(), "Descrição", "Informe a descrição."));
            } else if (descricao.length() > 200) {
                erros.add(new ErroLinha(l.numero(), "Descrição", "Use no máximo 200 caracteres."));
            }
            Optional<BigDecimal> valor = ValoresPlanilha.valor(l.valor("valor")).filter(v -> v.signum() > 0);
            if (valor.isEmpty()) {
                erros.add(new ErroLinha(l.numero(), "Valor", "Informe um valor maior que zero, como 1.234,56."));
            }
            if (data.isPresent()) {
                YearMonth mes = YearMonth.from(data.get());
                if (fechados.computeIfAbsent(mes, periodos::estaFechado)) {
                    erros.add(new ErroLinha(l.numero(), "Data", "O mês " + MES.format(mes) + " já está fechado."));
                }
            }
            if (erros.size() == antes) {
                validas.add(new LinhaFinanceira(l.numero(), data.get(), conta.get(), tipo.get(), sub.get(),
                        porCodigo.get(sub.get().categoriaPai()), descricao, valor.get()));
            }
        }
        return new Analise(TipoImportacao.FINANCEIRO, nomeArquivo(arquivo), linhas.size(), erros, validas, List.of(),
                List.of());
    }

    private Analise analisarDoadores(String arquivo, List<PlanilhaCsv.Linha> linhas) {
        YearMonth atual = YearMonth.now(relogio);
        LocalDate hoje = LocalDate.now(relogio);
        List<ErroLinha> erros = new ArrayList<>();
        List<LinhaDoador> validas = new ArrayList<>();
        List<DuplicataLinha> duplicatas = new ArrayList<>();
        Map<String, Integer> telefones = new HashMap<>();
        Map<String, Integer> emails = new HashMap<>();
        Map<String, Integer> cpfs = new HashMap<>();
        for (PlanilhaCsv.Linha l : linhas) {
            int antes = erros.size();
            String nascimentoTexto = l.valor("data_de_nascimento");
            Optional<LocalDate> nascimento = nascimentoTexto.isEmpty() ? Optional.empty()
                    : ValoresPlanilha.data(nascimentoTexto);
            if (!nascimentoTexto.isEmpty() && nascimento.isEmpty()) {
                erros.add(new ErroLinha(l.numero(), "Data de nascimento", "Informe a data como dd/mm/aaaa."));
            }
            Optional<String> whatsapp = consentimento(l.valor("consentimento_whatsapp"));
            if (whatsapp.isEmpty()) {
                erros.add(new ErroLinha(l.numero(), "Consentimento WhatsApp", "Use Sim, Não ou deixe em branco."));
            }
            Optional<String> email = consentimento(l.valor("consentimento_email"));
            if (email.isEmpty()) {
                erros.add(new ErroLinha(l.numero(), "Consentimento e-mail", "Use Sim, Não ou deixe em branco."));
            }
            Optional<List<YearMonth>> pendentes = ValoresPlanilha.meses(l.valor("competencias_pendentes"));
            if (pendentes.isEmpty()) {
                erros.add(new ErroLinha(l.numero(), "Competências pendentes",
                        "Informe os meses como mm/aaaa separados por vírgula."));
            } else if (pendentes.get().stream().anyMatch(m -> m.isAfter(atual))) {
                erros.add(new ErroLinha(l.numero(), "Competências pendentes",
                        "Competências futuras não são importadas; elas são geradas mês a mês."));
            }
            DoadorImportado doador = new DoadorImportado(Textos.compactar(l.valor("nome")),
                    vazioNulo(l.valor("telefone")), vazioNulo(l.valor("email")), nascimento.orElse(null),
                    vazioNulo(Textos.apenasDigitos(l.valor("cpf"))), whatsapp.orElse("NAO_INFORMADO"),
                    email.orElse("NAO_INFORMADO"), pendentes.orElse(List.of()));
            for (ErroCampo e : doadores.validar(doador)) {
                erros.add(new ErroLinha(l.numero(), rotulo(e.campo()), e.mensagem()));
            }
            if (doador.dataNascimento() != null && doador.dataNascimento().isAfter(hoje)) {
                erros.add(new ErroLinha(l.numero(), "Data de nascimento", "A data de nascimento não pode ser futura."));
            }
            repetida(erros, l.numero(), "Telefone", Textos.apenasDigitos(doador.telefone()), telefones);
            repetida(erros, l.numero(), "E-mail", Textos.normalizar(doador.email()), emails);
            repetida(erros, l.numero(), "CPF", doador.cpf() == null ? "" : doador.cpf(), cpfs);
            if (doador.cpf() != null && erros.size() == antes && doadores.cpfEmUso(doador.cpf())) {
                erros.add(new ErroLinha(l.numero(), "CPF", "CPF já cadastrado em outro doador."));
            }
            if (erros.size() == antes) {
                validas.add(new LinhaDoador(l.numero(), doador));
                List<Duplicata> possiveis = doadores.duplicatas(doador.nome(), doador.telefone(), doador.email());
                if (!possiveis.isEmpty()) {
                    duplicatas.add(new DuplicataLinha(l.numero(), doador.nome(), possiveis));
                }
            }
        }
        return new Analise(TipoImportacao.DOADORES, nomeArquivo(arquivo), linhas.size(), erros, List.of(), validas,
                duplicatas);
    }

    private static void repetida(List<ErroLinha> erros, int linha, String coluna, String valor,
            Map<String, Integer> vistos) {
        if (valor.isEmpty()) {
            return;
        }
        Integer anterior = vistos.putIfAbsent(valor, linha);
        if (anterior != null) {
            erros.add(new ErroLinha(linha, coluna, "Repetido na linha " + anterior + " do arquivo."));
        }
    }

    private static Optional<ContaFinanceira> conta(List<ContaFinanceira> contas, String valor) {
        String n = Textos.normalizar(valor);
        if (n.isEmpty()) {
            return Optional.empty();
        }
        return contas.stream().filter(c -> Textos.normalizar(c.nome()).equals(n) || Textos.normalizar(c.codigo())
                .equals(n)).findFirst();
    }

    /** "Categoria › Subcategoria" (também com ">" ou "/") ou só a subcategoria, se for única no tipo. */
    private static Optional<CategoriaPlano> subcategoria(List<CategoriaPlano> categorias,
            Map<String, CategoriaPlano> porCodigo, TipoCategoria tipo, String valor) {
        String[] partes = valor.split("\\s*[›>/]\\s*", 2);
        List<CategoriaPlano> candidatas = categorias.stream()
                .filter(c -> c.subcategoria() && c.tipo() == tipo)
                .filter(c -> partes.length == 2
                        ? Textos.normalizar(c.nome()).equals(Textos.normalizar(partes[1]))
                                && Textos.normalizar(porCodigo.get(c.categoriaPai()).nome())
                                        .equals(Textos.normalizar(partes[0]))
                        : Textos.normalizar(c.nome()).equals(Textos.normalizar(valor)) || c.codigo().equals(valor.trim()))
                .toList();
        return candidatas.size() == 1 ? Optional.of(candidatas.get(0)) : Optional.empty();
    }

    private static Optional<String> consentimento(String valor) {
        return switch (Textos.normalizar(valor)) {
            case "" -> Optional.of("NAO_INFORMADO");
            case "sim", "s" -> Optional.of("SIM");
            case "nao", "n" -> Optional.of("NAO");
            default -> Optional.empty();
        };
    }

    private static String rotulo(String campo) {
        return switch (campo) {
            case "nome" -> "Nome";
            case "telefone", "telefones" -> "Telefone";
            case "email", "emails" -> "E-mail";
            case "cpf" -> "CPF";
            case "dataNascimento" -> "Data de nascimento";
            default -> campo;
        };
    }

    /** UTF-8 (com ou sem BOM) ou, se não for, Windows-1252 (o CSV do Excel no Windows). */
    static String texto(byte[] conteudo) {
        try {
            return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(conteudo)).toString();
        } catch (CharacterCodingException e) {
            return new String(conteudo, Charset.forName("windows-1252"));
        }
    }

    private static String nomeArquivo(String arquivo) {
        String n = arquivo == null || arquivo.isBlank() ? "planilha.csv" : arquivo.replaceAll(".*[\\\\/]", "").trim();
        return n.length() > 200 ? n.substring(n.length() - 200) : n;
    }

    private static String vazioNulo(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    private Autor autor() {
        return new Autor(usuario.getSubject(), usuario.getNome(), relogio.instant());
    }

    record LinhaFinanceira(int linha, LocalDate data, ContaFinanceira conta, TipoCategoria tipo,
            CategoriaPlano subcategoria, CategoriaPlano categoria, String descricao, BigDecimal valor) {
    }

    record LinhaDoador(int linha, DoadorImportado doador) {
    }

    private record Analise(TipoImportacao tipo, String arquivo, int linhas, List<ErroLinha> erros,
            List<LinhaFinanceira> financeiras, List<LinhaDoador> doadoresValidos, List<DuplicataLinha> duplicatas) {

        List<YearMonth> meses() {
            return List.copyOf(financeiras.stream().map(l -> YearMonth.from(l.data()))
                    .collect(Collectors.toCollection(TreeSet::new)));
        }

        Previa previa() {
            Map<String, Total> porConta = new LinkedHashMap<>();
            Map<String, Total> porCategoria = new LinkedHashMap<>();
            for (LinhaFinanceira l : financeiras.stream().sorted(Comparator.comparing(LinhaFinanceira::data)).toList()) {
                somar(porConta, l.conta().nome(), l);
                somar(porCategoria, l.categoria().nome() + " › " + l.subcategoria().nome(), l);
            }
            int competencias = doadoresValidos.stream().mapToInt(d -> d.doador().competenciasPendentes().size()).sum();
            return new Previa(tipo, arquivo, linhas, erros, ordenar(porConta), ordenar(porCategoria), meses(),
                    duplicatas, doadoresValidos.size(), competencias);
        }

        private static void somar(Map<String, Total> mapa, String nome, LinhaFinanceira l) {
            Total t = mapa.getOrDefault(nome, new Total(nome, BigDecimal.ZERO, BigDecimal.ZERO, 0));
            mapa.put(nome, l.tipo() == TipoCategoria.RECEITA
                    ? new Total(nome, t.receitas().add(l.valor()), t.despesas(), t.linhas() + 1)
                    : new Total(nome, t.receitas(), t.despesas().add(l.valor()), t.linhas() + 1));
        }

        private static List<Total> ordenar(Map<String, Total> mapa) {
            return mapa.values().stream().sorted(Comparator.comparing(Total::nome, String.CASE_INSENSITIVE_ORDER))
                    .toList();
        }
    }

    /** @param coluna nome da coluna na planilha; nulo para erro da linha inteira */
    public record ErroLinha(int linha, String coluna, String mensagem) {
    }

    public record Total(String nome, BigDecimal receitas, BigDecimal despesas, int linhas) {
    }

    public record DuplicataLinha(int linha, String nome, List<Duplicata> possiveis) {
    }

    /**
     * @param doadores      linhas de doador válidas
     * @param competencias  competências pendentes que serão criadas (fora as do mês atual)
     */
    public record Previa(TipoImportacao tipo, String arquivo, int linhas, List<ErroLinha> erros,
            List<Total> totaisPorConta, List<Total> totaisPorCategoria, List<YearMonth> mesesAFechar,
            List<DuplicataLinha> duplicatas, int doadores, int competencias) {
    }

    public record ResumoImportacao(Importacao importacao, boolean podeDesfazer) {
    }
}
