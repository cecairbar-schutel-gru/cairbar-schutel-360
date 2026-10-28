-- Módulo Vendas (US-SALES-001 a 021) e a base de Estoque e Editoras de que ele depende:
-- catálogo, lotes de estoque (próprio e por remessa), movimentos, remessas e obrigações com editoras.
-- Os cadastros (US-INVENTORY-001/002, US-PUBLISHER-001/003) ainda não existem: os dados entram por SQL.

CREATE TABLE editora (
    id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome  VARCHAR(200) NOT NULL,
    ativa BOOLEAN      NOT NULL DEFAULT TRUE
);

-- Livros e produtos da cantina (US-INVENTORY-001/002). O preço é o vigente; a venda guarda o seu.
CREATE TABLE produto (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo       VARCHAR(10)    NOT NULL CHECK (tipo IN ('LIVRO', 'CANTINA')),
    nome       VARCHAR(200)   NOT NULL,
    categoria  VARCHAR(60),
    autor      VARCHAR(200),
    isbn       VARCHAR(13),
    editora_id BIGINT         REFERENCES editora (id),
    preco      NUMERIC(12, 2) NOT NULL CHECK (preco > 0),
    ativo      BOOLEAN        NOT NULL DEFAULT TRUE,
    -- nome e autor minúsculos e sem acentos, para a busca da venda (US-SALES-002)
    texto_busca TEXT GENERATED ALWAYS AS (translate(lower(nome || ' ' || coalesce(autor, '')),
        'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')) STORED,
    CHECK (tipo = 'CANTINA' OR categoria IS NULL)
);

CREATE UNIQUE INDEX uk_produto_isbn ON produto (isbn) WHERE isbn IS NOT NULL;
CREATE INDEX ix_produto_texto_busca_trgm ON produto USING gin (texto_busca gin_trgm_ops);

-- Remessas de livros consignados (US-PUBLISHER-003); o percentual de repasse é fixado por item.
CREATE TABLE remessa (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo      VARCHAR(20) NOT NULL UNIQUE,
    editora_id  BIGINT      NOT NULL REFERENCES editora (id),
    recebida_em DATE        NOT NULL,
    status      VARCHAR(15) NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA', 'ENCERRADA', 'CANCELADA'))
);

CREATE TABLE remessa_item (
    remessa_id          BIGINT       NOT NULL REFERENCES remessa (id),
    produto_id          BIGINT       NOT NULL REFERENCES produto (id),
    quantidade_recebida INTEGER      NOT NULL CHECK (quantidade_recebida > 0),
    repasse_percentual  NUMERIC(5, 2) NOT NULL CHECK (repasse_percentual BETWEEN 0 AND 100),
    PRIMARY KEY (remessa_id, produto_id)
);

-- Saldo por produto e origem: um lote próprio (remessa nula) e um por remessa. Nunca negativo.
CREATE TABLE lote_estoque (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    produto_id BIGINT  NOT NULL REFERENCES produto (id),
    remessa_id BIGINT  REFERENCES remessa (id),
    quantidade INTEGER NOT NULL CHECK (quantidade >= 0)
);

CREATE UNIQUE INDEX uk_lote_proprio ON lote_estoque (produto_id) WHERE remessa_id IS NULL;
CREATE UNIQUE INDEX uk_lote_remessa ON lote_estoque (produto_id, remessa_id) WHERE remessa_id IS NOT NULL;

-- O estoque só muda por movimento, na mesma transação que atualiza o lote.
CREATE TABLE movimento_estoque (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    produto_id      BIGINT       NOT NULL REFERENCES produto (id),
    remessa_id      BIGINT       REFERENCES remessa (id),
    tipo            VARCHAR(30)  NOT NULL,
    quantidade      INTEGER      NOT NULL CHECK (quantidade <> 0),
    ocorrido_em     TIMESTAMPTZ  NOT NULL,
    usuario_subject VARCHAR(100) NOT NULL,
    referencia_tipo VARCHAR(30),
    referencia_id   BIGINT
);

CREATE INDEX ix_movimento_estoque_produto ON movimento_estoque (produto_id, ocorrido_em DESC);
CREATE INDEX ix_movimento_estoque_referencia ON movimento_estoque (referencia_tipo, referencia_id);

-- Obrigações com editoras por venda ou baixa de consignado (US-PUBLISHER-006/008).
CREATE TABLE obrigacao_editora (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    editora_id         BIGINT         NOT NULL REFERENCES editora (id),
    remessa_id         BIGINT         NOT NULL REFERENCES remessa (id),
    produto_id         BIGINT         NOT NULL REFERENCES produto (id),
    origem_tipo        VARCHAR(20)    NOT NULL CHECK (origem_tipo IN ('VENDA', 'BAIXA')),
    origem_id          BIGINT         NOT NULL,
    quantidade         INTEGER        NOT NULL CHECK (quantidade > 0),
    preco_unitario     NUMERIC(12, 2) NOT NULL,
    repasse_percentual NUMERIC(5, 2)  NOT NULL,
    valor              NUMERIC(12, 2) NOT NULL CHECK (valor >= 0),
    valor_pago         NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (valor_pago >= 0),
    status             VARCHAR(20)    NOT NULL CHECK (status IN ('ABERTA', 'PARCIALMENTE_PAGA', 'PAGA', 'ESTORNADA')),
    criada_em          TIMESTAMPTZ    NOT NULL,
    estornada_em       TIMESTAMPTZ
);

CREATE INDEX ix_obrigacao_origem ON obrigacao_editora (origem_tipo, origem_id);
CREATE INDEX ix_obrigacao_editora_aberta ON obrigacao_editora (editora_id) WHERE status IN ('ABERTA', 'PARCIALMENTE_PAGA');

-- Valor já pago de uma obrigação estornada vira crédito da editora (US-PUBLISHER-008).
CREATE TABLE credito_editora (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    editora_id   BIGINT         NOT NULL REFERENCES editora (id),
    obrigacao_id BIGINT         NOT NULL REFERENCES obrigacao_editora (id),
    valor        NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
    criado_em    TIMESTAMPTZ    NOT NULL
);

-- Vendas: a original é preservada; cancelar só muda status e dados do cancelamento.
CREATE TABLE venda (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero              BIGINT        NOT NULL UNIQUE,
    caixa_id            BIGINT        NOT NULL REFERENCES conta_financeira (id),
    caixa_nome          VARCHAR(100)  NOT NULL,
    vendedor_subject    VARCHAR(100)  NOT NULL,
    vendedor_nome       VARCHAR(200),
    confirmada_em       TIMESTAMPTZ   NOT NULL,
    data_financeira     DATE          NOT NULL,
    total               NUMERIC(12, 2) NOT NULL CHECK (total > 0),
    chave_idempotencia  VARCHAR(100)  NOT NULL UNIQUE,
    -- No máximo uma venda refaz cada venda cancelada (US-SALES-010).
    refaz_venda_id      BIGINT        UNIQUE REFERENCES venda (id),
    lancamento_id       BIGINT        REFERENCES lancamento_financeiro (id),
    status              VARCHAR(20)   NOT NULL CHECK (status IN ('CONCLUIDA', 'CANCELADA')),
    cancelada_em        TIMESTAMPTZ,
    cancelada_por       VARCHAR(200),
    motivo_cancelamento TEXT
);

CREATE INDEX ix_venda_caixa_data ON venda (caixa_id, data_financeira DESC);
CREATE INDEX ix_venda_data ON venda (data_financeira DESC, numero DESC);
CREATE INDEX ix_venda_vendedor ON venda (vendedor_subject, confirmada_em DESC);

CREATE TABLE venda_item (
    venda_id        BIGINT         NOT NULL REFERENCES venda (id),
    ordem           INTEGER        NOT NULL,
    produto_id      BIGINT         NOT NULL REFERENCES produto (id),
    produto_nome    VARCHAR(200)   NOT NULL,
    tipo            VARCHAR(10)    NOT NULL CHECK (tipo IN ('LIVRO', 'CANTINA')),
    quantidade      INTEGER        NOT NULL CHECK (quantidade > 0),
    -- preço vigente na confirmação; nunca recalculado
    preco_unitario  NUMERIC(12, 2) NOT NULL CHECK (preco_unitario > 0),
    PRIMARY KEY (venda_id, ordem)
);

-- Unidades tiradas de cada lote: o cancelamento devolve ao mesmo lote (FIFO, US-SALES-006/009).
CREATE TABLE venda_item_lote (
    venda_id           BIGINT        NOT NULL REFERENCES venda (id),
    ordem              INTEGER       NOT NULL,
    produto_id         BIGINT        NOT NULL REFERENCES produto (id),
    remessa_id         BIGINT        REFERENCES remessa (id),
    remessa_codigo     VARCHAR(20),
    quantidade         INTEGER       NOT NULL CHECK (quantidade > 0),
    repasse_percentual NUMERIC(5, 2),
    obrigacao_id       BIGINT        REFERENCES obrigacao_editora (id),
    valor_obrigacao    NUMERIC(12, 2),
    PRIMARY KEY (venda_id, ordem),
    CHECK ((remessa_id IS NULL) = (obrigacao_id IS NULL))
);

CREATE TABLE venda_pagamento (
    venda_id   BIGINT         NOT NULL REFERENCES venda (id),
    ordem      INTEGER        NOT NULL,
    meio       VARCHAR(10)    NOT NULL CHECK (meio IN ('DINHEIRO', 'PIX', 'CARTAO')),
    conta_id   BIGINT         NOT NULL REFERENCES conta_financeira (id),
    conta_nome VARCHAR(100)   NOT NULL,
    valor      NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
    PRIMARY KEY (venda_id, ordem)
);

-- Numeração sequencial das vendas, sem lacunas (linha única travada na transação da venda).
CREATE TABLE sequencia_venda (
    id     INTEGER PRIMARY KEY CHECK (id = 1),
    ultimo BIGINT  NOT NULL
);
