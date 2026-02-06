# Guia: Configurar Cursor + GitHub + sua máquina para o CineBuddy

Este guia é para você, que é leigo em programação. Siga na ordem. Cada seção termina com um "Como saber que deu certo".

---

## O que você vai conseguir no final

- **Cursor** abrindo sempre a pasta certa do projeto e “sabendo” do que se trata.
- **Git** versionando seu código na sua máquina.
- **GitHub** guardando uma cópia na nuvem e permitindo deploy na Vercel.
- **Máxima automação**: um único lugar para editar (Cursor), um comando para enviar ao GitHub e deploy automático na Vercel (quando chegarmos nessa etapa).

---

## Parte 1 — Onde fica o projeto na sua máquina

Seu projeto CineBuddy hoje está em:

```
C:\Users\Buzz Color\OneDrive\Documentos\Cinebuddy
```

**Se você já criou um repositório no GitHub e tem outra pasta (ex.: `E:\_Projetos\Cinebuddy\CineBuddy-V13`):**  
Use o arquivo **`CONECTAR_ESTE_PROJETO_AO_GITHUB.md`** na raiz do projeto. Ele explica como conectar **esta pasta** (a que você abre no Cursor) ao mesmo repositório do GitHub, sem precisar mudar de pasta.

- **Recomendação (opcional):** criar uma pasta só para projetos de código, por exemplo:
  - `C:\Users\Buzz Color\Projetos\CineBuddy`
- Assim você separa “documentos do CineBuddy” (OneDrive) do “código do app” (Projetos).

**O que fazer agora (opcional mas recomendado):**

1. Crie a pasta: `C:\Users\Buzz Color\Projetos`
2. Dentro dela, crie: `CineBuddy`
3. Copie para `C:\Users\Buzz Color\Projetos\CineBuddy` tudo que está em `OneDrive\Documentos\Cinebuddy` (as pastas `files`, `Arquivos`, etc.).
4. Daqui em diante, **sempre abra no Cursor a pasta** `C:\Users\Buzz Color\Projetos\CineBuddy` (e não a pasta dentro de Documentos).

Se preferir continuar usando a pasta do OneDrive, tudo bem: use sempre **essa** pasta ao abrir o Cursor.

**Como saber que deu certo:** Você sabe qual pasta é “a do projeto” e vai sempre abrir essa pasta no Cursor.

---

## Parte 2 — Configurar o Cursor para o projeto

### 2.1 Abrir a pasta certa no Cursor

1. Abra o **Cursor**.
2. Menu **File** → **Open Folder** (ou **Ctrl+K Ctrl+O**).
3. Navegue até:
   - `C:\Users\Buzz Color\Projetos\CineBuddy`  
   **ou**
   - `C:\Users\Buzz Color\OneDrive\Documentos\Cinebuddy`
4. Clique em **Selecionar Pasta**.

**Como saber que deu certo:** Na barra lateral esquerda do Cursor você vê as pastas `files`, `Arquivos`, etc., e na parte superior o nome da pasta (CineBuddy).

### 2.2 Regras do projeto (já criadas para você)

Foi criada uma pasta `.cursor` dentro do seu projeto com **regras** que explicam para a IA:

- O que é o CineBuddy (orçamento, gestão financeira, projetos audiovisuais).
- Que a migração será para Next.js + React, Vercel e Supabase.
- Que você é iniciante e precisa de explicações passo a passo.

Assim, sempre que você abrir **esta pasta** no Cursor, a IA terá esse contexto. Você não precisa fazer nada além de abrir a pasta certa.

**Como saber que deu certo:** A pasta `.cursor` existe dentro da pasta do projeto (pode estar “escondida”; no Cursor ela aparece na árvore de arquivos).

---

## Parte 3 — Git na sua máquina

O **Git** é o programa que guarda o histórico do seu código (versões, alterações). O Cursor e a Vercel usam o Git.

### 3.1 Ver se o Git está instalado

1. No Cursor, abra o **terminal integrado**: **Terminal** → **New Terminal** (ou **Ctrl+`**).
2. Digite e pressione Enter:

   ```bash
   git --version
   ```

3. Se aparecer algo como `git version 2.xx.x`, o Git já está instalado.

**Se não estiver instalado:**

- Baixe em: https://git-scm.com/download/win  
- Instale com as opções padrão (Next, Next).
- Feche e abra o Cursor de novo e teste de novo o comando `git --version`.

**Como saber que deu certo:** O comando `git --version` mostra a versão do Git.

### 3.2 Sua identidade no Git (já configurada)

No seu `.gitconfig` já consta:

- Nome: **linthunder**
- Email: **lincoln.barela@gmail.com**

Se quiser usar outro email (por exemplo o do GitHub), no terminal:

```bash
git config --global user.email "seu-email@exemplo.com"
git config --global user.name "Seu Nome"
```

**Como saber que deu certo:** Os comandos não dão erro e, ao rodar `git config --global user.email`, aparece o email que você definiu.

---

## Parte 4 — GitHub: conta e repositório

O **GitHub** guarda uma cópia do seu código na nuvem e é o que a Vercel usa para fazer o deploy.

### 4.1 Conta no GitHub

1. Acesse https://github.com e faça login (ou crie uma conta).
2. Anote seu **nome de usuário** (ex.: `linthunder`).

### 4.2 Criar um repositório para o CineBuddy

1. No GitHub, clique no **+** no canto superior direito → **New repository**.
2. Preencha:
   - **Repository name:** `CineBuddy` (ou `cinebuddy-app`, se preferir).
   - **Description (opcional):** “Sistema de orçamento e gestão de projetos audiovisuais”.
   - Deixe **Public**.
   - **Não** marque “Add a README file” (você já tem arquivos na pasta).
3. Clique em **Create repository**.

**Como saber que deu certo:** Você vê uma página do repositório vazio com um endereço tipo:  
`https://github.com/linthunder/CineBuddy`

### 4.3 Ligar o GitHub ao Git na sua máquina (autenticação)

O Git na sua máquina precisa de permissão para enviar e puxar código do GitHub. A forma mais simples no Windows é **GitHub Desktop** ou **credenciais HTTPS**.

**Opção A — Usar GitHub Desktop (recomendado para leigos)**

1. Instale: https://desktop.github.com/
2. Abra o GitHub Desktop e faça login na sua conta GitHub.
3. O GitHub Desktop usa sua conta para autenticar; quando você fizer “Push” pelo Cursor ou pelo próprio Desktop, não precisará digitar senha toda vez.

**Opção B — Token de acesso pessoal (PAT)**

1. No GitHub: **Settings** (da sua conta) → **Developer settings** → **Personal access tokens** → **Tokens (classic)**.
2. **Generate new token (classic)**. Dê um nome (ex.: “Cursor CineBuddy”) e marque pelo menos **repo**.
3. Gere e **copie o token** (ele não aparece de novo).
4. Quando o Git pedir senha ao fazer push, use **o token** no lugar da senha.

**Como saber que deu certo:** Depois de configurar, ao fazer o primeiro `git push` (mais abaixo), não aparecer erro de “authentication failed” ou “permission denied”.

---

## Parte 5 — Inicializar o Git na pasta do projeto e ligar ao GitHub

Faça isso **uma vez** na pasta do CineBuddy que você abre no Cursor.

### 5.1 Abrir o terminal na pasta do projeto

1. No Cursor, abra a pasta do projeto (como na Parte 2).
2. Abra o terminal: **Terminal** → **New Terminal** (ou **Ctrl+`**).  
   O terminal deve estar “dentro” da pasta do projeto (no PowerShell você pode ver algo como `...\CineBuddy>`).

### 5.2 Inicializar o repositório Git

No terminal, rode um comando por vez:

```powershell
git init
```

Isso cria o repositório Git dentro da pasta do projeto.

### 5.3 Arquivo .gitignore (evitar subir o que não deve)

Antes de fazer o primeiro commit, é importante ter um `.gitignore` para não enviar ao GitHub pastas como `node_modules` (quando existir) ou arquivos sensíveis.  
Foi criado um arquivo `.gitignore` na raiz do projeto para você. Se não existir, crie um arquivo chamado `.gitignore` na pasta raiz do CineBuddy com pelo menos:

```gitignore
node_modules/
.env
.env.local
.next/
```

### 5.4 Primeiro commit

```powershell
git add .
git status
```

`git status` mostra os arquivos que serão commitados. Revise rapidamente. Depois:

```powershell
git commit -m "CineBuddy: estrutura inicial HTML/PHP antes da migração Next.js"
```

### 5.5 Ligar à branch principal e ao GitHub

O GitHub hoje usa a branch `main` por padrão. Configure e ligue o repositório remoto (troque `linthunder` pelo seu usuário do GitHub e `CineBuddy` pelo nome exato do repositório, se for diferente):

```powershell
git branch -M main
git remote add origin https://github.com/linthunder/CineBuddy.git
```

### 5.6 Enviar o código para o GitHub (push)

```powershell
git push -u origin main
```

- Se pedir usuário/senha: use seu **usuário do GitHub** e, se tiver configurado, o **token** no lugar da senha.
- Se você usa GitHub Desktop e der erro, abra o repositório no GitHub Desktop e faça o push por lá uma vez; depois o Cursor pode usar o mesmo repositório.

**Como saber que deu certo:** No site do GitHub, no repositório `CineBuddy`, você vê os arquivos e pastas do projeto.

---

## Parte 6 — Resumo do fluxo no dia a dia

Depois de tudo configurado:

| O que você quer fazer | Onde / Como |
|------------------------|-------------|
| Editar o código        | Abrir no Cursor a pasta **CineBuddy** (Projetos ou Documentos). |
| Salvar versão local    | No terminal: `git add .` e `git commit -m "Breve descrição do que mudou"`. |
| Enviar para o GitHub   | No terminal: `git push`. |
| Deploy (mais tarde)    | Conectar o repositório na Vercel; cada `git push` na `main` pode gerar deploy automático. |

---

## Parte 7 — Checklist final

Marque conforme for fazendo:

- [ ] Pasta do projeto definida e sempre aberta no Cursor (Projetos ou Documentos).
- [ ] Cursor abre essa pasta e mostra `files`, `Arquivos`, `.cursor`, etc.
- [ ] `git --version` funciona no terminal.
- [ ] Conta no GitHub criada e repositório `CineBuddy` criado.
- [ ] Autenticação configurada (GitHub Desktop ou token).
- [ ] `git init`, `git add .`, `git commit` e `git remote` e `git push` feitos com sucesso.
- [ ] Código visível no GitHub no repositório `CineBuddy`.

Quando todos os itens estiverem marcados, você está com **Cursor + Git + GitHub** configurados e com máxima automação para o próximo passo: criar o projeto Next.js e, depois, conectar Vercel e Supabase.

---

## Próximo passo (depois deste guia)

Quando você terminar este guia e quiser seguir para a migração, diga no chat:

- “Configurei tudo. Quero criar o projeto Next.js do CineBuddy na pasta do projeto (ou em uma subpasta).”

A partir daí podemos:

1. Criar o app Next.js (React) na pasta certa.
2. Configurar Supabase (banco e auth).
3. Conectar o repositório à Vercel para deploy automático.

Se em qualquer passo der erro, copie a mensagem de erro e a etapa em que parou e envie no chat para ajustarmos.
