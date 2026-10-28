-- Módulo Fechamento mensal (US-CLOSING-001, 007, 008, 009 e 013): situação de cada mês, versões do
-- demonstrativo gravadas a cada fechamento e o histórico de fechamentos e reaberturas.

-- Um mês sem linha está aberto. Fechado: nenhum lançamento, movimento datado, conciliação ou
-- reclassificação pode cair nele (trava única do servidor). Reaberto: aceita lançamentos de novo até
-- passar pelo checklist e ser fechado outra vez. A confirmação das liquidações de cartão (item 5 do
-- checklist) vale para o fechamento em curso e é desfeita na reabertura.
CREATE TABLE periodo (
    mes                         DATE         PRIMARY KEY CHECK (EXTRACT(DAY FROM mes) = 1),
    status                      VARCHAR(10)  NOT NULL CHECK (status IN ('ABERTO', 'FECHADO', 'REABERTO')),
    fechado_por                 VARCHAR(100),
    fechado_por_nome            VARCHAR(200),
    fechado_em                  TIMESTAMPTZ,
    nota                        TEXT,
    reaberto_por                VARCHAR(100),
    reaberto_por_nome           VARCHAR(200),
    reaberto_em                 TIMESTAMPTZ,
    justificativa_reabertura    TEXT,
    cartao_confirmado_por       VARCHAR(100),
    cartao_confirmado_por_nome  VARCHAR(200),
    cartao_confirmado_em        TIMESTAMPTZ,
    CHECK (status <> 'FECHADO' OR fechado_em IS NOT NULL),
    CHECK (status <> 'REABERTO' OR reaberto_em IS NOT NULL)
);

-- Demonstrativo consolidado e saldos por conta no fim do mês, gravados a cada fechamento. Uma
-- reabertura seguida de novo fechamento grava a versão seguinte; as anteriores ficam guardadas.
CREATE TABLE periodo_snapshot (
    mes              DATE         NOT NULL REFERENCES periodo (mes),
    versao           INTEGER      NOT NULL CHECK (versao > 0),
    saldos_contas    JSONB        NOT NULL,
    demonstrativo    JSONB        NOT NULL,
    criado_em        TIMESTAMPTZ  NOT NULL,
    criado_por       VARCHAR(100) NOT NULL,
    criado_por_nome  VARCHAR(200),
    PRIMARY KEY (mes, versao)
);

-- Histórico do período: cada fechamento, reabertura e confirmação das liquidações de cartão.
CREATE TABLE periodo_evento (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mes            DATE         NOT NULL REFERENCES periodo (mes),
    evento         VARCHAR(20)  NOT NULL CHECK (evento IN ('FECHAMENTO', 'REABERTURA', 'CARTAO_CONFIRMADO')),
    usuario        VARCHAR(100) NOT NULL,
    usuario_nome   VARCHAR(200),
    registrado_em  TIMESTAMPTZ  NOT NULL,
    texto          TEXT,
    versao         INTEGER
);

CREATE INDEX ix_periodo_evento_mes ON periodo_evento (mes, registrado_em);
