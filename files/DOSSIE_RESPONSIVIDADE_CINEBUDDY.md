# Dossiê: Responsividade e Contenção de Layout — CineBuddy

**Objetivo:** Varredura estrutural para vazamentos de informação, sobreposições e desalinhamentos ao reduzir a janela do browser; propostas de solução para um sistema responsivo estável, alinhado e com boa visibilidade.

---

## 0. Comportamento inteligente (redução progressiva)

**Princípio:** O sistema deve **reduzir progressivamente** o tamanho de elementos (botões, padding, fonte) ao reduzir a janela, em vez de apenas quebrar linha ou gerar scroll. Assim mantém-se boa leitura e operação sem desperdiçar espaço.

**Aplicação:**
- **Botões grandes** (ex.: BudgetTabs — “Pré-produção”, “Produção”, “Pós-produção”, “Finalizar orçamento”): em viewports estreitas, usar **padding menor** (ex.: `px-2` em vez de `px-4`), **altura um pouco menor** (ex.: `h-8` → `h-7` em mobile) e, se necessário, **fonte ligeiramente menor** (ex.: `text-[11px]` ou `text-[10px]`) ou **texto abreviado** (“Finalizar” em vez de “Finalizar orçamento”) para que tudo caiba na mesma linha ou quebre de forma previsível.
- **Outros controles** (Header, ViewFechamento toolbar, BottomNav): mesma ideia — **reduzir tamanho antes de esconder ou quebrar**, garantindo que a interface continue utilizável e legível.
- **Objetivo:** Evitar que botões “fixos” (px-3 sm:px-4, h-9 sm:h-8) ocupem sempre o mesmo espaço; permitir que encolham de forma controlada em telas menores.

**Onde aplicar:** BudgetTabs, ViewFechamento toolbar (Saving, Concluir fechamento), Header (botões mobile), BottomNav (já previsto modo só ícones), e qualquer barra de ações com múltiplos botões.

---

## 1. Tabelas de orçamento (BudgetDeptBlock / budget-table-cards)

### 1.1 Achado: linhas quebram em campos verticais

**Situação atual:** No breakpoint `max-width: 1279px`, o CSS em `globals.css` aplica layout em “cards” às tabelas de orçamento:
- `thead` oculto
- `tbody tr` → `display: block` (cada linha vira um bloco)
- `tbody td` → `display: flex` com `data-label` como pseudo-conteúdo

Isso faz com que **cada linha da tabela vire um conjunto de campos empilhados verticalmente** (label + valor por célula), e não uma linha horizontal.

**Expectativa do usuário:** Ao “quebrar em uma coluna” (grid da página em 1 coluna), as **linhas das tabelas devem continuar horizontais** (células lado a lado), e não virar layout vertical.

**Proposta:**
- **Remover o layout em cards** para `.budget-table-cards`: não usar `display: block` em `tr` nem `display: flex` em `td` em nenhum breakpoint.
- Manter **sempre** o layout de tabela (`display: table-row` / `table-cell`).
- Garantir contenção por outros meios:
  - Grid da página em 1 coluna a partir de um breakpoint (ex.: 1280px), dando largura total ao bloco da tabela.
  - Tabela com `min-width: 0`, `width: 100%`, `table-layout: fixed` e colunas com larguras relativas + fixas (Qtd/Excluir em px) para que a tabela **encolha com o container** sem overflow horizontal.
- Se em viewports muito estreitas a tabela ainda ficar apertada, usar **scroll horizontal apenas no container da tabela** (ex.: `overflow-x-auto` no wrapper do bloco), e não transformar as linhas em cards.

**Arquivos:** `app/globals.css` (remover/alterar o bloco `@media (max-width: 1279px)` que aplica o layout em cards).

---

## 2. Mini tables (Contingência, CRT, BV Agência)

### 2.1 Achado: valores são ocultados ao reduzir; redução “errada”

**Situação atual:** `MiniTables.tsx` usa um grid:
- `grid-cols-1 sm:grid-cols-2 md:grid-cols-3`
- Cada célula tem um flex interno: label (esquerda) + input (direita) com `flex-1` e `gap-3`.

Ao reduzir a largura:
- Em 2 ou 3 colunas, os cards encolhem e o **input (valor) é o primeiro a ser comprimido/ocultado**, pois o label tem tamanho fixo implícito e o input usa `flex-1`.
- O usuário espera que os **valores encolham da esquerda para a direita** (ou que o espaço do valor seja preservado até onde for possível), e que os **cards empilhem (1 coluna) antes** de os valores sumirem.

**Proposta:**
- **Prioridade de empilhamento:** Fazer o grid das mini tables ir para **1 coluna mais cedo**, para que cada card tenha largura total antes de ficar estreito demais.
  - Ex.: `grid-cols-1` até um breakpoint maior (ex.: apenas a partir de `lg` ou `xl` usar 2 colunas; acima de outro breakpoint, 3 colunas), garantindo que em telas médias/estreitas haja sempre 1 coluna (cards empilhados).
- **Prioridade de redução dentro do card:** Garantir que, ao encolher, seja o **label** a ceder espaço (ex.: `min-width: 0` no label, `flex-shrink: 0` ou largura mínima no input), ou usar `overflow: hidden; text-overflow: ellipsis` no label e manter o input com largura mínima razoável (ex.: `min-width: 5rem`) para o valor sempre visível.
- Opcional: em viewports muito pequenas, colocar label acima do valor (bloco vertical) dentro do mesmo card, em vez de lado a lado, para preservar legibilidade do valor.

**Arquivos:** `components/MiniTables.tsx` (grid e estrutura flex do label/input).

---

## 3. BottomNav (navegação inferior)

### 3.1 Achado: risco de vazamento e scroll horizontal

**Situação atual:** `BottomNav.tsx`:
- `flex items-center justify-around` + `overflow-x-auto`
- Cada botão: ícone + texto (label), `min-w-[56px] sm:min-w-[64px]`, texto em `text-[10px] sm:text-[11px]` uppercase.

Em janelas estreitas, sete botões com ícone + texto podem **vazar** para fora ou forçar barra de rolagem horizontal, mesmo com `overflow-x-auto`.

**Proposta (conforme sugerido pelo usuário):**
- **Modo compacto em viewports estreitas:** Abaixo de um breakpoint (ex.: `max-width: 640px` ou 768px), exibir **apenas os ícones** nos botões (ocultar o `<span>` do label).
- Manter **acessibilidade:** `aria-label` já existe em cada botão; o ícone pode ter `aria-hidden="true"` para leitores de tela não duplicarem.
- Evitar `overflow-x-auto` como solução principal: preferir **reduzir conteúdo (só ícones)** para que a nav caiba sem scroll.
- Opcional: tooltip (title ou componente) no hover para mostrar o nome da view quando só o ícone estiver visível.

**Arquivos:** `components/BottomNav.tsx` (condicional de exibição do label por breakpoint ou classe CSS).

---

## 4. Finance strip (Valor total, Custo, Lucro, Impostos, Margem)

### 4.1 Achado: layout assimétrico (2 + 3) e vazamento

**Situação atual:** `FinanceStrip.tsx`:
- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr_0.8fr]`.
- Em telas “médias” (sm até antes de lg) fica em **2 colunas**, o que produz **2 itens na primeira coluna e 3 na segunda** (ou distribuição assimétrica), deixando o bloco “torto”.
- Em telas muito estreitas, 1 coluna já empilha tudo, mas o passo intermediário (2 colunas) quebra a simetria e pode comprimir textos/valores.

**Proposta (conforme sugerido pelo usuário):**
- **Empilhar em 1 coluna antes de ir para 2:** Fazer o strip ir para **2 colunas apenas em larguras maiores** (ex.: só a partir de `lg` ou `xl`), e abaixo disso manter **sempre 1 coluna** (todos os itens empilhados). Assim evita-se o layout 2+3 e mantém alinhamento e simetria.
- **Quebra sugerida:** Por exemplo: `grid-cols-1` até `lg` (ou 1024px); a partir de `lg`, `grid-cols-5` ou o template `1.3fr 1fr 1fr 1.2fr 0.8fr`. Não usar `sm:grid-cols-2` para evitar a fase assimétrica.
- Garantir em cada célula: `min-width: 0` onde houver texto/valor, e `overflow: hidden; text-overflow: ellipsis` em labels longos se necessário, preservando os valores monetários sempre legíveis.

**Arquivos:** `components/FinanceStrip.tsx` (classes do grid e possivelmente estilos das células).

---

## 5. Main e vazamento geral da página

### 5.1 Achado: overflow-x-auto no main

**Situação atual:** `app/page.tsx`, `<main>`:
- `className="... w-full overflow-x-auto min-h-0"`.

O `overflow-x-auto` no main faz com que **qualquer conteúdo que ultrapasse a largura da viewport** gere barra de rolagem horizontal **na página inteira**, o que:
- Permite “vazamento” visual (a página parece que sai da tela).
- Não contém o overflow por componente (cada seção deveria ser responsável por seu próprio scroll, se necessário).

**Proposta:**
- **Remover `overflow-x-auto` do main** e garantir que nenhum filho direto ou bloco de conteúdo force largura mínima maior que 100vw sem necessidade.
- Onde for inevitável tabela larga (ex.: em viewports muito pequenas), usar **overflow-x-auto apenas no container da tabela** (ex.: o `div` que envolve cada `BudgetDeptBlock` ou a área de conteúdo do orçamento), mantendo header, strip, tabs, toolbar e nav fixos e sem scroll horizontal.
- Garantir `min-width: 0` nos containers intermediários (ex.: `page-layout__content`, `page-layout__content--grid`, filhos do grid) para que o flex/grid possa encolher e não “empurrar” o main.

**Arquivos:** `app/page.tsx` (main), e revisão de `BudgetDeptBlock` / views que usam tabelas.

---

## 6. Header

### 6.1 Achado: possível compressão e sobreposição em telas estreitas

**Situação atual:** `Header.tsx`:
- Em mobile: logo + “CineBuddy” + vários botões (Novo, Abrir, Salvar cópia, Salvar, Sair) na mesma linha com `flex gap-1.5 sm:hidden`.
- Em desktop: três áreas (esquerda, centro, direita) com `sm:flex` e `hidden sm:block` para o centro.

Em janelas muito estreitas, a faixa de botões no mobile pode **comprimir ou sobrepor** o título/logo.

**Proposta:**
- Garantir que a área dos botões no mobile tenha `flex-wrap: wrap` ou que, abaixo de um certo width, botões passem para uma segunda linha em vez de comprimir o logo.
- Manter logo + nome com `flex-shrink: 0` ou largura mínima para nunca ficarem invisíveis.
- Opcional: em larguras muito pequenas, reduzir texto dos botões (ex.: “Salvar cópia” → “Cópia”) ou mostrar só ícones em parte deles, de forma consistente com a BottomNav.

**Arquivos:** `components/Header.tsx`.

---

## 7. BudgetTabs (Pré / Prod / Pós + botão Finalizar)

### 7.1 Achado: possível quebra, desalinhamento e botões que não encolhem

**Situação atual:** `BudgetTabs.tsx`:
- `flex flex-wrap gap-2 sm:gap-1`; botões com `h-9 sm:h-8`, `px-3 sm:px-4`, `text-xs`; botão “Finalizar/Abrir” com `ml-auto` e texto longo (“Finalizar orçamento” / “Abrir orçamento”).
- Em telas estreitas, os botões mantêm **tamanho fixo** (padding e altura), o que pode forçar wrap ou ocupar espaço desnecessário.

**Proposta (comportamento inteligente):**
- **Redução progressiva:** Em viewports menores, reduzir **padding** (ex.: `px-2` em mobile, `px-3` em sm, `px-4` em md+), **altura** (ex.: `h-8` em mobile, `h-8` em sm) e, se necessário, **tamanho da fonte** (ex.: `text-[10px]` ou `text-[11px]` em mobile) para que as quatro ações (3 abas + Finalizar) continuem legíveis e operáveis sem quebrar em duas linhas cedo demais.
- **Texto abreviado no botão de lock (opcional):** Em telas muito estreitas, exibir “Finalizar” e “Abrir” em vez de “Finalizar orçamento” e “Abrir orçamento”, mantendo o ícone 🔒/🔓.
- Manter **flex-wrap** para quando realmente não couber; garantir que, ao quebrar, o botão Finalizar não fique sozinho de forma assimétrica (ex.: ordem visual ou agrupamento em um wrapper “tabs” + “action”).
- **Resumo:** Botões grandes podem e devem ter **tamanhos reduzidos** ao reduzir a janela, mantendo boa leitura e operação.

**Arquivos:** `components/BudgetTabs.tsx`.

---

## 8. ViewFechamento (strip de totais e tabelas)

### 8.1 Achado: grid 5 colunas e tabelas com min-width

**Situação atual:** ViewFechamento usa:
- Um strip em grid com 5 colunas: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5`.
- Tabelas com `min-w-[500px]` e container com `overflow-x-auto`.

O mesmo princípio do FinanceStrip se aplica: **evitar passo intermediário assimétrico** (ex.: 2 colunas com 2+3 itens). Garantir que tabelas não provoquem scroll no main, e sim no próprio container.

**Proposta:**
- Strip: alinhar lógica ao FinanceStrip — 1 coluna até um breakpoint maior, depois 5 colunas (ou 2 colunas simétricas, ex.: 2+2+1 em linhas definidas), evitando 2+3.
- Tabelas: manter `overflow-x-auto` e `min-width` apenas no wrapper da tabela; garantir que o restante da página (main) não use overflow horizontal.

**Arquivos:** `components/views/ViewFechamento.tsx`.

---

## 9. ViewConfig, ViewTeam, ViewDashboard e outros

### 9.1 Resumo

- **ViewConfig:** Vários grids (`grid-cols-1 sm:grid-cols-2`, `lg:grid-cols-4`); modais com `max-w-md`/`max-w-lg`. Garantir que em mobile os grids não forcem larguras mínimas que vazem; usar `min-width: 0` nos filhos onde houver texto longo.
- **ViewTeam:** Listas e tabelas; verificar se há `overflow-x-auto` local em tabelas e se não há min-width excessivo no container.
- **ViewDashboard:** Gráficos (Recharts) e grids; garantir que os containers de gráficos tenham `ResponsiveContainer` ou largura máxima 100% e que os grids de resumo não gerem overflow no main.

**Proposta geral:** Em toda view, garantir que:
- Containers de nível de página tenham `min-width: 0` quando forem filhos de flex/grid.
- Tabelas ou conteúdo largo tenham scroll apenas no próprio bloco (`overflow-x-auto` no wrapper da tabela), não no main.
- Grids que quebram em 2 colunas tenham número par de itens ou estratégia clara (ex.: 1 coluna até lg, depois várias colunas) para evitar colunas “tortas”.

---

## 10. Dupla checagem — itens adicionais

Itens que podem ter passado despercebidos na primeira varredura:

### 10.1 ViewFechamento — barra de ferramentas (Saving + Concluir)

- **Achado:** A linha com “Saving”, “Total economia”, “%”, “A pagar”, select “Responsável” (`min-w-[140px]`) e “Concluir fechamento” usa `flex flex-wrap`. Os spans têm `whitespace-nowrap`, o que **impede quebra** e pode forçar overflow horizontal antes do wrap.
- **Proposta:** (1) Permitir quebra de texto nos labels onde fizer sentido ou usar versões curtas em mobile (“Econ.”, “A pagar” já curto). (2) Select do responsável: reduzir `min-w-[140px]` em viewport estreita (ex.: `min-w-0` com largura mínima menor) ou quebrar a linha antes. (3) Aplicar **redução progressiva** ao botão “Concluir fechamento” (padding e, se necessário, texto “Concluir” em mobile).

### 10.2 ViewFilme — botões de ação (Roteiro, Decupagem, etc.)

- **Achado:** Grid `grid-cols-2 sm:grid-cols-4`; cada botão tem `py-5 px-3`, ícone `text-2xl`, label `text-[11px]`. Em 2 colunas em mobile, os botões podem ficar apertados.
- **Proposta:** Em viewports muito pequenas, reduzir padding (`py-3 px-2`) e/ou tamanho do ícone para manter proporção e legibilidade sem vazamento.

### 10.3 ViewConfig — tabelas e células com `whitespace-nowrap`

- **Achado:** Células de “Ações” (Editar, ×) usam `whitespace-nowrap`; cabeçalhos de tabela também. Isso é intencional para não quebrar, mas a **tabela** pode ficar larga e depender do `overflow-x-auto` do container. Confirmar que o container pai tem `overflow-x-auto` e que não há `min-width` excessivo na tabela.
- **Proposta:** Manter `whitespace-nowrap` nas ações; garantir que o wrapper da tabela tenha `overflow-x-auto` e `min-width: 0` no fluxo do layout.

### 10.4 Uso de `min-w-[...]` fixos

- **Locais:** `ViewFechamento`: select responsável `min-w-[140px]`; tabela fechamento `min-w-[500px]`. `BudgetDeptBlock`: inputClassName com `min-w-[4.5rem]` (usado em verbas/outros inputs, não no Qtd).
- **Proposta:** Revisar cada um: em mobile, reduzir ou remover `min-w` onde for seguro (ex.: select responsável com `min-w-[100px]` ou fluido com `min-w-0` e max-width). Tabelas: manter min-width apenas no wrapper com overflow, não no main.

### 10.5 LoginScreen

- **Achado:** Formulário centralizado com inputs `w-full`; não há grid que force largura. Risco baixo de vazamento.
- **Proposta:** Garantir que o card do login tenha `max-width` e `width: 100%` com padding; sem alteração crítica prevista.

### 10.6 ViewDashboard — tabela e gráficos

- **Achado:** Tabela com `min-w-[500px]`; Recharts com `ResponsiveContainer`. Containers devem ter `min-width: 0` para o flex/grid encolher.
- **Proposta:** Overflow da tabela apenas no container; gráficos já responsivos; confirmar `min-width: 0` nos wrappers do dashboard.

### 10.7 Resumo da dupla checagem

| Item | Risco | Ação |
|------|--------|------|
| ViewFechamento toolbar | Médio | Redução progressiva + flex-wrap + min-w do select |
| ViewFilme botões | Baixo | Padding/ícone menores em mobile |
| ViewConfig tabelas | Baixo | Confirmar overflow no wrapper |
| min-w fixos (140px, 500px, 4.5rem) | Médio | Revisar por contexto (mobile vs desktop) |
| LoginScreen | Baixo | Nenhuma alteração crítica |
| ViewDashboard | Baixo | min-width: 0 nos containers |

---

## 11. Resumo das prioridades de implementação

| Prioridade | Área              | Ação principal                                                                 |
|-----------|-------------------|-------------------------------------------------------------------------------|
| 1         | Tabelas orçamento | Remover layout em cards; manter linhas horizontais; conter overflow no bloco  |
| 2         | Mini tables       | Empilhar em 1 coluna antes de esconder valores; priorizar valor no flex       |
| 3         | BottomNav         | Modo só ícones em viewport estreita; evitar scroll horizontal                 |
| 4         | FinanceStrip      | 1 coluna até lg; depois 5 colunas (evitar 2 colunas assimétricas)            |
| 5         | Main              | Remover overflow-x-auto; conter overflow por componente                      |
| 6         | Header            | Evitar compressão do logo/botões; wrap ou ícones em mobile                   |
| 7         | BudgetTabs        | Revisar wrap e alinhamento do botão Finalizar                                |
| 8         | ViewFechamento    | Alinhar strip a 1 coluna → 5 colunas; manter overflow só no bloco da tabela |
| 9         | Demais views      | min-width: 0; overflow local em tabelas/gráficos                              |
| 10        | BudgetTabs        | Redução progressiva (padding, altura, texto abreviado)                        |
| 11        | ViewFechamento toolbar | Redução progressiva; revisar min-w e whitespace-nowrap                   |

---

## 12. Princípios de design responsivo aplicados

- **Contenção:** Nenhum conteúdo deve “vazar” para fora do viewport sem controle (scroll local em vez de scroll da página).
- **Simetria e alinhamento:** Evitar layouts intermediários com colunas desiguais (ex.: 2+3); preferir 1 coluna → N colunas quando houver espaço.
- **Prioridade de informação:** Em componentes com label + valor, preservar o valor (ex.: monetário) e permitir que o label encolha ou quebre linha.
- **Comportamento inteligente:** Reduzir progressivamente tamanho de botões e controles (padding, altura, fonte, texto abreviado) ao reduzir a janela, mantendo leitura e operação, em vez de depender só de wrap ou scroll.
- **Breakpoints consistentes:** Usar escala única (ex.: 640 / 1024 / 1280) para decisões de layout entre Header, BottomNav, strip, toolbar e conteúdo.
- **Acessibilidade:** Manter aria-labels e ordem lógica quando ocultar ou abreviar texto (ex.: só ícones na nav).

---

*Documento gerado para análise prévia à implementação. Inclui dupla checagem e princípio de comportamento inteligente (redução progressiva). Após aprovação, as alterações podem ser feitas nos arquivos indicados.*
