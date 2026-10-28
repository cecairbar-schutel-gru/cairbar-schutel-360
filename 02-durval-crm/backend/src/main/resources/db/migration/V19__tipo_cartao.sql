-- Crédito ou débito no pagamento em cartão (simulação de 27/10/2026, P9). A conta continua única
-- (Cartão a receber); o tipo serve ao comprovante, ao relatório de vendas e à conferência da liquidação.
-- Registros anteriores ficam sem tipo ("não informado").

ALTER TABLE venda_pagamento
    ADD COLUMN tipo_cartao VARCHAR(10) CHECK (tipo_cartao IN ('CREDITO', 'DEBITO')),
    ADD CONSTRAINT ck_venda_pagamento_tipo_cartao CHECK (tipo_cartao IS NULL OR meio = 'CARTAO');

ALTER TABLE contribuicao_pagamento
    ADD COLUMN tipo_cartao VARCHAR(10) CHECK (tipo_cartao IN ('CREDITO', 'DEBITO')),
    ADD CONSTRAINT ck_contribuicao_pagamento_tipo_cartao CHECK (tipo_cartao IS NULL OR meio = 'CARTAO');

-- Linha de Cartão a receber de vendas, contribuições, liquidações e seus estornos: o saldo a receber
-- se divide por tipo somando as linhas da conta.
ALTER TABLE lancamento_linha_conta
    ADD COLUMN tipo_cartao VARCHAR(10) CHECK (tipo_cartao IN ('CREDITO', 'DEBITO'));
