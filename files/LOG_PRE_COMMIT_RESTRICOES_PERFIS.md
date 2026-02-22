# Log pré-commit — Implementações de restrições e perfis

**Data da análise:** 14/02/2025  
**Último commit:** `3d44f1c` — Corrige INP nos botões de fase (ViewFechamento) + migração RLS

---

## ✅ Build e verificação

- **npm run build:** OK — compilação concluída sem erros
- **TypeScript:** OK — sem erros de tipo
- **Linter:** OK — sem erros reportados

---

## 🔧 Correções aplicadas nesta análise

1. **ViewConfig.tsx** — Removido import duplicado de `ProfileRole` (profiles e permissions)
2. **ViewConfig.tsx** — Ajuste de comparação `p.role === 'producer'` para `String(p.role) === 'producer'` (compatibilidade com DB legado)
3. **lib/permissions.ts** — Ajuste em `normalizeRole()` para retornar `undefined` em vez de `role` quando vazio (correção de tipo)

---

## 📋 Resumo das implementações (desde último commit)

### 1. USUÁRIOS — Projetos com acesso

- **Comportamento:** Checkboxes só atualizam estado local; salvamento ao clicar em SALVAR
- **API:** `POST /api/users/[id]/projects` — body `{ projectIds: string[] }`
- **Service:** `setUserProjects(userId, projectIds)` em `lib/services/projects.ts`
- **Arquivo:** `app/api/users/[id]/projects/route.ts` (novo)

### 2. PROJETOS — Usuários com acesso

- **Comportamento:** Melhorias no carregamento e tratamento de erros
- **API:** `GET /api/projects/[id]/members` retorna `{ memberIds }`
- **Service:** `getProjectMembers` trata resposta como array ou objeto com `memberIds`
- **Arquivo:** `app/api/projects/[id]/members/route.ts` (novo)

### 3. Tabela de restrições de perfis

- **Local:** Config > USUÁRIOS (apenas admin)
- **3 níveis:** Páginas nav, Abas Config, Botões Filme
- **Abas Config:** 9 abas (Produtora, Drive, Usuários, Colab., Cachê, Funções, Projetos, Ícones, Logs)
- **API:** `GET/POST /api/permissions/restrictions`
- **Arquivo:** `app/api/permissions/restrictions/route.ts` (novo)
- **SQL:** `files/supabase_profile_restrictions.sql` — executar no Supabase

### 4. Restrições dinâmicas

- **AuthContext:** `restrictions` e `refreshRestrictions`
- **Permissões:** `getRoleDisabledViews`, `getRestrictedConfigTabs`, `getRoleDisabledFilmeButtons`
- **ViewFilme:** Botões (incl. Drive) respeitam restrições
- **Fallback:** Sem dados na tabela, usa lógica hardcoded (drive, projects, logs para não-admin)

### 5. Header restrito (Assistente / Convidado)

- **Função:** `shouldRestrictHeaderToLogoutOnly` — mantida em código (não na tabela)
- **Efeito:** Exibe apenas botão SAIR para esses perfis

---

## 📁 Arquivos alterados (a incluir no commit)

**Modificados:**
- `app/api/auth/create-user/route.ts`
- `app/page.tsx`
- `components/Header.tsx`
- `components/views/ViewConfig.tsx`
- `components/views/ViewFilme.tsx`
- `lib/auth-context.tsx`
- `lib/services/profiles.ts`
- `lib/services/projects.ts`

**Novos:**
- `app/api/permissions/restrictions/route.ts`
- `app/api/projects/[id]/members/route.ts`
- `app/api/projects/members/route.ts` (se existir)
- `app/api/users/[id]/projects/route.ts`
- `lib/permissions.ts` (alterado/reescrito)
- `lib/services/profile-restrictions.ts`
- `files/supabase_profile_restrictions.sql`
- `files/supabase_project_members.sql` (se relevante)

**Não incluir no commit (conforme .gitignore):**
- `.cursor/settings.json`
- `.env.local`
- `node_modules`

---

## ⚠️ Pré-requisitos antes do deploy

1. **Executar no Supabase SQL Editor:**
   - `files/supabase_project_members.sql` (se ainda não executado)
   - `files/supabase_profile_restrictions.sql`

2. **Variáveis de ambiente:** Garantir `SUPABASE_SERVICE_ROLE_KEY` em produção

---

## ✅ Checklist final

- [x] Build passa
- [x] Sem erros de TypeScript
- [x] APIs com tratamento de erro
- [x] Fallback quando tabela `profile_restrictions` não existe
- [x] Normalização de role `producer` → `produtor_executivo`
- [x] Documentação no SQL
