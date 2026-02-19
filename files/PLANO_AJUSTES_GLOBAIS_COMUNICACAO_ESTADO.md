# Plano de ajustes globais – comunicação, estado e truncamento

**Objetivo:** Corrigir problemas de “truncamento” de comunicação, estado persistente indevido e melhorar a fluidez da UX, sem causar danos estruturais ao sistema.

**Escopo:** `app/page.tsx`, `lib/auth-context.tsx`, `components/Header.tsx`, `lib/services/projects.ts`.

---

## 1. Diagnóstico por problema

### 1.1 Informações do projeto anterior ao abrir outro

**Causa raiz:** Em `handleOpenProject` (page.tsx) o fluxo é: `await getProject(id)` → depois preenche estado. Durante o `await`, a UI continua mostrando o projeto anterior (projectData, refs dos views, etc.).

**Solução proposta:**
- No **início** de `handleOpenProject`: marcar “carregando projeto” (ex.: `setOpeningProjectId(id)` ou `setLoadingOpen(true)`) e **limpar imediatamente** o estado do projeto atual (projectData → EMPTY_PROJECT, projectDbId → null, snapshots → null, view refs com loadState vazio). Assim a tela não exibe dados do projeto antigo enquanto o novo carrega.
- Opcional: exibir um estado de “Carregando projeto...” no header ou na área principal enquanto `getProject` roda.
- Ao concluir (sucesso ou erro), limpar `openingProjectId`/`loadingOpen` e, em caso de sucesso, preencher com os dados do projeto escolhido.

**Risco:** Baixo. Só antecipa a “limpeza” e adiciona um estado de loading explícito.

---

### 1.2 Glitch no modal “Abrir”

**Causa raiz:** No Header, ao abrir o modal “Abrir”:
1. `openAbrir()` é chamado: `setModalOpen('abrir')` → `setLoadingProjects(true)` → `await listProjects()` → `setProjectsList` → `setLoadingProjects(false)`.
2. Um `useEffect` depende de `[searchTerm, modalOpen]`. Quando `modalOpen` vira `'abrir'`, o effect agenda (setTimeout 300ms) **outra** chamada: `setLoadingProjects(true)` → fetch (listProjects ou searchProjects) → `setLoadingProjects(false)`.

Resultado: a lista é carregada **duas vezes** e o “Carregando...” aparece duas vezes (ou pisca), gerando o glitch.

**Solução proposta:**
- **Unificar** a fonte da lista: só o `useEffect` busca projetos quando o modal está aberto.
- `openAbrir()` passa a fazer apenas: `setSearchTerm('')`, `setModalOpen('abrir')`. Não chama `listProjects()` nem altera `loadingProjects`.
- No `useEffect`: quando `modalOpen === 'abrir'`, agendar o fetch com **debounce**: 0 ms quando `searchTerm === ''` (abertura), 300 ms quando o usuário digita. Assim evita dupla requisição e mantém debounce na busca.
- Tratar “modal acabou de abrir” sem atrasar demais: primeiro frame com lista vazia e loading true, depois preencher. Opcional: manter lista em estado e, na abertura, se já houver lista em cache (ex. da última vez que abriu), mostrar cache e refetch em background.

**Risco:** Baixo. Só reorganiza quem dispara o fetch e quando.

---

### 1.3 Clicar rápido em Orçamento e voltar para Filme

**Causa raiz:** `handleOpenProject` é assíncrono. No final ele chama **sempre** `setCurrentView('filme')`. Sequência típica:
1. Usuário seleciona projeto → `handleOpenProject(id)` inicia.
2. `getProject(id)` demora (rede/Supabase).
3. Usuário clica em “Orçamento” → `setCurrentView('orcamento')` (nav já desbloqueada ou ele clica antes de desbloquear).
4. `getProject` termina → `handleOpenProject` aplica dados e chama `setCurrentView('filme')` → a view volta para Filme.

**Solução proposta:**
- **Não** forçar `setCurrentView('filme')` no final de `handleOpenProject` de forma incondicional.
- Duas variantes (escolher uma):
  - **A:** Só chamar `setCurrentView('filme')` se a view atual for `'home'` (abertura “inicial” do projeto). Se o usuário já mudou para orçamento/dashboard/etc., manter a view atual.
  - **B:** No início de `handleOpenProject`, guardar `currentView` em ref. No final, só chamar `setCurrentView('filme')` se a view atual **não** tiver sido alterada pelo usuário (comparar com a ref). Se já mudou, não sobrescrever.

Recomendação: **A** é mais simples e atende ao comportamento desejado (abrir projeto → ir para Filme; se ele já foi para Orçamento, manter Orçamento).

**Risco:** Baixo. Apenas condiciona a última linha do handler.

---

### 1.4 Comunicação Supabase mais rápida/limpa

**Análise:**
- `listProjects` e `getProject` são chamadas diretas ao Supabase (client), sem cache hoje.
- Não há evidência de chamadas redundantes além das já citadas (modal Abrir, etc.).

**Soluções propostas (incremental):**
- **Já cobertas acima:** evitar dupla carga no modal Abrir; evitar re-renders/estado que disparem fetches extras.
- **Cache leve no client (opcional):** para a lista do modal “Abrir”, manter em memória (ex. ref ou estado no Header) a última lista e timestamp; ao abrir o modal, mostrar essa lista imediatamente e, em paralelo, refetch para atualizar. Reduz sensação de lentidão.
- **getProject:** manter uma única chamada por “abrir projeto”; não adicionar cache agressivo sem necessidade (dados podem mudar em outro dispositivo).
- **Sem mudar estrutura:** não introduzir novas camadas (SWR/React Query) neste plano; apenas otimizar pontos já identificados.

**Risco:** Baixo se limitar a cache simples e menos chamadas duplicadas.

---

### 1.5 Logout e login: sistema abre com último projeto

**Causa raiz:** O estado do projeto (projectData, projectDbId, currentView, snapshots, refs dos views) vive em `app/page.tsx`. Quando `user` é null, o app renderiza `<LoginScreen />`, mas o **componente Home não desmonta**: apenas deixa de renderizar o conteúdo principal. Ao fazer login de novo, `user` fica definido e a mesma instância de Home reapresenta o conteúdo **com o estado antigo** (projeto e view anteriores).

**Solução proposta:**
- **Limpar estado do projeto quando o usuário sair:** em `page.tsx`, um `useEffect` que observa `user`:
  - Quando `user` passa de truthy para `null` (logout ou timeout): executar uma função `resetProjectState()` que:
    - `setProjectData(EMPTY_PROJECT)`, `setProjectDbId(null)`, `setCurrentView('home')`, `setProjectStatus(open/open/open)`, `setInitialSnapshot(null)`, `setFinalSnapshot(null)`, e chamar `loadState` vazio nos refs (viewOrcRef, viewOrcFinalRef, viewFechamentoRef).
  - Não executar quando `user` passa de null para truthy (login) para não apagar estado que acabou de ser definido; o “abrir sem projeto” já fica garantido porque o reset foi feito no momento do logout.
- Garantir que, após login, não haja “restauração” de projeto a partir de localStorage/sessionStorage (hoje não há; manter assim).

**Risco:** Baixo. Apenas explicita o reset que já deveria ocorrer conceitualmente ao sair.

---

### 1.6 Salvar projeto ao fazer logout (e em timeout)

**Requisito:** Ao fazer logout (incluindo por timeout), o sistema deve salvar o projeto que está aberto quando possível.

**Análise:**
- Logout **explícito** (botão Sair): temos controle no `page.tsx` (onde está `handleSave` e o estado do projeto). Podemos chamar `handleSave()` antes de `logout()`.
- Logout por **timeout/sessão inválida:** o auth-context chama `setSession(null)` (e eventualmente `signOut`). Nesse momento a página não tem como “interceptar” de forma síncrona para salvar; além disso, o token pode já estar inválido e o Supabase pode recusar o save.

**Solução proposta:**
- **Logout explícito:** no `page.tsx`, não passar `logout` direto para o Header. Passar um handler que: (1) chama `await handleSave()` (já é no-op se não houver projeto com nome); (2) em seguida chama `await logout()`. Assim, ao clicar em Sair, o projeto aberto é salvo antes de deslogar.
- **Timeout:** não garantir save no timeout (token pode estar expirado). O reset de estado (item 1.5) continua: ao detectar `user === null`, limpar projeto. Opcional futuro: tentar um “save em background” ao detectar que a sessão está prestes a expirar (ex. onAuthStateChange com evento de refresh falho) – fora do escopo mínimo deste plano.

**Risco:** Baixo. handleSave já existe e é idempotente para “sem projeto”.

---

## 2. Resumo das alterações por arquivo

| Arquivo | Alteração |
|--------|-----------|
| **app/page.tsx** | (1) Reset de estado no início de `handleOpenProject` + estado “loading open”; (2) No final de `handleOpenProject`, `setCurrentView('filme')` só se `currentView === 'home'`; (3) `useEffect` que, quando `user` vira `null`, chama `resetProjectState()`; (4) `onLogout` = async () => { await handleSave(); await logout(); }. |
| **components/Header.tsx** | (1) `openAbrir()` só define `setSearchTerm('')` e `setModalOpen('abrir')`; (2) `useEffect` do modal Abrir: uma única fonte de fetch, com debounce 0 ms (searchTerm vazio) ou 300 ms (busca). |
| **lib/auth-context.tsx** | Nenhuma alteração obrigatória (logout continua sendo apenas signOut + setProfile(null); o “save antes” fica no page). |
| **lib/services/projects.ts** | Nenhuma alteração obrigatória; opcional: cache simples da última lista para o modal (pode ser só no Header com ref/estado). |

---

## 3. Ordem de implementação sugerida

1. **Reset de estado ao sair (1.5 + 1.6)**  
   - Implementar `resetProjectState()` e o `useEffect` em `user` em `page.tsx`.  
   - Trocar `onLogout={logout}` por `onLogout={handleLogout}` com save + logout.  
   - Testar: logout → login → deve abrir sem projeto; logout com projeto aberto → projeto salvo.

2. **Abrir projeto sem “resto” do anterior (1.1)**  
   - No início de `handleOpenProject`, limpar estado e (opcional) setar “loading open”; ao terminar getProject, preencher e limpar loading.  
   - Testar: abrir projeto A, depois abrir projeto B → durante o carregamento não deve aparecer dados de A.

3. **Não forçar Filme ao abrir (1.3)**  
   - No final de `handleOpenProject`, usar `setCurrentView('filme')` apenas se `currentView === 'home'` (por exemplo com um ref ou leitura do state no callback).  
   - Testar: abrir projeto e clicar rápido em Orçamento → deve permanecer em Orçamento.

4. **Modal Abrir sem glitch (1.2)**  
   - Ajustar Header: `openAbrir` sem fetch; `useEffect` como única fonte de carga, com debounce 0/300 ms.  
   - Testar: abrir modal Abrir → uma única fase de “Carregando...” e lista estável.

5. **Opcional (1.4)**  
   - Cache da última lista no modal Abrir (mostrar lista anterior imediatamente + refetch em background).

---

## 4. Riscos e cuidados

- **Refs dos views (viewOrcRef, etc.):** ao chamar `loadState` vazio no reset ou no início de “abrir”, garantir que os refs já estejam montados quando aplicável; no reset por logout, os views podem ainda estar montados (apenas a tela de login está visível), então chamar `viewOrcRef.current?.loadState(...)` é seguro.
- **Race condition:** se o usuário abrir projeto A e, antes de terminar, abrir projeto B, garantir que apenas o resultado de B seja aplicado (ex.: usar um `openingProjectId` e ignorar resultado de getProject se não for o último id solicitado).
- **handleSave no logout:** pode demorar; considerar feedback visual (“Salvando antes de sair...” ou desabilitar o botão Sair até terminar) para evitar double-click.

---

## 5. O que não fazer (para não causar danos estruturais)

- Não mover estado do projeto para contexto global sem necessidade; manter em `page.tsx`.
- Não alterar a assinatura de `handleSave`, `handleOpenProject` ou a estrutura de dados do projeto (payload Supabase, tipos).
- Não remover o fluxo de lock (Orçamento Inicial → Final → Fechamento); apenas ajustar quando a view é definida ao abrir projeto.
- Não alterar políticas RLS ou estrutura de tabelas no Supabase neste plano.

---

Este plano pode ser executado em fases: primeiro itens 1 e 2 da ordem de implementação (logout/reset e abrir projeto limpo), depois 3 e 4 (view e modal), e por fim melhorias opcionais de cache.
