# CINEBUDDY — CONTEXTO MESTRE
## Documento 1/4 | Estado do código: V13.49
## Arquivo principal: CineBuddy_frontend_V13_49.html (1699 linhas, tudo inline)
## Backend: CineBuddy_backend_V13_49.php

---

## 1. O QUE É

SPA (Single Page Application) para gerenciamento de orçamentos audiovisuais. Rodar dentro do WordPress via Elementor Canvas. **Todo o código — HTML, CSS, JS — está em um único arquivo `.html`**. Backend é um plugin WordPress `.php` com handlers AJAX. Sem frameworks, sem bundlers, vanilla JS puro.

---

## 2. MAPA DE LINHAS DO ARQUIVO (V13.49 — 1699 linhas)

```
Linhas   1–7      : <!DOCTYPE>, <head>, FontAwesome CDN (v6.0.0)
Linhas   8–708    : <style> — TODO o CSS
Linhas 710–904    : <body> — HTML estrutural
  712–721         : <header class="global-header"> (fixed top, 70px)
  723–726         : Modais: modal-projects, modal-copy, modal-new-project, modal-team
  728–772         : <section id="view-filme">
  774–840         : <section id="view-orcamento"> (ORÇAMENTO INICIAL)
  842–858         : <section id="view-orc-final">       ← STUB parcial — refatorar
  860–875         : <section id="view-fechamento">      ← STUB básico — construir
  877             : <section id="view-team">            ← placeholder
  879–904         : <section id="view-config">
  896–904         : <nav class="bottom-nav">
Linhas 906–1699   : <script> — TODO o JS
  906–918         : CONFIG (PRE_PROD_LIST, DEPARTMENTS, LABOR_DEPTS, globals)
  920–923         : saveContext()
  926–1031        : Formatação de moeda (formatCurrency, parseCurrencyInput, etc.)
  1033–1154       : Verbas (addVerbaSection, addVerbaRow, calcVerbaRow, updateDeptTotal)
  1157–1200       : Mini tabelas (updateMiniTable, handleMiniTableFocus/Blur, getMiniTablesTotal)
  1202–1250       : toggleLock(stage)
  1251–1263       : setButtonState(btnId, isLocked, textLocked, textOpen)
  1265–1300       : updateLockUI()
  1302–1396       : renderBudgetTables() — gera ORÇAMENTO INICIAL
  1397–1427       : renderFinalBudgetTables() — gera ORC FINAL (stub)
  1428–1442       : renderClosingTable() — gera FECHAMENTO (stub)
  1444–1453       : syncPay(), switchBudgetPhase(), switchFinalPhase()
  1456–1481       : addBudgetRow(tableId, data)
  1482–1495       : saveProject()
  1496            : saveBudgetLines(jobId, btn, originalHTML)
  1497–1520       : loadProject(projData)
  1521–1560       : Modais & utils
  1526–1543       : populateFinalTables(lines)
  1544–1558       : calcFinalRow(input)
  1559–1582       : calcFinalFinancials()
  1583            : saveRealizedCosts()
  1584–1598       : filterProjects, removeRow, searchDB, selectRole, selectPro, calcRow
  1600–1643       : calcFinancials() — Finance Strip do INICIAL
  1644–1678       : applyMarkup(percent)
  1679–1699       : switchTab, loadBudgetForFinal, closeModal, openFilmeAction, unlockNewProject, etc.
```

---

## 3. SISTEMA DE CORES (CSS Variables)

```css
:root {
  --bg-body: #f4f4f4;  --bg-panel: #ffffff;  --primary: #111111;
  --accent: #f5c518;   --text-main: #333333; --text-muted: #666666;
  --border: #e0e0e0;   --input-bg: #fafafa;  --success: #28a745;
  --danger: #dc3545;   --container-dark: #3a3a3a;
  --font-stack: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
```

---

## 4. PADRÕES VISUAIS (usar SEMPRE)

### 4.1 Película Amarela — hover padrão
```css
background: rgba(245, 197, 24, 0.1);
border-color: var(--accent);
box-shadow: 0 0 8px rgba(245, 197, 24, 0.3);
```

### 4.2 dept-block — padrão estrutural
```css
.dept-block    { margin-bottom: 40px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border-radius: 6px; }
.dept-header   { background: var(--primary); color: var(--accent); padding: 12px 20px;
                 border-radius: 6px 6px 0 0; font-weight: 800; text-transform: uppercase; }
.dept-body     { background: var(--container-dark); padding: 15px; border-radius: 0 0 6px 6px; }
```

### 4.3 cb-table & cb-input-cell
```css
.cb-table th   { background: rgba(255,255,255,0.08); color: #ddd; padding: 8px 6px;
                 font-size: 0.82em; text-transform: uppercase; }
.cb-input-cell { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15);
                 color: #fff; padding: 6px 8px; border-radius: 3px; width: 100%; }
.cb-input-cell:focus { border-color: var(--accent); box-shadow: 0 0 4px rgba(245,197,24,0.3); }
```

### 4.4 Botões btn-add-row e btn-add-verba
```css
.btn-add-row   { background: rgba(245,197,24,0.08); border: 1px dashed var(--accent);
                 color: var(--accent); padding: 6px 12px; font-weight: 700; width: 100%; }
.btn-add-verba { background: rgba(245,197,24,0.05); border: 1px dashed rgba(245,197,24,0.4);
                 color: var(--accent); padding: 6px 14px; font-size: 0.8em; }
```

### 4.5 Lock buttons
```css
.btn-lock   { background: var(--success) !important; color: white !important; font-size: 0.8em; }
.btn-unlock { background: #e67e22 !important; }  /* laranja = reabrir */
```

### 4.6 Tab Pills
```css
/* base: bg #e0e0e0, color #666, border-radius 20px, padding 10px 25px */
/* active: bg var(--primary), color var(--accent) */
```

### 4.7 Filme action buttons (V13.49)
```css
.filme-action-btn      { background: var(--primary); border: 2px solid #2a2a2a;
                         padding: 28px 20px 24px; gap: 12px; border-radius: 8px; }
.filme-action-btn:hover { background: rgba(245,197,24,0.1); border-color: var(--accent);
                          box-shadow: 0 4px 12px rgba(245,197,24,0.25); transform: translateY(-2px); }
.filme-action-btn i    { color: var(--accent); font-size: 1.8em; }
.filme-action-btn span { color: #cccccc; font-weight: 800; font-size: 0.88em; letter-spacing: 1.5px; }
.filme-action-btn:hover span { color: var(--text-main); }
```

### 4.8 Diferença positiva/negativa
```
diff >= 0 → color: var(--success); bg: rgba(40,167,69,0.05)
diff <  0 → color: var(--danger);  bg: rgba(220,53,69,0.05)
```

### 4.9 Layout 2 colunas
```css
.phase-wrapper { display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px; }
/* @media (max-width: 1400px) → 1fr */
```

### 4.10 Finance Strip
```
grid horizontal, 5+ caixas
border-bottom: 4px solid var(--accent)   ← INICIAL
border-bottom: 4px solid var(--success)  ← FINAL e FECHAMENTO
cada fin-box: padding 15px 10px, text-align center
.val: font-size 1.4em, font-weight 800
```

### 4.11 locked-sheet
```css
.locked-sheet              { pointer-events: none; opacity: 0.7; }
.locked-sheet input,select { background: #eee !important; color: #777 !important; border: transparent !important; }
.locked-module             { opacity: 0.4; pointer-events: none; }
.nav-btn.dimmed            { opacity: 0.3 !important; pointer-events: none !important; filter: grayscale(100%); }
```

---

## 5. CONVENÇÕES DE IDs

### Projeto
```
in-nome, in-agencia, in-cliente, in-duracao, in-duracao-unit
```

### Finance Strip — INICIAL (existem e funcionam)
```
fin-job-val, fin-cost-total, fin-profit, fin-tax-rate, fin-tax-val, fin-margin
```

### Finance Strip — FINAL
Existem no HTML: `final-total-orc, final-total-real, final-diff, final-profit-real`
⚠️ NÃO existem mas são usados pelo JS: `final-job-val, final-profit-diff, final-margin`

### Tabelas dinâmicas
```
INICIAL:  tbl-{SAFE_DEPT}-{fase}         → safeId = deptName.replace(/[^a-zA-Z0-9]/g,'') + '-' + phase
FINAL:    tbl-{SAFE_DEPT}-final-{fase}
Totais:   total-tbl-{...}  /  ftotal-tbl-{...}
```

### Nav
```
nav-filme, nav-orc1, nav-orc2, nav-fechamento, nav-team
```

### Lock
```
btn-lock-initial, btn-lock-final, btn-lock-closing
```

### Containers para locked-sheet
```
budget-tables-container    → INICIAL
final-tables-container     → FINAL
closing-table              → FECHAMENTO (⚠️ precisa mudar para closing-tables-container)
```

---

## 6. DEPARTAMENTOS & TIPOS

```javascript
PRE_PROD_LIST = ['DIREÇÃO','PRODUÇÃO','FOTOGRAFIA E TÉCNICA','ARTE E CENOGRAFIA',
  'FIGURINO E MAQUIAGEM','SOM DIRETO','CASTING','EQUIPAMENTOS',
  'LOCAÇÕES','TRANSPORTE','CATERING','DESPESAS GERAIS'];

DEPARTMENTS = { pre: PRE_PROD_LIST, prod: PRE_PROD_LIST, pos: ['FINALIZAÇÃO','ANIMAÇÃO','VFX','ÁUDIO'] };

LABOR_DEPTS = ['DIREÇÃO','PRODUÇÃO','FOTOGRAFIA E TÉCNICA','ARTE E CENOGRAFIA',
  'FIGURINO E MAQUIAGEM','SOM DIRETO','FINALIZAÇÃO','ANIMAÇÃO','VFX','ÁUDIO'];

// COST = PRE_PROD_LIST sem LABOR = CASTING, EQUIPAMENTOS, LOCAÇÕES, TRANSPORTE, CATERING, DESPESAS GERAIS

customHeaders = {
  'CASTING': {item:'Nome', supplier:'Descrição'},
  'LOCAÇÕES': {item:'Item', supplier:'Descrição'},
  'EQUIPAMENTOS': {item:'Item', supplier:'Fornecedor'},
  'CATERING': {item:'Item', supplier:'Descrição'},
  'TRANSPORTE': {item:'Item', supplier:'Descrição'},
  'DESPESAS GERAIS': {item:'Item', supplier:'Descrição'}
};
```

Colunas Labor: Função | Nome | Tipo (Diária/Semana/Fechado) | Cachê | Desl. | Qtd | Total | ×
Colunas Cost:  Item | Fornecedor | Tipo (Cachê/Verba/Extra) | Valor | Qtd | Total | ×
Verbas em: PRODUÇÃO, FOTOGRAFIA E TÉCNICA, ARTE E CENOGRAFIA

---

## 7. ESTADO ATUAL DE CADA PÁGINA

### FILME ✅ Completo — NÃO alterar
### ORÇAMENTO INICIAL ✅ Completo — NÃO alterar
### ORÇAMENTO FINAL ⚠️ Stub — refatorar (veja 03_SPEC)
### FECHAMENTO ⚠️ Stub — construir (veja 03_SPEC)
### EQUIPE — Placeholder
### CONFIG — Básico funcional

---

## 8. FUNÇÕES DE MOEDA

```javascript
formatCurrencyValue(number)  → "R$ 1.234,56"       // exibição em divs
parseCurrencyInput(string)   → 1234.56              // parse de input com R$
formatCurrencyOnBlur(input)  → formata input no blur
removeCurrencyFormat(input)  → remove formato no focus
formatNumber(value)          → "1.234,56"           // sem R$ (mini tables)
parseCurrency(str)           → number               // parse simples
```
REGRA: Nunca parseFloat() diretamente em campos com "R$". Sempre parseCurrencyInput().

---

## 9. VARIÁVEIS GLOBAIS

```javascript
let currentJobId = null;
let currentView = 'filme';
let activePhase = 'prod';
let activeFinalPhase = 'prod';
let currentStatus = { initial: 'open', final: 'locked', closing: 'locked' };
window.initialBudgetData = null; // { jobValue, totalCost, taxValue, profitNet, margin }
                                 // ⚠️ só existe após calcFinancials() no INICIAL
let searchTimeout;
```

---

## 10. GLOBAL HEADER

```
height: 70px, fixed top, z-index: 1000, bg: var(--primary)
gh-center opacity: 0 por padrão → 1 quando projeto carregado
disp-name: nome do projeto (uppercase)
disp-info: JOB #ID • AGÊNCIA • CLIENTE • DURAÇÃO
btn-save-global: botão SALVAR no gh-right
```
`updateHeaderUI(title, jobId, agency, client, duration)` atualiza.

---
