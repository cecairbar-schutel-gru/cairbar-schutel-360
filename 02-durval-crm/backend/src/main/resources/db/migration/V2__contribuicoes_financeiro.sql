-- Módulo Contribuições (US-CONTRIB-001 a 021) e a base do Financeiro de que ele depende:
-- plano de contas inicial, contas financeiras e lançamentos com linhas de conta e de categoria.

-- Plano de contas (Spec §5, US-ADMIN-004): categoria + um nível de subcategoria.
CREATE TABLE categoria_financeira (
    codigo          VARCHAR(60)  PRIMARY KEY,
    nome            VARCHAR(100) NOT NULL,
    tipo            VARCHAR(10)  NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
    categoria_pai   VARCHAR(60)  REFERENCES categoria_financeira (codigo),
    ativa           BOOLEAN      NOT NULL DEFAULT TRUE
);

INSERT INTO categoria_financeira (codigo, nome, tipo, categoria_pai) VALUES
    ('RECEITAS_CONTRIBUICOES', 'Receitas de contribuições', 'RECEITA', NULL),
    ('RECEITAS_CONTRIBUICOES.MENSALIDADES', 'Mensalidades', 'RECEITA', 'RECEITAS_CONTRIBUICOES'),
    ('RECEITAS_CONTRIBUICOES.DOACOES_EXTRAORDINARIAS', 'Doações extraordinárias', 'RECEITA', 'RECEITAS_CONTRIBUICOES'),
    ('RECEITAS_CONTRIBUICOES.DOACOES_ANONIMAS', 'Doações anônimas', 'RECEITA', 'RECEITAS_CONTRIBUICOES'),
    ('RECEITAS_VENDAS', 'Receitas de vendas', 'RECEITA', NULL),
    ('RECEITAS_VENDAS.LIVROS', 'Livros', 'RECEITA', 'RECEITAS_VENDAS'),
    ('RECEITAS_VENDAS.CANTINA', 'Cantina', 'RECEITA', 'RECEITAS_VENDAS'),
    ('OUTRAS_RECEITAS', 'Outras receitas', 'RECEITA', NULL),
    ('OUTRAS_RECEITAS.OUTRAS_ENTRADAS', 'Outras entradas', 'RECEITA', 'OUTRAS_RECEITAS'),
    ('DESPESAS_OPERACIONAIS', 'Despesas operacionais', 'DESPESA', NULL),
    ('DESPESAS_OPERACIONAIS.ENERGIA_ELETRICA', 'Energia elétrica', 'DESPESA', 'DESPESAS_OPERACIONAIS'),
    ('DESPESAS_OPERACIONAIS.AGUA', 'Água', 'DESPESA', 'DESPESAS_OPERACIONAIS'),
    ('DESPESAS_OPERACIONAIS.INTERNET', 'Internet', 'DESPESA', 'DESPESAS_OPERACIONAIS'),
    ('DESPESAS_OPERACIONAIS.MANUTENCAO_CONSERVACAO', 'Manutenção e conservação', 'DESPESA', 'DESPESAS_OPERACIONAIS'),
    ('DESPESAS_OPERACIONAIS.MATERIAL_LIMPEZA', 'Material de limpeza', 'DESPESA', 'DESPESAS_OPERACIONAIS'),
    ('DESPESAS_OPERACIONAIS.MATERIAIS_CONSUMO', 'Materiais de consumo', 'DESPESA', 'DESPESAS_OPERACIONAIS'),
    ('DESPESAS_COMERCIAIS', 'Despesas comerciais', 'DESPESA', NULL),
    ('DESPESAS_COMERCIAIS.COMPRA_CANTINA', 'Compra de produtos da cantina', 'DESPESA', 'DESPESAS_COMERCIAIS'),
    ('DESPESAS_COMERCIAIS.REPASSE_EDITORAS', 'Repasse às editoras', 'DESPESA', 'DESPESAS_COMERCIAIS'),
    ('DESPESAS_COMERCIAIS.TAXAS_CARTAO', 'Taxas de cartão', 'DESPESA', 'DESPESAS_COMERCIAIS'),
    ('OUTRAS_DESPESAS', 'Outras despesas', 'DESPESA', NULL),
    ('OUTRAS_DESPESAS.EVENTOS', 'Despesas com eventos', 'DESPESA', 'OUTRAS_DESPESAS');

-- Caixas, bancos e Cartão a receber (US-FINANCIAL-001). Para caixas, o código é o id da claim
-- "caixas" do Keycloak. Caixas e bancos são cadastrados pelo Tesoureiro; Cartão a receber é único.
CREATE TABLE conta_financeira (
    id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo  VARCHAR(60)  NOT NULL UNIQUE,
    nome    VARCHAR(100) NOT NULL,
    tipo    VARCHAR(20)  NOT NULL CHECK (tipo IN ('CAIXA', 'BANCO', 'CARTAO_A_RECEBER')),
    ativa   BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX uk_conta_cartao_a_receber ON conta_financeira (tipo) WHERE tipo = 'CARTAO_A_RECEBER';

INSERT INTO conta_financeira (codigo, nome, tipo) VALUES ('cartao-a-receber', 'Cartão a receber', 'CARTAO_A_RECEBER');

-- Lançamentos: nunca editados nem excluídos; correções por estorno (estorna_lancamento_id).
CREATE TABLE lancamento_financeiro (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    data_financeira       DATE         NOT NULL,
    origem_tipo           VARCHAR(30)  NOT NULL,
    origem_id             BIGINT       NOT NULL,
    descricao             VARCHAR(200) NOT NULL,
    criado_por            VARCHAR(100) NOT NULL,
    criado_em             TIMESTAMPTZ  NOT NULL,
    estorna_lancamento_id BIGINT       UNIQUE REFERENCES lancamento_financeiro (id)
);

CREATE INDEX ix_lancamento_origem ON lancamento_financeiro (origem_tipo, origem_id);
CREATE INDEX ix_lancamento_data ON lancamento_financeiro (data_financeira);

CREATE TABLE lancamento_linha_conta (
    lancamento_id BIGINT        NOT NULL REFERENCES lancamento_financeiro (id),
    ordem         INTEGER       NOT NULL,
    conta_id      BIGINT        NOT NULL REFERENCES conta_financeira (id),
    valor         NUMERIC(12, 2) NOT NULL CHECK (valor <> 0),
    PRIMARY KEY (lancamento_id, ordem)
);

CREATE INDEX ix_lancamento_linha_conta ON lancamento_linha_conta (conta_id);

CREATE TABLE lancamento_linha_categoria (
    lancamento_id    BIGINT        NOT NULL REFERENCES lancamento_financeiro (id),
    ordem            INTEGER       NOT NULL,
    categoria_codigo VARCHAR(60)   NOT NULL REFERENCES categoria_financeira (codigo),
    valor            NUMERIC(12, 2) NOT NULL CHECK (valor <> 0),
    PRIMARY KEY (lancamento_id, ordem)
);

-- Contribuições: o registro original é preservado; cancelar só muda status e dados do cancelamento.
CREATE TABLE contribuicao (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo                VARCHAR(30)   NOT NULL CHECK (tipo IN ('MENSALIDADE', 'DOACAO_EXTRAORDINARIA', 'DOACAO_ANONIMA')),
    doador_id           BIGINT        REFERENCES doador (id),
    valor_doacao        NUMERIC(12, 2) NOT NULL CHECK (valor_doacao >= 0),
    total               NUMERIC(12, 2) NOT NULL CHECK (total > 0),
    observacao          VARCHAR(200),
    caixa_id            BIGINT        NOT NULL REFERENCES conta_financeira (id),
    caixa_nome          VARCHAR(100)  NOT NULL,
    operador_subject    VARCHAR(100)  NOT NULL,
    operador_nome       VARCHAR(200),
    recebida_em         TIMESTAMPTZ   NOT NULL,
    data_financeira     DATE          NOT NULL,
    numero_recibo       VARCHAR(20)   NOT NULL UNIQUE,
    chave_idempotencia  VARCHAR(100)  NOT NULL UNIQUE,
    lancamento_id       BIGINT        REFERENCES lancamento_financeiro (id),
    status              VARCHAR(20)   NOT NULL CHECK (status IN ('REGISTRADA', 'CANCELADA')),
    cancelada_em        TIMESTAMPTZ,
    cancelada_por       VARCHAR(200),
    motivo_cancelamento TEXT,
    -- Doação anônima não se vincula a doador.
    CHECK ((tipo = 'DOACAO_ANONIMA') = (doador_id IS NULL))
);

CREATE INDEX ix_contribuicao_doador ON contribuicao (doador_id, data_financeira DESC);
CREATE INDEX ix_contribuicao_dia_caixa ON contribuicao (data_financeira, caixa_id);
CREATE INDEX ix_contribuicao_operador ON contribuicao (operador_subject, recebida_em DESC);

CREATE TABLE contribuicao_competencia (
    contribuicao_id BIGINT        NOT NULL REFERENCES contribuicao (id),
    ordem           INTEGER       NOT NULL,
    mes             DATE          NOT NULL CHECK (EXTRACT(DAY FROM mes) = 1),
    valor           NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
    PRIMARY KEY (contribuicao_id, ordem)
);

CREATE TABLE contribuicao_pagamento (
    contribuicao_id BIGINT        NOT NULL REFERENCES contribuicao (id),
    ordem           INTEGER       NOT NULL,
    meio            VARCHAR(10)   NOT NULL CHECK (meio IN ('DINHEIRO', 'PIX', 'CARTAO')),
    conta_id        BIGINT        NOT NULL REFERENCES conta_financeira (id),
    conta_nome      VARCHAR(100)  NOT NULL,
    valor           NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
    PRIMARY KEY (contribuicao_id, ordem)
);

ALTER TABLE competencia
    ADD COLUMN contribuicao_id     BIGINT  REFERENCES contribuicao (id),
    ADD COLUMN criada_no_pagamento BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX ix_competencia_contribuicao ON competencia (contribuicao_id) WHERE contribuicao_id IS NOT NULL;

-- Numeração anual dos recibos ("2026-000123"), sem lacunas.
CREATE TABLE sequencia_recibo (
    ano    INTEGER PRIMARY KEY,
    ultimo INTEGER NOT NULL
);

-- Execuções da geração mensal (US-CONTRIB-001): idempotência e aviso de falha nos painéis.
CREATE TABLE execucao_geracao_competencias (
    mes              DATE        PRIMARY KEY CHECK (EXTRACT(DAY FROM mes) = 1),
    situacao         VARCHAR(10) NOT NULL CHECK (situacao IN ('SUCESSO', 'FALHA')),
    tentativas       INTEGER     NOT NULL,
    ultima_tentativa TIMESTAMPTZ NOT NULL,
    criadas          INTEGER     NOT NULL,
    duracao_ms       BIGINT      NOT NULL,
    erro             TEXT
);
