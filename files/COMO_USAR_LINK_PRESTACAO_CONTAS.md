# Como usar o link de prestação de contas

**Você não precisa incluir nenhum token manualmente.** O token é gerado automaticamente quando você clica em "Gerar link". Nada precisa ser configurado no Supabase para isso.

---

## Quem faz o quê

| Quem | Onde | Ação |
|------|------|------|
| **Você (no sistema)** | App em http://localhost:3000, **logado** | Abre um projeto → aba **FECHAMENTO** → clica em **"Gerar link"** no departamento → **copia a URL** que aparece no modal. |
| **Colaborador (sem login)** | Abre a **URL que você enviou** no navegador | Vê só o departamento dele, preenche despesas e clica em **Salvar**. Os dados vão para o mesmo projeto no sistema. |

O **token** fica **dentro da própria URL** que o sistema gera (algo como `?token=eyJ...`). Quem recebe o link já está “autorizado” a salvar aquele departamento; não precisa fazer login nem configurar nada no Supabase.

---

## Passo a passo (no seu computador)

### 1. Servidor rodando na porta certa

- O app deve estar rodando em **http://localhost:3000** (ou na URL que você usa). O link gerado usa automaticamente a mesma porta em que você está.
- No `.env.local` use `NEXT_PUBLIC_APP_URL=http://localhost:3000` como fallback (em produção use a URL do seu site).
- Reinicie o servidor (`npm run dev`) depois de alterar o `.env.local`, se ainda não tiver reiniciado.

### 2. Entrar no sistema

- Abra **http://localhost:3000** no navegador.
- Faça **login** (e-mail e senha do CineBuddy).

### 3. Ter um projeto “salvo”

- O botão **"Gerar link"** só aparece para projetos que **já estão salvos** no Supabase (projeto aberto pela lista “Abrir” ou projeto novo já salvo).
- Se você criou um projeto novo e nunca salvou, **salve o projeto** (por exemplo indo em outra aba e voltando, ou salvando ao editar) e depois abra de novo pela lista **Abrir**.
- Abra o projeto (lista **Abrir** → escolher o projeto).

### 4. Ir na aba FECHAMENTO

- No menu inferior, clique em **FECHAMENTO**.
- Só é possível acessar o Fechamento depois de **finalizar o Orçamento Final** (travar o orçamento final). Se a aba estiver desabilitada, finalize o orçamento final antes.

### 5. Gerar o link

- Na seção **Prestação de contas**, você verá os 4 departamentos (PRODUÇÃO, ARTE E CENOGRAFIA, etc.).
- Em cada bloco de departamento há o botão **"Gerar link"** (ao lado de **"Selecionar"**).
- Clique em **"Gerar link"** no departamento desejado.
- Abre um **modal** com uma URL longa (ex.: `http://localhost:3001/prestacao-contas/abc-123-uuid/producao?token=...`).
- Clique em **"Copiar"** e feche o modal.

### 6. Enviar o link ao colaborador

- Envie essa URL por e-mail, WhatsApp, etc.
- O colaborador **não precisa** fazer login. Ele abre o link no celular ou no computador, preenche as despesas e clica em **Salvar**.

### 7. Ver os dados de volta no sistema

- No app, na aba **FECHAMENTO** do **mesmo projeto**, as despesas que o colaborador salvou aparecem na tabela daquele departamento.

---

## O que NÃO é necessário

- **Não** é preciso configurar nada no Supabase para o token (ele é gerado e validado pelo seu app com a variável `PRESTACAO_CONTAS_JWT_SECRET`).
- **Não** é preciso o colaborador ter conta ou fazer login.
- **Não** é preciso colocar nenhum token manualmente na URL; o sistema já gera a URL com o token.

---

## Se algo não funcionar

1. **Não aparece o botão "Gerar link"**  
   - Você está na aba **FECHAMENTO**?  
   - O projeto foi **aberto pela lista Abrir** (está salvo no Supabase)?  
   - O **Orçamento Final** já foi finalizado (travar) para liberar o Fechamento?

2. **Ao clicar em "Gerar link" dá erro**  
   - Você está **logado**?  
   - O servidor foi **reiniciado** depois de adicionar `PRESTACAO_CONTAS_JWT_SECRET` no `.env.local`?  
   - No terminal do `npm run dev`, aparece algum erro ao clicar em "Gerar link"?

3. **Colaborador abre o link mas não consegue salvar**  
   - A URL que ele abriu tem **?token=...** no final? Se alguém apagou essa parte, não vai salvar.  
   - O app está rodando em **http://localhost:3001** (ou na mesma URL que está no link)? Se o link for de outro computador, o colaborador precisa acessar pelo IP/domínio desse computador (ex.: no mesmo Wi‑Fi: `http://192.168.x.x:3001/...`).

4. **Servidor na porta 3001**  
   - Se você iniciou com `npm run dev` e ele abriu na 3000, pode parar (Ctrl+C) e rodar:  
     `npm run dev -- -p 3001`  
   - Assim o link gerado (com `NEXT_PUBLIC_APP_URL=http://localhost:3001`) vai bater com o que está no navegador.
