# Frontend — Turismo Hub

SPA em React 18 + Vite + React Router 7 + Tailwind v3. Sem libs de estado global: cada página é um arquivo grande que cuida do próprio `useState` e `fetch`.

## Rodar local

```bash
npm install
npm run dev                              # vite em :5173
npm run build                            # build de produção em dist/
npm run lint                             # ESLint (flat config)
```

Depende do backend em `http://localhost:8000` (hardcoded — ver "Notas").

## Rodar via Docker

```bash
docker compose up frontend               # do diretório raiz
```

O Dockerfile usa `node:20-alpine`, roda `npm ci` na build e sobe o Vite em `0.0.0.0:5173`. O compose monta o source como bind volume + volume anônimo em `/app/node_modules` (pra não pisar nas deps do container).

`CHOKIDAR_USEPOLLING=true` é setado no compose pra hot-reload pegar mudanças do bind mount.

## Estrutura

```text
src/
├── App.jsx              ← rotas (/, /admin, /empresario)
├── main.jsx             ← bootstrap
└── pages/
    ├── Login.jsx
    ├── AdminDashboard.jsx       ← arquivo grande, 3 abas: empresas, formulários, scraping
    └── EmpresarioDashboard.jsx  ← formulários + alterar senha
```

## Padrões adotados

- **Auth** vive no `localStorage` sob a chave `usuario`. O role decide o redirect. Não há guard de rota — quem souber a URL `/admin` acessa.
- **API calls** com `fetch` direto pra `http://localhost:8000`. Sem cliente HTTP custom, sem React Query.
- **Tailwind** sem componentes reutilizáveis — classes inline em cada `<div>`.
- **Idioma:** UI, identificadores e comentários em pt-BR.

## Notas que não dá pra adivinhar lendo o código

- **API URL hardcoded.** Se mudar a porta do backend, edite `fetch('http://localhost:8000/...')` em todos os arquivos. Não existe `VITE_API_URL` configurado.
- **Aba "Robô de Dados (Scraping)" no admin** dispara o backend e dá `console.log(...)` + `console.table(...)` do JSON retornado. Sem persistência — o destino futuro é uma planilha do Google Sheets.
- **Iframe do Google Forms.** O empresário responde em iframe e depois clica em "Já respondi" pra marcar como concluído manualmente. O Google Forms não tem callback nativo nesse contexto.
