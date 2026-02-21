# Integração Google Drive – Plano atual

## Objetivo

Criar e atualizar automaticamente no Google Drive uma **estrutura de pastas por projeto** (pasta raiz com ID + nome + cliente; estrutura fixa de produção; pastas por membro da equipe com CONTRATO e NOTAS FISCAL).

---

## Status

- **Implementação anterior (links manuais em colaboradores):** **REVERTIDA.**
- **Implementação atual:** **OAuth** — o admin conecta sua conta Google (ex.: buzzcreativecontentstudio@gmail.com) em Configurações → Drive. Os arquivos usam a cota da conta do admin. Ver **`PASSO_A_PASSO_GOOGLE_DRIVE_OAUTH.md`**.

---

## Documentos de referência

- **`FEEDBACK_GOOGLE_DRIVE_ESTRUTURA.md`** — entendimento da sua visão e decisão de reverter.
- **`PASSO_A_PASSO_GOOGLE_DRIVE.md`** — guia completo: Parte A (configuração no Google), Parte B (estrutura de pastas), Parte C (ordem da implementação no código).

---

## Estrutura de referência

A árvore de pastas a ser criada no Drive espelha a pasta **`Arquivos/(_ID_NOME_DO_PROJETO)`** deste repositório (raiz do projeto com subpastas __BRUTAS, __EXTRAS, _COLOR, _EDIT, _MOTION, _PRODUÇÃO, _VFX; em _PRODUÇÃO\EQUIPE, uma pasta por profissional com CONTRATO e NOTAS FISCAL).
