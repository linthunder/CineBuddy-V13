# Relatório de Análise: Implementação no ORÇAMENTO FINAL

**Objetivo:** Avaliar viabilidade de incluir no Orçamento Final: PhaseDefaultsBar, tabelas AGÊNCIA/CLIENTE, automações (Catering, etc.) e Tabela de Cachês, preservando o workflow em cascata.

---

## 1. Compreensão do Sistema de Cascata

### 1.1 Fluxo de Dados

```
ORÇAMENTO INICIAL (editável)
    │
    │  Ao clicar "FINALIZAR ORÇAMENTO"
    ├── Snapshot capturado: budgetLines, verbaLines, miniTables, phaseDefaults, jobValue, taxRate, notes
    ├── setInitialSnapshot(snapshot)
    ├── Status: initial='locked', final='open'
    └── Auto-save (payload inclui budget_lines_initial + budget_lines_final)
           │
           ▼
ORÇAMENTO FINAL (recebe dados do snapshot)
    │  - initialSnapshot repassado como prop
    │  - useEffect clona budgetLines/verbaLines/miniTables/notes para estado local
    │  - Linhas recebem sufixo "-f" (ex: id-f) para edição independente
    │
    │  Ao clicar "FINALIZAR ORÇAMENTO" (no Final)
    ├── setFinalSnapshot(snapshot do ViewOrcFinal)
    └── Status: final='locked', closing='open'
           │
           ▼
FECHAMENTO (recebe dados do finalSnapshot)
    │  - Converte budgetLines/verbaLines em ClosingLine[]
    │  - Ignora linhas type='people' (AGÊNCIA/CLIENTE)
    │  - Exibe comparativos orçado vs realizado
    └── Linhas de fechamento usadas para prestação de contas
```

### 1.2 Função de Cada Estágio

| Estágio | Função | Dados principais |
|--------|--------|------------------|
| **Orçamento Inicial** | Planejamento: definir equipe, itens, valores orçados, padrões por fase (dias, semanas, deslocamento, alimentação), tabelas AGÊNCIA/CLIENTE (pessoas no set) | budgetLines, verbaLines, miniTables, phaseDefaults, cacheTableId |
| **Orçamento Final** | Ajuste pós-produção: alterar valores reais (Cachê Real, Desl. Real, Qtd Real, etc.) mantendo orçado como referência; comparação orçado x real | Mesmos depts, linhas editáveis com valores "real" |
| **Fechamento** | Consolidação para pagamento: linhas com status de pagamento, NF, datas; não inclui pessoas (AGÊNCIA/CLIENTE) | closingLines, expenses, saving |

### 1.3 O Que Já Transfere Hoje

- **budgetLines** ✓ (inclui AGÊNCIA/CLIENTE pois usam DEPARTMENTS.prod)
- **verbaLines** ✓
- **miniTables** ✓ (Contingência, CRT, BV Agência)
- **notes** ✓
- **jobValue, taxRate** ✓ (do Inicial para cálculos)

**Não transfere hoje:**
- **phaseDefaults** (dias, semanas, deslocamento, alimentação) — só existe no Inicial
- **cacheTableId** — só no Inicial; Final não tem seletor de tabela de cachês
- **projectData.agencia / cliente** — ViewOrcFinal não recebe; headerLabel em AGÊNCIA/CLIENTE ficaria vazio ou "—"

---

## 2. O Que Precisa Ser Implementado

### 2.1 PhaseDefaultsBar

**Estado atual:** Existe apenas no ViewOrcamento (Inicial).

**Proposta:**
- Adicionar PhaseDefaultsBar no toolbar do ViewOrcFinal.
- Estado: `phaseDefaults` no ViewOrcFinal (inicializado a partir do snapshot).
- **Transferência:** Incluir `phaseDefaults` no BudgetSnapshot e no payload ao finalizar Inicial → copiar para o Final junto com budgetLines.
- **Persistência:** Criar coluna `phase_defaults_final` (ou reaproveitar `phase_defaults_initial` se o Final herdar os mesmos valores iniciais). Hoje só `phase_defaults_initial` existe no banco.
- **Ações Aplicar:** No Final, Aplicar Dias/Semanas/Deslocamento/Alimentação devem funcionar igual ao Inicial (alterando as linhas clonadas do snapshot).

**Risco:** Baixo. O snapshot já contém phaseDefaults; basta incluir no tipo do initialSnapshot e no clone.

### 2.2 Tabelas AGÊNCIA e CLIENTE

**Estado atual:** BudgetLines já inclui AGÊNCIA/CLIENTE em prod (DEPARTMENTS.prod = PROD_LIST). O clone no useEffect do ViewOrcFinal percorre `initialSnapshot.budgetLines[phase]` por dept — como DEPARTMENTS.prod já tem AGÊNCIA e CLIENTE, as linhas são clonadas. BudgetDeptBlock renderiza os blocos.

**O que falta:**
1. **headerLabel:** ViewOrcFinal não recebe `projectData`. É preciso passar `projectData` (ou pelo menos `agencia` e `cliente`) para ViewOrcFinal e daí para BudgetDeptBlock.
2. **BudgetDeptBlock:** Já suporta headerLabel; falta só a prop vir do OrcFinal.

**Persistência:** budget_lines_final já armazena JSONB. Linhas de AGÊNCIA/CLIENTE (type: 'people') são salvas normalmente.

**Risco:** Muito baixo. Apenas repassar projectData ao ViewOrcFinal.

### 2.3 Automação de CATERING

**Estado atual (Inicial):**
- Primeira linha de CATERING: "Alimentação equipe" com unitCost = alimentacaoPerPerson × teamCount.
- teamCount = labor + CASTING (soma de quantity) + AGÊNCIA/CLIENTE (1 por linha).
- updateFirstCateringRow em addRow, removeRow, updateRow (qtd CASTING), e useEffect quando phaseDefaults ou budgetLines mudam.

**Proposta para o Final:**
- Replicar a mesma lógica: phaseDefaults, teamCountForPhase, updateFirstCateringRow.
- Ao carregar do snapshot, a 1ª linha de CATERING já vem com o valor calculado; se o usuário alterar phaseDefaults ou adicionar/remover pessoas, recalcular.
- **Observação:** No Final, o foco é "realizar" custos. A linha de alimentação pode ser editada manualmente (unitCost, quantity). A automação é útil para manter coerência ao alterar dias, equipe etc., mas não é obrigatória para o workflow de fechamento.

**Risco:** Baixo. A lógica já existe; é reutilizar no ViewOrcFinal com cuidado para não conflitar com edições manuais.

### 2.4 Tabela de Cachês

**Estado atual:** ViewOrcamento tem BudgetTabs com cacheTables, cacheTableId, onCacheTableChange. ViewOrcFinal tem BudgetTabs sem essas props (apenas phase tabs e lock).

**Proposta:**
- Incluir cacheTableId no estado do ViewOrcFinal (ou herdado do Inicial).
- Passar cacheTables, cacheTableId, onCacheTableChange para BudgetTabs no ViewOrcFinal.
- **Persistência:** cache_table_id é único por projeto; Final e Inicial compartilham o mesmo projeto. Não há `cache_table_id_final` no banco — usa-se o mesmo cache_table_id do projeto.
- **Comportamento:** Ao finalizar o Inicial, o cacheTableId já está definido. No Final, o usuário pode trocar a tabela (para autocomplete de funções em novas linhas); ao salvar, o payload atual usa orcState.cacheTableId. O save do Final não envia cache_table_id hoje — isso vem do orcState (Inicial). Será preciso definir: Final pode ter tabela diferente? Se sim, adicionar cache_table_id_final ou passar cacheTableId do Final no payload.

**Risco:** Médio. Exige decisão: Final usa a mesma tabela do Inicial ou pode escolher outra? Se mesma: apenas repassar cacheTableId do snapshot. Se pode mudar: novo campo no estado e no payload.

---

## 3. Impactos no Workflow

### 3.1 Fechamento

- ViewFechamento já ignora `row.type === 'people'` ao montar closingLines.
- Nenhum ajuste necessário no Fechamento para AGÊNCIA/CLIENTE.

### 3.2 Salvamento

- **handleSave** coleta orcState (Inicial) e orcFinalState (Final).
- Payload atual para Final: budget_lines_final, verba_lines_final, mini_tables_final, notes_final, job_value_final, tax_rate_final.
- Será preciso incluir phase_defaults_final (se Final tiver phaseDefaults editáveis) e garantir que cache_table_id reflita a escolha correta (Inicial ou Final, conforme regra definida).

### 3.3 Carregamento de Projeto

- orcFinalData hoje: budget_lines_final, verba_lines_final, mini_tables_final, notes_final.
- Adicionar phaseDefaults ao loadState do ViewOrcFinal (a partir de phase_defaults_final ou phase_defaults_initial).

---

## 4. Resumo de Alterações Necessárias

| Item | Onde | Tipo | Complexidade |
|------|------|------|--------------|
| phaseDefaults no initialSnapshot | page.tsx, ViewOrcamento getState | Incluir no snapshot | Baixa |
| phase_defaults_final no banco | migration, projects | Nova coluna (opcional: reutilizar initial) | Baixa |
| PhaseDefaultsBar no ViewOrcFinal | ViewOrcFinal toolbar | Novo componente + estado | Média |
| Automação CATERING no ViewOrcFinal | ViewOrcFinal | Replicar lógica do Inicial | Média |
| projectData no ViewOrcFinal | page.tsx → ViewOrcFinal → BudgetDeptBlock | Repassar props | Baixa |
| cacheTables/cacheTableId no ViewOrcFinal | page.tsx, ViewOrcFinal, BudgetTabs | Estado + props | Média |
| createEmptyRow no Final com phaseDefaults | ViewOrcFinal addRow | Passar phaseDefaults | Baixa |

---

## 5. Conclusão e Recomendação

**Viabilidade:** Alta. O workflow em cascata pode ser mantido. As alterações são incrementais e compatíveis com o que já existe.

**Recomendações:**
1. **PhaseDefaultsBar:** Implementar; melhora a coerência Dias/Semanas/Deslocamento/Alimentação no Final.
2. **AGÊNCIA/CLIENTE:** Implementar; repassar projectData resolve o headerLabel.
3. **Automação CATERING:** Implementar com o mesmo critério do Inicial; mantém a 1ª linha de alimentação alinhada às mudanças de equipe e dias.
4. **Tabela de Cachês:** Implementar com regra simples: Final usa o mesmo cacheTableId do Inicial (herdado do snapshot). Não criar cache_table_id_final por enquanto.

**Ordem sugerida de implementação:**
1. projectData → ViewOrcFinal → headerLabel (AGÊNCIA/CLIENTE) — rápido
2. phaseDefaults no snapshot e no clone do ViewOrcFinal
3. PhaseDefaultsBar no toolbar do ViewOrcFinal
4. Automação CATERING (teamCount, updateFirstCateringRow) no ViewOrcFinal
5. cacheTableId no ViewOrcFinal (herdar do snapshot) e BudgetTabs com seletor
6. Persistência phase_defaults_final (se for necessário histórico distinto)

---

**Aguardando confirmação para iniciar a implementação.**
