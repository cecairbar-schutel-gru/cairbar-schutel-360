-- US-CLOSING-014: dias de cada mês (de 1 a 7 seguidos, até o dia 28) em que o mês anterior pode ser
-- fechado. Uma única linha; sem linha, vale do dia 1 ao dia 7.
CREATE TABLE janela_fechamento (
    id                   SMALLINT     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    dia_inicio           SMALLINT     NOT NULL CHECK (dia_inicio BETWEEN 1 AND 28),
    dia_fim              SMALLINT     NOT NULL CHECK (dia_fim BETWEEN 1 AND 28),
    atualizado_por       VARCHAR(100) NOT NULL,
    atualizado_por_nome  VARCHAR(200),
    atualizado_em        TIMESTAMPTZ  NOT NULL,
    CHECK (dia_fim >= dia_inicio AND dia_fim - dia_inicio < 7)
);
