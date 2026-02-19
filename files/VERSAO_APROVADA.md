# Versão aprovada e funcional

**Data:** 14 de fevereiro de 2025  

**Estado:** Esta versão foi registrada como aprovada e funcional. Base para as próximas implementações.

## Inclui (resumo)

- Merge por departamento no save (evita zerar trabalho de outros usuários)
- Logout sem alert indevido; save silencioso; tratamento de 403 no signOut
- API prestação de contas: `gerar-link` com checagem de `PRESTACAO_CONTAS_JWT_SECRET` e mensagens claras (503)
- Melhorias de INP: handlers em background em Sair, Excluir projeto, Gerar link, Copiar link (feedback "Copiado!" no botão)
- Acessibilidade: modais da Config com `role="dialog"`, `aria-modal`, `aria-labelledby`
- Activity logs e perfis: uso de `getSession` em vez de `getUser` onde aplicável; menos ruído no console

---

*Arquivo atualizado ao registrar nova versão aprovada.*
