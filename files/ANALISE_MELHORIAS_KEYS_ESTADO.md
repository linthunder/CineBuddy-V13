# Análise de melhorias – keys únicas, estado e consistência

**Objetivo:** Evitar keys duplicadas em listas React e outros pontos de melhoria no mesmo sentido (estado, comunicação, UX).

---

## 1. Keys duplicadas – o que foi corrigido nesta análise

### 1.1 ViewFechamento.tsx

| Local | Problema | Correção |
|-------|----------|----------|
| **Modal responsáveis (lista de opções)** | `key={opt}` — o mesmo rótulo (ex.: "Diretor de Produção (Diretor de Produção)") podia aparecer mais de uma vez no array. | Passamos a usar `key={\`${expenseResponsibleModalDept}-opt-${idx}\`}` e deduplicamos o array com `Set`. |
| **Chips dos responsáveis selecionados (modal)** | `key={name}` — se responsável 1 e 2 fossem a mesma pessoa, duas keys iguais. | `key={\`${expenseResponsibleModalDept}-resp-${idx}\`}`. |
| **Bloco por departamento (lista responsáveis r1, r2)** | `<Fragment key={name}>` — mesmo risco quando r1 e r2 são iguais. | `key={\`${dept}-resp-${i}\`}`. |

### 1.2 PrestacaoContasDeptView.tsx

| Local | Problema | Correção |
|-------|----------|----------|
| **Lista de responsáveis no cabeçalho** | `key={name}` — dois responsáveis com mesmo nome gerariam keys iguais. | `key={\`resp-${i}\`}`. |

### 1.3 ViewDashboard.tsx

| Local | Problema | Correção |
|-------|----------|----------|
| **Barras por departamento (custo)** | `key={d.name}` — nomes de departamento poderiam repetir em cenários edge. | `key={\`dept-cost-${i}\`}`. |
| **Barras por departamento (headcount)** | Idem. | `key={\`dept-hc-${i}\`}`. |
| **Tabela de comparação (Inicial vs Final)** | `key={d.name}` — mesma lógica. | `key={\`comp-${i}\`}`. |

### 1.4 ViewConfig.tsx

| Local | Problema | Correção |
|-------|----------|----------|
| **Galeria de ícones (filtro)** | `key={name}` — ícones em lista podem ter nomes repetidos. | `key={\`gallery-icon-${i}\`}`. |

---

## 2. Outros pontos já verificados (sem alteração)

- **Header.tsx:** lista de projetos usa `key={p.id}` (id único do Supabase).
- **ViewFechamento / tabelas:** linhas usam `key={line.id}`, `key={exp.id}` (ids únicos).
- **ViewConfig (APP_ICONS):** array estático com nomes únicos; `key={name}` mantido.
- **ViewTeam:** já usa `key={\`${member.name}-${member.role}-${idx}\`}`.
- **AutocompleteInput:** já usa `key={\`${opt.label}-${i}\`}`.
- **BudgetDeptBlock, ViewOrcamento, ViewOrcFinal:** keys por `row.id`, `v.id`, `dept` (únicos no contexto).

---

## 3. Boas práticas adotadas

1. **Listas derivadas de dados do usuário:** preferir key que inclua **índice** quando o valor exibido (nome, rótulo) pode repetir: `key={\`contexto-${idx}\`}` ou `key={\`${id}-${idx}\`}`.
2. **Listas estáticas (opções fixas):** `key={opt}` ou `key={name}` é aceitável se a fonte garante unicidade; em dúvida, usar índice.
3. **Listas com id único (API/DB):** manter `key={item.id}`.
4. **Deduplicar opções ao montar:** quando a lista é montada a partir de várias fontes (ex.: cargos fixos + linhas do fechamento), usar `Array.from(new Set([...a, ...b]))` para não exibir o mesmo rótulo duas vezes e reduzir risco de key duplicada.

---

## 4. Possíveis melhorias futuras (não implementadas)

- **ViewConfig – APP_ICONS:** hoje `key={name}`; se no futuro houver ícones com mesmo `name`, trocar para `key={\`app-icon-${i}\`}`.
- **useEffect com async:** em auth-context e outros, já existe tratamento de `cancelled`; manter esse padrão em qualquer novo efeito assíncrono.
- **Cache leve da lista de projetos (Header):** mencionado no plano de ajustes globais; opcional para reduzir sensação de lentidão ao abrir o modal Abrir.

---

## 5. Resumo

- **Corrigido nesta análise:** 7 pontos de key em 4 arquivos (ViewFechamento, PrestacaoContasDeptView, ViewDashboard, ViewConfig), além da deduplicação do array de opções de responsáveis no ViewFechamento.
- **Verificado e mantido:** uso de `id` ou key composta com índice onde já estava correto.
- **Documentado:** regras para keys e deduplicação para manter consistência em novas listas.
