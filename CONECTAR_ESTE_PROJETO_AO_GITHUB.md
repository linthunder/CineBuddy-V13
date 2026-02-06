# Conectar este projeto (Cursor) ao repositório GitHub

**Pasta do projeto CineBuddy:**  
`E:\_Projetos\Cinebuddy\CineBuddy-V13`

Sempre abra **esta pasta** no Cursor (File → Open Folder → escolha essa pasta). O conteúdo (files, Arquivos, documentação, .cursor) já está aqui; o Git pode já estar inicializado (existe `.git`). O objetivo é garantir que esta pasta esteja ligada ao repositório no GitHub e que você envie o código com `git add` / `git commit` / `git push`.

---

## O que você precisa ter em mãos

1. **URL do repositório no GitHub**  
   Exemplo: `https://github.com/SEU_USUARIO/CineBuddy-V13` (ou o nome que você deu ao repo).  
   Para achar: abra o repositório no GitHub e clique em **Code** → copie a URL **HTTPS**.

2. **Git instalado**  
   No terminal do Cursor: `git --version`. Se não estiver instalado: https://git-scm.com/download/win

3. **Autenticação no GitHub**  
   GitHub Desktop instalado e logado **ou** um Personal Access Token (token clássico com permissão `repo`).  
   Ver guia: `GUIA_CONFIGURACAO_CURSOR_GITHUB.md` — Parte 4.3.

---

## Passos (execute no Cursor, com a pasta do projeto aberta)

**Importante:** No Cursor, abra a pasta `E:\_Projetos\Cinebuddy\CineBuddy-V13` (File → Open Folder). O terminal deve estar dentro dessa pasta.

### 1. Ver se o Git já está conectado ao GitHub

No terminal:

```powershell
git remote -v
```

- Se aparecer algo como `origin  https://github.com/...` → o remote já está configurado. Pule para **Passo 5** (add/commit) e depois **Passo 7** (push), se ainda não tiver enviado o código.
- Se não aparecer nada ou der erro → siga os passos abaixo.

### 2. Inicializar o Git nesta pasta (só se ainda não existir .git)

```powershell
git init
```

**Como saber que deu certo:** Aparece algo como “Initialized empty Git repository…” ou “Reinitialized…”. Se aparecer “already exists”, tudo bem, o Git já está aí.

### 3. Garantir a branch principal como `main`

```powershell
git branch -M main
```

### 4. Conectar ao repositório do GitHub (só se ainda não tiver remote)

Substitua `URL_DO_SEU_REPOSITORIO` pela URL que você copiou do GitHub (ex.: `https://github.com/linthunder/CineBuddy-V13.git`):

```powershell
git remote add origin URL_DO_SEU_REPOSITORIO
```

Exemplo real:

```powershell
git remote add origin https://github.com/linthunder/CineBuddy-V13.git
```

**Se aparecer “remote origin already exists”:**  
Remova e adicione de novo:

```powershell
git remote remove origin
git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPO.git
```

### 5. Ver o que será enviado

```powershell
git add .
git status
```

Revise a lista. Não devem aparecer `node_modules`, `.env` ou pastas pesadas (o `.gitignore` já evita isso).

### 6. Primeiro commit (registro local)

```powershell
git commit -m "CineBuddy: estrutura inicial HTML/PHP antes da migração Next.js"
```

(Se já tiver commits antes, use uma mensagem que descreva o que você mudou.)

### 7. Enviar para o GitHub (push)

Se o repositório no GitHub **já tem commits** (por exemplo, README criado na interface):

```powershell
git pull origin main --allow-unrelated-histories
git push -u origin main
```

Se o repositório no GitHub está **totalmente vazio** (sem README, sem primeiro commit):

```powershell
git push -u origin main
```

- Se pedir **usuário e senha:** use seu usuário do GitHub e, como senha, o **Personal Access Token** (não a senha da conta).
- Se usar **GitHub Desktop:** pode ser necessário abrir este repositório no Desktop e fazer o primeiro push por lá; depois o Cursor consegue fazer push normalmente.

**Como saber que deu certo:** No site do GitHub, no seu repositório, você vê as pastas `files`, `Arquivos`, `.cursor`, etc.

---

## Pasta antiga no OneDrive

Se você ainda tem a pasta `c:\Users\Buzz Color\OneDrive\Documentos\Cinebuddy`, pode ignorá-la ou apagá-la. O projeto oficial agora é **só** `E:\_Projetos\Cinebuddy\CineBuddy-V13`. Abra sempre esta pasta no Cursor.

---

## Resumo do fluxo no dia a dia

| O que fazer | Onde / Como |
|-------------|-------------|
| Editar código | Abrir no Cursor a pasta `E:\_Projetos\Cinebuddy\CineBuddy-V13`. |
| Salvar versão local | No terminal: `git add .` e `git commit -m "Descrição do que mudou"`. |
| Enviar para o GitHub | No terminal: `git push`. |

---

## Checklist

- [ ] No Cursor: File → Open Folder → `E:\_Projetos\Cinebuddy\CineBuddy-V13`.
- [ ] Tenho a URL do repositório GitHub (ex.: https://github.com/…/…).
- [ ] Git instalado (`git --version` funciona).
- [ ] Autenticação configurada (GitHub Desktop ou token).
- [ ] Terminal aberto na pasta do projeto (caminho deve mostrar CineBuddy-V13).
- [ ] `git remote -v` mostra origin (ou foi feito `git init` + `git remote add origin URL`).
- [ ] `git add .`, `git commit -m "..."`, `git push -u origin main` (se ainda não enviou).
- [ ] Código visível no repositório no GitHub.

Quando todos estiverem marcados, **este projeto está conectado ao GitHub**. Próximo passo pode ser configurar a Vercel e, depois, criar o app Next.js e o Supabase.
