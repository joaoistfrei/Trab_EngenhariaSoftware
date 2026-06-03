# Scraper — Turismo Hub

CLI em Go que raspa o preço da diária de um hotel no **Booking.com** e cospe JSON no stdout. Chamado pelo backend via `subprocess`.

## Por que Go + chromedp?

O Booking **não tem API pública anônima** e protege as páginas de hotel com **AWS WAF challenge** (JavaScript). HTTP cliente puro (Go `net/http`, Python `requests`) é detectado e bloqueado.

`chromedp` controla um **Chromium real** via DevTools — o challenge é resolvido pelo próprio browser. É o caminho menos pior pra raspar essas páginas hoje.

## Build / Run

```bash
go build -o scraper .                    # binário standalone
./scraper -url "https://www.booking.com/hotel/br/exemplo.pt-br.html"
# ou:
go run . -hotel "Hotel Plaza Olimpia"
```

## Flags

| Flag | Default | Descrição |
|---|---|---|
| `-url` | — | URL direta do hotel (preferido). |
| `-hotel` | — | Nome pra busca; pega o 1º resultado `/hotel/` da SERP. |
| `-checkin` | amanhã | `YYYY-MM-DD`. |
| `-checkout` | check-in + 1 | `YYYY-MM-DD`. |
| `-adultos` | `2` | |
| `-timeout` | `60` | Em segundos. Cobre todas as tentativas. |
| `-chromium` | `$CHROMIUM_PATH` ou auto | Caminho do binário Chromium/Chrome. |
| `-v` | `false` | Log de progresso no stderr. |

`-url` **ou** `-hotel` — um dos dois é obrigatório.

## Comportamento

- **Headless `new`** (Chromium 109+) — o headless clássico (`true`) é detectado pelo WAF e fica preso no challenge.
- **Datas indisponíveis viram retry.** Se a página devolver "Not available" pras datas pedidas, o scraper soma 1 dia em `checkin` e `checkout` (preservando o número de noites) e tenta de novo. Até 30 tentativas no mesmo browser. A saída inclui `observacao` quando a data foi ajustada.
- **Indisponibilidade total** (após 30 tentativas) → exit 1 + JSON com `observacao` explicando.
- **Sucesso** → exit 0 + JSON completo.

### Exemplo de saída

```json
{
  "nome": "Hotel Plaza Olimpia",
  "url_hotel": "https://www.booking.com/hotel/br/exemplo.pt-br.html?...",
  "checkin": "2026-06-04",
  "checkout": "2026-06-05",
  "adultos": 2,
  "moeda": "R$",
  "preco_total": "450,00",
  "preco_diaria": "450,00",
  "preco_bruto": "R$ 450,00",
  "observacao": "data ajustada: solicitado 2026-06-01 → 2026-06-02, disponível a partir de 2026-06-04 → 2026-06-05"
}
```

## Requisitos

- Chromium ou Chrome instalado (`/usr/bin/chromium` por default; sobrescreva com `-chromium` ou `CHROMIUM_PATH`).
- Em Docker o backend já vem com `chromium` no apt + flag `--no-sandbox` + `shm_size=1gb` (Chromium odeia `/dev/shm` de 64MB).

## Limitações

- **Layout do Booking muda.** Os regex em `extrairPreco` e `extrairNome` são frágeis — se o site rearranjar o HTML, o scraper passa a não localizar preço (sai com `observacao: "preço não localizado..."`).
- **Câmbio.** Se a sessão Booking detectar país diferente, a moeda muda. O preço sai junto do símbolo (`R$`, `US$`, `€`, `£`) — o consumidor tem que lidar com isso.
- **WAF endurece com o tempo.** Hoje o `headless=new` resolve. Amanhã quem sabe.
