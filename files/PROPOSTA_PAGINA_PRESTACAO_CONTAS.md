# Proposta: Página exclusiva de Prestação de Contas (revisada)

## Objetivo

Oferecer **uma página por departamento** de prestação de contas, **vinculada a um projeto**, para ser enviada aos **responsáveis do departamento** (colaboradores que não usam o sistema). Eles preenchem as despesas sem fazer login; os dados são enviados para a prestação de contas da aba **FECHAMENTO** do sistema.

---

## Regras de negócio

| Regra | Descrição |
|-------|-----------|
| **Uma página por departamento** | Cada um dos 4 departamentos (PRODUÇÃO, ARTE E CENOGRAFIA, FIGURINO E MAQUIAGEM, FOTOGRAFIA E TÉCNICA) tem sua própria URL. O responsável **não vê** verba nem despesas dos outros departamentos. |
| **Vinculada ao projeto** | A prestação é sempre de um projeto específico. Projeto A ≠ Projeto B. |
| **Sem login** | A página exclusiva **não exige autenticação**. Será enviada a colaboradores que não têm acesso ao sistema. |
| **Sincronização com o sistema** | Tudo que for preenchido/salvo na página exclusiva deve ser gravado no mesmo projeto e aparecer na aba **FECHAMENTO** do CineBuddy (closing_lines). |

---

## Rota proposta

Uma URL por **projeto + departamento**:

| Padrão | Exemplo |
|--------|---------|
| `/prestacao-contas/[projectId]/[deptSlug]` | `/prestacao-contas/abc-123-uuid/producao` |
| Com token (para permitir salvar sem login) | `...?token=xyz` ou token no path |

**Slugs dos departamentos (sugestão):**

| Departamento (valor interno) | Slug na URL |
|------------------------------|-------------|
| PRODUÇÃO | `producao` |
| ARTE E CENOGRAFIA | `arte-cenografia` |
| FIGURINO E MAQUIAGEM | `figurino-maquiagem` |
| FOTOGRAFIA E TÉCNICA | `fotografia-tecnica` |

Assim, cada link compartilhado é único por projeto e por departamento (e, se usarmos token, por link de compartilhamento).

---

## Autenticação da página (sem login do usuário)

Como a página é **pública** mas precisa **gravar** no projeto, é necessário que apenas quem recebeu o link possa enviar dados.

**Proposta: token no link**

1. **Geração do link (no sistema, por usuário logado)**  
   Na aba FECHAMENTO, para cada departamento, haverá um botão tipo **“Gerar link para este departamento”**. Ao clicar:
   - O sistema gera um **token** (ex.: aleatório seguro) e o associa ao projeto + departamento (ex.: tabela `prestacao_links`: `project_id`, `department`, `token`, `created_at`, `expires_at` opcional).
   - Ou usa um **JWT assinado** com `projectId`, `department`, `expiresAt` (sem tabela).
   - A URL retornada é:  
     `https://seusite.com/prestacao-contas/[projectId]/[deptSlug]?token=...`

2. **Uso do link (colaborador, sem login)**  
   - O colaborador abre a URL. A página carrega os dados **apenas daquele departamento** (verba desse dept, despesas desse dept, responsáveis).
   - Ao clicar em **Salvar**, o front envia para uma API (ex.: `POST /api/prestacao-contas/save`) o `token` + `projectId` + `department` + payload (lista de despesas do departamento, e opcionalmente responsáveis).
   - A API valida o token (consulta à tabela ou verificação da assinatura JWT). Se válido, atualiza o projeto: lê `closing_lines` atual, substitui/merge apenas a parte desse departamento (expenses + eventualmente expenseDepartmentConfig), e chama `updateProject`. Assim, a aba FECHAMENTO continua exibindo tudo integrado.

3. **Sem token**  
   - Se a página for acessada sem token (ou com token inválido/expirado), pode-se permitir **apenas leitura** ou exibir mensagem “Link inválido ou expirado”. O importante: **escrita só com token válido**.

---

## Estrutura de arquivos sugerida

```
app/
  prestacao-contas/
    [projectId]/
      [deptSlug]/
        page.tsx          # Página pública: um projeto + um departamento
api/
  prestacao-contas/
    data/
      route.ts             # GET: retorna dados só do dept (verba, despesas, responsáveis); valida token para escrita ou só leitura
    save/
      route.ts             # POST: recebe token + payload, valida token, atualiza closing_lines do projeto
  (opcional) gerar-link/
    route.ts               # POST (auth): gera token e devolve URL do departamento (chamado pelo app ao clicar em "Gerar link")
components/
  prestacao-contas/
    PrestacaoContasDeptView.tsx   # UI de um único departamento: responsáveis (somente leitura?), verba, tabela, Salvar
```

Ou manter uma única página com query params (menos elegante para compartilhar):

- `app/prestacao-contas/page.tsx` com `searchParams`: `project`, `dept`, `token`.

A recomendação é **rota dinâmica** `[projectId]/[deptSlug]` para URLs limpas e fáceis de enviar.

---

## O que a página exclusiva exibe (por departamento)

- **Título:** nome do projeto + nome do departamento (ex.: “Projeto X – Prestação de contas – PRODUÇÃO”).
- **Responsáveis:** os 2 responsáveis do departamento (somente leitura; definidos no FECHAMENTO).
- **Verba destinada:** apenas a verba **desse** departamento (valor orçado).
- **Saldo:** verba − total das despesas desse departamento.
- **Tabela de despesas:** colunas Data, Fornecedor, Descrição, Tipo, Valor, NF, Status (apenas linhas desse departamento).
- **Botão “Adicionar conta”.**
- **Botão “Salvar”:** envia para a API (com token); a API atualiza o projeto e os dados aparecem no FECHAMENTO.

Sem token válido: não exibir botão Salvar (ou exibir desabilitado / mensagem “Link inválido”).

---

## Fluxo resumido

1. **No sistema (FECHAMENTO):** usuário logado escolhe o projeto, abre a prestação de contas e clica em “Gerar link” no departamento desejado. O sistema gera o token e mostra a URL (ex.: `https://.../prestacao-contas/abc/producao?token=xyz`).
2. **Compartilhamento:** usuário envia esse link ao responsável do departamento (ex.: por e-mail/WhatsApp).
3. **Colaborador (sem login):** abre o link, vê só o seu departamento (verba, despesas, responsáveis), edita e clica em **Salvar**.
4. **Backend:** API valida token, atualiza `closing_lines` do projeto (merge do departamento) e responde sucesso.
5. **Sistema:** na aba FECHAMENTO do mesmo projeto, os dados desse departamento já aparecem atualizados.

---

## Dados: apenas do departamento

| Dado | Fonte | Observação |
|------|--------|------------|
| Verba do departamento | `budget_lines_final` + `verba_lines_final` (cálculo igual ao ViewFechamento, só para esse dept) | Não enviar verbas dos outros depts. |
| Despesas do departamento | `closing_lines[1]` (expenses) filtradas por `department === dept` | Só esse dept. |
| Responsáveis do departamento | `closing_lines[3]` (expenseDepartmentConfig[dept]) | Somente leitura na página exclusiva. |

Na **gravação**, a API deve:

1. Carregar o projeto atual.
2. Obter `closing_lines` = `[closingLines, expenses, saving, expenseDepartmentConfig]`.
3. Substituir em `expenses` apenas as linhas cujo `department === dept` pelo payload enviado; manter as demais.
4. (Opcional) Atualizar `expenseDepartmentConfig[dept]` se a página enviar responsáveis editáveis no futuro.
5. Chamar `updateProject(projectId, { closing_lines: updated })`.

---

## Resumo da proposta revisada

| Item | Proposta |
|------|----------|
| **Rota** | `/prestacao-contas/[projectId]/[deptSlug]` (uma página por projeto + departamento) |
| **Query** | `?token=...` (obrigatório para permitir Salvar) |
| **Auth da página** | **Nenhum login.** Acesso à página é público; escrita autorizada apenas com token válido no link. |
| **Escopo** | Um departamento por URL; colaborador não vê verba nem despesas dos outros. |
| **Vinculação** | Sempre a um projeto; dados salvos vão para o mesmo projeto e aparecem no FECHAMENTO. |
| **API** | GET dados do dept (e opcionalmente validar token); POST save com token, merge em closing_lines. |
| **Geração do link** | Na aba FECHAMENTO, botão “Gerar link” por departamento; retorna URL com token. |

Quando estiver de acordo, o próximo passo é implementar: rotas dinâmicas, API de dados/save, geração de token/link e componente `PrestacaoContasDeptView` (um departamento só).
