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
   └─ 🗂 Ver e editar todos os cartões ─► lista com pesquisa ─► editar pergunta, resposta e notas
```

Os cartões P1 aparecem sempre primeiro, baralhados.

O avião no topo mostra quantas perguntas **diferentes** já viste de todos os cartões (ex.: `120/316`), desde sempre — não só hoje nem só neste voo. Em ☰ vês o mesmo número, a percentagem e as passagens no total.

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
- As notas ficam ligadas ao texto da pergunta. Se mudares a pergunta diretamente no GitHub, a nota antiga deixa de aparecer nesse cartão (se mudares pela app, a nota acompanha).

### Editar pela app (grava direto no GitHub)

```
☰ ─► 🗂 Ver e editar todos os cartões ─► toca num cartão ─► muda pergunta/resposta ─► Guardar no GitHub
   (ou, a estudar: arrastar ↑ ─► ✎ Editar)
        │
        ▼
API do GitHub ─► commit no cards.md (branch main) ─► GitHub Pages publica em 1-2 min
        │
        └─► neste telemóvel a alteração aparece logo
```

Precisa de um token GitHub (só uma vez):

```
github.com ─► Settings ─► Developer settings ─► Personal access tokens ─► Fine-grained tokens ─► Generate new token
   ├─ Repository access: Only select repositories ─► este repositório
   └─ Permissions ─► Contents: Read and write
Copia o token ─► app ─► ☰ ─► GitHub ─► cola ─► Testar ligação
```

O token fica só no telemóvel e nunca é exportado. As notas ficam no telemóvel; para as guardar no GitHub usa ☰ ▸ GitHub ▸ **Sincronizar notas** (grava `notes.json` no repositório — **público = visível a todos**). Também sincroniza sozinho 20 s depois de saíres do cartão (só se houve alterações; sem rede, fica para a próxima). Em conflito, ganha a versão do telemóvel; apagar uma nota não a apaga dos outros aparelhos.

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
