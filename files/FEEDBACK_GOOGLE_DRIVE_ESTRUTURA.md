# Feedback: integração Google Drive conforme sua visão

## 1. Entendimento da sua solicitação

### 1.1 Quando criar

- **Sempre que um novo projeto for criado** no CineBuddy, o sistema deve criar automaticamente no **seu Google Drive** (em uma “pasta de trabalho” que você configurar) uma pasta desse projeto.

### 1.2 Nome da pasta raiz do projeto

- A pasta principal do projeto no Drive deve ser nomeada pelo sistema com:
  - **ID** (do projeto no CineBuddy)
  - **Nome do projeto**
  - **Nome do cliente**  
  Exemplo: `abc123 Nome do Projeto Cliente XYZ` (o formato exato podemos ajustar, ex.: com hífen ou parênteses).

### 1.3 Estrutura fixa (cadeia de pastas)

Dentro dessa pasta raiz, você quer a **mesma árvore** que está em `Arquivos/(_ID_NOME_DO_PROJETO)`:

- **__BRUTAS** → AUDIO, VIDEO → DIA01, etc.
- **__EXTRAS** → KVs, ORDEM DO DIA, REFs, ROTEIRO, STORYBOARD
- **_COLOR** → EXTRAS, RENDERS, STILLS, TIMELINES (e subpastas como EXTRAS\FONTS, RENDERS\_WIP, etc.)
- **_EDIT** → EXTRAS, FOOTAGE, MIX, PROJECTS, RENDERS, STILLS, TIMELINES (e todas as subpastas)
- **_MOTION** → 3D, EXTRAS, FOOTAGE, PROJECTS, RENDERS, STILLS (e subpastas)
- **_PRODUÇÃO** → EQUIPE, JURÍDICO E SEGUROS, LIBERAÇÕES
- **_VFX** → 3D, EXTRAS, FOOTAGE, PROJECTS, RENDERS, STILLS (e subpastas)

Ou seja: uma **estrutura fixa** que o sistema replica sempre (a partir da árvore de referência que você tem em `Arquivos`).

### 1.4 Pastas dinâmicas (equipe)

- Dentro de **\_PRODUÇÃO\EQUIPE** o sistema deve criar **uma pasta por membro da equipe**.
- Nome de cada pasta: **Nome do profissional + função** (ex.: `Renan (Diretor de Produção)` ou `Lincoln Barela (Diretor de Cena)`).
- Dentro da pasta de cada profissional:
  - **CONTRATO**
  - **NOTAS FISCAL**
    - E dentro de NOTAS FISCAL: subpastas por departamento (ARTE E CENOGRAFIA, EQUIPE, FIGURINO E MAQUIAGEM, FOTOGRAFIA E TÉCNICA, PRODUÇÃO), alinhadas aos departamentos da prestação de contas.

### 1.5 Atualização contínua

- Sempre que o **projeto for salvo**, o sistema deve **atualizar** essa estrutura no Drive:
  - **Novos membros** → criar novas pastas em EQUIPE (Nome + Função).
  - **Mudança de nome ou de função** → renomear a pasta do profissional.
  - (Se um membro sair do orçamento, podemos definir se a pasta é removida ou mantida; você pode decidir depois.)

---

## 2. Sobre a última implementação (links em colaboradores)

A última implementação fez o seguinte:

- Colunas no banco (Supabase): `contract_drive_url` e `invoice_drive_url` na tabela **collaborators**.
- Em **Configurações > Colaboradores**: dois campos opcionais para colar “Link contrato (Drive)” e “Link NF (Drive)”.
- Na página **Equipe**: botões ✎ (Contrato) e 📄 (Nota fiscal) **abrem** esse link quando existir.

Isso é **só “guardar e abrir link”**: não cria pasta nenhuma no Drive, não usa API do Google.

**Recomendação:** **reverter** essa implementação antes de começar a nova, por dois motivos:

1. **Evitar confusão:** na sua visão, as pastas CONTRATO e NOTAS FISCAL são **criadas pelo sistema** dentro da estrutura do projeto. O “link por colaborador” é outro fluxo (manual). Melhor ter um único conceito: “estrutura de pastas no Drive criada e atualizada pelo CineBuddy”.
2. **Banco:** as colunas `contract_drive_url` e `invoice_drive_url` foram pensadas para link manual. Na nova abordagem, o “lugar” do contrato/NF passa a ser a **pasta** que o sistema cria (e opcionalmente podemos guardar o **ID da pasta** no Drive no projeto, não em colaborador). Assim evitamos misturar os dois modelos.

**O que reverter:**

- Remover os campos de link do modal de Colaborador (ViewConfig).
- Remover o uso de `contract_drive_url` e `invoice_drive_url` nos botões da Equipe (ViewTeam) e voltar os botões para “em breve” ou para abrir a pasta do Drive quando tivermos a integração real.
- No código: tipo `Collaborator` e `CollaboratorInsert` podem voltar a não ter esses dois campos (ou deixar as colunas no banco por enquanto e só não usar no app; você decide se prefere já dropar as colunas no Supabase).

Assim começamos a nova implementação “do zero” em cima da sua visão (pasta do projeto + estrutura fixa + pastas por profissional).

---

## 3. Visão técnica da nova implementação (resumida)

- **Google Drive API** (v3): criar pastas e subpastas.
- **Autenticação:** conta de **serviço** (Service Account) no Google Cloud, com uma **pasta compartilhada** no Drive (a “pasta de trabalho”) onde o CineBuddy terá permissão de criar/editar. Não é o usuário fazendo login no navegador; é o servidor do CineBuddy agindo em nome da conta de serviço.
- **Quando criar:** ao **criar projeto** no CineBuddy (e, se quiser, ao **abrir** um projeto que ainda não tem pasta no Drive).
- **Quando atualizar:** a cada **save** do projeto (ou em um “Sincronizar com Drive” explícito), comparar a equipe atual (Orçamento Realizado / fechamento) com o que já existe no Drive e criar/renomear pastas em EQUIPE.
- **Onde rodar:** criação/atualização de pastas no **servidor** (API route no Next.js), usando variáveis de ambiente com as credenciais da conta de serviço e o ID da pasta raiz de trabalho no Drive.

A implementação pode ser guiada passo a passo (Google Cloud, Service Account, Drive API, depois código no CineBuddy e fluxo de “criar projeto” / “salvar projeto”).

---

## 4. Próximos passos sugeridos

1. **Confirmar** se esse entendimento (pastas automáticas + estrutura fixa + pastas por profissional + atualizar ao salvar) está correto e se quer mesmo **reverter** a parte de “links em colaboradores”.
2. **Definir** o formato exato do nome da pasta raiz (ex.: `{id} - {nomeProjeto} - {cliente}` ou com parênteses).
3. **Decidir** se, ao remover um profissional do orçamento, a pasta dele no Drive deve ser removida, mantida ou apenas “não atualizada”.
4. Depois disso, seguir com o **passo a passo** da implementação (configuração Google + código), em ordem clara para você acompanhar.

Quando você confirmar o entendimento e a decisão de reverter (ou não), seguimos para o plano detalhado passo a passo da implementação da estrutura no Google Drive.
