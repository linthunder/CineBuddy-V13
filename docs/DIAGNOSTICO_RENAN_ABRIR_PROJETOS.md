# Diagnóstico: usuário não vê projetos no modal ABRIR (ex.: Renan em produção)

Este documento lista **todas as possíveis causas** e como verificar/corrigir cada uma.

---

## 1. Dados no Supabase (project_members) — causa mais provável

**O que acontece:** A API `/api/projects/list` só devolve projetos em que o usuário tem linha em `project_members`. Se não houver nenhuma linha para o `user_id` dele, a lista vem vazia.

**Por que no local pode funcionar:** Se no Supabase que o local usa a tabela `project_members` está **vazia**, a API devolve **todos** os projetos para qualquer um. Em produção, se já existem linhas (outros usuários), aí a API filtra e o Renan fica sem nenhum.

**Como verificar:**
- Supabase Dashboard → **Table Editor** → schema **public** (não Auth) → tabela **`project_members`**.
- SQL Editor:
  ```sql
  -- Ver quantos projetos cada usuário tem
  SELECT p.name, p.surname, p.email, p.id AS user_id, COUNT(pm.project_id) AS projetos
  FROM profiles p
  LEFT JOIN project_members pm ON pm.user_id = p.id
  GROUP BY p.id, p.name, p.surname, p.email;
  ```
  Se o Renan tiver **0** na coluna `projetos`, essa é a causa.

**Correção:** Rodar no **mesmo projeto Supabase que a produção usa** o script `supabase/ensure_project_members_and_fix_renan.sql` (ou o INSERT do `supabase/fix_user_project_access.sql`).

---

## 2. Vercel usando outro projeto Supabase

**O que acontece:** A produção (Vercel) está com variáveis de ambiente apontando para um projeto Supabase **diferente** do que você usa no local (ou do que você usou para rodar o SQL). Os dados corrigidos ficam em um projeto e o app em produção lê de outro.

**Como verificar:**
- Vercel → seu projeto → **Settings** → **Environment Variables** → ambiente **Production**.
- Confira `NEXT_PUBLIC_SUPABASE_URL`: deve ser **exatamente** a mesma URL do Supabase onde você rodou o SQL e onde estão os outros usuários que funcionam (ex.: `https://xxxx.supabase.co`).
- Compare com o `.env.local` do seu PC: mesma URL?

**Correção:** Ajustar as variáveis de produção para o projeto Supabase correto e fazer **Redeploy**.

---

## 3. Dois logins / dois usuários “Renan”

**O que acontece:** Existem dois usuários no Auth (por exemplo dois e-mails). O SQL ou a aba Usuários atribuíram projetos a um `user_id`, e o Renan entra com outro (outro e-mail/conta). O `user_id` que recebe projetos não é o mesmo que está logado.

**Como verificar:**
- Supabase → **Authentication** → **Users**: quantos usuários têm nome/e-mail do Renan?
- Em **Table Editor** → **public** → **profiles**: confira os `id` e e-mails. O `id` do perfil é o mesmo do Auth.
- Use o diagnóstico da API (ver seção 7) com o Renan logado: anote o `userId` e confira no Supabase se esse `id` tem linhas em `project_members`.

**Correção:** Atribuir projetos ao `user_id` correto (o da conta com que ele faz login em cinebuddy.buzzccs.com.br), ou unificar contas.

---

## 4. Código (lógica da API)

**O que acontece:** Bug na filtragem por `project_members` ou no uso do `caller.id`.

**Regra atual:**  
- Projetos **sem nenhum** membro em `project_members` → todos veem.  
- Projetos **com** membros → só veem quem tem linha em `project_members` com seu `user_id`.

A API usa **service_role** (ignora RLS). O `caller.id` vem do JWT validado pelo Supabase Auth. Se outros usuários veem projetos, a lógica está aplicada igual para todos; a diferença costuma ser só os dados (quem tem ou não linhas em `project_members`).

**Conclusão:** Improvável ser bug de código se outros usuários acessam normalmente. Foque em dados e ambiente (itens 1 e 2).

---

## 5. Restrições de perfil (Config → Usuários → Restrições)

**O que acontece:** Restrições de perfil controlam **quais botões/abas** o usuário vê (ex.: esconder o botão “Abrir”), **não** o conteúdo da lista de projetos devolvida pela API.

Se o Renan **abre** o modal ABRIR e só vê “Nenhum projeto encontrado”, o botão e a chamada à API estão ok; a API está respondendo com lista vazia. Restrições de perfil **não** filtram a lista de projetos.

**Conclusão:** Restrições não explicam lista vazia no modal; não é necessário mudar restrições para corrigir esse problema.

---

## 6. Configuração no Supabase (RLS, Auth, URL)

- **RLS em `project_members`:** A API usa **service_role**, que ignora RLS. Não é causa da lista vazia.
- **Auth (Site URL / Redirect URLs):** Afetam login e redirect; se o Renan consegue entrar e abrir o modal, não é isso que esvazia a lista.
- **URL do projeto:** Só importa que a **Vercel** use a mesma URL (e chaves) do projeto onde estão os dados (ver item 2).

---

## 7. Diagnóstico pela API (produção)

Foi adicionado suporte a `?debug=1` na rota `/api/projects/list`. Com o **Renan logado** em cinebuddy.buzzccs.com.br:

1. Abrir em uma nova aba:  
   `https://cinebuddy.buzzccs.com.br/api/projects/list?debug=1`
2. A resposta pode vir com um objeto que inclui `_debug`, por exemplo:
   - `userId`: id do usuário logado (deve ser o do Renan no Supabase).
   - `myProjectIdsCount`: quantos projetos ele tem em `project_members` (0 = causa da lista vazia).
   - `totalProjectsWithMembers`: quantos projetos têm pelo menos um membro.

Com isso você confirma:
- Que a produção está vendo o **mesmo** `userId` que o perfil do Renan no Supabase.
- Que o problema é **myProjectIdsCount = 0** (nenhuma linha em `project_members` para esse `userId`).

No Supabase, use esse `userId` no INSERT para dar acesso a todos os projetos (script em `supabase/fix_user_project_access.sql`, Opção B, trocando o UUID pelo `userId`).

---

## 8. Checklist definitivo

| Item | Onde verificar | Ação |
|------|----------------|------|
| Tabela `project_members` existe | Supabase → Table Editor → **public** | Rodar `ensure_project_members_and_fix_renan.sql` se não existir |
| Renan tem linhas em `project_members` | SQL: `SELECT * FROM project_members WHERE user_id = '<id_renan>'` | Rodar INSERT do `fix_user_project_access.sql` com o `id` correto |
| Produção usa o mesmo Supabase | Vercel → Env Vars → `NEXT_PUBLIC_SUPABASE_URL` | Igual ao projeto onde você corrigiu os dados |
| Um único usuário Renan | Auth → Users e profiles | Atribuir projetos ao `user_id` da conta com que ele loga |
| Diagnóstico da API | Abrir `/api/projects/list?debug=1` logado como Renan | Usar `userId` e `myProjectIdsCount` para confirmar e corrigir no SQL |

Depois de qualquer correção no Supabase, o Renan deve fazer **logout e login** de novo em **cinebuddy.buzzccs.com.br** e testar o ABRIR.
