-- 1. Tabela de Usuários (Controle de Acesso)
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL, -- Aqui vai o hash da senha gerado pelo Python
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'empresario'))
);

-- 2. Tabela de Formulários (Guarda os links do Google Forms)
CREATE TABLE formularios (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(150) NOT NULL,
    descricao TEXT,
    url_google_forms TEXT NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela de Vínculo (Muitos-para-Muitos: Quais empresas veem quais formulários)
CREATE TABLE formulario_empresa (
    formulario_id INT REFERENCES formularios(id) ON DELETE CASCADE,
    usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
    PRIMARY KEY (formulario_id, usuario_id)
);

-- 4. Tabela de Logs do Web Scraping (para o admin monitorar se teve erro ou não)
CREATE TABLE logs_scraping (
    id SERIAL PRIMARY KEY,
    executado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL CHECK (status IN ('sucesso', 'erro')),
    registros_coletados INT DEFAULT 0,
    mensagem_erro TEXT
);