-- Seed mínimo para o ambiente Docker. Roda só na 1ª inicialização do volume.
-- Senha em texto puro funciona porque o backend aceita os dois formatos
-- (bcrypt e plaintext); ela é re-hasheada quando o usuário alterar.

INSERT INTO usuarios (nome, email, senha, role, cnpj, url_booking)
VALUES ('Administrador', 'admin@olimpia.gov.br', 'admin123', 'admin', NULL, NULL)
ON CONFLICT (email) DO NOTHING;
