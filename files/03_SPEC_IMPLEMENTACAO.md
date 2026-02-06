# CINEBUDDY — ESPECIFICAÇÃO DE IMPLEMENTAÇÃO
## Documento 3/4 | Trabalho pendente após V13.49

---

## PARTE A — ORÇAMENTO FINAL (refatorar)

### A1. O que está errado atualmente

**Finance Strip (HTML linhas 844–848):**
- Existe apenas 4 fin-boxes: CUSTO, CUSTO REAL, DIFERENÇA, LUCRO REAL
- FALTAM (referenciados pelo JS calcFinalFinancials mas NÃO no HTML):
  - `final-job-val` — VALOR DO JOB (somente leitura)
  - `final-profit-diff` — DIFERENÇA DE LUCRO
  - `final-margin` — MARGEM %
- calcFinalFinancials() vai dar erro de "Cannot set property innerText of null"

**Tabelas (renderFinalBudgetTables, linha 1397):**
- Usa 1 conjunto genérico de colunas para todos: ITEM|FUNÇÃO|ORÇADO|REAL(UN)|QTD|EXTRA|TOTAL|DIF
- NÃO separa labor vs cost nas colunas
- NÃO exibe nome + função separados (exibe só item_name||role_function numa coluna)
- Não tem OBSERVAÇÕES
- Campos reais são type="number" sem formatação de moeda

**populateFinalTables (linha 1526):**
- Campos reais sem parseCurrencyInput/formatCurrencyOnBlur
- Não usa customHeaders por departamento

### A2. Finance Strip do FINAL — como deve ser

```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│VALOR JOB │  CUSTO   │CUSTO REAL│DIFERENÇA │LUCRO REAL│  MARGEM  │
│(readonly)│ (orçado) │          │          │          │          │
│final-    │final-    │final-    │final-    │final-    │final-    │
│job-val   │total-orc │total-real│diff      │profit-   │margin    │
│          │          │          │          │real      │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```
- border-bottom: var(--success) (verde) — já configurado
- VALOR JOB: somente leitura (texto), copiado de window.initialBudgetData.jobValue
- CUSTO: soma dos Total Orçado de todas as linhas
- CUSTO REAL: soma dos Total Real de todas as linhas
- DIFERENÇA = CUSTO ORÇADO - CUSTO REAL (verde se positiva = dentro orçamento)
- LUCRO REAL = VALOR JOB - CUSTO REAL
- MARGEM = (LUCRO REAL / VALOR JOB) × 100
  - Verde se >= 20%, amarelo se >= 10%, vermelho se < 10%

### A3. Colunas das tabelas — como devem ser

**Labor (profissionais) — colunas:**
```
Função | Nome | Tipo | Cachê | Desl. | Qtd | Total | Cachê Real | Desl. Real | Qtd Real | Total Real | Dif
```
- Função, Nome, Tipo: somente leitura, cinza (vem do INICIAL)
- Cachê, Desl., Qtd, Total: somente leitura, cinza (valores orçados)
- Cachê Real: editável, formatação moeda (default = valor de Cachê)
- Desl. Real: editável, formatação moeda (default = Desl.)
- Qtd Real: editável, number (default = Qtd)
- Total Real: calculado = (Cachê Real + Desl. Real) × Qtd Real
- Dif: Total Orçado - Total Real (verde/vermelho + fundo tinto)

**Cost (itens) — colunas:**
```
Item | Fornecedor | Tipo | Valor | Qtd | Total | Valor Real | Qtd Real | Total Real | Dif
```
- Item, Fornecedor, Tipo: somente leitura
- Valor, Qtd, Total: somente leitura (orçados)
- Valor Real: editável, formatação moeda (default = Valor)
- Qtd Real: editável (default = Qtd)
- Total Real: calculado = Valor Real × Qtd Real
- Dif: Total Orçado - Total Real

### A4. Dados que populateFinalTables recebe

```javascript
// Cada linha 'l' do array data.lines:
l.id                // ID da linha no banco
l.department        // ex: 'DIREÇÃO'
l.role_function     // função (labor) ou fornecedor (cost)
l.item_name         // nome profissional (labor) ou item (cost)
l.unit_type         // 'dia'|'sem'|'flat' ou 'cache'|'verba'|'extra'
l.unit_cost         // valor unitário orçado
l.extra_cost        // deslocamento orçado
l.quantity          // quantidade orçada
l.total_cost        // total orçado

l.real_unit_cost    // valor real (0 se não preenchido)
l.real_extra_cost   // desl real
l.real_quantity     // qtd real
l.real_total_cost   // total real

l.pay_status        // 'pendente' ou 'pago'
l.pay_doc           // número NF
l.pay_date          // data pagamento
```

### A5. Cálculo de Total Real

```javascript
// Labor:  totalReal = (realCachê + realDeslocamento) × realQtd
// Cost:   totalReal = realValor × realQtd
// Dif:    diff = totalOrçado - totalReal
//         diff >= 0: verde (dentro orçamento)
//         diff <  0: vermelho (estourou)
```

### A6. OBSERVAÇÕES no FINAL
Adicionar bloco de OBSERVAÇÕES em cada fase (mesmo padrão do INICIAL):
```html
<div class="dept-block notes-block" style="grid-column: 1 / -1;">
  <div class="dept-header"><span><i class="fas fa-sticky-note"></i> OBSERVAÇÕES</span></div>
  <div class="dept-body">
    <textarea id="notes-final-{fase}" class="notes-textarea" rows="6"></textarea>
  </div>
</div>
```

### A7. Total por departamento
Usar o mesmo padrão do INICIAL: span#ftotal-tbl-{...} no dept-header, atualizar no calcFinalRow.

---

## PARTE B — FECHAMENTO (construir do zero)

### B1. Estrutura geral da seção

```html
<section id="view-fechamento">
  <div class="container">
    <!-- Finance Strip -->
    <div class="finance-strip" style="border-bottom-color: var(--success);">
      VALOR JOB | CUSTO FINAL | TOTAL PAGO | PENDENTE | LUCRO FINAL
    </div>

    <!-- Tabs de fase -->
    <div class="budget-tabs">
      PRÉ-PRODUÇÃO | PRODUÇÃO | PÓS-PRODUÇÃO | ENCERRAR PROJETO (btn-lock-closing)
    </div>

    <!-- Tabelas por fase (mesmo padrão phase-wrapper + 2 colunas) -->
    <div id="closing-tables-container">
      <!-- gerado por renderClosingTables() -->
    </div>

    <!-- PRESTAÇÃO DE CONTAS (fora das fases, sempre visível) -->
    <div class="dept-block">...</div>
  </div>
</section>
```

### B2. Finance Strip do FECHAMENTO

```
┌──────────┬───────────┬──────────┬──────────┬───────────┐
│VALOR JOB │CUSTO FINAL│TOTAL PAGO│ PENDENTE │LUCRO FINAL│
│(readonly)│           │          │          │           │
└──────────┴───────────┴──────────┴──────────┴───────────┘
```
- VALOR JOB: somente leitura (do projeto / window.initialBudgetData.jobValue)
- CUSTO FINAL: soma de todos os "Total Final" das linhas
- TOTAL PAGO: soma dos "Total Final" onde pay_status = 'pago'
- PENDENTE: soma dos "Total Final" onde pay_status = 'pendente'
- LUCRO FINAL: VALOR JOB - CUSTO FINAL

### B3. Estrutura de cada linha no FECHAMENTO

Cada item do FINAL aparece como GRUPO de 3 linhas visuais:

```
┌─────────────────────────────────────────────────────────────────────┐
│ LINHA PRINCIPAL (readonly, bg cinza claro)                          │
│  Nome/Item | Função/Fornecedor | Tipo | Valor Final (do ORC FINAL) │
├─────────────────────────────────────────────────────────────────────┤
│ LINHA DE FECHAMENTO (editável) — APENAS para labor                 │
│  Diária de: [select 4-16h] | Adicional: [select 0-100%]            │
│  Horas Extra: [select 0-12h] | Nota Fiscal: [campo + botão]        │
├─────────────────────────────────────────────────────────────────────┤
│ LINHA DE RESUMO                                                     │
│  Total NF: R$ xxx | Horas Extra: R$ xxx | [$ PIX] [A PAGAR/PAGO]   │
└─────────────────────────────────────────────────────────────────────┘
```

Para cost (itens/fornecedores) — apenas 2 linhas (sem Linha de Fechamento com horas extras):
```
┌─────────────────────────────────────────────────────────────────────┐
│ LINHA PRINCIPAL (readonly)                                          │
│  Item | Fornecedor | Tipo | Valor Final                            │
├─────────────────────────────────────────────────────────────────────┤
│ LINHA DE RESUMO                                                     │
│  Nota Fiscal: [campo] | [A PAGAR/PAGO]                              │
└─────────────────────────────────────────────────────────────────────┘
```

### B4. Campos da Linha de Fechamento — detalhado

**DIÁRIA DE (select):**
Opções: 4h, 5h, 6h, 7h, 8h, 9h, 10h, 11h, 12h, 13h, 14h, 15h, 16h
Default: 8h

**ADICIONAL (select):**
Opções: 0%, 10%, 20%, 30%, 40%, 50%, 60%, 70%, 80%, 90%, 100%
Default: 0%

**HORAS EXTRA (select):**
Opções: 0h, 1h, 2h, 3h, 4h, 5h, 6h, 7h, 8h, 9h, 10h, 11h, 12h
Default: 0h

**NOTA FISCAL:**
Campo de texto para número/identificação da NF. Pode ter botão para link Google Drive no futuro.

### B5. Cálculo de Horas Extras

```javascript
// Dados disponíveis na linha:
valorTotalReal  = valor real total do ORC FINAL (já calculado: (cachê+desl)×qtd)
cachêReal       = valor real do cachê por dia
qtdDias         = quantidade real de dias (do ORC FINAL)
diariaDe        = horas por diária (select, ex: 8)
adicionalPct    = % adicional (select, ex: 20)
qtdHorasExtras  = horas extras (select, ex: 3)

// Cálculo:
valorHora          = cachêReal / diariaDe
adicionalHora      = valorHora × (adicionalPct / 100)
horaComAdicional   = valorHora + adicionalHora
valorExtras        = horaComAdicional × qtdHorasExtras

// Totais na Linha de Resumo:
totalNF            = valorTotalReal + valorExtras
```

### B6. Botão A PAGAR / PAGO

```css
.btn-pagamento.pendente { background: var(--danger); color: white; }  /* "A PAGAR" */
.btn-pagamento.pago     { background: var(--success); color: white; } /* "PAGO ✓" */
```
- Toggle onclick: muda classe + atualiza estado interno
- Presente em TODAS as linhas (labor e cost)
- Estado salvo via pay_status no backend

### B7. Modal PIX (dados bancários)

Quando o botão [$ PIX] é clicado:
```
┌──────────────────────────────────┐
│        DADOS DE PAGAMENTO        │
├──────────────────────────────────┤
│  Nome:    João Silva             │
│  CPF:     123.456.789-00         │
│  PIX:     joao@email.com         │
│  Banco:   Nubank                 │
│  Agência: 0001                   │
│  Conta:   12345-6                │
└──────────────────────────────────┘
```
- Busca pelo nome via cb_get_pros (já existe)
- Se não encontrado: "Profissional não encontrado no cadastro"
- Usar padrão modal existente (.modal-overlay + .modal-box)
- Botão PIX APENAS em linhas labor (não em cost)

### B8. Tabela PRESTAÇÃO DE CONTAS

Tabela adicional ABAIXO das fases (sempre visível, não dentro das tabs).

```
┌─────────────────────────────────────────────────────┐
│ PRESTAÇÃO DE CONTAS                                 │
├───────────┬─────────────┬──────────┬────────┬───────┤
│   NOME    │  DESCRIÇÃO  │  VALOR   │   NF   │STATUS │
├───────────┼─────────────┼──────────┼────────┼───────┤
│ [input+AC]│ [input text]│ [R$ inp] │[campo] │[APAG] │
│     ...   │    ...      │   ...    │  ...   │  ...  │
└───────────┴─────────────┴──────────┴────────┴───────┘
            [+ ADICIONAR CONTA]
```
- NOME: input com autocomplete conectado a cb_get_pros (mesmo padrão do searchDB)
- DESCRIÇÃO: input texto livre
- VALOR: input com formatação moeda
- NF: campo texto para número da nota fiscal
- STATUS: botão A PAGAR / PAGO (mesmo padrão)
- Cada linha tem botão × para remover
- Botão "+ ADICIONAR CONTA" abaixo da tabela

---

## PARTE C — PRIORIDADE DE IMPLEMENTAÇÃO

### Fase 1: Corrigir ORÇAMENTO FINAL
1. Adicionar IDs faltantes ao Finance Strip (final-job-val, final-profit-diff, final-margin)
2. Refatorar renderFinalBudgetTables() — colunas corretas separando labor vs cost com customHeaders
3. Refatorar populateFinalTables() — formatação moeda nos campos reais, separação labor/cost
4. Refatorar calcFinalRow() — labor (cachê+desl)×qtd vs cost valor×qtd
5. Adicionar OBSERVAÇÕES nas fases do FINAL
6. Atualizar totais por departamento (ftotal-tbl-...)
7. Testar calcFinalFinancials()

### Fase 2: Construir FECHAMENTO base
1. Refatorar HTML da seção view-fechamento (Finance Strip + tabs + closing-tables-container)
2. Criar renderClosingTables() com estrutura de 3 linhas por item (labor) e 2 linhas (cost)
3. Criar switchClosingPhase()
4. Criar calcClosingRow() e calcClosingFinancials()
5. Criar botão A PAGAR/PAGO em todas as linhas

### Fase 3: FECHAMENTO detalhes
1. Criar cálculo de horas extras (Linha de Fechamento)
2. Criar modal PIX com busca via cb_get_pros
3. Criar campo Nota Fiscal
4. Criar tabela PRESTAÇÃO DE CONTAS com autocomplete
5. Criar saveClosingData()

### Fase 4: Ajustes finais
1. Corrigir updateLockUI para usar closing-tables-container
2. Revisar locked-sheet em todos os elementos do FECHAMENTO
3. Testar fluxo completo: INICIAL → FINAL → FECHAMENTO

---

## PARTE D — BUGS CONHECIDOS NO CÓDIGO ATUAL (corrigir durante implementação)

1. **IDs ausentes no HTML do ORC FINAL:** `final-job-val`, `final-profit-diff`, `final-margin` são referenciados em calcFinalFinancials() mas não existem no HTML. → ERRO no console.

2. **duration_unit não salvo no backend:** Frontend envia mas tabela wp_cinebuddy_projects não tem essa coluna. → Precisa migração.

3. **renderClosingTable() dependente do DOM:** Busca dados das <tr> do view-orc-final. Se usuário não visitou essa aba, DOM vazio e FECHAMENTO fica vazio. → Deve buscar do backend diretamente.

4. **calcFinalFinancials referencia window.initialBudgetData:** Só existe após calcFinancials() no INICIAL. Se abrir diretamente no FINAL, pode ser undefined. → Precisa fallback.

5. **updateLockUI usa closing-table como container:** Aplica locked-sheet na table, mas FECHAMENTO vai ter múltiplas tabelas. → Usar closing-tables-container como wrapper.

---
