-- Módulo Administração (US-ADMIN-001 a 005, 009, 012 e 021): valor da mensalidade com histórico,
-- modelos de mensagem, manutenção do plano de contas, dados da organização, log de auditoria só de
-- inserção e importação do histórico.

-- US-ADMIN-002: cada linha vale do seu mês até o mês anterior à seguinte. A primeira traz o valor
-- usado até aqui (DURVALCRM_MENSALIDADE), vigente desde a competência mais antiga.
CREATE TABLE valor_mensalidade (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    valor            NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
    vigente_de       DATE           NOT NULL UNIQUE CHECK (EXTRACT(DAY FROM vigente_de) = 1),
    motivo           TEXT,
    criado_por       VARCHAR(100)   NOT NULL,
    criado_por_nome  VARCHAR(200),
    criado_em        TIMESTAMPTZ    NOT NULL
);

INSERT INTO valor_mensalidade (valor, vigente_de, motivo, criado_por, criado_por_nome, criado_em)
SELECT ${mensalidade_inicial}, COALESCE(MIN(mes), DATE_TRUNC('month', CURRENT_DATE)::DATE),
       'Valor da instalação', 'sistema', 'Sistema', NOW()
FROM competencia;

-- US-ADMIN-003: um modelo por tipo, com o texto do WhatsApp e o assunto e corpo do e-mail.
CREATE TABLE modelo_mensagem (
    tipo                 VARCHAR(20)  PRIMARY KEY CHECK (tipo IN ('AGRADECIMENTO', 'ANIVERSARIO')),
    whatsapp             TEXT         NOT NULL,
    email_assunto        VARCHAR(200) NOT NULL,
    email_corpo          TEXT         NOT NULL,
    atualizado_por       VARCHAR(100),
    atualizado_por_nome  VARCHAR(200),
    atualizado_em        TIMESTAMPTZ
);

INSERT INTO modelo_mensagem (tipo, whatsapp, email_assunto, email_corpo) VALUES
    ('AGRADECIMENTO',
     'Olá, {nome}! Recebemos sua contribuição de {valor} em {data} ({competencias}). Recibo nº {recibo}. Muito obrigado! {organizacao}',
     'Recibo nº {recibo} — obrigado pela sua contribuição',
     E'Olá, {nome}!\n\nRecebemos sua contribuição de {valor} em {data} ({competencias}).\nRecibo nº {recibo} (em anexo).\n\nMuito obrigado!\n{organizacao}'),
    ('ANIVERSARIO',
     'Olá, {nome}! Feliz aniversário! Um abraço de todos da {organizacao}.',
     'Feliz aniversário, {nome}!',
     E'Olá, {nome}!\n\nFeliz aniversário! Um abraço de todos da {organizacao}.');

-- US-ADMIN-004: subcategorias dos fluxos automáticos são "Sistema" (renomeáveis, nunca inativadas);
-- nomes únicos dentro da categoria-mãe (as categorias entre si).
ALTER TABLE categoria_financeira ADD COLUMN sistema BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE categoria_financeira SET sistema = TRUE WHERE codigo IN (
    'RECEITAS_CONTRIBUICOES.MENSALIDADES', 'RECEITAS_CONTRIBUICOES.DOACOES_EXTRAORDINARIAS',
    'RECEITAS_CONTRIBUICOES.DOACOES_ANONIMAS', 'RECEITAS_VENDAS.LIVROS', 'RECEITAS_VENDAS.CANTINA',
    'DESPESAS_COMERCIAIS.COMPRA_CANTINA', 'DESPESAS_COMERCIAIS.REPASSE_EDITORAS', 'DESPESAS_COMERCIAIS.TAXAS_CARTAO');

CREATE UNIQUE INDEX uk_categoria_nome ON categoria_financeira (COALESCE(categoria_pai, ''), LOWER(nome));

-- US-ADMIN-005: uma única linha. Sem linha, valem os dados da configuração da instalação.
CREATE TABLE organizacao (
    id                   SMALLINT     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    razao_social         VARCHAR(200) NOT NULL,
    nome_exibicao        VARCHAR(200) NOT NULL,
    cnpj                 VARCHAR(14),
    endereco             VARCHAR(300),
    telefone             VARCHAR(20),
    email                VARCHAR(254),
    logo                 BYTEA,
    logo_tipo            VARCHAR(20)  CHECK (logo_tipo IN ('image/png', 'image/jpeg')),
    rodape_recibo        VARCHAR(300),
    atualizado_por       VARCHAR(100) NOT NULL,
    atualizado_por_nome  VARCHAR(200),
    atualizado_em        TIMESTAMPTZ  NOT NULL
);

-- US-ADMIN-009: perfil em uso e IP de cada registro; o log é só de inserção.
ALTER TABLE evento_auditoria
    ADD COLUMN perfil VARCHAR(20),
    ADD COLUMN ip     VARCHAR(45);

CREATE INDEX ix_evento_auditoria_registrado ON evento_auditoria (registrado_em DESC, id DESC);
CREATE INDEX ix_evento_auditoria_acao ON evento_auditoria (acao);
CREATE INDEX ix_evento_auditoria_autor ON evento_auditoria (autor_subject);

CREATE FUNCTION evento_auditoria_somente_insercao() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'O log de auditoria é só de inserção: % não é permitido.', TG_OP;
END;
$$;

CREATE TRIGGER tg_evento_auditoria_somente_insercao
    BEFORE UPDATE OR DELETE ON evento_auditoria
    FOR EACH ROW EXECUTE FUNCTION evento_auditoria_somente_insercao();

-- US-ADMIN-012: cada importação, com o que ela criou (para desfazer por inteiro).
CREATE TABLE importacao (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo               VARCHAR(20)  NOT NULL CHECK (tipo IN ('FINANCEIRO', 'DOADORES')),
    arquivo            VARCHAR(200) NOT NULL,
    usuario            VARCHAR(100) NOT NULL,
    usuario_nome       VARCHAR(200),
    registrada_em      TIMESTAMPTZ  NOT NULL,
    linhas_total       INTEGER      NOT NULL,
    linhas_importadas  INTEGER      NOT NULL,
    -- ids criados (lançamentos ou doadores) e meses fechados pela importação
    criados            JSONB        NOT NULL DEFAULT '[]',
    meses_fechados     JSONB        NOT NULL DEFAULT '[]',
    status             VARCHAR(20)  NOT NULL CHECK (status IN ('CONCLUIDA', 'DESFEITA')),
    desfeita_em        TIMESTAMPTZ,
    desfeita_por       VARCHAR(100),
    desfeita_por_nome  VARCHAR(200)
);

ALTER TABLE periodo_evento DROP CONSTRAINT periodo_evento_evento_check;
ALTER TABLE periodo_evento ADD CONSTRAINT periodo_evento_evento_check
    CHECK (evento IN ('FECHAMENTO', 'REABERTURA', 'CARTAO_CONFIRMADO', 'IMPORTACAO'));
