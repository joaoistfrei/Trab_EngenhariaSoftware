# Backend — Turismo Hub

API REST em FastAPI (single-file: `main.py`). Conecta direto no Postgres via `psycopg2` (sem ORM), serve o admin e o empresário no mesmo `:8000`.

## Rodar local

```bash
pip install -r ../../requirements
uvicorn main:app --reload                # porta 8000
```

Precisa do Postgres ouvindo em `localhost:5432` com o banco `olimpia_turismo`. Veja [`../database/README.md`](../database/README.md).

## Rodar via Docker

```bash
docker compose up backend                # do diretório raiz
```

O Dockerfile aqui é **multi-stage**:

1. `golang:1.26-bookworm` compila o scraper Go (`/usr/local/bin/scraper` no runtime).
2. `python:3.11-slim-bookworm` instala `chromium`, deps Python, e copia `main.py` + binário.

`ENTRYPOINT` usa `tini` pra reapar zumbis do Chromium quando o chromedp deixa subprocessos pendurados.

## Variáveis de ambiente

| Variável | Default | Descrição |
|---|---|---|
| `DB_HOST` | `localhost` | host do Postgres |
| `DB_PORT` | `5432` | |
| `DB_NAME` | `olimpia_turismo` | |
| `DB_USER` | `postgres` | |
| `DB_PASSWORD` | `chimbica` | |
| `SCRAPER_BIN` | `../scraper/scraper` | caminho do binário Go |
| `CHROMIUM_PATH` | `/usr/bin/chromium` | repassado ao scraper |
| `GOOGLE_SHEET_URL` | vazio (envio desligado) | URL da planilha do Google que recebe os preços |
| `GOOGLE_CREDENTIALS_PATH` | `/run/secrets/google-service-account.json` (compose) | caminho do JSON de service account (Sheets API) |
| `SCRAPING_SCHEDULER_ATIVO` | `true` | `false`/`0`/`no` desliga a thread do agendador (útil pra rodar local sem disparos automáticos) |
| `SCRAPING_SCHEDULER_TICK_SEG` | `60` | intervalo (em segundos) entre checagens do agendador |

## Rotas (resumo)

Documentação interativa em `http://localhost:8000/docs`.

### Autenticação
- `POST /api/login` — recebe `{identificacao, senha}`. `identificacao` pode ser e-mail ou CNPJ. Retorna `{nome, role, usuario_id, email, cnpj}`. **Sem token** — o frontend guarda no `localStorage`.

### Empresas (admin)
- `POST /api/admin/cadastrar-empresa` — cria empresário, gera senha provisória e retorna em texto puro no response.
- `GET /api/admin/empresas` — lista empresários.
- `PUT /api/admin/empresas/{id}` — edita dados (nome, e-mail, CNPJ, `url_booking`).
- `PUT /api/admin/resetar-senha` — gera nova senha provisória.
- `DELETE /api/admin/empresas/{id}` — exclui (cascade nas tabelas filhas).

### Empresário
- `PUT /api/usuarios/alterar-senha` — troca a senha (verifica a atual).

### Formulários
- `POST /api/admin/formularios` — cria com lista de empresas vinculadas.
- `GET /api/formularios?usuario_id=` — sem o param lista tudo (admin); com o param devolve só os do empresário, incluindo flag `respondido`.
- `GET /api/admin/formularios/{id}/empresas` — IDs vinculados.
- `PUT /api/admin/formularios/{id}/empresas` — substitui a lista (DELETE + INSERT, sem diff).
- `GET /api/admin/formularios/{id}/status` — status por empresa.
- `PUT /api/formularios/{id}/responder` — empresário marca como concluído.
- `DELETE /api/admin/formularios/{id}` — exclui.

### Scraping (admin)
- `POST /api/admin/scraping/config` — persiste regra de agendamento + empresas alvo. A thread do scheduler relê isso a cada tick, então a mudança vale na próxima checagem (sem restart).
- `GET /api/admin/scraping/logs` — últimos 50 logs (manuais e agendados, prefixados em `detalhes` por `[Manual]` / `[Agendado]`).
- `POST /api/admin/scraping/executar` — dispara o robô **agora** pras empresas no body (ou pras configuradas, se body vazio). Roda o scraper Go em série, anexa uma linha por empresa na planilha em `GOOGLE_SHEET_URL` (se configurada) e devolve `{checkin, checkout, adultos, total, resultados:[...], planilha:{enviado, linhas, erro}}`. Veja [Integração Google Sheets](#integração-google-sheets) na raiz do repo. Retorna **409** se uma execução (manual ou agendada) já está em andamento.

## Notas que não dá pra adivinhar lendo o código

- **Senha em modo duplo.** Login e troca de senha checam `if db_senha.startswith('$2b$')` — se sim, bcrypt; se não, comparação plaintext. Permite seed legado conviver com hashes. Preserve esse branch.
- **`scraping_logs` × `logs_scraping`.** Existem as duas tabelas no schema; só `scraping_logs` é usada. Não chame a errada.
- **DB_CONFIG hardcoded com senha em texto puro.** Aceitável neste projeto escolar — não logue ou ecoe esse dict em respostas.
- **Cascade no SQL.** `formulario_empresa` e `scraping_empresas_alvo` têm `ON DELETE CASCADE`. As rotas de DELETE só apagam o pai.
- **Sheets é best-effort, nunca derruba o scraping.** `_enviar_planilha` engole exceções e devolve `{enviado:false, erro:"..."}` na resposta. Se `GOOGLE_SHEET_URL` está vazia o envio é pulado em silêncio (sem erro). Sem retries — uma falha intermitente da API perde aquela rodada; consultar `planilha.erro` na resposta.
- **Ordem das colunas é fixada em `PLANILHA_COLUNAS`.** Mudou aqui, tem que atualizar o cabeçalho da planilha (linha 1) na mesma ordem.
- **Scheduler é uma thread daemon no processo do FastAPI.** Sobe no `on_event("startup")` e tica a cada `SCRAPING_SCHEDULER_TICK_SEG` segundos (default 60). Não há coordenação entre instâncias — se você rodar 2 réplicas do backend, vão tentar disparar em paralelo. Pra essa escala (1 instância), o lock `_scraping_lock` já basta. **Dedupe é por data** (`scraping_logs.data_execucao`): nunca roda duas vezes no mesmo dia, independente da unidade configurada.
- **Decisão de "deve rodar hoje" não tem hora do dia.** A primeira vez que o tick vê uma janela válida no dia, dispara. Pra controlar horário específico precisa estender o schema (`scraping_config.hora`) — não está implementado.
