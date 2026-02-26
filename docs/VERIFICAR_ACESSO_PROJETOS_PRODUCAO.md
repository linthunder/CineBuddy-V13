# Verificar por que o Renan não vê projetos em produção (ABRIR)

## Por que funciona no local e não na Vercel?

- **Local:** a API usa o mesmo Supabase do `.env.local`. Se na sua base **não há nenhuma linha em `project_members`**, a API devolve **todos** os projetos para qualquer usuário logado.
- **Produção:** se já existem linhas em `project_members` (ex.: outros usuários atribuídos), a API só devolve projetos em que o **user_id** do Renan aparece. Se não houver nenhuma linha para ele, a lista fica vazia.

Ou seja: o problema é **só de dados** — o Renan não está em `project_members` no projeto Supabase que a **produção** usa.

---

## 1. Conferir no Supabase (mesmo projeto da produção)

1. Abra o **Dashboard** do projeto Supabase que a Vercel usa (mesma URL do `NEXT_PUBLIC_SUPABASE_URL` em Production).
2. **Table Editor** → schema **public** (não Auth) → deve existir a tabela **`project_members`**.
   - Se **não existir**: rode o script `supabase/ensure_project_members_and_fix_renan.sql` no **SQL Editor** (ele cria a tabela e já insere o Renan).
3. Se a tabela já existir:
   - **SQL Editor** → New query → cole e execute **só o Passo 2** (ou o bloco do Renan) do arquivo `supabase/ensure_project_members_and_fix_renan.sql`, ou use `supabase/fix_user_project_access.sql`.

---

## 2. Conferir na Vercel (mesmo Supabase que o local)

1. **Vercel** → seu projeto → **Settings** → **Environment Variables**.
2. Para o ambiente **Production**, confira:
   - `NEXT_PUBLIC_SUPABASE_URL` = mesma URL do `.env.local`.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = mesma anon key do `.env.local`.
   - `SUPABASE_SERVICE_ROLE_KEY` = mesma service role key do `.env.local`.
3. Se alterar algo, faça **Redeploy** do último deploy de produção.

---

## 3. Depois de corrigir os dados

1. Renan faz **logout** em **https://cinebuddy.buzzccs.com.br**.
2. Faz **login** de novo.
3. Clica em **ABRIR** e verifica se os projetos aparecem.

---

## 4. Plugins / Supabase MCP

O Cursor não tem, neste projeto, os descriptores do plugin Supabase (MCP) para consultar o banco por aqui. Tudo precisa ser conferido e corrigido **no Dashboard do Supabase** (Table Editor + SQL Editor) e nas variáveis da **Vercel**, como acima.
