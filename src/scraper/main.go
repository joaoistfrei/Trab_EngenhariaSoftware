// Raspagem do preço da diária de um hotel no Booking.com.
//
// Uso:
//   go run . -url "https://www.booking.com/hotel/br/exemplo.pt-br.html"
//   go run . -hotel "Hotel Plaza Olimpia"
//   go run . -hotel "Pousada X" -checkin 2026-06-10 -checkout 2026-06-12 -adultos 2
//
// O Booking.com não oferece uma API pública anônima e protege as páginas com
// AWS WAF (challenge JavaScript). Por isso o script controla um Chromium real
// via DevTools (chromedp) — o desafio é resolvido pelo próprio browser. É
// necessário ter `chromium` (ou Chrome) instalado; o caminho pode ser
// sobrescrito com -chromium ou via env CHROMIUM_PATH.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/chromedp/chromedp"
)

const (
	userAgent      = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
	searchEndpoint = "https://www.booking.com/searchresults.pt-br.html"
)

type Resultado struct {
	Nome        string `json:"nome"`
	URLHotel    string `json:"url_hotel"`
	Checkin     string `json:"checkin"`
	Checkout    string `json:"checkout"`
	Adultos     int    `json:"adultos"`
	Moeda       string `json:"moeda,omitempty"`
	PrecoTotal  string `json:"preco_total,omitempty"`
	PrecoDiaria string `json:"preco_diaria,omitempty"`
	PrecoBruto  string `json:"preco_bruto,omitempty"`
	Observacao  string `json:"observacao,omitempty"`
}

func main() {
	var (
		hotel        = flag.String("hotel", "", "Nome do hotel para buscar no Booking")
		urlHotel     = flag.String("url", "", "URL direta do hotel no Booking (alternativa a -hotel)")
		checkin      = flag.String("checkin", "", "Data de check-in YYYY-MM-DD (padrão: amanhã)")
		checkout     = flag.String("checkout", "", "Data de check-out YYYY-MM-DD (padrão: check-in + 1 dia)")
		adultos      = flag.Int("adultos", 2, "Número de adultos")
		chromiumPath = flag.String("chromium", "", "Caminho do binário Chromium/Chrome (padrão: $CHROMIUM_PATH ou auto)")
		timeoutSeg   = flag.Int("timeout", 60, "Timeout total em segundos")
		verbose      = flag.Bool("v", false, "Log de progresso no stderr")
	)
	flag.Parse()

	if *hotel == "" && *urlHotel == "" {
		fmt.Fprintln(os.Stderr, "informe -hotel ou -url")
		flag.Usage()
		os.Exit(2)
	}
	ci, co, noites, err := resolverDatas(*checkin, *checkout)
	if err != nil {
		fmt.Fprintln(os.Stderr, "datas inválidas:", err)
		os.Exit(2)
	}

	browser, cancelBrowser, err := iniciarBrowser(*chromiumPath, time.Duration(*timeoutSeg)*time.Second)
	if err != nil {
		fmt.Fprintln(os.Stderr, "erro ao iniciar Chromium:", err)
		os.Exit(1)
	}
	defer cancelBrowser()

	log := func(string, ...any) {}
	if *verbose {
		log = func(f string, a ...any) { fmt.Fprintf(os.Stderr, "[scraper] "+f+"\n", a...) }
	}

	link, nomeBusca, err := resolverHotel(browser, *urlHotel, *hotel, ci, co, *adultos, log)
	if err != nil {
		fmt.Fprintln(os.Stderr, "erro ao localizar hotel:", err)
		os.Exit(1)
	}

	log("carregando %s", link)
	html, estado, err := renderizar(browser, link, log)
	if err != nil {
		fmt.Fprintln(os.Stderr, "erro ao renderizar página do hotel:", err)
		os.Exit(1)
	}

	nome := extrairNome(html)
	if nome == "" {
		nome = nomeBusca
	}

	moeda, precoTotal, precoBruto, errPreco := extrairPreco(html)
	res := Resultado{
		Nome:       nome,
		URLHotel:   link,
		Checkin:    ci,
		Checkout:   co,
		Adultos:    *adultos,
		Moeda:      moeda,
		PrecoTotal: precoTotal,
		PrecoBruto: precoBruto,
	}
	switch {
	case errPreco != nil && estado == "indisponivel":
		res.Observacao = "hotel sem disponibilidade nessas datas (página exibe 'Not available')"
	case errPreco != nil:
		res.Observacao = "preço não localizado no HTML renderizado (layout pode ter mudado ou desafio anti-bot não resolvido)"
	case noites > 0 && precoTotal != "":
		res.PrecoDiaria = dividirPreco(precoTotal, noites)
	}

	out, _ := json.MarshalIndent(res, "", "  ")
	fmt.Println(string(out))
	if errPreco != nil {
		os.Exit(1)
	}
}

func resolverDatas(ciIn, coIn string) (string, string, int, error) {
	hoje := time.Now()
	var ci, co time.Time
	var err error
	if ciIn == "" {
		ci = hoje.AddDate(0, 0, 1)
	} else {
		ci, err = time.Parse("2006-01-02", ciIn)
		if err != nil {
			return "", "", 0, fmt.Errorf("checkin: %w", err)
		}
	}
	if coIn == "" {
		co = ci.AddDate(0, 0, 1)
	} else {
		co, err = time.Parse("2006-01-02", coIn)
		if err != nil {
			return "", "", 0, fmt.Errorf("checkout: %w", err)
		}
	}
	if !co.After(ci) {
		return "", "", 0, errors.New("checkout precisa ser depois do checkin")
	}
	noites := int(co.Sub(ci).Hours() / 24)
	return ci.Format("2006-01-02"), co.Format("2006-01-02"), noites, nil
}

func iniciarBrowser(execPath string, timeout time.Duration) (context.Context, context.CancelFunc, error) {
	if execPath == "" {
		execPath = os.Getenv("CHROMIUM_PATH")
	}
	// "headless=new" (Chromium 109+) é o modo headless atualizado e NÃO é
	// detectado pelo AWS WAF do Booking, ao contrário do headless clássico.
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", "new"),
		chromedp.Flag("disable-blink-features", "AutomationControlled"),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.WindowSize(1280, 900),
		chromedp.UserAgent(userAgent),
	)
	if execPath != "" {
		opts = append(opts, chromedp.ExecPath(execPath))
	}

	allocCtx, cancelAlloc := chromedp.NewExecAllocator(context.Background(), opts...)
	browserCtx, cancelBrowser := chromedp.NewContext(allocCtx)
	ctx, cancelTimeout := context.WithTimeout(browserCtx, timeout)

	if err := chromedp.Run(ctx); err != nil {
		cancelTimeout()
		cancelBrowser()
		cancelAlloc()
		return nil, nil, err
	}
	cancel := func() {
		cancelTimeout()
		cancelBrowser()
		cancelAlloc()
	}
	return ctx, cancel, nil
}

// renderizar navega até a URL, aguarda o WAF challenge resolver e o conteúdo
// relevante (preço OU indicador de indisponibilidade) aparecer. Devolve o
// HTML capturado e um estado ("ok", "indisponivel", "incerto").
func renderizar(ctx context.Context, raw string, log func(string, ...any)) (string, string, error) {
	// JS: avalia o estado da página. Devolve "ok" se já tem preço visível,
	// "indisponivel" se o Booking exibe alertas de "Not available" nas datas,
	// ou string vazia se ainda está carregando/no challenge.
	const pollScript = `(function(){
		var d = document;
		if (!d.body) return "";
		var text = d.body.innerText || "";
		if (/just a moment|verify that you'?re not a robot/i.test(text) && text.length < 4000) return "";
		var precoEl = d.querySelector('[data-testid="price-and-discounted-price"], [data-testid="price-for-x-nights"]');
		if (precoEl && /[0-9]/.test(precoEl.innerText)) return "ok";
		if (/R\$\s?[0-9]/.test(text)) return "ok";
		if (/not available|sem disponibilidade|esgotad[oa]|no availability/i.test(text)) return "indisponivel";
		return "";
	})()`

	estado := "incerto"
	var html string
	actions := []chromedp.Action{
		chromedp.Navigate(raw),
		chromedp.ActionFunc(func(ctx context.Context) error {
			log("aguardando challenge / conteúdo")
			deadline, _ := ctx.Deadline()
			for {
				if !deadline.IsZero() && time.Now().After(deadline) {
					return errors.New("timeout aguardando conteúdo")
				}
				var ret string
				if err := chromedp.Evaluate(pollScript, &ret).Do(ctx); err == nil && ret != "" {
					estado = ret
					return nil
				}
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(800 * time.Millisecond):
				}
			}
		}),
		chromedp.OuterHTML("html", &html, chromedp.ByQuery),
	}
	if err := chromedp.Run(ctx, actions...); err != nil {
		// Em erro, tenta snapshot do que tiver para que o extrator possa analisar.
		_ = chromedp.Run(ctx, chromedp.OuterHTML("html", &html, chromedp.ByQuery))
		if html != "" {
			return html, estado, nil
		}
		return "", estado, err
	}
	return html, estado, nil
}

func resolverHotel(ctx context.Context, urlHotel, nome, ci, co string, adultos int, log func(string, ...any)) (string, string, error) {
	if urlHotel != "" {
		return comDatas(urlHotel, ci, co, adultos), "", nil
	}
	q := url.Values{}
	q.Set("ss", nome)
	q.Set("checkin", ci)
	q.Set("checkout", co)
	q.Set("group_adults", fmt.Sprintf("%d", adultos))
	q.Set("group_children", "0")
	q.Set("no_rooms", "1")
	q.Set("order", "popularity")
	buscaURL := searchEndpoint + "?" + q.Encode()
	log("buscando: %s", buscaURL)
	html, _, err := renderizar(ctx, buscaURL, log)
	if err != nil {
		return "", "", err
	}
	reAbs := regexp.MustCompile(`href="(https://www\.booking\.com/hotel/[^"\s]+\.html[^"]*)"`)
	reRel := regexp.MustCompile(`href="(/hotel/[^"\s]+\.html[^"]*)"`)
	var link string
	if m := reAbs.FindStringSubmatch(html); m != nil {
		link = m[1]
	} else if m := reRel.FindStringSubmatch(html); m != nil {
		link = "https://www.booking.com" + m[1]
	} else {
		return "", "", errors.New("nenhum hotel encontrado nos resultados de busca")
	}
	link = strings.ReplaceAll(link, "&amp;", "&")

	nomeEncontrado := nome
	reNome := regexp.MustCompile(`data-testid="title"[^>]*>\s*([^<]+?)\s*<`)
	if m := reNome.FindStringSubmatch(html); m != nil {
		nomeEncontrado = strings.TrimSpace(m[1])
	}
	return comDatas(link, ci, co, adultos), nomeEncontrado, nil
}

func comDatas(raw, ci, co string, adultos int) string {
	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	q := u.Query()
	q.Set("checkin", ci)
	q.Set("checkout", co)
	q.Set("group_adults", fmt.Sprintf("%d", adultos))
	q.Set("group_children", "0")
	q.Set("no_rooms", "1")
	u.RawQuery = q.Encode()
	return u.String()
}

func extrairNome(html string) string {
	patterns := []*regexp.Regexp{
		regexp.MustCompile(`<h2[^>]*class="[^"]*pp-header__title[^"]*"[^>]*>\s*([^<]+?)\s*<`),
		regexp.MustCompile(`data-testid="property-header-name"[^>]*>\s*([^<]+?)\s*<`),
		regexp.MustCompile(`<meta\s+property="og:title"\s+content="([^"]+)"`),
		regexp.MustCompile(`<title>\s*([^<|]+?)\s*[|<]`),
	}
	for _, re := range patterns {
		if m := re.FindStringSubmatch(html); m != nil {
			return strings.TrimSpace(m[1])
		}
	}
	return ""
}

func extrairPreco(html string) (string, string, string, error) {
	candidatos := []*regexp.Regexp{
		regexp.MustCompile(`data-testid="price-and-discounted-price"[^>]*>\s*([^<]+?)\s*<`),
		regexp.MustCompile(`class="[^"]*prco-valign-middle-helper[^"]*"[^>]*>\s*([^<]+?)\s*<`),
		regexp.MustCompile(`data-testid="price"[^>]*>\s*([^<]+?)\s*<`),
	}
	var bruto string
	for _, re := range candidatos {
		if m := re.FindStringSubmatch(html); m != nil {
			bruto = limparTexto(m[1])
			break
		}
	}
	if bruto == "" {
		re := regexp.MustCompile(`(R\$|US\$|€|£)\s?([0-9][0-9.\s ,]*)`)
		if m := re.FindStringSubmatch(html); m != nil {
			bruto = limparTexto(m[0])
		}
	}
	if bruto == "" {
		return "", "", "", errors.New("preço não localizado")
	}
	reSeparar := regexp.MustCompile(`(R\$|US\$|€|£)\s?([0-9][0-9.\s,]*)`)
	if m := reSeparar.FindStringSubmatch(bruto); m != nil {
		valor := strings.TrimSpace(m[2])
		valor = strings.ReplaceAll(valor, " ", "")
		return m[1], valor, bruto, nil
	}
	return "", "", bruto, nil
}

func limparTexto(s string) string {
	s = strings.ReplaceAll(s, "&nbsp;", " ")
	s = strings.ReplaceAll(s, " ", " ")
	s = strings.ReplaceAll(s, "&amp;", "&")
	return strings.TrimSpace(s)
}

func dividirPreco(total string, noites int) string {
	if noites <= 1 {
		return total
	}
	usaVirgula := strings.Contains(total, ",")
	limpo := strings.ReplaceAll(total, ".", "")
	limpo = strings.ReplaceAll(limpo, ",", ".")
	var v float64
	if _, err := fmt.Sscanf(limpo, "%f", &v); err != nil {
		return ""
	}
	porNoite := v / float64(noites)
	s := fmt.Sprintf("%.2f", porNoite)
	if usaVirgula {
		s = strings.ReplaceAll(s, ".", ",")
	}
	return s
}
