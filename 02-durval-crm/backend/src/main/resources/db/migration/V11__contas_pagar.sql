-- Contas a pagar: cadastro de despesas únicas ou recorrentes (mensais ou anuais) e o pagamento de
-- cada vencimento, que gera a despesa no Financeiro (origem CONTA_PAGAR).

CREATE TABLE conta_pagar (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    descricao              VARCHAR(200)   NOT NULL,
    favorecido             VARCHAR(200),
    categoria_codigo       VARCHAR(60)    NOT NULL REFERENCES categoria_financeira (codigo),
    valor_previsto         NUMERIC(12, 2) NOT NULL CHECK (valor_previsto > 0),
    recorrencia            VARCHAR(10)    NOT NULL CHECK (recorrencia IN ('UNICA', 'MENSAL', 'ANUAL')),
    primeiro_vencimento    DATE           NOT NULL,
    -- último dia em que ainda há vencimento; nulo = sem fim (só nas recorrentes)
    fim_recorrencia        DATE,
    conta_financeira_id    BIGINT         REFERENCES conta_financeira (id),
    observacoes            TEXT,
    ativa                  BOOLEAN        NOT NULL DEFAULT TRUE,
    CHECK (fim_recorrencia IS NULL OR fim_recorrencia >= primeiro_vencimento)
);

CREATE TABLE pagamento_conta_pagar (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conta_pagar_id         BIGINT         NOT NULL REFERENCES conta_pagar (id),
    vencimento             DATE           NOT NULL,
    pago_em                DATE           NOT NULL,
    valor                  NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
    conta_id               BIGINT         NOT NULL REFERENCES conta_financeira (id),
    conta_nome             VARCHAR(100)   NOT NULL,
    observacao             TEXT,
    lancamento_id          BIGINT         REFERENCES lancamento_financeiro (id),
    chave_idempotencia     VARCHAR(100)   NOT NULL UNIQUE,
    registrado_em          TIMESTAMPTZ    NOT NULL,
    registrado_por_subject VARCHAR(100)   NOT NULL,
    registrado_por         VARCHAR(200),
    -- preenchido quando a despesa é estornada no Financeiro (US-FINANCIAL-010): o vencimento reabre
    estornado_em           TIMESTAMPTZ
);

-- Um único pagamento válido por vencimento.
CREATE UNIQUE INDEX uk_pagamento_conta_pagar_vencimento
    ON pagamento_conta_pagar (conta_pagar_id, vencimento) WHERE estornado_em IS NULL;
