-- Chave PIX da organização para o QR Code de cobrança do PDV da cantina. A cidade é exigida pelo
-- BR Code do Banco Central (até 15 caracteres sem acentos).
ALTER TABLE organizacao
    ADD COLUMN tipo_chave_pix VARCHAR(10) CHECK (tipo_chave_pix IN ('CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA')),
    ADD COLUMN chave_pix      VARCHAR(77),
    ADD COLUMN cidade_pix     VARCHAR(60),
    ADD CONSTRAINT ck_organizacao_pix_completa CHECK (
        (tipo_chave_pix IS NULL AND chave_pix IS NULL AND cidade_pix IS NULL)
        OR (tipo_chave_pix IS NOT NULL AND chave_pix IS NOT NULL AND cidade_pix IS NOT NULL));
