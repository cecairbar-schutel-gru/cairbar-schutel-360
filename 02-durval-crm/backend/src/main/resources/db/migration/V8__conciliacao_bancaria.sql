-- Módulo Conciliação bancária (US-RECONCILIATION-001 a 010): sessões por conta bancária, marcações
-- feitas durante a sessão e lançamentos pendentes (diferenças de prazo) gravados na conclusão.

-- Subcategorias de Outras despesas previstas no plano de contas inicial (Spec §5); Taxas bancárias é a
-- sugestão do lançamento ausente na conciliação (US-RECONCILIATION-005).
INSERT INTO categoria_financeira (codigo, nome, tipo, categoria_pai) VALUES
    ('OUTRAS_DESPESAS.TAXAS_BANCARIAS', 'Taxas bancárias', 'DESPESA', 'OUTRAS_DESPESAS'),
    ('OUTRAS_DESPESAS.OUTRAS_SAIDAS', 'Outras saídas', 'DESPESA', 'OUTRAS_DESPESAS')
ON CONFLICT (codigo) DO NOTHING;

-- Sessão: uma conta bancária até a data final do extrato. O saldo de abertura é o saldo do extrato da
-- sessão concluída anterior (ou o saldo inicial da conta, na primeira).
CREATE TABLE conciliacao (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conta_id            BIGINT         NOT NULL REFERENCES conta_financeira (id),
    data_fim            DATE           NOT NULL,
    saldo_extrato       NUMERIC(12, 2) NOT NULL,
    saldo_abertura      NUMERIC(12, 2) NOT NULL,
    status              VARCHAR(15)    NOT NULL CHECK (status IN ('EM_ANDAMENTO', 'CONCLUIDA')),
    iniciada_por        VARCHAR(100)   NOT NULL,
    iniciada_por_nome   VARCHAR(200),
    iniciada_em         TIMESTAMPTZ    NOT NULL,
    concluida_por       VARCHAR(100),
    concluida_por_nome  VARCHAR(200),
    concluida_em        TIMESTAMPTZ,
    CHECK ((status = 'CONCLUIDA') = (concluida_em IS NOT NULL))
);

-- Só uma sessão em andamento por conta; o checklist do fechamento lê max(data_fim) das concluídas.
CREATE UNIQUE INDEX uk_conciliacao_em_andamento ON conciliacao (conta_id) WHERE status = 'EM_ANDAMENTO';
CREATE INDEX ix_conciliacao_conta ON conciliacao (conta_id, data_fim DESC);

-- A linha da conta bancária aponta para a sessão que a conciliou (preenchido na conclusão: definitivo).
ALTER TABLE lancamento_linha_conta
    ADD CONSTRAINT fk_linha_conta_conciliacao FOREIGN KEY (conciliacao_id) REFERENCES conciliacao (id);

-- Marcações da sessão, gravadas a cada clique (quem e quando). "adicionado": lançamento registrado
-- na própria tela da conciliação. Um lançamento só é conciliado uma vez em cada conta.
CREATE TABLE conciliacao_item (
    conciliacao_id    BIGINT         NOT NULL REFERENCES conciliacao (id),
    lancamento_id     BIGINT         NOT NULL REFERENCES lancamento_financeiro (id),
    conta_id          BIGINT         NOT NULL REFERENCES conta_financeira (id),
    valor             NUMERIC(12, 2) NOT NULL,
    marcado_por       VARCHAR(100)   NOT NULL,
    marcado_por_nome  VARCHAR(200),
    marcado_em        TIMESTAMPTZ    NOT NULL,
    adicionado        BOOLEAN        NOT NULL DEFAULT FALSE,
    PRIMARY KEY (conciliacao_id, lancamento_id)
);

CREATE UNIQUE INDEX uk_conciliacao_item_lancamento ON conciliacao_item (lancamento_id, conta_id);

-- Lançamentos até a data final que ficaram sem marcar na conclusão ("pendentes": diferenças de
-- prazo). Continuam não conciliados e aparecem na próxima sessão.
CREATE TABLE conciliacao_pendente (
    conciliacao_id BIGINT         NOT NULL REFERENCES conciliacao (id),
    lancamento_id  BIGINT         NOT NULL REFERENCES lancamento_financeiro (id),
    valor          NUMERIC(12, 2) NOT NULL,
    PRIMARY KEY (conciliacao_id, lancamento_id)
);
