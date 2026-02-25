# Plano de implementação — versão para commit/push

Este documento descreve as revisões feitas, as melhorias aplicadas e o passo a passo para aplicar no Supabase as correções dos avisos/sugestões, além da ativação da proteção de senha vazada.

---

## Parte 1 — Revisões já feitas no código

### 1.1 Pontos de atenção do relatório

- **API `/api/projects/list`**: Adicionado log em desenvolvimento quando o usuário está autenticado mas a lista de projetos retorna vazia (enquanto existem projetos e há projetos com membros). Ajuda a diagnosticar casos como “RENAN LIMA não vê projetos” — no terminal do servidor (onde roda `npm run dev`) aparecerá algo como:  
  `[projects/list] Usuário sem projetos visíveis. user_id= ... myProjectIds= ... projectsWithMembers= ...`

- **Finais de linha**: Atualizado `.gitattributes` para forçar LF em `*.ts`, `*.tsx`, `*.js`, `*.json`, `*.css`, `*.md`, `*.sql`, `*.mdc`, reduzindo avisos “LF will be replaced by CRLF” em futuros commits.

- **Consistência**: Nenhuma alteração na lógica de filtro do modal ABRIR; apenas melhorias de diagnóstico e padronização.

### 1.2 Arquivos alterados nesta revisão

- `app/api/projects/list/route.ts` — log em dev quando lista filtrada está vazia.
- `.gitattributes` — regras de eol para arquivos de texto.
- `supabase/migration_supabase_warnings_fixes.sql` — novo arquivo com as correções SQL descritas abaixo.

---

## Parte 2 — O que você precisa fazer no Supabase

### 2.1 Executar a migration de correções (avisos 1, 2 e sugestões 1, 2)

1. Acesse o **Supabase Dashboard** do projeto CineBuddy.
2. No menu lateral, abra **SQL Editor**.
3. Clique em **New query**.
4. Copie todo o conteúdo do arquivo **`supabase/migration_supabase_warnings_fixes.sql`** (do repositório) e cole no editor.
5. Clique em **Run** (ou Ctrl+Enter).
6. Confira se a execução termina sem erro (mensagem de sucesso na parte inferior).

**O que essa migration faz:**

- **Funções com search_path definido**  
  - `update_updated_at_column()` e `roles_rates_reorder()` passam a ter `SET search_path = public`, eliminando o aviso “Function Search Path Mutable”.

- **Políticas RLS em tabelas que não tinham policy**  
  - Em `drive_connection` e `job_id_sequence` são criadas políticas `FOR ALL` com `USING (false)` e `WITH CHECK (false)`.  
  - Assim, nenhum acesso é concedido via RLS; o acesso continua sendo feito **apenas** pelo backend com a **service role key** (que ignora RLS). Isso atende à sugestão “RLS Enabled No Policy” sem mudar o comportamento do app.

- **Policy em `profiles` (aviso 7)**  
  - A policy “Admin can update any profile” deixa de usar `WITH CHECK (true)` e passa a usar explicitamente “quem está fazendo o update é admin”, mantendo o mesmo comportamento e reduzindo o aviso.

---

### 2.2 Ativar proteção contra senha vazada (aviso 10)

1. No Supabase Dashboard, no menu lateral, abra **Authentication**.
2. Clique em **Sign In / Providers** (ou apenas **Providers**, dependendo da versão do painel).
3. Abra as configurações do provedor **Email** (clique em “Email” na lista de providers).
4. Na seção de opções do Email, procure por **“Prevent the use of leaked passwords”** (ou texto equivalente, ex.: “Rejeitar senhas que constem em vazamentos”).
5. Ative a opção e salve.

**Observação:** Essa função está disponível apenas no **Pro Plan e superiores**. No plano gratuito a opção não aparece; o ajuste fica **adiado para quando o projeto tiver plano Pro**. O aviso do Supabase pode ser ignorado até lá.

---

### 2.3 Avisos “RLS Policy Always True” (avisos 3 a 9) — não alterados nesta versão

As tabelas **activity_logs**, **cache_tables**, **collaborators**, **company**, **profiles**, **projects**, **roles_rates** têm políticas com `USING (true)` ou `WITH CHECK (true)`, o que o Supabase sinaliza como “permissivo” e equivalente a desativar RLS para aquele papel.

- **Decisão para esta versão:** Nenhuma alteração nas policies. O app hoje depende desse comportamento (acesso amplo para usuários autenticados ou para o backend).
- **Futuro (opcional):** Em uma próxima versão, pode-se desenhar políticas mais restritivas (por exemplo, usuário só altera o próprio perfil, admin altera outros; projetos só visíveis para membros, etc.) e aplicar em migrations separadas, com testes antes de subir.

Não há passo a passo adicional para você fazer no Supabase em relação a esses avisos nesta entrega.

---

## Parte 3 — Checklist antes do commit/push

- [ ] Executou `supabase/migration_supabase_warnings_fixes.sql` no SQL Editor do Supabase e a query rodou sem erro.
- [ ] Ativou a opção “Leaked password protection” (ou equivalente) em Authentication > Settings no Supabase.
- [ ] Testou o app localmente após as mudanças (login, modal ABRIR, Config, Fechamento).
- [ ] Se ainda usar o usuário RENAN LIMA para teste: após aplicar a migration, se o problema “não vê projetos” continuar, conferir no terminal do servidor (dev) se aparece o log `[projects/list] Usuário sem projetos visíveis...` e verificar no Supabase se existem linhas em `project_members` com o `user_id` desse usuário.

---

## Parte 4 — Resumo do que foi alterado para esta versão

| Item | Onde | O que foi feito |
|------|------|-----------------|
| Diagnóstico modal ABRIR | `app/api/projects/list/route.ts` | Log em dev quando lista filtrada está vazia (user_id, contagens). |
| Finais de linha | `.gitattributes` | Regras eol=lf para tipos de arquivo do projeto. |
| Function search_path | Supabase (migration) | `update_updated_at_column` e `roles_rates_reorder` com `SET search_path = public`. |
| RLS sem policy | Supabase (migration) | Políticas em `drive_connection` e `job_id_sequence` (USING false) para eliminar “no policy”. |
| Leaked password | Supabase (manual) | Ativar em Authentication > Settings. |
| RLS “Always True” | — | Documentado; sem mudança nesta versão. |

Após concluir a Parte 2 e o checklist da Parte 3, a versão está pronta para commit e push conforme sua confirmação.
