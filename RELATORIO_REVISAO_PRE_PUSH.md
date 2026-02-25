# Relatório de revisão — alterações desde o último commit/push

**Último commit:** `fa6ee28` — *Implementação aprovada - Membros de projeto, restrições de perfis, ícone fix e RLS*

**Data do relatório:** 2026-02-25

---

## 1. Resumo das alterações (working tree vs HEAD)

### 1.1 Arquivos modificados (19 arquivos, +993 / -427 linhas)

| Área | Arquivos | Tipo de mudança |
|------|----------|-----------------|
| **API** | `app/api/projects/list/route.ts` | Inclusão do campo `status` no select e no tipo; lógica de filtro por membros **inalterada**. |
| **Serviços** | `lib/services/projects.ts` | `cache: 'no-store'` no fetch da listagem; `updateProject` não altera mais `job_id` (imutável). |
| **Layout / tema** | `app/globals.css`, `lib/theme.ts` | Novos estilos (Fechamento, tabelas, page-layout, etc.). |
| **Páginas** | `app/page.tsx` | Ajustes de estado e fluxo (abrir projeto, config, etc.). |
| **Componentes** | `Header.tsx`, `BottomNav.tsx`, `BudgetDeptBlock.tsx` | UI, modais, botões. |
| **Views** | `ViewConfig.tsx`, `ViewFechamento.tsx`, `ViewDashboard.tsx`, `ViewFilme.tsx`, `ViewHome.tsx`, `ViewOrcFinal.tsx`, `ViewTeam.tsx` | Ajustes de layout, labels (Hora extra, Cachê), tamanhos de fonte, alinhamentos, totais. |
| **Auth / restrições** | `lib/auth-context.tsx`, `lib/services/profile-restrictions.ts` | Comportamento de loading e restrições de botões. |
| **Build** | `package.json`, `package-lock.json` | Scripts `dev:clean`, `dev:force`, `build:clean`. |

### 1.2 Arquivos não rastreados (não entram no commit a menos que você os adicione)

- Regras Cursor: `.cursor/rules/dev-console-404.mdc`, `next-cache-causa-raiz.mdc`, `testes-antes-implementacao.mdc`
- Novos componentes: `CalendarWidget.tsx`, `PageTitleTab.tsx`, `ProjectsEvolutionChart.tsx`
- Scripts e SQL: `scripts/test-supabase-connectivity.mjs`, `supabase/fix_job_id_bz0002.sql`, `migration_job_id_immutable.sql`
- Arquivos em `files/` (CSV, instruções, etc.)

---

## 2. Consistência do código

### 2.1 Pontos positivos

- **API `/api/projects/list`**: Continua usando `createServerClient()` (service role), então a listagem não depende de RLS no servidor; a filtragem por `project_members` está coerente com o fluxo do modal ABRIR.
- **Imutabilidade de `job_id`**: `updateProject` remove `job_id` dos updates, alinhado à regra de negócio.
- **Modal ABRIR**: Usa `listAccessibleProjects()` → `GET /api/projects/list` com `Authorization: Bearer <token>`; o backend identifica o usuário com `getAuthUser(request)` e filtra por `project_members`.
- **Config > Usuário > Projetos**: Uso de `getUserProjectIds` / `setUserProjects` (API `GET/POST /api/users/:id/projects`) com service role, adequado para admin/atendimento definirem projetos por usuário.

### 2.2 Pontos de atenção (revisados)

- **Finais de linha**: Adicionado `.gitattributes` com `eol=lf` para `*.ts`, `*.tsx`, `*.js`, `*.json`, `*.css`, `*.md`, `*.sql`, `*.mdc` para evitar avisos CRLF em futuros commits.
- **Diagnóstico modal ABRIR**: Em desenvolvimento, a API `/api/projects/list` passa a registrar no servidor quando o usuário recebe lista vazia mas existem projetos com membros (ajuda a diagnosticar casos como “usuário não vê projetos”).
- **ViewFechamento.tsx**: Muitas mudanças de UI (labels, larguras, alinhamentos); convém testar fluxo de diárias e totais antes do push.

---

## 3. Bug: RENAN LIMA não vê projetos no modal ABRIR

### 3.1 Comportamento esperado

- Usuário com perfil admin e incluído em projetos deve ver esses projetos no modal do botão **ABRIR**.
- A lista vem de `GET /api/projects/list`: o backend filtra projetos por `project_members` (projetos sem membros = todos veem; projetos com membros = só quem está em `project_members`).

### 3.2 Onde está a lógica

- **Backend:** `app/api/projects/list/route.ts`  
  - Lê `project_members` (todos os `project_id`) e depois `project_members` onde `user_id = caller.id`.  
  - `caller` vem de `getAuthUser(request)` (token JWT do header `Authorization`).
- **Frontend:** `Header.tsx` → `listAccessibleProjects(searchTerm)` → `lib/services/projects.ts` → `fetch('/api/projects/list', { headers: { Authorization: 'Bearer ' + session.access_token } })`.

Nenhuma alteração **desde o último commit** mudou essa lógica (apenas foi adicionado `status` e `cache: 'no-store'`). Ou seja, o bug **não foi introduzido** pelas mudanças atuais do relatório; provavelmente está em **dados ou em RLS no Supabase**.

### 3.3 Causas prováveis

1. **Falta de linhas em `project_members` para o RENAN LIMA**  
   - As associações “RENAN LIMA nos projetos” precisam existir na tabela `project_members` com o `user_id` correto (id do auth do RENAN LIMA).  
   - Se o admin só tiver adicionado RENAN como “membro” pelo **modal do projeto** (editar projeto → membros), essa gravação usa **Supabase no client** (`setProjectMembers` em `lib/services/projects.ts`), e aí **RLS em `project_members`** pode estar bloqueando o `INSERT` (por exemplo, se a policy exige ser admin ou ser o próprio usuário).  
   - Já **Config > Usuários > RENAN LIMA > Projetos com acesso** usa a **API** (`setUserProjects` → `POST /api/users/:id/projects`), que usa **service role** e ignora RLS; esse caminho tende a funcionar.

2. **Identificador do usuário**  
   - Se em algum lugar for usado nome ou outro campo em vez do `id` do `auth.users` (UUID), as linhas em `project_members` podem estar com `user_id` errado e o filtro no `/api/projects/list` não encontra nada para o RENAN LIMA.

3. **Token / sessão**  
   - Se o token não for enviado ou estiver expirado, a API pode devolver 401 e o front retorna `[]` (lista vazia). Menos provável se outros usuários (ex.: LINCOLN, DUDA) veem projetos normalmente no mesmo ambiente.

### 3.4 O que fazer no Supabase (recomendações)

1. **Confirmar dados em `project_members`**  
   - No **Table Editor** (ou SQL), para o usuário RENAN LIMA:  
     - Pegar o **UUID** em `auth.users` (ou `profiles.id`, que costuma ser o mesmo).  
     - Consultar:  
       ```sql
       SELECT * FROM project_members WHERE user_id = '<uuid_do_renan_lima>';
       ```  
   - Se não houver linhas, o modal ABRIR não mostrará projetos para ele.

2. **Garantir que as associações foram feitas pela API (Config)**  
   - Em **Config > Usuários > RENAN LIMA**, abrir o modal do usuário e em **“Projetos com acesso”** marcar os projetos desejados e salvar.  
   - Isso chama `setUserProjects` → API com service role e grava em `project_members` sem depender de RLS.

3. **Revisar RLS em `project_members`**  
   - Se vocês também usam “membros” pelo **modal do projeto** (ao editar um projeto), verificar as policies de `project_members`:  
     - **SELECT**: quem pode ler (ex.: usuário vê só os projetos em que está; admin vê tudo).  
     - **INSERT / DELETE**: quem pode criar/remover vínculos (ex.: só admin ou atendimento).  
   - Se o INSERT estiver restrito demais, o fluxo “editar projeto → adicionar RENAN como membro” pode falhar silenciosamente no client e não criar as linhas.

4. **(Opcional) Conferir resposta da API para RENAN LIMA**  
   - Com RENAN LIMA logado, no navegador (DevTools > Network), ao abrir o modal ABRIR:  
     - Ver a requisição `GET /api/projects/list`.  
     - Se status for **401**, o token não está sendo aceito.  
     - Se for **200** e o body for `[]`, o backend está aplicando o filtro e não encontrando projetos para o `user_id` desse token (reforça a necessidade de checar `project_members` e o UUID usado).

---

## 4. Revisão de falhas (checklist)

| Item | Status |
|------|--------|
| Lógica de listagem do modal ABRIR (projects/list) | ✅ Inalterada; coerente com project_members |
| Uso de service role na API de listagem | ✅ Correto |
| Atribuição de projetos ao usuário (Config) | ✅ Via API (service role) |
| Atribuição de membros ao projeto (modal do projeto) | ⚠️ Via client Supabase; depende de RLS em project_members |
| Imutabilidade de job_id em updates | ✅ Garantida em updateProject |
| Scripts de cache (.next) e porta (dev:force) | ✅ Adicionados e documentados |

Nenhuma **inconsistência lógica** foi encontrada no código das alterações atuais. O problema do RENAN LIMA aponta para **dados ou RLS no Supabase**, não para mudanças no código desde o último commit.

---

## 5. Recomendações antes do commit/push

1. **RENAN LIMA**  
   - Seguir a seção 3.4 (verificar `project_members`, usar Config para (re)atribuir projetos, revisar RLS se usar o modal de membros do projeto).

2. **Commit**  
   - Incluir apenas os arquivos que você quer versionar (por exemplo, não commitar `.cursor/`, `files/` ou arquivos temporários, a menos que seja intencional).  
   - Mensagem sugerida (exemplo):  
     `Ajustes de UI (Fechamento, Header, Config), scripts dev:clean/build:clean, diretrizes cache Next e relatório de revisão`

3. **Testes manuais sugeridos**  
   - Login com LINCOLN, DUDA, RENAN LIMA e TESTE: abrir modal ABRIR e conferir se a lista de projetos está correta para cada um.  
   - Após corrigir dados/RLS para RENAN LIMA, testar de novo com ele.

---

**Aguardo sua confirmação para efetuar o commit/push.** Não farei push até você autorizar.
