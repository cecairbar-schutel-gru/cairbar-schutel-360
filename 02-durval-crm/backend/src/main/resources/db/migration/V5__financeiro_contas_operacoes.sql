-- Módulo Financeiro (US-FINANCIAL-001 a 021): cadastro de contas com saldo inicial e data de corte,
-- natureza e autoria dos lançamentos, transferências internas, liquidação de cartão, lançamentos
-- manuais com anexo, estorno com correção, reclassificação com histórico e fechamento de caixa.

-- Cadastro de contas (US-FINANCIAL-001). Contas antigas, incluídas por SQL, ficam com saldo inicial
-- zero e data de corte no primeiro lançamento (sem lançamentos, sem restrição prática). Os valores
-- padrão existem só para cargas por SQL; a API sempre informa os dois.
ALTER TABLE conta_financeira
    ADD COLUMN localizacao   VARCHAR(100),
    ADD COLUMN banco         VARCHAR(100),
    ADD COLUMN agencia       VARCHAR(20),
    ADD COLUMN numero_conta  VARCHAR(30),
    ADD COLUMN saldo_inicial NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN data_corte    DATE;

UPDATE conta_financeira c
SET data_corte = COALESCE((
    SELECT MIN(l.data_financeira)
    FROM lancamento_linha_conta lc JOIN lancamento_financeiro l ON l.id = lc.lancamento_id
    WHERE lc.conta_id = c.id), DATE '2000-01-01');

ALTER TABLE conta_financeira
    ALTER COLUMN data_corte SET DEFAULT DATE '2000-01-01',
    ALTER COLUMN data_corte SET NOT NULL,
    -- Caixa nunca fica negativo, nem no saldo inicial.
    ADD CONSTRAINT ck_conta_caixa_saldo_inicial CHECK (tipo <> 'CAIXA' OR saldo_inicial >= 0);

-- Natureza (filtro da US-FINANCIAL-005), autor legível, motivo do estorno, vínculo com o lançamento
-- corrigido (US-FINANCIAL-010), referência da adquirente (US-FINANCIAL-004) e idempotência.
-- Lançamentos do próprio Financeiro (manual, transferência, liquidação) não têm origem_id.
ALTER TABLE lancamento_financeiro
    ALTER COLUMN origem_id DROP NOT NULL,
    ADD COLUMN natureza              VARCHAR(15),
    ADD COLUMN criado_por_nome       VARCHAR(200),
    ADD COLUMN motivo                TEXT,
    ADD COLUMN corrige_lancamento_id BIGINT REFERENCES lancamento_financeiro (id),
    ADD COLUMN referencia_externa    VARCHAR(60),
    ADD COLUMN chave_idempotencia    VARCHAR(100) UNIQUE;

UPDATE lancamento_financeiro l
SET natureza = CASE
    WHEN l.estorna_lancamento_id IS NOT NULL THEN 'ESTORNO'
    WHEN NOT EXISTS (SELECT 1 FROM lancamento_linha_categoria c WHERE c.lancamento_id = l.id) THEN 'TRANSFERENCIA'
    WHEN (SELECT SUM(c.valor) FROM lancamento_linha_categoria c WHERE c.lancamento_id = l.id) > 0 THEN 'RECEITA'
    ELSE 'DESPESA'
END;

ALTER TABLE lancamento_financeiro
    ALTER COLUMN natureza SET NOT NULL,
    ADD CONSTRAINT ck_lancamento_natureza
        CHECK (natureza IN ('RECEITA', 'DESPESA', 'TRANSFERENCIA', 'LIQUIDACAO', 'ESTORNO'));

CREATE INDEX ix_lancamento_natureza ON lancamento_financeiro (natureza, data_financeira);
CREATE INDEX ix_lancamento_criado_em ON lancamento_financeiro (criado_em DESC);
CREATE INDEX ix_lancamento_corrige ON lancamento_financeiro (corrige_lancamento_id)
    WHERE corrige_lancamento_id IS NOT NULL;

-- Conciliação bancária (US-RECONCILIATION): a linha da conta bancária aponta para a sessão que a
-- conciliou. A tabela das sessões virá com aquele módulo.
ALTER TABLE lancamento_linha_conta ADD COLUMN conciliacao_id BIGINT;

CREATE INDEX ix_linha_conta_nao_conciliada ON lancamento_linha_conta (conta_id) WHERE conciliacao_id IS NULL;
CREATE INDEX ix_linha_categoria_codigo ON lancamento_linha_categoria (categoria_codigo);

-- Anexo opcional do lançamento manual (US-FINANCIAL-009): PDF, JPG ou PNG de até 5 MB.
CREATE TABLE lancamento_anexo (
    lancamento_id BIGINT       PRIMARY KEY REFERENCES lancamento_financeiro (id),
    nome          VARCHAR(200) NOT NULL,
    tipo          VARCHAR(50)  NOT NULL,
    conteudo      BYTEA        NOT NULL
);

-- Histórico de classificação (US-FINANCIAL-021): a linha guarda a categoria atual, usada pelos
-- relatórios; cada mudança fica registrada aqui.
CREATE TABLE historico_classificacao (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lancamento_id       BIGINT       NOT NULL,
    ordem               INTEGER      NOT NULL,
    categoria_anterior  VARCHAR(60)  NOT NULL REFERENCES categoria_financeira (codigo),
    categoria_nova      VARCHAR(60)  NOT NULL REFERENCES categoria_financeira (codigo),
    alterado_por        VARCHAR(100) NOT NULL,
    alterado_por_nome   VARCHAR(200),
    alterado_em         TIMESTAMPTZ  NOT NULL,
    motivo              TEXT         NOT NULL,
    FOREIGN KEY (lancamento_id, ordem) REFERENCES lancamento_linha_categoria (lancamento_id, ordem)
);

CREATE INDEX ix_historico_classificacao ON historico_classificacao (lancamento_id, alterado_em);

-- Fechamento opcional do caixa físico (US-FINANCIAL-007): só registro, nenhum lançamento automático.
CREATE TABLE fechamento_caixa (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conta_id      BIGINT         NOT NULL REFERENCES conta_financeira (id),
    esperado      NUMERIC(12, 2) NOT NULL,
    contado       NUMERIC(12, 2) NOT NULL CHECK (contado >= 0),
    diferenca     NUMERIC(12, 2) NOT NULL,
    observacao    TEXT,
    usuario       VARCHAR(100)   NOT NULL,
    usuario_nome  VARCHAR(200),
    fechado_em    TIMESTAMPTZ    NOT NULL,
    CHECK (diferenca = contado - esperado),
    CHECK (diferenca = 0 OR observacao IS NOT NULL)
);

CREATE INDEX ix_fechamento_caixa ON fechamento_caixa (fechado_em DESC, conta_id);
