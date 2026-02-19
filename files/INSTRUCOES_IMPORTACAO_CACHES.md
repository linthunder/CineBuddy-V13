# Importação de tabelas de cachês (CSV – Real brasileiro)

O CineBuddy aceita **apenas arquivo CSV** com **padronização de moeda em Real brasileiro** (ponto para milhar, vírgula para decimal).

## Formato obrigatório

- **Arquivo:** CSV (extensão `.csv`), encoding **UTF-8**.
- **Separador:** vírgula (`,`).
- **Valores monetários:** formato Real brasileiro: **R$ 1.234,56** (ponto = milhar, vírgula = decimal).
- **Campos com vírgula** (nome da função ou número): devem estar entre **aspas duplas** `"` (aspas retas, ASCII).
- **Primeira linha:** cabeçalho (ex.: `Função,Cachê (Dia),Cachê (Semana)`), será ignorada na importação.

## Colunas (na ordem)

| Coluna           | Descrição                 | Exemplo (dentro do CSV)   |
|------------------|---------------------------|----------------------------|
| 1. Função         | Nome da função            | `"Diretor de Cena"`        |
| 2. Cachê (Dia)    | Valor por dia (R$)        | `"R$1.441,47"`             |
| 3. Cachê (Semana) | Valor por semana (R$)     | `"R$7.207,34"`             |

## Exemplo de linha CSV

```csv
"Diretor de Cena","R$1.441,47","R$7.207,34"
```

Valores vazios ou traço ficam como zero. O sistema normaliza aspas curvas (Excel/Word) para aspas retas antes de interpretar.

## Regras

- Linhas em branco são ignoradas.
- Linhas com **Função** vazia são ignoradas.
- Use os arquivos em **`files/Tabelas/`** (ex.: `Sindicine Cinema 2025.csv`) como referência; eles já estão no formato correto.

## Como importar

1. **Tabelas de Cachê:** crie ou edite uma tabela e clique em **“Importar CSV”** na linha da tabela.
2. **Funções e Cachês:** selecione a tabela no dropdown e clique em **“Importar”** no cabeçalho.
3. Selecione um arquivo **.csv** no formato acima.

As funções serão adicionadas à tabela selecionada (para substituir tudo, exclua a tabela e crie uma nova antes de importar).
