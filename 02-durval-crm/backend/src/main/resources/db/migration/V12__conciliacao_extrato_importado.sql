-- Importação do extrato bancário (OFX ou CSV) na sessão de conciliação. O arquivo é lido no navegador;
-- o servidor guarda as linhas do período da sessão, sugere o lançamento de cada uma (mesmo valor, data
-- próxima) e liga a linha ao lançamento quando o Tesoureiro confirma o par (que fica marcado).

-- Um extrato por sessão: importar de novo substitui o anterior (as marcações ficam).
CREATE TABLE conciliacao_extrato (
    conciliacao_id      BIGINT       PRIMARY KEY REFERENCES conciliacao (id),
    arquivo             VARCHAR(255) NOT NULL,
    formato             VARCHAR(3)   NOT NULL CHECK (formato IN ('OFX', 'CSV')),
    importado_por       VARCHAR(100) NOT NULL,
    importado_por_nome  VARCHAR(200),
    importado_em        TIMESTAMPTZ  NOT NULL
);

-- Linha do extrato; "lancamento_id" é o par confirmado (um lançamento só se liga a uma linha da sessão).
-- "identificador" é o FITID do OFX, quando houver.
CREATE TABLE conciliacao_extrato_linha (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conciliacao_id      BIGINT         NOT NULL REFERENCES conciliacao_extrato (conciliacao_id) ON DELETE CASCADE,
    ordem               INT            NOT NULL,
    data                DATE           NOT NULL,
    descricao           VARCHAR(255)   NOT NULL,
    valor               NUMERIC(12, 2) NOT NULL,
    identificador       VARCHAR(255),
    lancamento_id       BIGINT REFERENCES lancamento_financeiro (id),
    conferida_por       VARCHAR(100),
    conferida_por_nome  VARCHAR(200),
    conferida_em        TIMESTAMPTZ,
    CHECK ((lancamento_id IS NULL) = (conferida_em IS NULL))
);

CREATE INDEX ix_extrato_linha_sessao ON conciliacao_extrato_linha (conciliacao_id, data, ordem);
CREATE UNIQUE INDEX uk_extrato_linha_lancamento ON conciliacao_extrato_linha (conciliacao_id, lancamento_id)
    WHERE lancamento_id IS NOT NULL;
