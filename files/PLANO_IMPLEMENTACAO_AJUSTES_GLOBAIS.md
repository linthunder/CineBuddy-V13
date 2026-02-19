# Plano de implementação – Ajustes globais (comunicação e estado)

**Referência:** `files/PLANO_AJUSTES_GLOBAIS_COMUNICACAO_ESTADO.md`  
**Status:** Implementado conforme fases abaixo.

---

## Fases executadas

### Fase 1 – Reset ao logout e salvar antes de sair

- **app/page.tsx**
  - Criada `resetProjectState(opts?)`: limpa projeto, status, snapshots, refs dos views; com `skipViewReset: true` não força `currentView` para `home`.
  - Refs: `currentViewRef` (view atual), `openingProjectIdRef` (id em abertura), `prevUserRef` (user anterior).
  - `useEffect` que observa `user`: quando passa de truthy para `null` (logout/timeout), chama `resetProjectState()` para abrir sem projeto após novo login.
  - Estado `loggingOut` e `handleLogout`: chama `handleSaveRef.current?.()` e em seguida `logout()`; botão Sair desabilitado com texto "Saindo...".
  - Header recebe `onLogout={handleLogout}` e `loggingOut={loggingOut}`.

- **components/Header.tsx**
  - Nova prop `loggingOut?: boolean`; botões Sair (mobile e desktop) desabilitados quando `loggingOut` e exibem "Saindo...".

---

### Fase 2 – Abrir projeto sem “resto” do anterior e race

- **app/page.tsx**
  - Estado `loadingOpen`: indica carregamento ao abrir outro projeto.
  - No **início** de `handleOpenProject(id)`:
    - `openingProjectIdRef.current = id`
    - `resetProjectState({ skipViewReset: true })` (limpa dados e refs, não força view)
    - `setLoadingOpen(true)`
  - `const project = await getProject(id)`; em seguida: se `openingProjectIdRef.current !== id` → return (ignora resultado de abertura anterior).
  - Em erro: `setLoadingOpen(false)`, `openingProjectIdRef.current = null`, alert e return.
  - No **fim** (sucesso): `setLoadingOpen(false)`, `openingProjectIdRef.current = null`, e só então `if (currentViewRef.current === 'home') setCurrentView('filme')`.

- **Header**
  - Nova prop `loadingOpen?: boolean`; quando true, exibe "Carregando projeto..." no lugar do nome do projeto e sublinha vazia.

---

### Fase 3 – Não forçar Filme se o usuário já mudou de view

- **app/page.tsx**
  - `useEffect` mantém `currentViewRef.current = currentView`.
  - No final de `handleOpenProject`: `setCurrentView('filme')` apenas se `currentViewRef.current === 'home'`, evitando voltar para Filme se o usuário já tiver ido para Orçamento (ou outra view) durante o carregamento.

---

### Fase 4 – Modal Abrir sem glitch (uma única fonte de fetch)

- **components/Header.tsx**
  - `openAbrir()`: apenas `setSearchTerm('')`, `setLoadingProjects(true)`, `setModalOpen('abrir')` — **não** chama `listProjects()`.
  - `useEffect` dependente de `[searchTerm, modalOpen]`: quando `modalOpen === 'abrir'`, define **uma única** carga:
    - Debounce: `delayMs = searchTerm === '' ? 0 : 300`.
    - `setLoadingProjects(true)` no início do effect; dentro do `setTimeout(delayMs)` faz o fetch (`searchTerm.trim() ? searchProjects(...) : listProjects()`), atualiza `projectsList` e `setLoadingProjects(false)`.
  - Evita dupla requisição e dois “Carregando...”, eliminando o glitch.

---

## Arquivos alterados

| Arquivo | Alterações |
|--------|------------|
| **app/page.tsx** | Refs (currentView, openingProjectId, prevUser); estado loadingOpen e loggingOut; resetProjectState(opts); effect de reset ao user null; handleLogout; handleOpenProject com reset no início, race check e setCurrentView condicional; Header com loadingOpen, handleLogout, loggingOut. |
| **components/Header.tsx** | Props loadingOpen, loggingOut; displayName/displaySubline com “Carregando projeto...”; botões Sair com disabled e “Saindo...”; openAbrir sem fetch; useEffect do modal Abrir como única fonte de fetch com debounce 0/300. |

---

## O que não foi alterado

- **lib/auth-context.tsx**: sem mudanças; logout segue apenas signOut + setProfile(null).
- **lib/services/projects.ts**: sem mudanças (cache opcional da lista não implementado).
- Estrutura de dados do projeto, payloads Supabase e fluxo de lock (Orçamento Inicial → Final → Fechamento) mantidos.

---

## Como testar

1. **Logout e login sem projeto:** Fazer logout (com ou sem projeto aberto) e login de novo → a tela deve abrir em HOME, sem projeto.
2. **Salvar ao sair:** Com projeto aberto, clicar em Sair → deve mostrar “Saindo...”, salvar e em seguida deslogar.
3. **Abrir outro projeto:** Com projeto A aberto, Abrir → escolher projeto B → durante o carregamento não deve aparecer dados de A; deve aparecer “Carregando projeto...” no header; ao terminar, ir para Filme (ou manter view atual se já tiver mudado).
4. **Orçamento rápido:** Abrir um projeto e, assim que possível, clicar em Orçamento → a view deve permanecer em Orçamento (não voltar para Filme).
5. **Modal Abrir:** Abrir o modal Abrir → uma única fase de “Carregando...” e lista estável, sem piscar.
