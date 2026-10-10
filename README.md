# Cartões TAP ✈

PWA de estudo para a entrevista e o teste teórico de piloto da TAP: 316 cartões (296 técnicos + 20 de entrevista).

## Como se usa

```
Toque no ecrã ──────────► próximo cartão
Arrastar ← / →  ────────► próximo / anterior
Arrastar ↑  ────────────► resposta + as tuas notas + Claude + adiar
   ├─ ⏱ 10 min / 1 h / 1 dia / 7 dias ─► o cartão volta depois desse tempo
   └─ ✓ Já sei ────────────────────────► não volta a aparecer
♪ (topo) ───────────────► música de estudo calma (gerada na app, funciona offline)
☰ (topo) ───────────────► modo (Tudo / Teste teórico / Entrevista), temas, P1/P2, chave API, exportar notas
```

Os cartões P1 aparecem sempre primeiro, baralhados.

## Publicar no GitHub Pages

```
1. github.com ─► New repository ─► nome (ex.: cartoes-tap) ─► Create
2. "uploading an existing file" ─► arrasta TODOS os ficheiros desta pasta (incluindo a pasta icons) ─► Commit
3. Settings ─► Pages ─► Source: "Deploy from a branch" ─► Branch: main / (root) ─► Save
4. Espera 1-2 min ─► https://O-TEU-UTILIZADOR.github.io/cartoes-tap/
5. No telemóvel:
   iPhone (Safari) ─► Partilhar ─► "Adicionar ao ecrã principal"
   Android (Chrome) ─► ⋮ ─► "Instalar app"
```

## Editar ou acrescentar cartões

Edita o `cards.md` (até diretamente no GitHub). Cada cartão é uma linha:

```
- **Pergunta?** Resposta. _[Tema P1 etiquetas]_
```

- O tema é a primeira palavra dentro de `_[ ]_`; a prioridade é `P1` ou `P2`.
- As etiquetas `verificar`, `corrigido` e `preencher` aparecem com cores próprias.
- As notas ficam ligadas ao texto da pergunta. Se mudares a pergunta, a nota antiga deixa de aparecer nesse cartão.

Depois de mudares o `app.js`, o `style.css` ou o `index.html`, altera `VERSION` no `sw.js` (ex.: `tapcards-v2`) para o telemóvel ir buscar a versão nova. O `cards.md` atualiza sozinho quando há internet.

## Claude

A forma como falas com o Claude depende de onde abres a app:

```
Link do Claude (claude.ai/artifact/…) ─► chat dentro da app com a tua conta Claude, sem chave e sem custos extra
GitHub Pages sem chave ───────────────► botão «Abrir no claude.ai» (sai da app)
GitHub Pages + chave API ─────────────► chat dentro da app, pago à parte (console.anthropic.com)
```

A chave API é opcional e fica só no teu telemóvel (☰ ▸ Claude). Nunca é exportada nem vai para o GitHub.

> ⚠️ Nunca escrevas a chave API em nenhum ficheiro do repositório: o repositório é público.

## Cópia de segurança

As notas, os cartões dominados e os adiados ficam guardados no browser do telemóvel. Usa ☰ ▸ **Exportar notas** de vez em quando. Se limpares os dados do browser ou mudares de telemóvel, recuperas tudo com **Importar**.
