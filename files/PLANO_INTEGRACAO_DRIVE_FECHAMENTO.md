# Plano de implementação — Integração Drive + Fechamento

## Resumo das solicitações

1. Substituir todos os campos de input "NF" por **botão de Upload** (ícone Lucide) + fluxo de envio.
2. **Profissionais (labor)**: botão NF → pasta `_PRODUÇÃO/EQUIPE/(Nome (Função))/NOTA FISCAL`.
3. **Prestação de contas (4 departamentos)**: botão NF → pasta `_PRODUÇÃO/PRESTAÇÃO DE CONTAS/{PRODUÇÃO|ARTE E CENOGRAFIA|FIGURINO E MAQUIAGEM|FOTOGRAFIA E TÉCNICA}`.
4. **Outras tabelas** (EQUIPAMENTOS, LOCAÇÕES, etc.): botão NF → `_PRODUÇÃO/PRESTAÇÃO DE CONTAS/PRODUÇÃO/{Nome da tabela}/{Nome do fornecedor}` (ex.: EQUIPAMENTOS/Link Remoto).
5. **Remover** as tabelas de verbas (Verba de Produção, Verba de Arte, Verba de Figurino) — já cobertas pelas tabelas de prestação de contas.
6. Renomear labels **"NF"** para **"NOTA FISCAL"**.
7. **Botão Upload**: usuário seleciona arquivo, clica "ENVIAR" → sistema cria pasta (se não existir) e faz upload.
8. **Padronizar** os botões de informação da página FECHAMENTO com os da página EQUIPE (visual e função).
9. **Botão Contrato (✎)**: abre PDF do contrato em `_PRODUÇÃO/EQUIPE/(Nome (Função))/CONTRATO`; se não houver PDF, abre link da pasta.
10. **Botão Nota fiscal (📄)**: abre PDF da nota fiscal em `_PRODUÇÃO/EQUIPE/(Nome (Função))/NOTA FISCAL`.

---

## Arquitetura técnica

### Dependências

- **Projeto**: já possui `drive_root_folder_id` por projeto e lib `google-drive.ts`.
- **APIs necessárias**:
  - `GET /api/drive/folder-url` — retorna URL do Drive para uma pasta (por path relativo ou por ID).
  - `POST /api/drive/upload` — recebe arquivo + path; cria pasta se necessário; faz upload; retorna URL do arquivo.
  - `GET /api/drive/folder-contents` — lista arquivos de uma pasta (para encontrar PDF de contrato/NF).

### Mapeamento de paths no Drive

| Contexto | Path relativo à raiz do projeto |
|----------|----------------------------------|
| Profissional (contrato) | `_PRODUÇÃO/EQUIPE/{Nome (Função)}/CONTRATO` |
| Profissional (nota fiscal) | `_PRODUÇÃO/EQUIPE/{Nome (Função)}/NOTA FISCAL` |
| Prestação PRODUÇÃO | `_PRODUÇÃO/PRESTAÇÃO DE CONTAS/PRODUÇÃO` |
| Prestação ARTE E CENOGRAFIA | `_PRODUÇÃO/PRESTAÇÃO DE CONTAS/ARTE E CENOGRAFIA` |
| Prestação FIGURINO E MAQUIAGEM | `_PRODUÇÃO/PRESTAÇÃO DE CONTAS/FIGURINO E MAQUIAGEM` |
| Prestação FOTOGRAFIA E TÉCNICA | `_PRODUÇÃO/PRESTAÇÃO DE CONTAS/FOTOGRAFIA E TÉCNICA` |
| Outras tabelas (custo) | `_PRODUÇÃO/PRESTAÇÃO DE CONTAS/PRODUÇÃO/{ Departamento }/{ Fornecedor ou Item }` |

---

## Etapas de implementação

### Fase 1 — APIs do Drive (backend)

#### 1.1 API `GET /api/drive/folder-url`
- **Entrada**: `projectId`, `path` (ex.: `_PRODUÇÃO/EQUIPE/Maria (Produtora)/NOTA FISCAL`).
- **Lógica**: buscar `drive_root_folder_id` do projeto; usar `getOrCreatePath` para obter ID da pasta; retornar `https://drive.google.com/drive/folders/{id}`.
- **Saída**: `{ url: string }` ou `{ error: string }`.

#### 1.2 API `POST /api/drive/upload`
- **Entrada**: `projectId`, `path`, `file` (multipart/form-data).
- **Lógica**: obter ou criar pasta pelo path; fazer upload do arquivo na pasta via Drive API; retornar URL de visualização do arquivo.
- **Saída**: `{ fileUrl: string, fileId: string }` ou `{ error: string }`.

#### 1.3 API `GET /api/drive/folder-contents`
- **Entrada**: `projectId`, `path`.
- **Lógica**: obter ID da pasta; listar arquivos (priorizar PDF); retornar lista com `id`, `name`, `webViewLink`.
- **Saída**: `{ files: { id, name, webViewLink }[] }` ou `{ error: string }`.

#### 1.4 Funções em `lib/google-drive.ts`
- `getFolderIdByPath(projectRootId: string, relativePath: string): Promise<string>` — já existe via `getOrCreatePath`.
- `uploadFileToFolder(folderId: string, file: Buffer, mimeType: string, fileName: string): Promise<{ id: string; webViewLink: string }>` — nova.
- `listFilesInFolder(folderId: string): Promise<{ id: string; name: string; webViewLink: string }[]>` — nova.

---

### Fase 2 — Componentes e hooks (frontend)

#### 2.1 Componente `DriveUploadButton`
- **Props**: `projectId`, `drivePath`, `onUploadComplete?: (fileUrl: string) => void`, `disabled?`.
- **UI**: input file oculto + botão com ícone `Upload` (Lucide) + label "ENVIAR" opcional.
- **Fluxo**: usuário seleciona arquivo → clica "ENVIAR" (ou o próprio botão dispara) → `POST /api/drive/upload` → callback com URL.
- **Estados**: idle, uploading, success, error.

#### 2.2 Componente `DriveLinkButton`
- **Props**: `projectId`, `drivePath`, `variant: 'folder' | 'contract' | 'invoice'`.
- **Comportamento**:
  - `folder`: abre URL da pasta (sempre).
  - `contract`: chama `folder-contents`; se houver PDF, abre o primeiro; senão, abre a pasta.
  - `invoice`: idem `contract`.
- **UI**: ícone (✎ para contrato, 📄 para NF) + tooltip.

#### 2.3 Hook `useDrivePath(projectId, path)`
- Retorna `{ url, loading, error, openFolder, openFirstPdf }`.
- Encapsula chamadas às APIs.

---

### Fase 3 — Alterações no ViewFechamento

#### 3.1 Remover tabelas de verbas
- Em `buildClosingLinesFromSnapshot`, **não** incluir linhas com `isVerba: true` nas `closingLines`.
- Ou: filtrar `closingLines` na renderização para não exibir blocos cujo único conteúdo seja verbas.
- **Resultado**: blocos "Verba de Produção", "Verba de Arte", "Verba de Figurino" deixam de aparecer.

#### 3.2 Substituir input NF por botão de Upload (labor)
- Em cada linha de profissional (labor), trocar:
  ```jsx
  <input ... placeholder="NF" value={line.invoiceNumber} />
  ```
  por:
  ```jsx
  <DriveUploadButton projectId={projectDbId} drivePath={memberPath} onUploadComplete={(url) => updateLine(line.id, { invoiceUrl: url })} />
  ```
- `memberPath` = `_PRODUÇÃO/EQUIPE/${memberFolderName(line)}/NOTA FISCAL`.

#### 3.3 Substituir input NF por botão de Upload (prestação de contas)
- Em cada linha de despesa (`ExpenseLine`), trocar o input NF por:
  ```jsx
  <DriveUploadButton projectId={projectDbId} drivePath={prestacaoPath} ... />
  ```
- `prestacaoPath` = `_PRODUÇÃO/PRESTAÇÃO DE CONTAS/${exp.department}`.

#### 3.4 Substituir input NF (outras tabelas — custo)
- Para linhas com `isLabor: false` e `isVerba: false` (custos: EQUIPAMENTOS, LOCAÇÕES, etc.):
- Path = `_PRODUÇÃO/PRESTAÇÃO DE CONTAS/PRODUÇÃO/${line.department}/${line.name || line.role || 'Sem nome'}`.
- Tabela = `line.department` (ex.: EQUIPAMENTOS), fornecedor = `line.name` ou item (conforme CUSTOM_HEADERS).

#### 3.5 Padronizar botões i, $, ✎, 📄
- Usar o mesmo estilo da página EQUIPE: `iconBtnCls`, tamanho 26x26, ícones Info, DollarSign, PenLine, Receipt.
- **Contrato (✎)**: `DriveLinkButton` com `variant="contract"` e path `_PRODUÇÃO/EQUIPE/{Nome (Função)}/CONTRATO`.
- **Nota fiscal (📄)**: `DriveLinkButton` com `variant="invoice"` e path `_PRODUÇÃO/EQUIPE/{Nome (Função)}/NOTA FISCAL`.

#### 3.6 Trocar label "NF" por "NOTA FISCAL"
- Substituir todas as ocorrências de `<span>NF</span>` e `placeholder="NF"` por "NOTA FISCAL" (no placeholder do botão de upload, usar "Upload" ou similar).

---

### Fase 4 — Alterações no ViewTeam

#### 4.1 Botões Contrato e Nota fiscal
- Substituir `window.alert('...')` por `DriveLinkButton` com `projectId`, `memberPath` (obtido via props `projectDbId` e dados do membro).
- Path contrato: `_PRODUÇÃO/EQUIPE/{Nome (Função)}/CONTRATO`.
- Path NF: `_PRODUÇÃO/EQUIPE/{Nome (Função)}/NOTA FISCAL`.
- Necessário passar `projectDbId` para ViewTeam (via props do page.tsx).

---

### Fase 5 — Ajustes de dados e UX

#### 5.1 Campos opcionais em ClosingLine e ExpenseLine
- Manter `invoiceNumber` para exibir número da NF (texto) se o usuário quiser preencher manualmente.
- Adicionar `invoiceUrl?: string` para armazenar o link do arquivo enviado (opcional; pode derivar só do path se não quisermos persistir).

#### 5.2 Persistência
- Se o `invoiceUrl` for relevante para histórico, incluir em `closing_lines` e `expenses` no estado do fechamento (já são salvos em `closing_lines` no projeto).
- Caso contrário, o arquivo fica no Drive e o botão sempre abre a pasta ou o PDF existente.

#### 5.3 Tratamento quando `drive_root_folder_id` é null
- Se o projeto ainda não tiver pasta no Drive, exibir mensagem: "Salve o projeto para habilitar upload no Drive" e desabilitar os botões.

---

## Ordem sugerida

1. **Fase 1** — APIs (folder-url, upload, folder-contents) e funções em `google-drive.ts`.
2. **Fase 2** — Componentes `DriveUploadButton` e `DriveLinkButton` (ou hook).
3. **Fase 3** — ViewFechamento: remover verbas, trocar inputs por botões, padronizar ícones, renomear NF.
4. **Fase 4** — ViewTeam: conectar botões Contrato e NF ao Drive.
5. **Fase 5** — Ajustes finais (persistência, UX quando Drive não configurado).

---

## Observações

- **PRESTAÇÃO DE CONTAS** vs **PRESTAÇÕES DE CONTAS**: usar `PRESTAÇÃO DE CONTAS` para coincidir com `drive-folder-structure.ts`.
- **Criação dinâmica de pastas**: path `PRODUÇÃO/EQUIPAMENTOS/Link Remoto` será criado sob demanda no primeiro upload.
- **Tipos de arquivo**: aceitar PDF (e possivelmente imagens) no upload; validação no backend.
