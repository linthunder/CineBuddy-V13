# Análise de responsividade: ORÇAMENTO vs ORÇAMENTO FINAL

## Tabelas e componentes da página ORÇAMENTO

| Componente | Uso | Breakpoints | Observação |
|-----------|-----|-------------|------------|
| **FinanceStrip** | Faixa superior (Valor total, Custo, Lucro, Impostos, Margem) | `grid-cols-1` < lg (1024px) → `lg:grid-cols-[1.3fr_1fr_1fr_1.2fr_0.8fr]` | Bordas: `border-b lg:border-b-0 lg:border-r` |
| **BudgetTabs** | PRÉ / PROD / PÓS + TABELA DE CACHÊS + Finalizar | `flex-col sm:flex-row` | Mobile: linha 1 = tabs, linha 2 = cache + finalizar |
| **MiniTables** | Contingência, CRT, BV Agência | `grid-cols-1 sm:grid-cols-3` | 1 col mobile, 3 cols ≥ 640px |
| **PhaseDefaultsBar** | Padrões da fase (Dias, Semanas, Deslocamento, Alimentação) | `grid-cols-2 sm:grid-cols-4` | 2 cols mobile, 4 cols ≥ 640px |
| **BudgetDeptBlock** | Blocos por departamento (DIRETORIA, ESCRITA, etc.) | Tabela principal: `overflow-x-auto`; Verba: `min-w-0 xl:min-w-[400px]` | Header: `flex-col sm:flex-row`; padding `p-2 sm:p-3` |
| **Grid de blocos** | Container dos BudgetDeptBlock | `grid-cols-1 xl:grid-cols-2 gap-4` | 1 col < 1280px, 2 cols ≥ 1280px |
| **Observações** | Textarea observações | `col-span-full p-3 mt-0` | Sempre largura total |

---

## Comparativo (antes da padronização)

| Elemento | ORÇAMENTO | ORÇ. FINAL |
|----------|-----------|------------|
| **Strip** | 1 col até lg (1024px) | 1 col até sm, 2 cols em 640–1024px, 5 cols em lg |
| **Strip bordas** | `border-b` até lg; `lg:border-b-0 lg:border-r` | `border-b` até sm; `sm:border-b-0 sm:border-r` |
| **Grid departamentos** | `xl:grid-cols-2` | `xl:grid-cols-2` ✓ |
| **Observações** | `mt-0` | sem `mt-0` |

---

## Padronização aplicada

1. **Finance Strip (Orç. Final):**
   - De `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5` para `grid-cols-1 lg:grid-cols-5` (igual ao FinanceStrip)
   - Bordas de `sm:` para `lg:` (1 coluna até 1024px, 5 colunas depois)
   - `min-w-0` nas células (evita overflow)

2. **Observações:** Adicionado `mt-0` no Orç. Final para manter o espaçamento igual ao do Orçamento.

---

## Breakpoints Tailwind usados

- **sm**: 640px
- **md**: 768px  
- **lg**: 1024px
- **xl**: 1280px

## Resultado

ORÇAMENTO e ORÇAMENTO FINAL agora seguem o mesmo padrão responsivo:
- Strip em 1 coluna até 1024px; 5 colunas a partir de 1024px
- Blocos de departamento em 1 coluna até 1280px; 2 colunas a partir de 1280px
