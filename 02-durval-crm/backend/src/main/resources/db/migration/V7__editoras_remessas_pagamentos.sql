-- Módulo Editoras (US-PUBLISHER-001 a 010): cadastro da editora, remessas com código anual,
-- devoluções por remessa, pagamentos alocados às obrigações (da mais antiga para a mais nova) e a
-- transferência formal do saldo devido ao mês seguinte.

-- Editoras incluídas por SQL antes do cadastro podem não ter CNPJ; o cadastro exige.
ALTER TABLE editora
    ADD COLUMN cnpj         VARCHAR(14),
    ADD COLUMN contato_nome VARCHAR(200),
    ADD COLUMN telefone     VARCHAR(20),
    ADD COLUMN email        VARCHAR(200),
    ADD COLUMN banco        VARCHAR(100),
    ADD COLUMN agencia      VARCHAR(20),
    ADD COLUMN conta        VARCHAR(30),
    ADD COLUMN chave_pix    VARCHAR(100),
    ADD COLUMN observacoes  TEXT;

CREATE UNIQUE INDEX uk_editora_cnpj ON editora (cnpj) WHERE cnpj IS NOT NULL;

-- Itens, quantidades e percentuais não mudam depois de gravados; o erro se corrige cancelando.
ALTER TABLE remessa
    ADD COLUMN numero_documento    VARCHAR(60),
    ADD COLUMN registrada_em       TIMESTAMPTZ,
    ADD COLUMN registrada_por      VARCHAR(200),
    ADD COLUMN cancelada_em        TIMESTAMPTZ,
    ADD COLUMN cancelada_por       VARCHAR(200),
    ADD COLUMN motivo_cancelamento TEXT;

CREATE INDEX ix_remessa_editora ON remessa (editora_id, recebida_em DESC);

-- Código R-AAAA-NNNN pelo ano de recebimento (linha do ano travada na transação da remessa).
CREATE TABLE sequencia_remessa (
    ano    INTEGER PRIMARY KEY,
    ultimo INTEGER NOT NULL
);

-- Devolução de livros consignados não vendidos: só estoque, nenhum lançamento nem obrigação.
CREATE TABLE devolucao_editora (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    remessa_id             BIGINT       NOT NULL REFERENCES remessa (id),
    devolvida_em           DATE         NOT NULL,
    observacao             TEXT,
    registrada_em          TIMESTAMPTZ  NOT NULL,
    registrada_por_subject VARCHAR(100) NOT NULL,
    registrada_por         VARCHAR(200)
);

CREATE INDEX ix_devolucao_remessa ON devolucao_editora (remessa_id);

CREATE TABLE devolucao_editora_item (
    devolucao_id BIGINT  NOT NULL REFERENCES devolucao_editora (id),
    produto_id   BIGINT  NOT NULL REFERENCES produto (id),
    quantidade   INTEGER NOT NULL CHECK (quantidade > 0),
    PRIMARY KEY (devolucao_id, produto_id)
);

-- Pagamento (parcial ou total). O valor sai da conta de origem como despesa "Repasse às editoras";
-- o crédito disponível (pagamentos de obrigações estornadas) é aplicado antes, sem novo lançamento.
CREATE TABLE pagamento_editora (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    editora_id             BIGINT         NOT NULL REFERENCES editora (id),
    pago_em                DATE           NOT NULL,
    valor                  NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
    credito_aplicado       NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (credito_aplicado >= 0),
    conta_id               BIGINT         NOT NULL REFERENCES conta_financeira (id),
    conta_nome             VARCHAR(100)   NOT NULL,
    meio                   VARCHAR(15)    NOT NULL CHECK (meio IN ('PIX', 'TRANSFERENCIA', 'DINHEIRO')),
    observacao             TEXT,
    lancamento_id          BIGINT         REFERENCES lancamento_financeiro (id),
    chave_idempotencia     VARCHAR(100)   NOT NULL UNIQUE,
    registrado_em          TIMESTAMPTZ    NOT NULL,
    registrado_por_subject VARCHAR(100)   NOT NULL,
    registrado_por         VARCHAR(200),
    -- preenchido quando a despesa é estornada no Financeiro (US-FINANCIAL-010)
    estornado_em           TIMESTAMPTZ
);

CREATE INDEX ix_pagamento_editora ON pagamento_editora (editora_id, pago_em);

-- Quanto de cada pagamento (dinheiro e crédito aplicado) cobriu cada obrigação.
CREATE TABLE alocacao_pagamento_editora (
    pagamento_id BIGINT         NOT NULL REFERENCES pagamento_editora (id),
    obrigacao_id BIGINT         NOT NULL REFERENCES obrigacao_editora (id),
    valor        NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
    PRIMARY KEY (pagamento_id, obrigacao_id)
);

CREATE INDEX ix_alocacao_obrigacao ON alocacao_pagamento_editora (obrigacao_id);

-- O estorno de um pagamento que tinha coberto uma obrigação depois estornada reduz o crédito.
ALTER TABLE credito_editora DROP CONSTRAINT credito_editora_valor_check;
ALTER TABLE credito_editora ADD CONSTRAINT credito_editora_valor_check CHECK (valor <> 0);

-- Saldo devido levado conscientemente ao mês seguinte no fechamento (US-PUBLISHER-010).
CREATE TABLE transferencia_saldo_editora (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    editora_id      BIGINT         NOT NULL REFERENCES editora (id),
    mes             DATE           NOT NULL CHECK (EXTRACT(DAY FROM mes) = 1),
    valor           NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
    nota            TEXT           NOT NULL,
    usuario_subject VARCHAR(100)   NOT NULL,
    usuario_nome    VARCHAR(200),
    registrada_em   TIMESTAMPTZ    NOT NULL,
    UNIQUE (editora_id, mes)
);
