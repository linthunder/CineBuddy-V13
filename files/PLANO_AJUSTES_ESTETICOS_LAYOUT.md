# Plano de implementação — Ajustes estéticos e padronização do layout

Documento gerado a partir das solicitações do usuário. Objetivo: aplicar mudanças de nomenclatura, padronizar o FinanceStrip, labels e o comportamento visual dos botões em todo o sistema, de forma segura e sem quebrar funcionalidades.

---

## 1. Mudança de nomenclatura

### 1.1 Títulos de página e labels do menu inferior

| Onde | Atual | Novo |
|------|--------|------|
| **Página "Orçamento"** (previsto) | Título: "Orçamento" | "Orçamento Previsto" |
| **Menu inferior** (mesma view) | "ORÇAMENTO" | "ORÇ. PREVISTO" |
| **Página "Orçamento Final"** (realizado) | Título: "Orçamento Final" | "Orçamento Realizado" |
| **Menu inferior** (mesma view) | "ORÇ. FINAL" | "ORÇ. REALIZADO" |

**Arquivos a alterar:**
- `components/BottomNav.tsx`: em `ITEMS`, trocar `label` de `orcamento` para `'ORÇ. PREVISTO'` e de `orc-final` para `'ORÇ. REALIZADO'`.
- `components/views/ViewOrcamento.tsx`: em `PageLayout`, `title="Orçamento"` → `title="Orçamento Previsto"`.
- `components/views/ViewOrcFinal.tsx`: em ambos os usos de `PageLayout` (estado vazio e principal), `title="Orçamento Final"` → `title="Orçamento Realizado"`. Ajustar também a mensagem do estado vazio se mencionar "Orçamento Final".

**Risco:** Baixo. Apenas strings de UI; IDs (`orcamento`, `orc-final`) permanecem iguais.

### 1.2 Destaque do título da página

**Objetivo:** Títulos como "Orçamento Previsto", "Orçamento Realizado", "Fechamento", "Equipe", "Dashboard" devem parecer claramente como título da página.

**Arquivo:** `app/globals.css`

**Alteração:** Na classe `.page-layout__title`:
- Aumentar levemente o destaque: por exemplo `font-size` de `0.75rem` para `0.8125rem` (13px) e `font-weight` de `500` para `600`, mantendo uppercase e letter-spacing.

**Risco:** Baixo. Apenas CSS.

---

## 2. Padronização do FinanceStrip (Orçamento Previsto)

**Situação atual:**
- **Orçamento (Previsto):** usa `FinanceStrip.tsx` com grid `lg:grid-cols-[1.3fr_1fr_1fr_1.2fr_0.8fr]` (5 colunas com proporções diferentes).
- **Orçamento Realizado e Fechamento:** usam strip inline com `lg:grid-cols-5` (5 colunas iguais).

**Objetivo:** Deixar o strip da página Orçamento Previsto com o mesmo padrão visual das outras duas (5 colunas iguais).

**Arquivo:** `components/FinanceStrip.tsx`

**Alteração:** Na `div` principal do strip, trocar:
`grid-cols-1 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr_0.8fr]`
por
`grid-cols-1 lg:grid-cols-5`.

**Risco:** Baixo. Pode alterar levemente a largura das colunas em telas grandes; conteúdo e comportamento permanecem.

---

## 3. Padronização de labels (strips e textos)

### 3.1 Orçamento Realizado (ViewOrcFinal) — strip

| Atual | Novo |
|-------|------|
| "Valor Job" | "Valor total" |
| "Custo Real" | "Custo" |
| "Lucro Real" | "Lucro líquido" |

**Arquivo:** `components/views/ViewOrcFinal.tsx` (bloco `financeStrip`, labels nas primeiras três células).

### 3.2 Fechamento — strip

| Atual | Novo |
|-------|------|
| "Valor Job" | "Valor total" |

**Arquivo:** `components/views/ViewFechamento.tsx` (bloco `financeStrip`, primeira célula).

### 3.3 Equipe — resumo total

| Atual | Novo |
|-------|------|
| "Total Mão de Obra (Equipe)" | "Total de Equipe" |

**Arquivo:** `components/views/ViewTeam.tsx` (caixa de resumo com `grandTotal`).

**Risco:** Baixo. Apenas texto de interface.

---

## 4. Padronização de botões (hover e alinhamento)

**Regras desejadas:**
- **Ação de excluir/remover:** hover vermelho (cor `cinema.danger`), consistente com `.btn-remove-row` e botões "Excluir".
- **Demais ações (editar, duplicar, exportar, importar, novo, etc.):** hover amarelo (já definido em `.btn-resolve-hover`).

**Estratégia recomendada:**
1. **CSS global:** Criar classe `.btn-danger-hover` em `globals.css` para hover vermelho (border + color + background suave), espelhando o comportamento de `.btn-remove-row:hover`, para uso em botões que não estão dentro de `.budget-table-cards`.
2. **Aplicar de forma sistemática:**
   - Botões com `aria-label="Excluir"` ou texto "Excluir" / "Remover" → adicionar `btn-danger-hover` (e manter `transition-colors` onde já existir).
   - Botões de ação que não são exclusão → adicionar `btn-resolve-hover` onde ainda não tiver.
3. **Alinhamento:** Botão "Nova tabela" (ícone + texto): garantir `inline-flex items-center justify-center gap-1.5` e que o ícone tenha tamanho fixo (ex.: `size={14}`) para o "+" não desalinhar.

### 4.1 Novas classes em `app/globals.css`

- `.btn-danger-hover:hover`: `color: var(--cinema-danger); border-color: var(--cinema-danger); background: rgba(201, 74, 74, 0.1);` (com `!important` se necessário para vencer estilos inline).

### 4.2 Onde aplicar (checklist por arquivo)

**ViewConfig.tsx**
- [ ] Chips de usuários (lista de nomes na aba Usuários): adicionar `btn-resolve-hover` aos botões que exibem nome do usuário.
- [ ] Aba Colaboradores: Exportar, Importar, Novo — adicionar `btn-resolve-hover`; botões Editar/Excluir na tabela — Editar com `btn-resolve-hover`, Excluir com `btn-danger-hover`.
- [ ] Aba Tabelas de Cachê: botão "Nova tabela" — adicionar `btn-resolve-hover` e revisar alinhamento (flex items-center gap-1.5; ícone Plus com size consistente).
- [ ] Aba Funções e Cachês: Exportar, Importar, Nova — `btn-resolve-hover`; "Remover separador" — `btn-danger-hover`; botões Editar/Duplicar/Excluir nas linhas — Editar e Duplicar `btn-resolve-hover`, Excluir `btn-danger-hover`; Duplicar, Tornar padrão, Importar CSV, Editar, Excluir (por tabela) — mesmas regras.
- [ ] Aba Projetos: Editar/Excluir por projeto — Editar `btn-resolve-hover`, Excluir `btn-danger-hover`.
- [ ] Modais: Fechar (X), Cancelar — já têm ou podem receber `btn-resolve-hover`; botões Salvar/primary — `btn-resolve-hover` onde fizer sentido; botões de excluir (ex.: Remover logo) — `btn-danger-hover`.

**ViewTeam.tsx**
- [ ] Botão "Atualizar" no toolbar: adicionar `btn-resolve-hover`.

**ViewFechamento.tsx**
- [ ] Botões de ação (Exportar, Importar, etc.) e ícones Editar/Excluir em tabelas: seguir mesma regra (excluir = danger, resto = resolve-hover). Verificar também botão "Excluir diária".

**ViewOrcamento / ViewOrcFinal**
- [ ] Se houver botões de toolbar ou tabela que ainda não tenham hover, aplicar a mesma convenção.

**ViewDashboard.tsx**
- [ ] Botões existentes (ex.: troca de fase): `btn-resolve-hover`.

**Header.tsx**
- [ ] Já usa `btn-resolve-hover`; manter.

**PrestacaoContasDeptView.tsx**
- [ ] Botões de ação e "Remover": excluir com `btn-danger-hover`, demais com `btn-resolve-hover`.

### 4.3 Alinhamento do botão "Nova tabela"

**Arquivo:** `components/views/ViewConfig.tsx`

- Garantir que o botão tenha `flex items-center justify-center gap-1.5` (ou `inline-flex` conforme layout).
- Ícone: `<Plus size={14} strokeWidth={2} style={{ color: 'currentColor' }} />` — já existe; verificar se não há margin/padding extra no ícone que desalinhe. Se necessário, envolver ícone em um span com `inline-flex items-center` para alinhamento vertical consistente.

**Risco:** Baixo. Apenas classes CSS e eventual ajuste de flex no botão.

---

## 5. Ordem de implementação sugerida (segura)

1. **Fase 1 — Nomenclatura e labels (sem impacto em lógica)**  
   - BottomNav: labels "ORÇ. PREVISTO" e "ORÇ. REALIZADO".  
   - ViewOrcamento: título "Orçamento Previsto".  
   - ViewOrcFinal: título "Orçamento Realizado" e labels do strip (Valor total, Custo, Lucro líquido).  
   - ViewFechamento: label "Valor total" no strip.  
   - ViewTeam: "Total de Equipe" no resumo.  
   - Atualizar referências em texto de estado vazio em ViewOrcFinal se necessário.

2. **Fase 2 — Título da página e FinanceStrip**  
   - globals.css: `.page-layout__title` com font-size e font-weight ajustados.  
   - FinanceStrip.tsx: grid `lg:grid-cols-5`.

3. **Fase 3 — CSS dos botões**  
   - globals.css: adicionar `.btn-danger-hover` e documentar uso (excluir = danger, resto = resolve-hover).

4. **Fase 4 — Aplicar classes nos botões**  
   - ViewConfig: chips de usuários, Colaboradores, Tabelas de Cachê, Funções e Cachês, Projetos, modais.  
   - ViewTeam: Atualizar.  
   - ViewFechamento, ViewDashboard, PrestacaoContasDeptView: onde houver botões ainda sem hover.

5. **Fase 5 — Alinhamento**  
   - Botão "Nova tabela" em ViewConfig: revisar flex e ícone.

---

## 6. Testes recomendados após cada fase

- Navegar por todas as views (Home, Filme, Orç. Previsto, Orç. Realizado, Fechamento, Dashboard, Equipe, Config).  
- Verificar títulos e labels do menu inferior e dos strips.  
- Clicar e passar o mouse nos botões alterados (hover amarelo vs vermelho).  
- Abrir modais e testar botões Fechar/Cancelar/Salvar/Excluir.  
- Em Config, testar abas (Tabelas de Cachê, Funções, Colaboradores, Usuários, Projetos) e alinhamento do botão "Nova tabela".

---

## 7. Referências no código (resumo)

| Item | Arquivo | Observação |
|------|---------|------------|
| ITEMS do menu | BottomNav.tsx | ids: orcamento, orc-final |
| Título Orçamento | ViewOrcamento.tsx | PageLayout title |
| Título Orç. Final | ViewOrcFinal.tsx | PageLayout title (2 lugares) |
| Strip Orç. Previsto | FinanceStrip.tsx | grid + labels Valor total, Custo, etc. |
| Strip Orç. Realizado | ViewOrcFinal.tsx | financeStrip inline, labels |
| Strip Fechamento | ViewFechamento.tsx | financeStrip inline, Valor Job |
| Total Equipe | ViewTeam.tsx | "Total Mão de Obra (Equipe)" |
| .page-layout__title | globals.css | tamanho e peso |
| .btn-resolve-hover | globals.css | hover amarelo |
| .btn-remove-row | globals.css | hover vermelho (tabela orç.) |
| Nova tabela | ViewConfig.tsx | Plus + "Nova tabela" |

Este plano pode ser executado fase a fase, com commit após cada fase para facilitar rollback se necessário.
