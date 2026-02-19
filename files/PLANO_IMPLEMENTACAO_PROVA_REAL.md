# Plano de implementação — checagem dupla de prova real
## Referência: CineBuddy_frontend_V13_50.html

Este documento lista **cada campo, botão, tabela e cálculo** da referência HTML e define como verificar se o sistema Next.js se comporta igual (prova real). Use como checklist antes de dar por concluída cada fase.

---

## Legenda

| Símbolo | Significado |
|---------|-------------|
| ✅ | Já implementado / conferido |
| ⬜ | Pendente |
| 🔴 | Comportamento diferente da referência (corrigir) |

---

# FASE 0 — HEADER (barra superior)

| # | Elemento | Referência V13.50 | Prova real (checagem dupla) | Status |
|---|----------|-------------------|-----------------------------|--------|
| H1 | Botão **NOVO** | Abre modal "Novo projeto" (Nome, Agência, Cliente, Duração + unidade). Ao confirmar "SALVAR E ABRIR": cria projeto e abre/foca na view Filme. | Clicar em NOVO → modal abre com 4 campos + botão "SALVAR E ABRIR". Preencher e confirmar → modal fecha e dados aparecem em Filme (ou projeto criado). | ⬜ |
| H2 | Botão **ABRIR** | Abre modal "Abrir projeto" com busca e lista de projetos. Ao clicar em um item → carrega projeto (dados filme + orçamento + status). | Clicar em ABRIR → modal com campo Buscar e lista. Selecionar projeto → modal fecha, dados do projeto e tabelas carregam. | ⬜ |
| H3 | Botão **SALVAR CÓPIA** | Abre modal "Salvar cópia" (Nome Cópia, Agência, Cliente, Duração). Ao "CRIAR CÓPIA": cria cópia do projeto atual com novo nome/dados. | Clicar em SALVAR CÓPIA → modal com 4 campos. Preencher e CRIAR CÓPIA → cópia criada (e opcionalmente aberta). | ⬜ |
| H4 | Botão **SALVAR** | Salva contexto atual: no Orçamento inicial = projeto + linhas iniciais; no Orç. Final = final; no Fechamento = fechamento. Feedback visual "SALVANDO...". | Em Orçamento, alterar algo → SALVAR → recarregar/abrir outro e voltar → dados persistem. Botão mostra loading ao salvar. | ⬜ |
| H5 | Centro do header | Exibe NOME DO PROJETO (strong) e "JOB #xxx • Agência • Cliente". Atualiza ao carregar/abrir projeto. | Abrir um projeto → centro mostra nome e info. Trocar de projeto → texto atualiza. | ⬜ |

---

# FASE 1 — VIEW FILME (Dados do projeto)

| # | Elemento | Referência V13.50 | Prova real | Status |
|---|----------|-------------------|------------|--------|
| F1 | Campo **Nome** | Input texto, id lógico in-nome. Salvo com o projeto. | Digitar nome → salvar projeto → reabrir → nome permanece. | ⬜ |
| F2 | Campo **Agência** | Input texto. Salvo com o projeto. | Idem: persistência ao salvar/reabrir. | ⬜ |
| F3 | Campo **Cliente** | Input texto. Salvo com o projeto. | Idem. | ⬜ |
| F4 | Campo **Duração** | Input numérico + select (segundos | minutos). Salvo com o projeto. | Alterar valor e unidade → salvar → reabrir → valores permanecem. | ⬜ |
| F5 | Botões ROTEIRO, DECUPAGEM, STORYBOARD, ORDEM DO DIA | Placeholder: ao clicar podem abrir alerta "Em breve: roteiro" (ou ação futura). | Clicar em cada um → não quebra; pode mostrar mensagem ou nada. | ⬜ |

---

# FASE 2 — VIEW ORÇAMENTO (Orçamento inicial)

## 2.1 Finance Strip (painel financeiro)

| # | Elemento | Referência V13.50 | Prova real | Status |
|---|----------|-------------------|------------|--------|
| S1 | **VALOR TOTAL** (input) | Editável. Focus: remove "R$", mostra só número. Blur: formata R$ x.xxx,xx. OnChange: recalcula CUSTO, LUCRO, IMPOSTOS, MARGEM. | Digitar 10000 → blur → mostra "R$ 10.000,00". Alterar → CUSTO/LUCRO/MARGEM atualizam. | ⬜ |
| S2 | Botão **+30%** (ao lado do label VALOR TOTAL) | applyMarkup(30): 1) Soma custo total (linhas + mini tabelas). 2) Se custo 0, alerta. 3) Valor = Custo / (1 - 0,30 - taxaImposto/100). 4) Preenche input VALOR TOTAL e chama calcFinancials(). | Com itens no orçamento e impostos 12,5%: clicar +30% → VALOR TOTAL preenchido; Lucro/Margem batem com margem ~30% sobre custo. Sem itens: aviso (ou não preencher). | ⬜ |
| S3 | **CUSTO** (somente leitura) | Soma: todas as linhas (tabelas + verbas) + Contingência + CRT + BV Agência. Atualiza ao alterar qualquer linha ou mini tabela. | Adicionar linha com total R$ 100 → CUSTO sobe R$ 100. Preencher Contingência R$ 50 → CUSTO sobe R$ 50. | ⬜ |
| S4 | **LUCRO LÍQUIDO** (somente leitura) | Valor Total − Custo − Impostos (em R$). Cor: verde se ≥ 0, vermelho se < 0. | Valor 1000, Custo 600, Impostos 12,5% → Lucro = 1000 − 600 − 125 = 275. Cor verde. | ⬜ |
| S5 | **IMPOSTOS** (% + valor R$) | Input número (ex.: 12,5). Valor R$ = Valor Total × (taxa/100). Ao alterar % → recalcula valor e Lucro/Margem. | Mudar para 10% → valor R$ e Lucro atualizam. Margem recalculada. | ⬜ |
| S6 | **MARGEM** (somente leitura) | (Lucro Líquido / Valor Total) × 100. Cor: verde ≥20%, amarelo ≥10%, vermelho <10%. | Para Valor 1000, Custo 700, Impostos 0: Lucro 300 → Margem 30% (verde). Ajustar custo para 950 → Margem 5% (vermelho). | ⬜ |

## 2.2 Abas (Pré-produção | Produção | Pós-produção)

| # | Elemento | Referência V13.50 | Prova real | Status |
|---|----------|-------------------|------------|--------|
| T1 | Abas Pré / Prod / Pós | Troca a fase visível. Apenas o phase-wrapper da fase ativa é exibido (outros hidden). | Clicar Pré-produção → só blocos da pré aparecem. Clicar Produção → só produção. Conteúdo correto por fase. | ⬜ |
| T2 | Botão **FINALIZAR ORÇAMENTO** | toggleLock('initial'): salva, bloqueia edição do inicial, copia para Orç. Final, libera aba Orç. Final. Texto/ícone: "FINALIZAR" (cadeado fechado) ou "ABRIR" (cadeado aberto). | (Implementação futura com backend.) Clicar → estado de lock muda; aba Orç. Final fica acessível; dados copiados para Final. | ⬜ |

## 2.3 Mini tabelas (Contingência, CRT, BV Agência)

| # | Elemento | Referência V13.50 | Prova real | Status |
|---|----------|-------------------|------------|--------|
| M1 | Contingência (input R$) | Valor em reais. Focus: mostra número sem "R$". Blur: formata R$ e atualiza custo total / calcFinancials. | Digitar 500 → blur → "R$ 500,00". CUSTO no strip sobe 500. | ⬜ |
| M2 | CRT (input R$) | Mesmo comportamento. Entra na soma do CUSTO. | Idem. | ⬜ |
| M3 | BV Agência (input R$) | Mesmo comportamento. Entra na soma do CUSTO. | Idem. | ⬜ |

## 2.4 Tabelas por departamento (blocos)

| # | Elemento | Referência V13.50 | Prova real | Status |
|---|----------|-------------------|------------|--------|
| D1 | Lista de departamentos por fase | Pré/Prod: 12 depts (DIREÇÃO… DESPESAS GERAIS). Pós: 4 depts (FINALIZAÇÃO, ANIMAÇÃO, VFX, ÁUDIO). Cada bloco: header (nome + total) + body (tabela + botão adicionar). | Trocar aba Prod/Pós → conjuntos corretos de blocos. Cada bloco mostra título e total no header. | ⬜ |
| D2 | **Labor** (Função, Nome, Tipo, Cachê, Desl., Qtd, Total, ×) | Total = (Cachê + Desl.) × Qtd. Tipo: Diária | Semana | Fechado. Ao alterar qualquer campo da linha → recalcula Total da linha e totais do dept + strip. | Inserir Cachê 1000, Desl. 200, Qtd 2 → Total = 2400. Header do bloco e CUSTO do strip atualizam. | ⬜ |
| D3 | **Cost** (Item, Fornecedor, Tipo, Valor, Qtd, Total, ×) | Total = Valor × Qtd. Tipo: Cachê | Verba | Extra. customHeaders por dept (ex.: CASTING = Nome/Descrição). | Inserir Valor 500, Qtd 3 → Total 1500. Labels corretos por dept (ex. CASTING: Nome, Descrição). | ⬜ |
| D4 | Botão **+ Adicionar profissional/item** | Adiciona uma linha vazia na tabela do bloco. Labor: "profissional"; cost: "item". | Clicar → nova linha com campos vazios; Total 0; ao preencher, totais atualizam. | ⬜ |
| D5 | Botão **×** (remover linha) | Remove a linha. Recalcula total do dept e CUSTO do strip. | Remover linha com valor → total do bloco e CUSTO diminuem. | ⬜ |
| D6 | **Verbas** (só PRODUÇÃO, FOTOGRAFIA E TÉCNICA, ARTE E CENOGRAFIA) | Botão "ADICIONAR VERBA" → aparece seção com tabela (Descrição, Valor, Qtd, Total, ×). Total da verba entra no total do departamento e no CUSTO. | Nos 3 depts, botão visível. Clicar → seção com tabela. Adicionar linha verba 100×2=200 → total do dept sobe 200 e CUSTO sobe. | ⬜ |
| D7 | **Total do departamento** (no header do bloco) | Soma das linhas da tabela principal + linhas de verba (se houver). Atualiza em tempo real. | Incluir linhas + verba → número no header = soma. Remover linha → total diminui. | ⬜ |

## 2.5 Campos de input (comportamento geral)

| # | Elemento | Referência V13.50 | Prova real | Status |
|---|----------|-------------------|------------|--------|
| I1 | Inputs de moeda (Cachê, Desl., Valor, Verba) | Aceitam digitação livre (ex.: 10, 100, 1234,56). Focus: valor editável sem "R$". Blur: formata "R$ x.xxx,xx". parseCurrencyInput para ler. | Digitar "1500" ou "1.500,00" → valor numérico 1500 usado no cálculo. Não cortar após 1 dígito. | ⬜ |
| I2 | Input Qtd (número) | type number, min 0, step any. Valor entra em Total = (Cachê+Desl)×Qtd ou Valor×Qtd. | Valores inteiros e decimais (ex.: 2, 1.5). Total atualiza ao mudar. | ⬜ |
| I3 | Select Tipo (labor: Dia/Semana/Fechado; cost: Cachê/Verba/Extra) | Só afeta label/contexto; cálculo de Total igual (Cachê+Desl)×Qtd ou Valor×Qtd. | Trocar tipo → Total mantém fórmula; sem erro. | ⬜ |

## 2.6 OBSERVAÇÕES (por fase)

| # | Elemento | Referência V13.50 | Prova real | Status |
|---|----------|-------------------|------------|--------|
| O1 | Bloco OBSERVAÇÕES | Uma vez por fase (Pré, Prod, Pós). Textarea (id notes-pre, notes-prod, notes-pos). grid-column 1/-1 (largura total). | Em cada aba, rodapé com "OBSERVAÇÕES" e textarea. Salvar/carregar projeto persiste texto (quando houver backend). | ⬜ |

---

# FASE 3 — VIEW ORÇ. FINAL (quando implementada)

| # | Elemento | Referência V13.50 | Prova real | Status |
|---|----------|-------------------|------------|--------|
| R1 | Finance Strip | VALOR JOB (readonly), CUSTO REAL, LUCRO REAL, DIFERENÇA (lucro final − lucro inicial), MARGEM. Sem botão +30%. | Valor do job não editável. Diferença verde/vermelho. Margem cores por faixa. | ⬜ |
| R2 | Mini tabelas | Readonly (copiadas do inicial). Contam no CUSTO REAL. | Valores iguais ao inicial; inputs desabilitados. | ⬜ |
| R3 | Tabelas | Estrutura igual ao inicial; editáveis (verbas também). Totais por dept (ftotal-...). | Editar linha → CUSTO REAL e Lucro/Diferença/Margem atualizam. | ⬜ |
| R4 | OBSERVAÇÕES (FINAL) | notes-final-pre, notes-final-prod, notes-final-pos. | Uma textarea por fase. | ⬜ |
| R5 | Botão FINALIZAR / ABRIR | toggleLock('final'): salva, bloqueia, copia para Fechamento, libera aba Fechamento. | Clicar → lock; aba Fechamento liberada. | ⬜ |

---

# FASE 4 — VIEW FECHAMENTO (quando implementada)

Conforme 03_SPEC_IMPLEMENTACAO.md e cinebuddy text.txt: linhas de fechamento (labor: diária de, adicional %, horas extras, NF); linha de resumo (total NF, HE, botão PIX, A PAGAR/PAGO); prestação de contas. (Checklist detalhado em fase futura.)

---

# Fórmulas de prova real (referência numérica)

Use estes casos para checagem dupla dos cálculos:

**1. Total por linha (labor)**  
Cachê = 1000, Desl. = 200, Qtd = 2 → Total = (1000+200)×2 = **2400**.

**2. Total por linha (cost)**  
Valor = 500, Qtd = 3 → Total = 500×3 = **1500**.

**3. Custo total**  
Linhas somam R$ 5000; Contingência 100, CRT 50, BV 50 → CUSTO = **5200**.

**4. Finance strip (inicial)**  
Valor Total = 10000, Custo = 5200, Impostos = 12,5%  
→ Impostos R$ = 1250  
→ Lucro = 10000 − 5200 − 1250 = **3550**  
→ Margem = 3550/10000 = **35,5%**.

**5. +30% (applyMarkup(30))**  
Custo = 7000, Impostos = 12,5% (taxRate = 0,125).  
Valor = 7000 / (1 − 0,30 − 0,125) = 7000 / 0,575 ≈ **12173,91**.  
Após preencher e recalcular: Margem ≈ 30% (e Lucro ≈ 0,30 × valor antes de impostos, considerando imposto sobre o valor).

**6. Verba no total do dept**  
Tabela principal: uma linha Total 1000. Verba: uma linha 200×1 = 200. Total do dept = **1200**.

---

# Ordem sugerida de implementação (com prova real a cada passo)

1. **Botão +30%** no Finance Strip + fórmula applyMarkup(30) → prova: custo 7000, imposto 12,5%, +30% → valor ≈ 12173,91 e margem ~30%.
2. **Botão SALVAR CÓPIA** no header + modal (Nome, Agência, Cliente, Duração) → prova: abrir modal, preencher, criar cópia (backend quando existir).
3. **Bloco OBSERVAÇÕES** (uma área por fase no Orçamento) → prova: 3 textareas visíveis (Pré/Prod/Pós), layout grid-column 1/-1.
4. **Revisão geral de cálculos** (linha, dept, custo, lucro, margem, moeda) → prova: tabela de fórmulas acima.
5. **Workflow Lock + Orç. Final + Fechamento** (conforme spec e docs) → prova: checklist FASE 3 e FASE 4.

Ao concluir cada item, marque ✅ na coluna Status e faça a prova real correspondente. Se algo falhar, marque 🔴 e ajuste antes de seguir.
