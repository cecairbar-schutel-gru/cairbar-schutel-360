-- Pedidos de novos livros às editoras: feitos pela Tesouraria (Tesoureiro ou Administrador), sem
-- despesa (consignado se paga no repasse). O Vendedor registra a remessa contra o pedido, conferindo as
-- quantidades; cancelar essa remessa reabre o pedido.

CREATE TABLE pedido_livros (
    id                  BIGSERIAL    PRIMARY KEY,
    editora_id          BIGINT       NOT NULL REFERENCES editora (id),
    status              VARCHAR(10)  NOT NULL CHECK (status IN ('ABERTO', 'RECEBIDO', 'CANCELADO')),
    observacao          TEXT,
    pedido_em           TIMESTAMPTZ  NOT NULL,
    pedido_por          VARCHAR(200) NOT NULL,
    remessa_id          BIGINT       REFERENCES remessa (id),
    cancelado_em        TIMESTAMPTZ,
    cancelado_por       VARCHAR(200),
    motivo_cancelamento TEXT,
    CHECK ((status = 'RECEBIDO') = (remessa_id IS NOT NULL))
);

CREATE INDEX ix_pedido_livros_editora ON pedido_livros (editora_id, pedido_em DESC);
CREATE UNIQUE INDEX uk_pedido_livros_remessa ON pedido_livros (remessa_id) WHERE remessa_id IS NOT NULL;

CREATE TABLE pedido_livros_item (
    pedido_id  BIGINT  NOT NULL REFERENCES pedido_livros (id),
    produto_id BIGINT  NOT NULL REFERENCES produto (id),
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    PRIMARY KEY (pedido_id, produto_id)
);
