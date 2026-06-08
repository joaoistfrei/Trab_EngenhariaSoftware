# Turismo Hub

Portal do **Observatório de Turismo de Olímpia**. Centraliza o inventário turístico da cidade: o admin gerencia empresas (hotéis, pousadas, restaurantes), distribui formulários do Google Forms e dispara o robô de web scraping que coleta o preço da diária dos hotéis no Booking.

Controle de acesso em dois níveis (**admin** e **empresário**) com painéis dedicados.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, Vite 5, React Router 7, Tailwind v3 |
| Backend | Python 3.11, FastAPI, Uvicorn, psycopg2, Passlib + Bcrypt |
| Banco | PostgreSQL 16 |
| Scraper | Go 1.26, chromedp (Chromium headless) |
| Orquestração | Docker Compose |

## Estrutura

```text
.
├── docker-compose.yml          ← orquestra db + backend + frontend
├── requirements                ← deps Python (note: sem .txt)
├── data/                       ← reservado pra outputs do scraping
├── docs/
└── src/
    ├── backend/                ← FastAPI single-file (main.py) + Dockerfile
    ├── frontend/               ← Vite/React + Dockerfile
    ├── scraper/                ← CLI Go que raspa o Booking
    └── database/               ← tabelas.sql + seed.sql
```

Cada serviço tem seu próprio README com detalhes:

- [`src/backend/README.md`](src/backend/README.md)
- [`src/frontend/README.md`](src/frontend/README.md)
- [`src/scraper/README.md`](src/scraper/README.md)
- [`src/database/README.md`](src/database/README.md)

## Subindo com Docker (recomendado)

Pré-requisitos: `docker` + plugin `docker compose` (em Arch: `sudo pacman -S docker-compose`).

```bash
docker compose up --build
```

Sobe 3 containers:

- **db** (`turismo-db`) — Postgres 16, porta `5432`, com `tabelas.sql` e `seed.sql` rodados na 1ª inicialização do volume.
- **backend** (`turismo-backend`) — FastAPI em `http://localhost:8000`. Imagem multi-stage: stage Go compila o scraper, stage Python embala FastAPI + Chromium + o binário. `shm_size=1gb` porque o Chromium odeia `/dev/shm` pequeno. Hot-reload via `--reload` + bind mount do source.
- **frontend** (`turismo-frontend`) — Vite dev server em `http://localhost:5173` com hot-reload.

**Login inicial:** `admin@olimpia.gov.br` / `admin123` (vem do `seed.sql`).

### Comandos úteis

```bash
docker compose up -d --build         # destacado
docker compose logs -f backend       # acompanhar logs
docker compose ps                    # status dos serviços
docker compose down                  # parar (mantém o banco)
docker compose down -v               # parar e ZERAR o banco (re-roda seed)
docker compose exec backend bash     # shell no backend
docker compose exec db psql -U postgres -d olimpia_turismo
```

## Subindo manualmente (sem Docker)

Útil pra debug rápido. Cada serviço tem instruções completas no seu próprio README — aqui só o resumo.

```bash
# 1. Postgres já rodando em localhost:5432 com a base olimpia_turismo criada
psql -U postgres -d olimpia_turismo -f src/database/tabelas.sql

# 2. Backend
pip install -r requirements
cd src/backend && uvicorn main:app --reload

# 3. Frontend
cd src/frontend && npm install && npm run dev

# 4. Scraper (opcional — o backend chama via subprocess)
cd src/scraper && go build -o scraper .
```

O backend lê o caminho do binário em `SCRAPER_BIN` (env), com fallback pra `src/scraper/scraper`.

## Variáveis de ambiente

Todas têm fallback pros valores de dev. Só precisa setar em Docker / produção.

| Variável | Default | Onde |
|---|---|---|
| `DB_HOST` | `localhost` | backend |
| `DB_PORT` | `5432` | backend |
| `DB_NAME` | `olimpia_turismo` | backend |
| `DB_USER` | `postgres` | backend |
| `DB_PASSWORD` | `chimbica` | backend |
| `SCRAPER_BIN` | `../scraper/scraper` (relativo a `main.py`) | backend |
| `CHROMIUM_PATH` | `/usr/bin/chromium` | scraper (Go) |
| `GOOGLE_SHEET_URL` | vazio (envio desligado) | backend — URL da planilha que recebe os preços |
| `GOOGLE_CREDENTIALS_PATH` | `/run/secrets/google-service-account.json` (no compose) | backend — caminho do JSON do service account |

## Integração com Google Sheets

Após cada execução do robô (`POST /api/admin/scraping/executar`), o backend anexa uma linha por empresa no fim da planilha apontada por `GOOGLE_SHEET_URL`. A linha 1 da planilha é tratada como cabeçalho — o append começa na primeira linha vazia, então o header fica intocado.

**Cabeçalho esperado** (linha 1, nesta ordem):

`Data execução | ID empresa | Nome empresa | URL hotel | Check-in | Check-out | Adultos | Moeda | Preço diária | Preço total | Preço bruto | Observação | Sucesso | Erro`

**Setup (uma vez):**

1. No [Google Cloud Console](https://console.cloud.google.com/) crie um projeto, habilite a **Google Sheets API** e crie um **Service Account**. Gere uma chave JSON e baixe.
2. Salve esse JSON em `./secrets/google-service-account.json` na raiz do repo (o diretório está gitignored).
3. Abra sua planilha no Google Sheets → **Compartilhar** → adicione o `client_email` do JSON como **Editor**.
4. Configure a URL da planilha em `GOOGLE_SHEET_URL`:
   - **Docker:** edite o `docker-compose.yml` e troque `GOOGLE_SHEET_URL: ""` pela URL da sua planilha.
   - **Local (sem Docker):** exporte no shell antes de subir o uvicorn — `export GOOGLE_SHEET_URL="https://docs.google.com/spreadsheets/d/..."`.
5. Suba o backend (`docker compose up` ou `uvicorn ...`) — a resposta de `POST /api/admin/scraping/executar` mostra `planilha.enviado: true` se deu certo.

Se `GOOGLE_SHEET_URL` ficar vazia, o envio é silenciosamente pulado e o scraping segue normal — útil pra dev local sem configurar nada.

## Limitações conhecidas

- **Sem autenticação por token.** O login só devolve o usuário e o frontend confia no `localStorage`. Rotas "admin" são confiadas no cliente. Projeto escolar — não usar em produção sem revisar.
- **Senhas em modo duplo.** O backend aceita bcrypt e texto puro lado a lado (suporta dados legados). Senhas alteradas pelo usuário são re-hasheadas em bcrypt.
- **CORS travado em `http://localhost:5173`.** Mudou a porta do frontend? Edita `src/backend/main.py`.
- **Sem testes automatizados.**
- **Scraper depende do layout do Booking.** Se o HTML mudar, os regex do extrator quebram.

## Próximos passos

- Scheduler real pro robô (hoje só dispara via botão "Executar Agora").
- Build de produção do frontend (nginx) + deploy.

## Licença

Projeto acadêmico — uso livre.
