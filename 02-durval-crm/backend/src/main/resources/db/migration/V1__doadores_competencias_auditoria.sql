-- Módulos Doador (US-DONOR-001..012), Contribuições (competências, US-CONTRIB-001/002)
-- e Administração (log de auditoria, US-ADMIN-009).

-- Busca parcial por nome/telefone e checagem de duplicidade por similaridade de trigramas.
-- pg_trgm é extensão confiável (PostgreSQL 13+): o dono do banco pode criá-la.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE doador (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    versao               BIGINT       NOT NULL DEFAULT 0,
    nome                 VARCHAR(200) NOT NULL,
    -- nome sem acentos e minúsculo, calculado pela aplicação (equivale a lower(unaccent(nome)))
    nome_busca           VARCHAR(200) NOT NULL,
    cpf                  VARCHAR(11),
    data_nascimento      DATE,
    status               VARCHAR(20)  NOT NULL CHECK (status IN ('ATIVO', 'INATIVO', 'ANONIMIZADO')),
    endereco_cep         VARCHAR(8),
    endereco_logradouro  VARCHAR(200),
    endereco_numero      VARCHAR(20),
    endereco_complemento VARCHAR(100),
    endereco_bairro      VARCHAR(100),
    endereco_cidade      VARCHAR(100),
    endereco_uf          VARCHAR(2),
    criado_em            TIMESTAMPTZ  NOT NULL,
    inativado_em         TIMESTAMPTZ,
    motivo_inativacao    TEXT
);

CREATE UNIQUE INDEX uk_doador_cpf ON doador (cpf) WHERE cpf IS NOT NULL;
CREATE INDEX ix_doador_nome_busca_trgm ON doador USING gin (nome_busca gin_trgm_ops);
CREATE INDEX ix_doador_status ON doador (status);
CREATE INDEX ix_doador_nascimento_mes ON doador (EXTRACT(MONTH FROM data_nascimento)) WHERE status = 'ATIVO';

CREATE TABLE doador_contato (
    doador_id     BIGINT       NOT NULL REFERENCES doador (id),
    ordem         INTEGER      NOT NULL,
    tipo          VARCHAR(10)  NOT NULL CHECK (tipo IN ('TELEFONE', 'EMAIL')),
    tipo_telefone VARCHAR(10)  CHECK (tipo_telefone IN ('CELULAR', 'FIXO')),
    -- telefone só com dígitos; e-mail como informado
    valor         VARCHAR(254) NOT NULL,
    principal     BOOLEAN      NOT NULL,
    PRIMARY KEY (doador_id, ordem)
);

CREATE INDEX ix_doador_contato_valor_trgm ON doador_contato USING gin (valor gin_trgm_ops);
CREATE INDEX ix_doador_contato_email ON doador_contato (lower(valor)) WHERE tipo = 'EMAIL';
CREATE INDEX ix_doador_contato_telefone ON doador_contato (valor) WHERE tipo = 'TELEFONE';

CREATE TABLE doador_consentimento (
    doador_id      BIGINT      NOT NULL REFERENCES doador (id),
    canal          VARCHAR(10) NOT NULL CHECK (canal IN ('WHATSAPP', 'EMAIL')),
    valor          VARCHAR(15) NOT NULL CHECK (valor IN ('SIM', 'NAO', 'NAO_INFORMADO')),
    registrado_em  TIMESTAMPTZ,
    registrado_por VARCHAR(200),
    PRIMARY KEY (doador_id, canal)
);

CREATE TABLE doador_nota (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doador_id     BIGINT       NOT NULL REFERENCES doador (id),
    texto         VARCHAR(500) NOT NULL,
    autor_subject VARCHAR(100) NOT NULL,
    autor_nome    VARCHAR(200),
    criada_em     TIMESTAMPTZ  NOT NULL
);

CREATE INDEX ix_doador_nota_doador ON doador_nota (doador_id, criada_em DESC);

CREATE TABLE competencia (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doador_id      BIGINT        NOT NULL REFERENCES doador (id),
    -- primeiro dia do mês da competência
    mes            DATE          NOT NULL CHECK (EXTRACT(DAY FROM mes) = 1),
    valor          NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
    status         VARCHAR(20)   NOT NULL CHECK (status IN ('PENDENTE', 'PAGA', 'CANCELADA')),
    data_pagamento DATE,
    numero_recibo  VARCHAR(30),
    CONSTRAINT uk_competencia_doador_mes UNIQUE (doador_id, mes)
);

CREATE INDEX ix_competencia_pendente ON competencia (doador_id) WHERE status = 'PENDENTE';

-- Log de auditoria: só inserção. O vínculo com o usuário é o subject do Keycloak.
CREATE TABLE evento_auditoria (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    registrado_em TIMESTAMPTZ  NOT NULL,
    autor_subject VARCHAR(100) NOT NULL,
    autor_nome    VARCHAR(200),
    acao          VARCHAR(60)  NOT NULL,
    entidade      VARCHAR(60)  NOT NULL,
    entidade_id   VARCHAR(60)  NOT NULL,
    detalhes      JSONB        NOT NULL DEFAULT '{}'
);

CREATE INDEX ix_evento_auditoria_entidade ON evento_auditoria (entidade, entidade_id);
