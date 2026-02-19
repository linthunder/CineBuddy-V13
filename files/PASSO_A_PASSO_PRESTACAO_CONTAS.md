# Passo a passo: Implementação da página exclusiva de Prestação de Contas

Siga a ordem abaixo. Cada passo pode ser feito em um único “batch” de alterações ou dividido em commits menores.

---

## Visão geral da ordem

| # | Passo | O que faz |
|---|--------|-----------|
| 1 | Constantes e tipos compartilhados | Slugs dos departamentos, mapeamento slug ↔ departamento, tipo da linha de despesa |
| 2 | API GET – dados do departamento | Carrega projeto e devolve só verba, despesas e responsáveis de um dept |
| 3 | API POST – gerar link (token) | Gera JWT com projectId + departamento + validade; devolve URL |
| 4 | API POST – salvar | Valida token, faz merge das despesas do dept em closing_lines, atualiza projeto |
| 5 | Componente PrestacaoContasDeptView | UI de um único departamento (título, responsáveis, verba, saldo, tabela, Adicionar conta, Salvar) |
| 6 | Página pública | Rota `app/prestacao-contas/[projectId]/[deptSlug]/page.tsx` |
| 7 | Botão “Gerar link” no FECHAMENTO | Em cada bloco de departamento, botão que chama a API e mostra/copia a URL |

---

## Passo 1 – Constantes e tipos compartilhados

**Objetivo:** Centralizar slugs, mapeamentos e tipos para uso na API, na página e no ViewFechamento.

**Arquivo sugerido:** `lib/prestacao-contas.ts` (novo)

- Definir lista dos 4 departamentos (pode importar de ViewFechamento ou reexportar).
- Definir mapeamento **slug → departamento** e **departamento → slug**:
  - `producao` ↔ PRODUÇÃO
  - `arte-cenografia` ↔ ARTE E CENOGRAFIA
  - `figurino-maquiagem` ↔ FIGURINO E MAQUIAGEM
  - `fotografia-tecnica` ↔ FOTOGRAFIA E TÉCNICA
- Exportar função `getDeptBySlug(slug: string): department | null` e `getSlugByDept(department): string`.
- Exportar tipo da **linha de despesa** (igual ao ExpenseLine do ViewFechamento: id, department, description, value, invoiceNumber, payStatus, date, supplier, expenseType) para uso na API e no componente.
- Validar slug na rota: se `[deptSlug]` não for um dos 4, retornar 404.

**Onde usar:** API (data + save), página exclusiva, e depois no botão “Gerar link” (para montar a URL).

---

## Passo 2 – API GET – dados do departamento

**Objetivo:** Endpoint público que, dado projeto + departamento (e opcionalmente token), retorna apenas os dados daquele departamento (verba, despesas, responsáveis). Não exige login.

**Arquivo:** `app/api/prestacao-contas/data/route.ts` (novo)

- **Método:** GET.
- **Query params:** `projectId`, `deptSlug` (ou receber no path; nesse caso pode ser uma rota como `app/api/prestacao-contas/[projectId]/[deptSlug]/route.ts` GET).
- Validar `deptSlug` com o mapeamento do Passo 1; se inválido, 400.
- Carregar projeto com `getProject(projectId)`. Se não existir, 404.
- Obter `closing_lines` do projeto. Formato: `[closingLines, expenses, expenseDepartmentConfig?, ...]`.
- Filtrar `expenses` onde `department === departamento`.
- Obter responsáveis: `expenseDepartmentConfig?.[departamento]` (responsible1, responsible2).
- Calcular **verba do departamento:** usar a mesma lógica de `getDeptBudget` do ViewFechamento, usando `budget_lines_final` e `verba_lines_final` do projeto (normalizar de `Record<string, unknown>` para o formato esperado por `getDeptBudget` – por fase e departamento).
- Calcular **saldo:** verba − soma dos valores das despesas do departamento.
- Retornar JSON: `{ projectName, department, departmentSlug, responsible1, responsible2, verba, saldo, expenses }`.
- **Token:** não é obrigatório para GET (página pode carregar em modo só leitura sem token). Se quiser esconder dados sem token, pode exigir token no GET também; senão, deixe GET público e só o POST (salvar) exige token.

**Nota:** A função `getDeptBudget` hoje está dentro do ViewFechamento e usa `BudgetLinesByPhase` e `VerbaLinesByPhase`. Será preciso extrair essa função para um módulo compartilhado (ex.: `lib/budgetUtils.ts` ou `lib/prestacao-contas.ts`) e usá-la na API, normalizando os dados do projeto (budget_lines_final, verba_lines_final) para esse formato.

---

## Passo 3 – API POST – gerar link (token)

**Objetivo:** Usuário logado, na aba FECHAMENTO, clica em “Gerar link” e recebe a URL com token (JWT). O token autoriza salvamentos naquele projeto + departamento sem login.

**Arquivo:** `app/api/prestacao-contas/gerar-link/route.ts` (novo)

- **Método:** POST.
- **Auth:** exige que o usuário esteja logado (verificar sessão/cookie/JWT do CineBuddy como nas outras APIs protegidas).
- **Body:** `{ projectId: string, deptSlug: string }`.
- Validar `deptSlug` (Passo 1). Verificar se o projeto existe e se o usuário tem permissão (ex.: projeto da empresa do usuário).
- Gerar **JWT** com payload: `{ projectId, department (valor interno, ex.: "PRODUÇÃO"), exp: data de expiração (ex.: 90 dias) }`. Assinar com um segredo (variável de ambiente, ex.: `PRESTACAO_CONTAS_JWT_SECRET`).
- Montar URL base do app (ex.: `process.env.NEXT_PUBLIC_APP_URL` ou `headers.get('origin')`):  
  `https://.../prestacao-contas/[projectId]/[deptSlug]?token=[JWT]`
- Retornar JSON: `{ url: string, expiresAt?: string }`.

**Alternativa com tabela:** Em vez de JWT, criar tabela `prestacao_links` (project_id, department, token, created_at, expires_at) e gerar token aleatório; na API de save (Passo 4) validar consultando a tabela. Use JWT se quiser evitar migração no início.

---

## Passo 4 – API POST – salvar

**Objetivo:** Receber despesas do departamento + token; validar token; atualizar closing_lines do projeto (merge só desse departamento).

**Arquivo:** `app/api/prestacao-contas/save/route.ts` (novo)

- **Método:** POST.
- **Body:** `{ token: string, projectId: string, deptSlug: string, expenses: ExpenseLine[] }`. Cada item em `expenses` deve ter `department` igual ao departamento (ou a API força o department ao fazer o merge).
- Validar `deptSlug` e obter o departamento interno.
- **Validar token:** decodificar JWT (se usar JWT), verificar assinatura e `exp`, e que `projectId` e `department` do payload batem com o request. Se usar tabela, consultar por token e comparar project_id e department.
- Carregar projeto com `getProject(projectId)`. Se não existir ou não bater com o token, 404 ou 403.
- Obter `closing_lines` atual: `[closingLines, expensesFull, saving, expenseDepartmentConfig]`.
- **Merge:** em `expensesFull`, remover todas as linhas cujo `department === departamento` e adicionar as linhas recebidas em `expenses` (garantindo que cada linha tenha `department` igual ao departamento).
- Montar novo array: `closing_lines = [closingLines, newExpensesFull, saving, expenseDepartmentConfig]`.
- Chamar `updateProject(projectId, { closing_lines: closing_lines })`.
- Retornar 200 com `{ success: true }` ou 400/403 em caso de erro.

---

## Passo 5 – Componente PrestacaoContasDeptView

**Objetivo:** Um único componente que mostra a prestação de **um** departamento: título, responsáveis (somente leitura), verba, saldo, tabela de despesas (Data, Fornecedor, Descrição, Tipo, Valor, NF, Status), “Adicionar conta” e “Salvar”. Reutilizável na página exclusiva.

**Arquivo:** `components/prestacao-contas/PrestacaoContasDeptView.tsx` (novo)

- **Props sugeridas:**  
  - `projectName: string`  
  - `department: string` (nome do departamento, ex.: "PRODUÇÃO")  
  - `responsible1?: string`, `responsible2?: string`  
  - `verba: number`, `saldo: number`  
  - `expenses: ExpenseLine[]` (só do departamento)  
  - `onExpensesChange: (expenses: ExpenseLine[]) => void` (ou callbacks update/add/remove)  
  - `onSave: () => void`  
  - `saving?: boolean` (estado de loading do botão Salvar)  
  - `canEdit?: boolean` (se false, esconde Adicionar conta e Salvar; ex.: quando não tem token)  
  - `saveSuccess?: boolean` (feedback de sucesso)

- Reaproveitar **estilos e estrutura** da tabela do ViewFechamento (colunas Data, Fornecedor, Descrição, Tipo, Valor, NF, Status, Remover), inputs e dropdown de TIPO (Alimentação, Combustível, Estacionamento, outros).
- Título: ex.: “{projectName} – Prestação de contas – {department}”.
- Exibir responsáveis com separador vertical (como no FECHAMENTO).
- Verba e saldo (saldo em vermelho se negativo).
- Botão Salvar chama `onSave`; desabilitar enquanto `saving`.

**Dica:** Pode extrair do ViewFechamento apenas o trecho da tabela de um departamento (cabeçalho da tabela + map das linhas) para evitar duplicar HTML/CSS. O estado (expenses) fica na página que usa o componente.

---

## Passo 6 – Página pública

**Objetivo:** Rota que renderiza a prestação de um departamento, sem login.

**Arquivo:** `app/prestacao-contas/[projectId]/[deptSlug]/page.tsx` (novo)

- Client component (usa estado para expenses e loading).
- Ler `params.projectId`, `params.deptSlug` e `searchParams.token`.
- Validar `deptSlug` com o mapeamento do Passo 1; se inválido, `notFound()`.
- **Carregar dados:** chamar GET da API (Passo 2) com projectId e deptSlug. Se projeto não existir ou erro, mostrar mensagem ou 404.
- Estado local: `expenses` (lista do departamento), `projectName`, `verba`, `saldo`, `responsible1`, `responsible2`.
- `canEdit = !!token` (ou validar token no GET e retornar um flag; por simplicidade, considerar que com token pode editar).
- Renderizar `PrestacaoContasDeptView` com:
  - dados carregados;
  - `onExpensesChange` atualiza estado local;
  - `onSave` chama POST save (Passo 4) com token, projectId, deptSlug e expenses; em sucesso, mostrar feedback; em erro (ex.: token inválido), mostrar “Link inválido ou expirado”.
- Sem token: ainda assim pode carregar e exibir em modo leitura (`canEdit=false`).

---

## Passo 7 – Botão “Gerar link” no FECHAMENTO

**Objetivo:** Na aba FECHAMENTO do sistema, em cada bloco de departamento (ao lado do título ou dos responsáveis), adicionar um botão “Gerar link” (ou “Link para este departamento”).

- Ao clicar:
  - Chamar POST `api/prestacao-contas/gerar-link` com `projectId` (id do projeto aberto) e `deptSlug` (slug do departamento).
  - Receber a URL no response.
  - Mostrar a URL em um modal ou tooltip para o usuário **copiar** (e opcionalmente enviar por e-mail/WhatsApp). Ex.: “Link copiado!” ou exibir a URL em um input readonly com botão Copiar.

- Só exibir o botão se houver projeto carregado (projectDbId) e se o usuário estiver na view fechamento (já está no contexto certo). O projectId a enviar é o `projectDbId` (id do registro no Supabase).

---

## Checklist final

- [ ] Passo 1 – `lib/prestacao-contas.ts` com slugs, mapeamentos e tipo ExpenseLine (ou import do ViewFechamento).
- [ ] Passo 2 – GET dados do departamento (verba, despesas, responsáveis); extrair/reexportar `getDeptBudget` para uso na API; normalizar budget_lines_final e verba_lines_final.
- [ ] Passo 3 – POST gerar-link (JWT com projectId + department + exp); variável de ambiente para o segredo.
- [ ] Passo 4 – POST save (validar token, merge expenses no closing_lines, updateProject).
- [ ] Passo 5 – Componente PrestacaoContasDeptView (um departamento).
- [ ] Passo 6 – Página `app/prestacao-contas/[projectId]/[deptSlug]/page.tsx` (sem auth).
- [ ] Passo 7 – Botão “Gerar link” no ViewFechamento por departamento.

---

## Variáveis de ambiente

- **`PRESTACAO_CONTAS_JWT_SECRET`** (obrigatória para gerar link e salvar) – segredo para assinar e validar o token do link. Gere uma string longa e aleatória (ex.: `openssl rand -base64 32`) e adicione em `.env.local`. Sem ela, o botão "Gerar link" e o Salvamento na página exclusiva falham.
- **`NEXT_PUBLIC_APP_URL`** (opcional) – URL base do app para montar o link (ex.: `https://cinebuddy.vercel.app`). Se não definir, a API usa o `Origin` do request ao gerar o link.

---

## Ordem sugerida de implementação (por dependência)

1. **Passo 1** – Constantes e tipos (nenhuma dependência).
2. **Passo 2** – GET data (depende do 1; e de extrair getDeptBudget se ainda estiver só no ViewFechamento).
3. **Passo 5** – Componente PrestacaoContasDeptView (pode ser desenvolvido em paralelo ou depois do 2; depende dos tipos do 1).
4. **Passo 3** – POST gerar-link (depende do 1; JWT).
5. **Passo 4** – POST save (depende do 1 e da validação do token do 3).
6. **Passo 6** – Página (depende de 2, 4 e 5).
7. **Passo 7** – Botão no FECHAMENTO (depende do 3 e da URL retornada).

Após concluir todos os passos, testar: gerar link no FECHAMENTO, abrir em aba anônima, editar despesas e salvar; em seguida abrir o projeto no FECHAMENTO e conferir se as despesas do departamento aparecem atualizadas.
