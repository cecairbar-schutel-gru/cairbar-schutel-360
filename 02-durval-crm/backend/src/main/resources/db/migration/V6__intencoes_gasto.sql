-- Módulo Intenções de gasto (US-EXPENSE-001 a 009, Jornada C): pedido do Operador, aprovação com
-- despesa automática, rejeição, desistência e, nas compras da cantina, recebimento conferido pelo
-- Vendedor com bloqueio da entrada quando diverge.

CREATE TABLE intencao_gasto (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    descricao           VARCHAR(200)   NOT NULL,
    categoria_codigo    VARCHAR(60)    NOT NULL REFERENCES categoria_financeira (codigo),
    valor_solicitado    NUMERIC(12, 2) NOT NULL CHECK (valor_solicitado > 0),
    justificativa       TEXT           NOT NULL,
    status              VARCHAR(25)    NOT NULL CHECK (status IN ('PENDENTE', 'APROVADA', 'AGUARDANDO_RECEBIMENTO',
                                                                  'DIVERGENTE', 'RECEBIDA', 'REJEITADA', 'CANCELADA')),
    solicitante         VARCHAR(100)   NOT NULL,
    solicitante_nome    VARCHAR(200),
    criada_em           TIMESTAMPTZ    NOT NULL,
    -- Destaque em "Minhas intenções" (US-EXPENSE-008).
    status_alterado_em  TIMESTAMPTZ    NOT NULL,
    -- Aprovação (US-EXPENSE-004): valores confirmados ou ajustados e a despesa gerada. Uma correção
    -- após divergência (US-EXPENSE-007) troca o valor e o lançamento; o histórico guarda os anteriores.
    valor_aprovado      NUMERIC(12, 2) CHECK (valor_aprovado > 0),
    categoria_aprovada  VARCHAR(60)    REFERENCES categoria_financeira (codigo),
    meio_pagamento      VARCHAR(15)    CHECK (meio_pagamento IN ('DINHEIRO', 'PIX', 'TRANSFERENCIA', 'BOLETO')),
    conta_id            BIGINT         REFERENCES conta_financeira (id),
    conta_nome          VARCHAR(100),
    data_pagamento      DATE,
    nota_aprovacao      TEXT,
    lancamento_id       BIGINT         REFERENCES lancamento_financeiro (id),
    -- Quem aprovou ou rejeitou.
    decidida_por        VARCHAR(100),
    decidida_por_nome   VARCHAR(200),
    decidida_em         TIMESTAMPTZ,
    motivo_rejeicao     TEXT,
    -- Recebimento da compra da cantina (US-EXPENSE-006).
    recebida_por        VARCHAR(100),
    recebida_por_nome   VARCHAR(200),
    recebida_em         TIMESTAMPTZ,
    divergencia         TEXT,
    -- Desistência do solicitante (US-EXPENSE-009) ou cancelamento após divergência (US-EXPENSE-007).
    cancelada_por       VARCHAR(100),
    cancelada_por_nome  VARCHAR(200),
    cancelada_em        TIMESTAMPTZ,
    motivo_cancelamento TEXT,
    -- Aprovada em diante tem a despesa; a cancelada após divergência guarda o lançamento estornado.
    CHECK (status IN ('PENDENTE', 'REJEITADA', 'CANCELADA')
           OR (valor_aprovado IS NOT NULL AND lancamento_id IS NOT NULL)),
    CHECK (status <> 'REJEITADA' OR motivo_rejeicao IS NOT NULL),
    CHECK (status <> 'DIVERGENTE' OR divergencia IS NOT NULL)
);

CREATE INDEX ix_intencao_status ON intencao_gasto (status, criada_em);
CREATE INDEX ix_intencao_solicitante ON intencao_gasto (solicitante, criada_em DESC);

-- Itens da compra da cantina: só o total é aprovado, nunca item a item (Spec §3).
CREATE TABLE intencao_gasto_item (
    intencao_id         BIGINT       NOT NULL REFERENCES intencao_gasto (id),
    ordem               INTEGER      NOT NULL,
    produto_id          BIGINT       NOT NULL REFERENCES produto (id),
    produto_nome        VARCHAR(200) NOT NULL,
    quantidade          INTEGER      NOT NULL CHECK (quantidade > 0),
    quantidade_recebida INTEGER      CHECK (quantidade_recebida >= 0),
    PRIMARY KEY (intencao_id, ordem),
    UNIQUE (intencao_id, produto_id)
);

-- Orçamentos e comprovantes: até 5 por intenção (PDF, JPG ou PNG de até 10 MB), sem alteração depois
-- do envio.
CREATE TABLE intencao_gasto_anexo (
    intencao_id BIGINT       NOT NULL REFERENCES intencao_gasto (id),
    ordem       INTEGER      NOT NULL CHECK (ordem BETWEEN 1 AND 5),
    nome        VARCHAR(200) NOT NULL,
    tipo        VARCHAR(50)  NOT NULL,
    tamanho     INTEGER      NOT NULL CHECK (tamanho > 0),
    conteudo    BYTEA        NOT NULL,
    enviado_em  TIMESTAMPTZ  NOT NULL,
    PRIMARY KEY (intencao_id, ordem)
);

-- Histórico da intenção: criação, decisões, recebimento, correção e cancelamento.
CREATE TABLE intencao_gasto_historico (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    intencao_id  BIGINT       NOT NULL REFERENCES intencao_gasto (id),
    evento       VARCHAR(20)  NOT NULL,
    usuario      VARCHAR(100) NOT NULL,
    usuario_nome VARCHAR(200),
    em           TIMESTAMPTZ  NOT NULL,
    descricao    TEXT         NOT NULL
);

CREATE INDEX ix_intencao_historico ON intencao_gasto_historico (intencao_id, id);

-- Última visita de cada solicitante a "Minhas intenções" (US-EXPENSE-008).
CREATE TABLE intencao_gasto_visita (
    usuario  VARCHAR(100) PRIMARY KEY,
    visto_em TIMESTAMPTZ  NOT NULL
);
