# CINEBUDDY — INSTRUÇÕES DO PROJETO
## Regras e Protocolos para TODAS as Conversas

---

## 0. PROTOCOLO DE IMPLEMENTAÇÃO (LEIS SAGRADAS — seguir rigorosamente)

### 0.1 ANTES de implementar qualquer código:
```
☐ Entendi a solicitação dentro do contexto do sistema como um todo?
☐ Qual o objetivo dessa implementação?
☐ Como ela se conecta com outras partes do sistema?
☐ Ela pode afetar partes já aprovadas e funcionais?
```

### 0.2 DURANTE a implementação:
```
✅ NUNCA faça implementações baseadas em suposições
✅ SEMPRE verifique se não afeta outras partes do código
✅ SEMPRE siga a referência exata do layout existente (consistência visual)
✅ SEMPRE faça checagem dupla (revisão de prova real) antes de entregar
```

### 0.3 AO ENTREGAR o código:

**IMPORTANTE: Entrega em 2 etapas para evitar limite de tokens**

**ETAPA 1 — Relatório de Implementação (no chat):**
```markdown
## 🔧 IMPLEMENTAÇÃO V13.XX

### Objetivo:
[Qual o propósito dessa implementação]

### Conexões com o Sistema:
[Como se conecta com outras partes]

### Arquivos Modificados:
- [ ] Frontend (motivo da alteração)
- [ ] Backend (motivo da alteração)

### Implementações Realizadas:
1. [item implementado com detalhes]
2. [item implementado com detalhes]
3. [item implementado com detalhes]

### Trechos de Código Modificados:
```javascript
// Apenas os trechos principais modificados (não o arquivo inteiro)
// Exemplo: função renderFinalBudgetTables() linhas 1397-1427
```

### Verificações de Segurança:
✅ Não afeta FILME ou ORÇAMENTO INICIAL
✅ Segue padrões visuais existentes (película amarela, dept-block)
✅ Usa parseCurrencyInput/formatCurrencyOnBlur nos campos monetários
✅ Checagem dupla realizada
✅ IDs seguem convenções estabelecidas

### Próximo Passo:
Aguardando confirmação: "IMPLEMENTAÇÃO APROVADA" ou feedback de ajustes
```

**ETAPA 2 — Arquivo(s) Completo(s) para Download:**
```
Após o relatório, use:
- create_file para gerar arquivos completos em /home/claude/
- present_files para disponibilizar download

Exemplo:
"Gerando arquivo completo para download..."
[create_file: CineBuddy_frontend_V13_50.html]
[present_files para o usuário baixar]
```

**O que NÃO fazer:**
```
❌ NÃO cole o HTML completo (1699 linhas) no chat
❌ NÃO tente mostrar o arquivo inteiro na resposta
✅ Mostre apenas trechos relevantes + gere arquivo para download
```

### 0.4 APÓS implementação:
```
Aguardar resposta:
  "IMPLEMENTAÇÃO APROVADA" → registrar versão como APROVADA, prosseguir
  Feedback de ajuste → corrigir e reenviar (relatório + arquivo)
```

### 0.5 SUGESTÕES e MELHORIAS:
```
✅ Você TEM liberdade para sugerir melhorias
❌ NÃO implemente sem confirmação prévia

Formato sugerido:
"Identifiquei uma oportunidade de melhoria:
 [descrição da melhoria]
 [justificativa técnica]
 Posso implementar isso junto com a tarefa atual?"
```

---

## 1. SOBRE ESTE PROJETO

**CineBuddy V13** é um SPA de orçamentos audiovisuais que roda dentro do WordPress via Elementor Canvas.

- **Arquitetura:** Single-file HTML + CSS + JS inline (sem frameworks, sem bundlers)
- **Backend:** WordPress plugin PHP com AJAX handlers
- **Estado atual:** V13.49 — FILME e ORÇAMENTO INICIAL completos, ORÇAMENTO FINAL e FECHAMENTO precisam ser implementados

---

## 2. REGRAS ESSENCIAIS (aplicam-se a TODAS as conversas)

### 2.1 Formatação de Moeda (CRÍTICO)
```javascript
✅ SEMPRE usar: parseCurrencyInput(valor)  para ler campos com "R$ 1.234,56"
✅ SEMPRE usar: formatCurrencyOnBlur(input) no evento blur dos inputs monetários
❌ NUNCA usar: parseFloat() diretamente em campos que exibem "R$ X.XXX,XX"
```

### 2.2 Padrões Visuais (usar SEMPRE, sem exceção)
```css
/* Película Amarela — hover padrão do sistema */
background: rgba(245, 197, 24, 0.1);
border-color: var(--accent);  /* #f5c518 */
box-shadow: 0 0 8px rgba(245, 197, 24, 0.3);

/* dept-block — estrutura de blocos de departamento */
.dept-header { background: var(--primary); color: var(--accent); } /* bg #111, texto amarelo */
.dept-body   { background: var(--container-dark); }                 /* bg #3a3a3a */

/* Layout 2 colunas */
.phase-wrapper { display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px; }
/* breakpoint: @media (max-width: 1400px) → 1fr */
```

### 2.3 Convenções de IDs
```
Projeto:           in-nome, in-agencia, in-cliente, in-duracao, in-duracao-unit
Finance INICIAL:   fin-job-val, fin-cost-total, fin-profit, fin-tax-rate, fin-margin
Finance FINAL:     final-job-val, final-total-orc, final-total-real, final-diff, 
                   final-profit-real, final-profit-diff, final-margin
Tabelas:           tbl-{DEPT_SEM_ESPECIAIS}-{fase}  ex: tbl-DIRECAO-prod
Totais:            total-tbl-{...}  /  ftotal-tbl-{...}
Lock buttons:      btn-lock-initial, btn-lock-final, btn-lock-closing
Containers:        budget-tables-container, final-tables-container, closing-tables-container
Nav:               nav-filme, nav-orc1, nav-orc2, nav-fechamento
```

### 2.4 NÃO QUEBRAR O QUE FUNCIONA
```
❌ NÃO alterar: FILME (completo e aprovado)
❌ NÃO alterar: ORÇAMENTO INICIAL (completo e aprovado)
✅ PODE alterar: ORÇAMENTO FINAL (refatorar conforme Fase 1)
✅ PODE alterar: FECHAMENTO (construir conforme Fase 2)
```

### 2.5 Código Inline
- Tudo deve permanecer em um único arquivo `.html`
- Sem frameworks, sem bundlers, vanilla JS
- Backend em arquivo `.php` separado

### 2.6 Versioning
- Após cada implementação significativa: V13.50, V13.51, V13.52, etc.
- Nomenclatura: `CineBuddy_frontend_V13_XX.html` e `CineBuddy_backend_V13_XX.php`
- Quando receber "IMPLEMENTAÇÃO APROVADA": registrar versão como APROVADA

### 2.7 Fallbacks para Dados Globais
```javascript
// window.initialBudgetData pode ser undefined se usuário não visitou INICIAL
const jobValue = window.initialBudgetData?.jobValue || 0;
const profitNet = window.initialBudgetData?.profitNet || 0;
```

### 2.8 OBSERVAÇÕES (textareas de notas)
```javascript
// ORÇAMENTO INICIAL
id="notes-pre"  id="notes-prod"  id="notes-pos"

// ORÇAMENTO FINAL
id="notes-final-pre"  id="notes-final-prod"  id="notes-final-pos"

// FECHAMENTO
id="notes-closing-pre"  id="notes-closing-prod"  id="notes-closing-pos"
```

---

## 3. WORKFLOW DO PROJETO

### Estado Atual (V13.49):
```
✅ FILME           — completo, 4 botões ação (placeholders)
✅ ORÇAMENTO       — completo, 12+4 depts, finance strip, mini tabelas, verbas
⚠️  ORÇ. FINAL    — stub parcial com bugs → REFATORAR (Fase 1)
⚠️  FECHAMENTO    — stub básico → CONSTRUIR (Fase 2)
```

### Roadmap:
```
FASE 1 (prioridade imediata):
  → Refatorar ORÇAMENTO FINAL
  → Corrigir Finance Strip (adicionar IDs faltantes)
  → Reescrever renderFinalBudgetTables() separando labor vs cost
  → Adicionar OBSERVAÇÕES
  → Formatação de moeda nos campos reais

FASE 2 (após aprovação da Fase 1):
  → Construir FECHAMENTO do zero
  → Finance Strip próprio
  → Estrutura de 3 linhas por item (labor)
  → Cálculo de horas extras
  → Modal PIX, botão A PAGAR/PAGO
  → Tabela PRESTAÇÃO DE CONTAS
```

**Detalhes completos:** Ver `03_SPEC_IMPLEMENTACAO.md`

---

## 4. SISTEMA DE LOCK/UNLOCK (workflow de cascata)

```
ORÇAMENTO INICIAL (open)
  → FINALIZAR → bloqueia INICIAL, abre FINAL (loadBudgetForFinal executa)
    → FINALIZAR → bloqueia FINAL, abre FECHAMENTO (renderClosingTable executa)
      → ENCERRAR → bloqueia FECHAMENTO

Botão verde "FINALIZAR/ENCERRAR" → trava
Botão laranja "ABRIR/REABRIR"    → destrava
```

**Funções principais:**
- `toggleLock(stage)` — toggle do estado (linhas 1202-1250)
- `updateLockUI()` — atualiza toda UI (linhas 1265-1300)
- `setButtonState(btnId, isLocked, textLocked, textOpen)` — muda visual do botão

**Classes CSS:**
- `.locked-sheet` — aplicada aos containers para bloquear edição
- `.btn-lock` — verde (estado "aberto", botão mostra "finalizar")
- `.btn-unlock` — laranja (estado "travado", botão mostra "abrir")

**Detalhes completos:** Ver `02_WORKFLOW_BACKEND.md`

---

## 5. DEPARTAMENTOS & TIPOS

```javascript
// 12 departamentos em PRÉ e PRODUÇÃO
PRE_PROD_LIST = ['DIREÇÃO', 'PRODUÇÃO', 'FOTOGRAFIA E TÉCNICA', 'ARTE E CENOGRAFIA',
                 'FIGURINO E MAQUIAGEM', 'SOM DIRETO', 'CASTING', 'EQUIPAMENTOS',
                 'LOCAÇÕES', 'TRANSPORTE', 'CATERING', 'DESPESAS GERAIS']

// 4 departamentos em PÓS-PRODUÇÃO
POS = ['FINALIZAÇÃO', 'ANIMAÇÃO', 'VFX', 'ÁUDIO']

// Departamentos do tipo "labor" (profissionais)
LABOR_DEPTS = ['DIREÇÃO', 'PRODUÇÃO', 'FOTOGRAFIA E TÉCNICA', 'ARTE E CENOGRAFIA',
               'FIGURINO E MAQUIAGEM', 'SOM DIRETO', 'FINALIZAÇÃO', 'ANIMAÇÃO', 'VFX', 'ÁUDIO']

// Departamentos do tipo "cost" (itens/fornecedores)
// = PRE_PROD_LIST sem LABOR_DEPTS
// = CASTING, EQUIPAMENTOS, LOCAÇÕES, TRANSPORTE, CATERING, DESPESAS GERAIS
```

**Verbas** (botão "ADICIONAR VERBA") — apenas em:
- PRODUÇÃO
- FOTOGRAFIA E TÉCNICA
- ARTE E CENOGRAFIA

**Headers customizados** por departamento (usar no renderFinalBudgetTables):
```javascript
customHeaders = {
  'CASTING':         { item: 'Nome',  supplier: 'Descrição' },
  'LOCAÇÕES':        { item: 'Item',  supplier: 'Descrição' },
  'EQUIPAMENTOS':    { item: 'Item',  supplier: 'Fornecedor' },
  'CATERING':        { item: 'Item',  supplier: 'Descrição' },
  'TRANSPORTE':      { item: 'Item',  supplier: 'Descrição' },
  'DESPESAS GERAIS': { item: 'Item',  supplier: 'Descrição' }
};
```

---

## 6. COMO USAR ESTE PROJETO (protocolo para conversas)

### 6.1 Início de Conversa — Template Conciso
```
Claude, estou trabalhando em [tarefa específica].

Consulte:
- 03_SPEC_IMPLEMENTACAO.md seção [X]
- [outros docs se necessário]

[Descrição breve da tarefa]

IMPORTANTE: Entregue relatório no chat + arquivo completo para download.
```

### 6.2 Consultar Documentação
Quando necessário contexto adicional:
```
"Consulte 01_CONTEXTO_MESTRE.md para ver as convenções de IDs"
"Veja 02_WORKFLOW_BACKEND.md para entender o toggleLock"
"Siga 03_SPEC_IMPLEMENTACAO.md Fase 1 item 2"
```

### 6.3 Após Gerar Nova Versão
```
1. Claude gera relatório no chat + arquivo V13.50 para download
2. Você baixa, testa, e responde: "IMPLEMENTAÇÃO APROVADA"
3. Você: "Atualize o frontend no Project Knowledge para V13.50"
4. Claude faz o upload
5. Continue trabalhando ou inicie nova conversa
```

---

## 7. BUGS CONHECIDOS (corrigir durante implementação)

1. **IDs ausentes no HTML do ORC FINAL:** `final-job-val`, `final-profit-diff`, `final-margin` — calcFinalFinancials() vai dar erro
2. **duration_unit não salvo no backend:** campo enviado mas coluna não existe na tabela
3. **renderClosingTable() dependente do DOM:** busca dados de <tr> em vez do backend
4. **window.initialBudgetData pode ser undefined:** se abrir direto no FINAL sem passar pelo INICIAL
5. **updateLockUI usa closing-table:** precisa usar closing-tables-container como wrapper

---

## 8. DOCUMENTOS DO PROJETO (referência rápida)

| Documento | Quando Consultar |
|-----------|------------------|
| **01_CONTEXTO_MESTRE.md** | Arquitetura, mapa de linhas, IDs, padrões visuais, CSS variables |
| **02_WORKFLOW_BACKEND.md** | Sistema de lock, funções toggleLock/updateLockUI, backend PHP, MySQL |
| **03_SPEC_IMPLEMENTACAO.md** | O QUE implementar (Fase 1 e 2), layouts, cálculos, prioridades |
| **INSTRUCOES_PROJETO.md** | Este arquivo — regras essenciais (consultar sempre) |

---

## 9. CHECKLIST PRÉ-IMPLEMENTAÇÃO

```
☐ Li a seção relevante de 03_SPEC_IMPLEMENTACAO.md?
☐ Entendi o objetivo da implementação no contexto do sistema?
☐ Conferi como isso se conecta com outras partes?
☐ Verifiquei que não vai quebrar FILME ou ORÇAMENTO INICIAL?
☐ Conferi as convenções de IDs em 01_CONTEXTO_MESTRE.md?
☐ Vou usar parseCurrencyInput/formatCurrencyOnBlur para moeda?
☐ Vou usar película amarela nos hovers?
☐ Vou seguir o padrão dept-block (header #111 + body #3a3a3a)?
☐ Vou seguir referências visuais existentes (consistência)?
☐ Fiz checagem dupla do código antes de enviar?
```

---

## 10. FORMATO DE ENTREGA (evitar erro de limite de tokens)

### ✅ CORRETO (2 etapas):
```
ETAPA 1: Relatório resumido no chat (500-1000 linhas)
  - Objetivo e conexões
  - Trechos principais modificados
  - Verificações de segurança
  
ETAPA 2: Arquivo completo para download
  - create_file → CineBuddy_frontend_V13_50.html
  - present_files → link para usuário baixar
```

### ❌ ERRADO (causa erro de limite):
```
❌ Colar 1699 linhas de HTML no chat
❌ Tentar mostrar arquivo completo na resposta
❌ Repetir código que não mudou
```

**Por quê?**
- Limite de output por resposta: ~4000 tokens
- Arquivo completo: ~15000 tokens
- Resultado: truncamento/erro

**Solução:**
- Relatório: ~1000 tokens (cabe confortavelmente)
- Arquivo: via download (sem limite)

---

**Última atualização:** V13.49 (03/02/2026)
**Próxima milestone:** Fase 1 — Refatorar ORÇAMENTO FINAL
**Formato de entrega:** Relatório no chat + arquivo para download
**Protocolo de aprovação:** Aguardar "IMPLEMENTAÇÃO APROVADA" antes de prosseguir
