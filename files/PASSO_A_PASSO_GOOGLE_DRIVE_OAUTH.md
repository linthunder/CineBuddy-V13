# Passo a passo: Google Drive com OAuth (conta pessoal)

Este guia descreve como configurar o Google Drive no CineBuddy usando **OAuth** com sua conta pessoal (ex.: buzzcreativecontentstudio@gmail.com). Os arquivos ficarão no seu Drive, usando sua cota de armazenamento (Drive Pro, etc.).

---

## Pré-requisitos

- Conta Google com Drive (pessoal ou Workspace)
- Acesso de administrador ao CineBuddy

---

## Etapa 1 — Google Cloud Console

### 1.1 Criar/abrir projeto

1. Acesse **https://console.cloud.google.com/**
2. Faça login com a conta Google que usará o Drive (ex.: buzzcreativecontentstudio@gmail.com)
3. Selecione ou crie um projeto (ex.: "CineBuddy")

### 1.2 Ativar a API do Google Drive

1. Menu lateral → **APIs e serviços** → **Biblioteca**
2. Pesquise **"Google Drive API"**
3. Clique em **"Ativar"**

### 1.3 Criar credenciais OAuth 2.0

1. Menu lateral → **APIs e serviços** → **Credenciais**
2. Clique em **"+ Criar credenciais"** → **"ID do cliente OAuth"**
3. Se aparecer "Configurar tela de consentimento":
   - Tipo de usuário: **Externo** (para conta pessoal)
   - Nome do app: **CineBuddy**
   - E-mail de suporte: seu e-mail
   - Domínios autorizados: deixe em branco (localhost)
   - Informações do desenvolvedor: seu e-mail
   - Salve e continue
4. Tipo de aplicativo: **Aplicativo da Web**
5. Nome: **CineBuddy Drive**
6. Em **URIs de redirecionamento autorizados**, adicione:
   - Desenvolvimento: `http://localhost:3000/api/auth/google-drive/callback`
   - Produção: `https://SEU-DOMINIO.vercel.app/api/auth/google-drive/callback`
7. Clique em **Criar**
8. Anote o **ID do cliente** e o **Segredo do cliente**

---

## Etapa 2 — Variáveis de ambiente

No `.env.local` (e na Vercel para produção):

```
GOOGLE_OAUTH_CLIENT_ID=seu_client_id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=seu_client_secret
```

Opcional (se a URL base for diferente):
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Etapa 3 — Banco de dados (Supabase)

Execute o SQL em `files/supabase_drive_oauth.sql` no Supabase (SQL Editor):

```sql
CREATE TABLE IF NOT EXISTS drive_connection (
  id text PRIMARY KEY DEFAULT 'default',
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  email text,
  root_folder_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

---

## Migrando de Service Account para OAuth

Se você usava conta de serviço antes, limpe os IDs antigos para que as pastas sejam recriadas no seu Drive:

```sql
UPDATE projects SET drive_root_folder_id = NULL;
```

---

## Etapa 4 — Conectar no CineBuddy

1. Inicie o app e faça login como **admin**
2. Vá em **Configurações** (ícone de engrenagem)
3. Aba **DRIVE**
4. Clique em **"Conectar Google Drive"**
5. Faça login na conta Google desejada
6. Autorize o acesso ao Drive
7. Você será redirecionado de volta ao CineBuddy

---

## Etapa 5 — Definir a pasta dos projetos

1. Em Configurações → Drive, após conectar, cole o **ID da pasta** onde os projetos serão salvos
2. Para obter o ID: crie uma pasta no Drive (ou use uma existente), abra-a, e copie o trecho da URL após `/folders/`  
   Ex.: `https://drive.google.com/drive/folders/1ABC123xyz` → o ID é `1ABC123xyz`
3. Clique em **Salvar pasta**

---

## Etapa 6 — Usar

- Ao **salvar** um projeto, a estrutura de pastas será criada em `CineBuddy - Projetos`
- Os botões de upload (notas fiscais, contratos) enviarão arquivos para o Drive
- Os arquivos usam a cota da sua conta Google e ficam na pasta que você definiu

---

## Desconectar

Em Configurações → Drive → **Desconectar**. Os projetos e pastas já criados permanecem no Drive; apenas novas operações pararão de funcionar até reconectar.
