# Database — Turismo Hub

PostgreSQL 16. Banco `olimpia_turismo`. Scripts em SQL puro (sem migration tool).

## Scripts

- **`tabelas.sql`** — DDL completo. Cria tabelas e aplica `ALTER`s incrementais (colunas que foram adicionadas depois). Idempotente do zero, **não** idempotente em re-run.
- **`seed.sql`** — só o usuário admin inicial (`admin@olimpia.gov.br` / `admin123`). Usa `ON CONFLICT (email) DO NOTHING`.

No Docker, ambos são montados em `/docker-entrypoint-initdb.d/` e rodam **só na 1ª inicialização do volume `dbdata`**. Pra re-seedar:

```bash
docker compose down -v && docker compose up
```

## Setup manual

```bash
createdb -U postgres olimpia_turismo
psql -U postgres -d olimpia_turismo -f tabelas.sql
psql -U postgres -d olimpia_turismo -f seed.sql
```

## Tabelas

### `usuarios`
Login centralizado pra admin e empresário (`role` distingue).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | SERIAL PK | |
| `nome` | VARCHAR(100) | |
| `email` | VARCHAR(100) UNIQUE | |
| `senha` | VARCHAR(255) | bcrypt ou plaintext (ver backend) |
| `role` | `'admin'` ou `'empresario'` | CHECK |
| `cnpj` | VARCHAR(20) | só empresário |
| `url_booking` | TEXT | URL do hotel pro scraper |

### `formularios` / `formulario_empresa`
- `formularios(id, titulo, descricao, url_google_forms, criado_em)`
- `formulario_empresa(formulario_id, usuario_id, respondido)` — M2M com flag de respondido. **CASCADE** em ambas FKs.

### `scraping_config` / `scraping_empresas_alvo` / `scraping_logs`
- `scraping_config` — guarda **uma** regra de agendamento (o backend faz DELETE + INSERT a cada save).
- `scraping_empresas_alvo` — empresas marcadas pra serem raspadas. **CASCADE** em `empresa_id`.
- `scraping_logs` — relatórios de execução. (Não usado ainda — execução manual atual não persiste.)

### `logs_scraping`
**Tabela órfã** (não usada pelo backend). Sobrou de uma iteração anterior. Pode ser removida quando alguém quiser arrumar.

## Notas

- **Sem migrations.** Mudou o schema? Edita `tabelas.sql` e re-cria o volume. Em produção isso seria substituído por uma tool tipo Alembic / Flyway / dbmate.
- **Senha em texto puro no docker-compose**. Aceitável só pelo escopo escolar.
