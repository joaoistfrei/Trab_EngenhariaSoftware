# Portal do Observatório de Turismo de Olímpia (Turismo Hub)

Plataforma full-stack desenvolvida para centralizar o Inventário Turístico da cidade de Olímpia. O sistema permite que o Observatório de Turismo gerencie empresas (hotéis, pousadas, restaurantes) e centralize formulários e dados de Web Scraping em um único painel de controle.

O sistema possui controle de acesso com níveis de permissão (Administrador e Empresário) e painéis customizados para cada perfil.

## 🛠️ Tecnologias Utilizadas

* **Frontend:** React, Vite, Tailwind CSS (v3), React Router DOM.
* **Backend:** Python, FastAPI, Uvicorn, Passlib + Bcrypt (Criptografia de senhas).
* **Banco de Dados:** PostgreSQL.

## 📂 Estrutura do Projeto

```text
Turismo Hub/
├── data/                   # Reservado para dados originais e processados (Scraping)
├── docs/                   # Documentação do projeto
├── src/
│   ├── backend/            # API em Python (FastAPI) e lógicas de rotas
│   ├── database/           # Scripts SQL (criação de tabelas e setup)
│   └── frontend/           # Interface visual em React e Tailwind
├── .gitignore
├── requirements.txt        # Dependências do backend Python
└── README.md
```

## 🚀 Como Executar o Projeto Localmente

O projeto é dividido em dois servidores rodando simultaneamente (Backend e Frontend).

### 1. Rodando o Backend (Python)
Abra um terminal na raiz do projeto e execute:

```bash
# Ative o seu ambiente virtual
source venv/bin/activate

# Instale as dependências
pip install -r requirements.txt

# Navegue até a pasta do backend e inicie o servidor FastAPI na porta 8000
cd src/backend
uvicorn main:app --reload
```

### 2. Rodando o Frontend (React)
Abra um **segundo terminal** e execute:

```bash
# Navegue até a pasta do frontend
cd src/frontend

# Instale as dependências do Node (apenas na primeira vez)
npm install

# Inicie o servidor do Vite
npm run dev
```

O painel estará disponível no seu navegador acessando: `http://localhost:5173/`