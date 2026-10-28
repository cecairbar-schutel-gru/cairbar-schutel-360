-- Subcategorias de Despesas operacionais citadas como exemplo no cadastro de contas a pagar (simulação
-- de 27/10/2026, P15). Sem conflito com uma subcategoria de mesmo código ou nome já criada pelo Administrador.
INSERT INTO categoria_financeira (codigo, nome, tipo, categoria_pai) VALUES
    ('DESPESAS_OPERACIONAIS.ALUGUEL', 'Aluguel', 'DESPESA', 'DESPESAS_OPERACIONAIS'),
    ('DESPESAS_OPERACIONAIS.SEGURO', 'Seguro', 'DESPESA', 'DESPESAS_OPERACIONAIS')
ON CONFLICT DO NOTHING;
