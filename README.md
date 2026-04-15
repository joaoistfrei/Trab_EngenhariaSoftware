# Turismo Hub

Projeto de dados e analytics para centralizar, organizar e analisar informacoes de turismo vindas de diferentes fontes, como planilhas, Google Forms e websites externos.

O objetivo e transformar dados brutos em datasets estruturados e gerar indicadores de turismo para apoiar analises e tomada de decisao.

## Estrutura do projeto

```
Turismo Hub/
├── data/
│   ├── raw/                # Dados originais, sem modificacao
│   └── processed/          # Dados limpos e transformados
├── docs/                   # Documentacao do projeto
├── src/
│   └── analysis/           # Scripts de limpeza e indicadores
│       ├── clean_data.py
│       └── indicators.py
├── .gitignore
├── requirements.txt
└── README.md
```

## Fluxo inicial

1. Coloque arquivos de origem em `data/raw/`.
2. Execute `src/analysis/clean_data.py` para gerar dados tratados em `data/processed/`.
3. Execute `src/analysis/indicators.py` para gerar indicadores basicos.

## Como executar

1. Crie e ative um ambiente virtual Python.
2. Instale as dependencias:

```bash
pip install -r requirements.txt
```

3. Rode os scripts:

```bash
python src/analysis/clean_data.py
python src/analysis/indicators.py
```

## Boas praticas adotadas

- Separacao clara entre dados brutos e processados.
- Scripts analiticos organizados em `src/analysis`.
- Estrutura minima, mas escalavel para novas etapas de analytics.
