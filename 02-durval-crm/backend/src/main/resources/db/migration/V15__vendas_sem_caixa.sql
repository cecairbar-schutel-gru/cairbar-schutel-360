-- Vendas e contribuições sem caixa (decidido com o responsável pelo produto em 26/10/2026): quem pode
-- vender ou receber registra direto, e cada forma de pagamento entra na conta definida pelo
-- Administrador (dinheiro num caixa, PIX numa conta bancária, cartão em Cartão a receber). Sai a claim
-- "caixas" do Keycloak, a escolha do caixa e o fechamento de caixa. As contas do tipo CAIXA continuam,
-- como contas de dinheiro em espécie; o lançamento de cada venda e contribuição guarda a conta.

CREATE TABLE conta_recebimento (
    id                   SMALLINT     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    dinheiro_conta_id    BIGINT       REFERENCES conta_financeira (id),
    pix_conta_id         BIGINT       REFERENCES conta_financeira (id),
    atualizado_por       VARCHAR(100) NOT NULL,
    atualizado_por_nome  VARCHAR(200),
    atualizado_em        TIMESTAMPTZ  NOT NULL
);

-- Ponto de partida: o caixa e a conta bancária ativos mais usados até hoje (empate: o mais antigo).
-- O Administrador confere e troca em Financeiro › Contas.
INSERT INTO conta_recebimento (id, dinheiro_conta_id, pix_conta_id, atualizado_por, atualizado_por_nome, atualizado_em)
SELECT 1,
       (SELECT c.id FROM conta_financeira c
        WHERE c.tipo = 'CAIXA' AND c.ativa
        ORDER BY (SELECT count(*) FROM lancamento_linha_conta l WHERE l.conta_id = c.id) DESC, c.id
        LIMIT 1),
       (SELECT c.id FROM conta_financeira c
        WHERE c.tipo = 'BANCO' AND c.ativa
        ORDER BY (SELECT count(*) FROM lancamento_linha_conta l WHERE l.conta_id = c.id) DESC, c.id
        LIMIT 1),
       'sistema', 'Migração V15', now();

DROP INDEX ix_venda_caixa_data;
ALTER TABLE venda DROP COLUMN caixa_id, DROP COLUMN caixa_nome;

DROP INDEX ix_contribuicao_dia_caixa;
CREATE INDEX ix_contribuicao_dia ON contribuicao (data_financeira);
ALTER TABLE contribuicao DROP COLUMN caixa_id, DROP COLUMN caixa_nome;

DROP TABLE fechamento_caixa;
