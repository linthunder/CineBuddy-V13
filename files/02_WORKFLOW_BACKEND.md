# CINEBUDDY — WORKFLOW + BACKEND
## Documento 2/4 | Versão: V13.49

---

## 1. SISTEMA DE WORKFLOW (LOCK/UNLOCK)

### 1.1 Estado global
```javascript
let currentStatus = { initial: 'open', final: 'locked', closing: 'locked' };
// Salvo no banco por projeto. Recuperado no loadProject via cb_get_budget_lines.
```

### 1.2 Fluxo em cascata (diagrama completo)
```
PROJETO ABERTO (novo ou recarregado)
├── ORÇAMENTO INICIAL:  open   ← editável
├── ORÇAMENTO FINAL:    locked ← nav dimmed, inacessível
└── FECHAMENTO:         locked ← nav dimmed, inacessível

APÓS "FINALIZAR ORÇAMENTO" no INICIAL
├── ORÇAMENTO INICIAL:  locked ← locked-sheet aplicado, botão laranja "ABRIR ORÇAMENTO"
├── ORÇAMENTO FINAL:    open   ← nav ativa, loadBudgetForFinal() executado automaticamente
└── FECHAMENTO:         locked ← nav dimmed

APÓS "FINALIZAR ORÇAMENTO" no FINAL
├── ORÇAMENTO INICIAL:  locked
├── ORÇAMENTO FINAL:    locked ← locked-sheet, botão laranja "ABRIR ORÇAMENTO"
└── FECHAMENTO:         open   ← nav ativa, renderClosingTable() executado automaticamente

APÓS "ENCERRAR PROJETO" no FECHAMENTO
├── ORÇAMENTO INICIAL:  locked
├── ORÇAMENTO FINAL:    locked
└── FECHAMENTO:         locked ← botão laranja "REABRIR PROJETO"
```

### 1.3 Reabertura (unlock)
- Qualquer estággio pode ser reaberto pelo botão laranja
- Reabrir INICIAL → FINAL volta a ser locked (cascata descendente)
- Reabrir FINAL → FECHAMENTO volta a ser locked
- Backend faz essa lógica automática no cb_update_stage_status

### 1.4 toggleLock(stage) — código real (linhas 1202–1250)
```javascript
function toggleLock(stage) {
    if(!currentJobId) return;

    // 1. Determina novo estado (toggle)
    let newStatus = 'locked';
    if(currentStatus[stage] === 'locked') newStatus = 'open';

    // 2. Spinner no botão
    const btn = document.getElementById(`btn-lock-${stage}`);
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ...';

    // 3. Salva dados ANTES de travar (safety) + delay 1s
    if(stage === 'initial') saveBudgetLines(currentJobId, ...);
    if(stage === 'final')   saveRealizedCosts();
    if(stage === 'closing') saveRealizedCosts();

    // 4. Após 1s, chama backend
    fetch('cb_update_stage_status', { stage, status: newStatus })

    // 5. Após sucesso:
    //    currentStatus[stage] = newStatus
    //    Se initial→locked: currentStatus.final = 'open'; loadBudgetForFinal();
    //    Se final→locked:   currentStatus.closing = 'open'; renderClosingTable();
    //    updateLockUI();
}
```

### 1.5 setButtonState(btnId, isLocked, textLocked, textOpen)
```javascript
// isLocked = true  → btn LARANJA (.btn-unlock) + fa-lock-open + textLocked  (ex: "ABRIR ORÇAMENTO")
// isLocked = false → btn VERDE  (padrão .btn-lock) + fa-lock + textOpen     (ex: "FINALIZAR ORÇAMENTO")
```

### 1.6 updateLockUI() — código real (linhas 1265–1300)
```javascript
function updateLockUI() {
    // 1. INICIAL
    const ctrInit = document.getElementById('budget-tables-container');
    const lockedInit = (currentStatus.initial === 'locked');
    if(lockedInit) ctrInit.classList.add('locked-sheet'); else ctrInit.classList.remove('locked-sheet');
    setButtonState('btn-lock-initial', lockedInit, 'ABRIR ORÇAMENTO', 'FINALIZAR ORÇAMENTO');

    // 2. FINAL
    const ctrFinal = document.getElementById('final-tables-container');
    const lockedFinal = (currentStatus.final === 'locked');
    if(lockedInit) {  // só acessa se INICIAL estiver locked
        document.getElementById('nav-orc2').classList.remove('dimmed', 'disabled');
        if(lockedFinal) ctrFinal.classList.add('locked-sheet'); else ctrFinal.classList.remove('locked-sheet');
        setButtonState('btn-lock-final', lockedFinal, 'ABRIR ORÇAMENTO', 'FINALIZAR ORÇAMENTO');
    } else {
        document.getElementById('nav-orc2').classList.add('dimmed', 'disabled');
    }

    // 3. FECHAMENTO
    const ctrClosing = document.getElementById('closing-table');  // ⚠️ precisa ser 'closing-tables-container'
    const lockedClosing = (currentStatus.closing === 'locked');
    if(lockedFinal && lockedInit) {  // só acessa se FINAL E INICIAL estiverem locked
        document.getElementById('nav-fechamento').classList.remove('dimmed', 'disabled');
        if(lockedClosing) ctrClosing.classList.add('locked-sheet'); else ctrClosing.classList.remove('locked-sheet');
        setButtonState('btn-lock-closing', lockedClosing, 'REABRIR PROJETO', 'ENCERRAR PROJETO');
    } else {
        document.getElementById('nav-fechamento').classList.add('dimmed', 'disabled');
    }
}
```

---

## 2. BACKEND PHP — DETALHES

### 2.1 Tabelas MySQL

#### wp_cinebuddy_projects
```sql
id              mediumint(9) AUTO_INCREMENT PRIMARY KEY
job_id          varchar(20)     -- ex: #BZ0001
title           varchar(255)    -- nome do projeto
agency          varchar(255)    -- agência
client          varchar(255)    -- cliente
duration        varchar(50)     -- duração (número)
status_initial  varchar(20)     DEFAULT 'open'
status_final    varchar(20)     DEFAULT 'locked'
status_closing  varchar(20)     DEFAULT 'locked'
updated_at      datetime        DEFAULT CURRENT_TIMESTAMP
```
⚠️ NOTA: `duration_unit` (segundos/minutos) é enviado pelo frontend mas NÃO está na tabela. Precisa migração.

#### wp_cinebuddy_budget_lines
```sql
id              mediumint(9) AUTO_INCREMENT PRIMARY KEY
project_id      mediumint(9)    -- FK para projects
stage           varchar(50)     -- 'initial'
department      varchar(100)    -- ex: 'DIREÇÃO'
role_function   varchar(100)    -- função (labor) ou fornecedor (cost)
item_name       varchar(255)    -- nome profissional (labor) ou item (cost)
unit_type       varchar(20)     -- 'dia'|'sem'|'flat' (labor) ou 'cache'|'verba'|'extra' (cost)
unit_cost       decimal(10,2)   -- cachê/valor unitário
extra_cost      decimal(10,2)   -- deslocamento (labor) ou 0
quantity        decimal(10,2)   -- quantidade
total_cost      decimal(10,2)   -- total orçado

-- Campos de realização (preenchidos no ORC FINAL)
real_unit_cost  decimal(10,2)   DEFAULT 0
real_extra_cost decimal(10,2)   DEFAULT 0
real_quantity   decimal(10,2)   DEFAULT 0
real_total_cost decimal(10,2)   DEFAULT 0

-- Campos de pagamento (preenchidos no FECHAMENTO)
pay_status      varchar(20)     DEFAULT 'pendente'   -- 'pendente' ou 'pago'
pay_date        date
pay_doc         varchar(50)     -- número NF
pay_obs         text
```

#### wp_cinebuddy_professionals
```sql
id            mediumint(9) AUTO_INCREMENT PRIMARY KEY
name          varchar(255)
role_default  varchar(100)
cpf           varchar(20)
rg            varchar(20)
phone         varchar(50)
email         varchar(100)
address       text
cnpj          varchar(30)
pix_key       varchar(100)    -- chave PIX (usado no modal PIX do FECHAMENTO)
bank          varchar(100)    -- nome banco
agency        varchar(20)     -- agência bancária
account       varchar(30)     -- conta
daily_rate    decimal(10,2)
weekly_rate   decimal(10,2)
```

#### wp_cinebuddy_company
```sql
id, company_name, fantasy_name, cnpj, address, phone, email, website
```

#### wp_cinebuddy_roles
```sql
id, role_name, department, base_rate
```

#### wp_cinebuddy_app_users / wp_cinebuddy_logs — existem, não usadas ativamente

---

### 2.2 AJAX Actions — Mapa Completo

| Action | Método | Dados Enviados | Retorno |
|--------|--------|----------------|---------| 
| cb_save_project | POST | title, agency, client, duration, duration_unit, current_job_id | { job_id, status:{initial,final,closing} } |
| cb_update_stage_status | POST | job_id, stage, status | success |
| cb_save_budget_lines | POST | job_id, lines (JSON) | success |
| cb_save_realized | POST | lines (JSON: id, real_rate, real_qty, real_travel, real_total, pay_*) | success |
| cb_get_budget_lines | GET | job_id | { lines:[...], status:{initial,final,closing} } |
| cb_list_projects | GET | — | [{id, job_id, title, client, updated_at}] |
| cb_get_pros | GET | term | [{id, name, role_default, cpf, pix_key, bank, agency, account, ...}] |
| cb_get_roles | GET | term | [{id, role_name, department, base_rate}] |
| cb_save_professional | POST | id, name, role_default, cpf, ... | success |
| cb_list_professionals | GET | — | [{id, name, ...}] |
| cb_save_company | POST | company_name, fantasy_name, ... | success |

---

### 2.3 Preservação de dados reais (lógica do backend)
Quando INICIAL é salvo (cb_save_budget_lines), as linhas são DELETADAS e recriadas. Para não perder dados reais que já foram preenchidos no FINAL, o backend:
1. Busca linhas antigas antes de deletar
2. Faz match por role_function ou item_name
3. Preserva campos real_* e pay_* na nova inserção

### 2.4 Auto-migração
Backend verifica se colunas existem antes de usar:
```php
$cols = $wpdb->get_col("DESCRIBE wp_cinebuddy_projects");
if (!in_array('status_initial', $cols)) { $wpdb->query("ALTER TABLE ... ADD ..."); }
```
Usar esse mesmo padrão para qualquer nova coluna.

### 2.5 O que PRECISA ser adicionado ao backend (para FECHAMENTO completo)

**Colunas a adicionar em budget_lines:**
```sql
diaria_de          int DEFAULT 8        -- horas da diária (4-16)
adicional_pct      int DEFAULT 0        -- % adicional (0-100)
qtd_horas_extras   int DEFAULT 0        -- horas extras (0-12)
nf_link            text                 -- link/número NF
```

**Actions novas:**
- cb_save_closing_details — salvar detalhes do fechamento
- cb_get_professional_by_id — buscar dados bancários por ID (modal PIX)

**Nova tabela para PRESTAÇÃO DE CONTAS:**
```sql
wp_cinebuddy_prestacao_contas
  id, project_id, nome, descricao, valor, nf_link, pay_status, pay_date
```

---

## 3. FLUXO DE DADOS ENTRE ABAS

### 3.1 Como dados chegam ao FINAL
```
Triggers:
  1. loadProject() → se initial === 'locked' → loadBudgetForFinal()
  2. switchTab('orc-final') → loadBudgetForFinal()
  3. toggleLock('initial') → se newStatus === 'locked' → loadBudgetForFinal()

loadBudgetForFinal():
  fetch('cb_get_budget_lines?job_id=...')
  → populateFinalTables(data.lines)
  → cada linha preenche campos orçados (readonly) + campos reais (editáveis)
  → se real_unit_cost === 0, usa valor orçado como default
```

### 3.2 Como dados chegam ao FECHAMENTO
```
Trigger: toggleLock('final') → se newStatus === 'locked' → renderClosingTable()

renderClosingTable() atual:
  → Busca <tr> do DOM do view-orc-final (⚠️ problema: se não visitou aba, DOM vazio)
  → Filtra por real > 0
  → Cria linhas simplificadas no fechamento
```

### 3.3 Dados salvos no backend
```
INICIAL → saveBudgetLines(): department, role, name, type, rate, travel, qty, total
FINAL/FECHAMENTO → saveRealizedCosts(): id, real_rate, real_qty, real_travel, real_total, pay_status, pay_doc, pay_date
```

---
