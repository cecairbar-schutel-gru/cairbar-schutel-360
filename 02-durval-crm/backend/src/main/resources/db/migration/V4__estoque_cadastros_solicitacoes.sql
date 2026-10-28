-- Módulo Estoque (US-INVENTORY-001 a 016): cadastros de livros e cantina, entradas por doação,
-- solicitações de baixa, preço e inativação com aprovação do Administrador, histórico de preços,
-- ajuste após contagem e histórico de movimentos com estorno.

-- Percentual de repasse padrão do título consignado, copiado para cada nova remessa (US-INVENTORY-001).
ALTER TABLE produto ADD COLUMN repasse_padrao NUMERIC(5, 2) CHECK (repasse_padrao BETWEEN 0 AND 100);

-- Quem fez o movimento (nome para o histórico) e qual movimento ele estorna.
ALTER TABLE movimento_estoque ADD COLUMN usuario_nome VARCHAR(200);
ALTER TABLE movimento_estoque ADD COLUMN estorna_movimento_id BIGINT REFERENCES movimento_estoque (id);

CREATE UNIQUE INDEX uk_movimento_estornado ON movimento_estoque (estorna_movimento_id)
    WHERE estorna_movimento_id IS NOT NULL;
CREATE INDEX ix_movimento_estoque_tipo ON movimento_estoque (tipo, ocorrido_em DESC);

-- Entrada de produtos doados (US-INVENTORY-006); os itens são os movimentos que ela gerou.
CREATE TABLE entrada_doacao (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    observacao          VARCHAR(200),
    registrada_em       TIMESTAMPTZ  NOT NULL,
    registrada_por      VARCHAR(100) NOT NULL,
    registrada_por_nome VARCHAR(200),
    cancelada_em        TIMESTAMPTZ,
    cancelada_por_nome  VARCHAR(200),
    motivo_cancelamento TEXT
);

-- Histórico de preços de livros e cantina (US-INVENTORY-012/013); vendas passadas nunca mudam.
CREATE TABLE historico_preco (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    produto_id      BIGINT         NOT NULL REFERENCES produto (id),
    preco_anterior  NUMERIC(12, 2) NOT NULL,
    preco_novo      NUMERIC(12, 2) NOT NULL CHECK (preco_novo > 0),
    alterado_em     TIMESTAMPTZ    NOT NULL,
    solicitado_por  VARCHAR(200),
    aprovado_por    VARCHAR(200)   NOT NULL,
    motivo          TEXT           NOT NULL
);

CREATE INDEX ix_historico_preco_produto ON historico_preco (produto_id, alterado_em DESC);

-- Pedidos do Vendedor decididos pelo Administrador (US-INVENTORY-007/011/014).
CREATE TABLE solicitacao_estoque (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo               VARCHAR(15)    NOT NULL CHECK (tipo IN ('BAIXA', 'PRECO', 'INATIVACAO')),
    produto_id         BIGINT         NOT NULL REFERENCES produto (id),
    remessa_id         BIGINT         REFERENCES remessa (id),
    quantidade         INTEGER        CHECK (quantidade > 0),
    motivo_baixa       VARCHAR(15)    CHECK (motivo_baixa IN ('VENCIMENTO', 'DANO', 'EXTRAVIO')),
    preco_atual        NUMERIC(12, 2),
    novo_preco         NUMERIC(12, 2) CHECK (novo_preco > 0),
    justificativa      TEXT           NOT NULL,
    foto               BYTEA,
    foto_tipo          VARCHAR(20),
    status             VARCHAR(15)    NOT NULL CHECK (status IN ('PENDENTE', 'APROVADA', 'REJEITADA', 'CANCELADA')),
    solicitante        VARCHAR(100)   NOT NULL,
    solicitante_nome   VARCHAR(200),
    solicitada_em      TIMESTAMPTZ    NOT NULL,
    decidida_por       VARCHAR(100),
    decidida_por_nome  VARCHAR(200),
    decidida_em        TIMESTAMPTZ,
    motivo_decisao     TEXT,
    CHECK (tipo <> 'BAIXA' OR (quantidade IS NOT NULL AND motivo_baixa IS NOT NULL)),
    CHECK (tipo <> 'PRECO' OR novo_preco IS NOT NULL)
);

CREATE INDEX ix_solicitacao_status ON solicitacao_estoque (status, solicitada_em);
CREATE INDEX ix_solicitacao_solicitante ON solicitacao_estoque (solicitante, solicitada_em DESC);
-- Um pedido pendente de preço (e um de inativação) por produto de cada vez.
CREATE UNIQUE INDEX uk_solicitacao_pendente ON solicitacao_estoque (produto_id, tipo)
    WHERE status = 'PENDENTE' AND tipo IN ('PRECO', 'INATIVACAO');
