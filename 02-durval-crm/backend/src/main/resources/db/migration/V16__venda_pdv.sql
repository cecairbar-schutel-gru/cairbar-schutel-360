-- Vendas do PDV da cantina (perfil PDV, sem o papel Vendedor) entram no relatório de vendas e no painel
-- de todo Vendedor, além das que ele mesmo fez. A lista e o cancelamento continuam só com as próprias.

ALTER TABLE venda ADD COLUMN pdv BOOLEAN NOT NULL DEFAULT false;

-- Vendas anteriores: o log de auditoria guarda o perfil em uso na confirmação.
UPDATE venda v SET pdv = true
WHERE EXISTS (SELECT 1 FROM evento_auditoria a
              WHERE a.acao = 'VENDA_CONFIRMADA' AND a.entidade = 'VENDA'
                AND a.entidade_id = v.id::text AND a.perfil = 'pdv');

CREATE INDEX ix_venda_pdv_data ON venda (data_financeira) WHERE pdv;
