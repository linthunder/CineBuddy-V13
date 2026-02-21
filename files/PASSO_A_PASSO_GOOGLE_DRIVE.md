# Passo a passo: integração Google Drive (estrutura de pastas por projeto)

Este guia descreve **em ordem** como implementar a criação automática de pastas no Google Drive quando um projeto é criado ou salvo no CineBuddy. Siga na sequência.

---

## Etapa 1 — Reversão (concluída)

A implementação anterior (links manuais de contrato/NF em colaboradores) foi **revertida** no código:

- Removidos os campos "Link contrato (Drive)" e "Link NF (Drive)" do modal de Colaborador.
- Botões Contrato e Nota fiscal na página Equipe voltaram a exibir "em breve".
- O tipo `Collaborator` não usa mais `contract_drive_url` nem `invoice_drive_url`.

**Se você já executou o SQL** que adicionava as colunas `contract_drive_url` e `invoice_drive_url` na tabela `collaborators`, pode deixá-las no banco (o app não as usa) ou removê-las com:

```sql
ALTER TABLE collaborators DROP COLUMN IF EXISTS contract_drive_url, DROP COLUMN IF EXISTS invoice_drive_url;
```

---

## Etapa 2 — Visão geral do que vamos fazer

1. **Configuração no Google Cloud** (você faz no navegador, passo a passo).
2. **Uma pasta “de trabalho” no seu Drive** que o CineBuddy usará como raiz (você cria e compartilha).
3. **Código no CineBuddy** que, ao criar ou salvar projeto, chama a API do Google Drive e cria/atualiza a estrutura de pastas.

---

## Parte A — Configuração no Google (faça primeiro)

### A.1 — Criar projeto no Google Cloud

1. Acesse: **https://console.cloud.google.com/**
2. Faça login com a conta Google onde está (ou estará) a pasta de trabalho do Drive.
3. No topo da página, clique no **seletor de projeto** (ao lado de "Google Cloud").
4. Clique em **"Novo projeto"**.
5. Nome do projeto: por exemplo **"CineBuddy"**.
6. Clique em **"Criar"** e aguarde. Depois, selecione esse projeto no seletor.

### A.2 — Ativar a API do Google Drive

1. No menu lateral (☰), vá em **"APIs e serviços"** → **"Biblioteca"**.
2. Pesquise por **"Google Drive API"**.
3. Clique em **"Google Drive API"** e depois em **"Ativar"**.

### A.3 — Criar conta de serviço (Service Account)

1. No menu lateral: **"APIs e serviços"** → **"Credenciais"**.
2. Clique em **"+ Criar credenciais"** → **"Conta de serviço"**.
3. Nome da conta de serviço: ex. **"cinebuddy-drive"**.
4. Clique em **"Criar e continuar"**. Em "Função" você pode pular (Concluir) ou escolher "Editor" se aparecer.
5. Clique em **"Concluir"**.
6. Na lista de contas de serviço, clique na que você criou (cinebuddy-drive).
7. Aba **"Chaves"** → **"Adicionar chave"** → **"Criar nova chave"** → tipo **JSON** → **"Criar"**.  
   Um arquivo JSON será baixado. **Guarde com segurança**; não suba para o GitHub nem compartilhe.  
   Esse JSON contém o que o CineBuddy precisa para acessar o Drive em nome da conta de serviço.

### A.4 — Pasta de trabalho no Google Drive (obrigatório: Drive compartilhado)

**Importante:** Contas de serviço não têm cota de armazenamento. Você precisa usar um **Drive compartilhado** (Shared Drive), não uma pasta normal em "Meu Drive".

1. No **Google Drive** (drive.google.com), crie um **Drive compartilhado**:
   - Clique em **"Novo"** → **"Drive compartilhado"**.
   - Nome sugerido: **"CineBuddy - Projetos"**.
   - Clique em **"Criar"**.

2. Abra o JSON da conta de serviço e procure o campo **"client_email"**. Será algo como:  
   `cinebuddy-drive@seu-projeto.iam.gserviceaccount.com`

3. No Drive compartilhado criado, clique com o botão direito nele → **"Gerenciar membros"** (ou abra o drive e clique no ícone de pessoas).
4. Adicione o **e-mail da conta de serviço** (o `client_email` do JSON) como **Gerente de conteúdo** ou **Administrador**.
5. Salve. Assim o CineBuddy (usando essa conta) poderá criar pastas dentro dele.

6. Para obter o **ID do Drive compartilhado**:
   - Abra o drive compartilhado no navegador.
   - A URL será algo como: `https://drive.google.com/drive/folders/1ABC...xyz`
   - O **ID** é a parte longa entre `/folders/` e o próximo `?` ou fim. Ex.: `1ABC...xyz`.  
   **Anote esse ID**; será usado como variável de ambiente.

### A.5 — Variáveis de ambiente (credenciais)

O CineBuddy precisa de duas coisas em ambiente **seguro** (servidor), nunca no front:

1. **ID do drive compartilhado**  
   Nome sugerido: `GOOGLE_DRIVE_ROOT_FOLDER_ID`  
   Valor: o ID do drive compartilhado que você anotou (ex.: `1ABC...xyz`).

2. **Conteúdo do JSON da conta de serviço** (ou os campos principais)  
   Opção mais simples: colar o **JSON inteiro** em uma variável.  
   Nome sugerido: `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`  
   Valor: o conteúdo do arquivo JSON (uma linha só, sem quebras).

- **No seu PC (desenvolvimento):** crie ou edite o arquivo **`.env.local`** na raiz do projeto e coloque:
  ```
  GOOGLE_DRIVE_ROOT_FOLDER_ID=id_da_pasta_aqui
  GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
  ```
- **Na Vercel (produção):** em **Settings** → **Environment Variables**, adicione as mesmas duas variáveis para **Production** (e Preview se quiser).

---

## Parte B — Estrutura de pastas que o sistema vai criar

A pasta raiz de **cada projeto** no Drive terá o nome:

**`{ID} - {Nome do projeto} - {Cliente}`**  
(ex.: `a1b2c3d4 - Filme XYZ - Cliente ABC`)

Dentro dela, a árvore **fixa** (igual para todos os projetos) é a que está em `Arquivos/(_ID_NOME_DO_PROJETO)`:

- **__BRUTAS**  
  - AUDIO → DIA01  
  - VIDEO → DIA01  
- **__EXTRAS**  
  - KVs, ORDEM DO DIA, REFs, ROTEIRO, STORYBOARD  
- **_COLOR**  
  - EXTRAS (FONTS, GRAPHICS, IA, REFs), RENDERS (_WIP, COLOR_CONFORM), STILLS, TIMELINES  
- **_EDIT**  
  - EXTRAS (SUBTITLES), FOOTAGE (AUDIO, STOCK), MIX, PROJECTS (RESOLVE), RENDERS (_DELIVERY, _WIP, AUDIO_CONFORM, COLOR_CONFORM, MOTION_CONFORM, VFX_CONFORM), STILLS, TIMELINES  
- **_MOTION**  
  - 3D (ASSETS (HDRI, MESHES, TEXTURES), BLENDER), EXTRAS (FONTS, GRAPHICS, IA, REFs), FOOTAGE (AUDIO, STOCK), PROJECTS (AE), RENDERS (_DELIVERY, _WIP, AE), STILLS (CLEANPLATES)  
- **_PRODUÇÃO**  
  - **EQUIPE** ← pastas dinâmicas (uma por membro: Nome (Função), cada uma com CONTRATO e NOTA FISCAL)  
  - **PRESTAÇÃO DE CONTAS** ← pastas por departamento para notas fiscais das prestações  
    - PRODUÇÃO, ARTE E CENOGRAFIA, FIGURINO E MAQUIAGEM, FOTOGRAFIA E TÉCNICA  
  - JURÍDICO E SEGUROS  
  - LIBERAÇÕES  
- **_VFX**  
  - 3D (ASSETS, BLENDER), EXTRAS, FOOTAGE, PROJECTS (AE), RENDERS (_DELIVERY, _WIP, FUSION), STILLS (CLEANPLATES)  

**Dentro de _PRODUÇÃO\EQUIPE**, para cada membro da equipe (extraído do Orçamento Realizado / mão de obra):

- Uma pasta: **`{Nome do profissional} ({Função})`**  
  Ex.: `Renan (Diretor de Produção)`
- Dentro dela: **CONTRATO** e **NOTA FISCAL** (nota fiscal do profissional)

**Dentro de _PRODUÇÃO\PRESTAÇÃO DE CONTAS** (notas fiscais das prestações por departamento):

- **PRODUÇÃO**, **ARTE E CENOGRAFIA**, **FIGURINO E MAQUIAGEM**, **FOTOGRAFIA E TÉCNICA**

**Quando atualizar (a cada save do projeto):**

- Novos membros → criar nova pasta em EQUIPE.
- Nome ou função alterados → renomear a pasta existente (se o sistema tiver guardado o ID da pasta do profissional no projeto).
- (Remoção de membro: podemos definir depois se a pasta no Drive é removida ou mantida.)

---

## Parte C — Ordem da implementação no código

1. **Definir a árvore fixa**  
   Um arquivo (ex.: `lib/drive-folder-structure.ts`) com a lista de caminhos de pastas a criar (a partir da raiz do projeto), espelhando `Arquivos/(_ID_NOME_DO_PROJETO)`.

2. **Cliente da API do Drive**  
   Um módulo (ex.: `lib/google-drive.ts`) que:
   - Lê `GOOGLE_DRIVE_ROOT_FOLDER_ID` e `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`.
   - Usa a conta de serviço para obter um token e chamar a **Google Drive API v3** (criar pasta, listar filhos, renomear).
   - Funções: `createFolder(parentId, name)`, `ensureFolderPath(parentId, path)`, `createProjectStructure(rootFolderId, teamMembers)`.

3. **API route no Next.js**  
   Ex.: `POST /api/drive/sync-project`  
   Recebe: `projectId`, `projectName`, `clientName`, lista de membros `{ name, role }`.  
   - Se o projeto ainda não tem `drive_root_folder_id` no banco, cria a pasta raiz, cria toda a estrutura fixa e as pastas da equipe; grava o `drive_root_folder_id` no projeto.
   - Se já tem, compara a equipe atual com a que está no Drive e cria/renomeia pastas em EQUIPE.

4. **Banco (Supabase)**  
   Na tabela `projects`, adicionar coluna opcional: `drive_root_folder_id` (text). Assim sabemos se a pasta do projeto já foi criada e qual é o ID.

5. **Chamadas no CineBuddy**  
   - **Ao criar projeto:** depois de `createProject`, chamar a API de sync (ou a função que cria a estrutura) com os dados do novo projeto; equipe pode estar vazia no início.
   - **Ao salvar projeto:** chamar a API de sync com os dados atuais (nome, cliente, equipe extraída do Orçamento Realizado). A API cria o que faltar e atualiza pastas de membros.

6. **Tratamento de erros**  
   Se o Drive estiver indisponível ou as credenciais inválidas, o projeto ainda deve ser criado/salvo no CineBuddy; o sync do Drive pode ser tentado de novo depois (ex.: botão "Sincronizar com Drive" ou novo save).

---

## Resumo do que você precisa ter em mãos

- [ ] Projeto criado no Google Cloud  
- [ ] Google Drive API ativada  
- [ ] Conta de serviço criada e JSON da chave baixado  
- [ ] **Drive compartilhado** criado e conta de serviço adicionada como membro (Gerente de conteúdo)  
- [ ] ID do drive compartilhado anotado  
- [ ] Variáveis `GOOGLE_DRIVE_ROOT_FOLDER_ID` e `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` configuradas no `.env.local` e na Vercel  

Quando a **Parte A** estiver concluída, podemos implementar a **Parte C** no código (árvore fixa, cliente Drive, API route, coluna no projeto e chamadas em criar/salvar projeto). Se quiser, na próxima mensagem diga em que passo da Parte A você está e seguimos a partir daí.
