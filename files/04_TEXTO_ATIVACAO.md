# TEXTO DE ATIVAÇÃO — Cole isso no início da próxima conversa

---

Olá Claude. Estamos continuando o desenvolvimento do **CineBuddy**, um SPA de orçamentos audiovisuais que roda dentro do WordPress via Elementor Canvas. O código atual é a versão **V13.49**.

Vou te fornecer os seguintes arquivos — leia TODOS os documentos de contexto ANTES de escrever qualquer código:

**Código:**
1. `CineBuddy_frontend_V13_49.html` — frontend completo (1699 linhas, HTML + CSS + JS inline)
2. `CineBuddy_backend_V13_49.php` — backend PHP (WordPress AJAX handlers)

**Contexto (leia primeiro, nessa ordem):**
3. `01_CONTEXTO_MESTRE.md` — arquitetura, padrões visuais, convenções de código, IDs, estado de cada página
4. `02_WORKFLOW_BACKEND.md` — sistema de lock/unlock, backend PHP, tabelas MySQL, AJAX actions, fluxo de dados
5. `03_SPEC_IMPLEMENTACAO.md` — especificação detalhada do que refatorar e construir, com prioridades

---

### CONTEXTO RÁPIDO

O CineBuddy tem estas abas no bottom nav:
- **FILME** ✅ — dados do projeto + 4 botões ação (placeholders)
- **ORÇAMENTO** ✅ — orçamento inicial completo: 12+4 departamentos em 2 colunas, finance strip com +30%, mini tabelas (CONTINGÊNCIA/CRT/BV), verbas em 3 depts, OBSERVAÇÕES em todas as fases
- **ORÇ. FINAL** ⚠️ — stub parcial com bugs latentes → **refatorar (Fase 1)**
- **FECHAMENTO** ⚠️ — stub básico com 1 tabela simplificada → **construir (Fase 2)**
- **EQUIPE** — placeholder
- **CONFIG** — básico funcional

O workflow funciona em cascata linear e irreversível (exceto reabrir):
```
ORÇAMENTO INICIAL (open)
  → FINALIZAR → bloqueia INICIAL, abre FINAL (copia dados)
    → FINALIZAR → bloqueia FINAL, abre FECHAMENTO (copia dados)
      → ENCERRAR → bloqueia FECHAMENTO
```
Cada estággio pode ser reaberto pelo botão laranja. Sistema já implementado e funcional.

---

### O QUE FAZER AGORA (seguir essa ordem exata)

#### FASE 1 — Refatorar ORÇAMENTO FINAL

1. **Finance Strip:** Adicionar os 3 IDs que faltam no HTML (final-job-val, final-profit-diff, final-margin). Redesenhar para ter 6 caixas: VALOR JOB (readonly) | CUSTO | CUSTO REAL | DIFERENÇA | LUCRO REAL | MARGEM

2. **renderFinalBudgetTables():** Reescrever para separar labor vs cost com colunas corretas:
   - Labor: Função | Nome | Tipo | Cachê | Desl. | Qtd | Total | Cachê Real | Desl. Real | Qtd Real | Total Real | Dif
   - Cost: Item | Fornecedor | Tipo | Valor | Qtd | Total | Valor Real | Qtd Real | Total Real | Dif
   - Usar customHeaders por departamento (CASTING→Nome/Descrição, etc.)

3. **populateFinalTables():** Reescrever para:
   - Separar labor vs cost na criação das linhas
   - Usar formatação moeda (formatCurrencyOnBlur / parseCurrencyInput) nos campos reais
   - Campos orçados: readonly, cinza
   - Campos reais: editáveis, default = valor orçado se real === 0

4. **calcFinalRow():** Reescrever para labor vs cost:
   - Labor: totalReal = (cachêReal + deslReal) × qtdReal
   - Cost: totalReal = valorReal × qtdReal

5. **OBSERVAÇÕES:** Adicionar textarea em cada fase (mesmo padrão do INICIAL)

6. **Totais por dept:** Atualizar ftotal-tbl-{...} no calcFinalRow

#### FASE 2 — Construir FECHAMENTO

1. **HTML base:** Finance Strip + tabs PRÉ/PROD/PÓS + btn-lock-closing + closing-tables-container

2. **renderClosingTables():** Gerar estrutura de linhas agrupadas:
   - Labor: 3 linhas (principal readonly + fechamento com selects + resumo com totais e botões)
   - Cost: 2 linhas (principal readonly + resumo com NF e botão pagamento)

3. **Horas extras:** Diária de (4-16h) × Adicional (0-100%) × Horas Extra (0-12h) → cálculo automático

4. **Botão A PAGAR/PAGO:** Toggle vermelho/verde em todas as linhas

5. **Modal PIX:** Busca dados bancários via cb_get_pros pelo nome do profissional

6. **PRESTAÇÃO DE CONTAS:** Tabela adicional abaixo das fases com autocomplete de profissionais

7. **updateLockUI:** Corrigir para usar closing-tables-container como container do locked-sheet

---

### REGRAS QUE DEVEM SER SEGUIDAS SEMPRE

1. **Película amarela:** Usar SEMPRE `rgba(245,197,24,0.1)` nos hovers de elementos interativos
2. **Moeda:** Usar SEMPRE `parseCurrencyInput()` para ler e `formatCurrencyOnBlur()` para formatar. Nunca `parseFloat()` diretamente em campos com "R$"
3. **Layout:** Manter grid 2 colunas (phase-wrapper) com breakpoint em 1400px
4. **dept-block:** Usar SEMPRE: dept-header (bg #111, texto amarelo) + dept-body (bg #3a3a3a)
5. **IDs:** Seguir convenção existente. Não inventar padrões novos
6. **Não quebrar:** FILME e ORÇAMENTO INICIAL estão completos e aprovados — NÃO alterar nada nessas seções
7. **Código inline:** Tudo permanecer em um único arquivo .html. Sem frameworks
8. **Versioning:** Após cada implementação significativa, nomear como V13.50, V13.51, etc.
9. **window.initialBudgetData:** Pode ser undefined se usuário não visitou INICIAL. Sempre usar fallback: `window.initialBudgetData ? window.initialBudgetData.jobValue : 0`
10. **OBSERVAÇÕES:** Usar id="notes-{fase}" no INICIAL e id="notes-final-{fase}" no FINAL

---

### IMPORTANTE
- Leia os documentos de contexto ANTES de escrever qualquer código
- O documento 03_SPEC_IMPLEMENTACAO.md contém a especificação detalhada com exemplos de cálculo, layouts ASCII, e lista de bugs conhecidos
- O documento 02_WORKFLOW_BACKEND.md contém o código real das funções toggleLock e updateLockUI que precisam ser integradas
- Após finalizar Fase 1, mostre o código e aguarde aprovação antes de prosseguir para Fase 2

---
