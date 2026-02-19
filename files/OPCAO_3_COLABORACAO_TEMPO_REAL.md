# Opção 3: Colaboração em tempo real

Documento de referência para uma **implementação futura** de edição simultânea no CineBuddy (múltiplos usuários no mesmo projeto ao mesmo tempo).

---

## O que seria a colaboração em tempo real

- Dois ou mais usuários **abrem o mesmo projeto** ao mesmo tempo.
- Alterações de um aparecem **na tela do outro** em poucos segundos (sem precisar dar F5 ou “Salvar”).
- Ex.: usuário A edita FOTOGRAFIA, usuário B edita PRODUÇÃO; ambos veem as mudanças um do outro em tempo (quase) real.

Isso costuma ser feito com:

- **WebSockets** ou **Server-Sent Events** para o servidor “empurrar” atualizações para os clientes.
- **Supabase Realtime**: o Supabase oferece canais em tempo real sobre tabelas (INSERT/UPDATE/DELETE). O front poderia se inscrever no canal do projeto e, ao receber um evento, atualizar o estado local (merge ou substituição por departamento, conforme a regra que você escolheu).

---

## Poderia quebrar o funcionamento geral do sistema?

- **Risco baixo se for um módulo opcional**: a colaboração em tempo real pode ser implementada **em paralelo** ao fluxo atual (abrir projeto → editar → Salvar). Ou seja:
  - Quem não usar a “sala colaborativa” continua usando como hoje: abrir, editar, salvar. Nada precisa mudar nesse fluxo.
  - Quem usar tempo real: além do save, o app se inscreve em atualizações do projeto e atualiza a tela quando outro usuário salva (ou quando há um “sync” por departamento).
- **Risco médio se mudar o core do save**: se no futuro o “save” for substituído por “enviar cada alteração em tempo real” (sem botão Salvar), aí sim o fluxo geral muda e exige testes fortes e rollback planejado. **Recomendação**: manter o Salvar como fonte da verdade e usar tempo real só para **visualização/aviso** (“outro usuário salvou; atualizar?”) ou para um modo “ao vivo” opcional.

Resumo: **não precisa quebrar o sistema**, desde que tempo real seja **adicional** e o “Salvar” continue garantindo a consistência no banco.

---

## Riscos envolvidos

| Risco | Descrição | Mitigação |
|-------|-----------|-----------|
| **Conflito de dados** | Dois usuários editam o mesmo departamento e um sobrescreve o outro no save. | Já mitigado pela **opção 1 (merge por departamento no save)**. Com tempo real, pode-se ainda mostrar “X está editando FOTOGRAFIA” e avisar ao salvar se houve mudança no servidor. |
| **Estado inconsistente na tela** | O front recebe um evento de realtime e atualiza só parte da tela, deixando estado misto (ex.: orçamento atualizado, verbas desatualizadas). | Desenhar regras claras: ao receber evento, fazer **merge por departamento** (como no save) e atualizar estado global; ou pedir “Recarregar projeto” para garantir consistência. |
| **Performance / custo** | Muitos projetos abertos com Realtime pode aumentar uso de conexões e custo no Supabase. | Usar canais só para o projeto aberto; desinscrever ao sair da página ou trocar de projeto. |
| **Segurança** | Realtime expõe mudanças a quem tem permissão. | Usar RLS (Row Level Security) no Supabase como já é feito; Realtime respeita as mesmas políticas. |

Nenhum desses riscos é inerente a “quebrar tudo”; são riscos **controláveis** com desenho e testes.

---

## Perda, dano ou inutilização de projetos existentes?

- **Não**, desde que:
  1. A **fonte da verdade** continue sendo o que está no banco (Supabase) após o **Salvar**.
  2. O **merge por departamento** (opção 1) seja usado tanto no save quanto, no futuro, ao aplicar eventos de tempo real (ou ao “recarregar” após aviso).
  3. **Não** se passe a sobrescrever projetos inteiros com payloads parciais ou sem merge. Ou seja: projetos já existentes não precisam ser migrados nem ficam “inutilizados” só por adicionar tempo real; o que pode corromper dados é **mudar a lógica de save** para sobrescrever sem merge — e isso não é obrigatório na opção 3.

Recomendações para quando implementar tempo real:

- Manter o botão **Salvar** e a lógica atual de **merge por departamento**.
- Tratar Realtime como **atualização de visualização** (e, se quiser, “Outro usuário salvou – atualizar?”) em vez de substituir o save.
- Fazer backup/export dos projetos importantes antes de ligar Realtime em produção na primeira vez (boa prática em qualquer mudança grande).

---

## Resumo

- **Opção 3** = colaboração em tempo real = ver as alterações dos outros sem recarregar, usando algo como Supabase Realtime.
- **Não precisa quebrar o sistema** se for feita como camada opcional em cima do save atual.
- **Riscos** são de conflito (já mitigado pelo merge por depto), consistência da tela, performance e segurança — todos tratáveis.
- **Projetos existentes** não seriam perdidos nem inutilizados, desde que a regra de save com merge por departamento seja mantida e Realtime não substitua essa regra.

Quando for implementar, vale documentar no próprio código e em um pequeno guia (ex.: “Como funciona o Realtime no CineBuddy”) para manutenção futura.
