# Cartões TAP ✈

PWA de estudo para a entrevista e o teste teórico de piloto da TAP: 316 cartões (296 técnicos + 20 de entrevista).

## Como se usa

```
3 botões no próprio cartão (obrigatório para passar ao próximo):
   🟢 Fácil  ·  🟡 Tive de pensar  ·  🔴 Não sabia   (teclado: 1 · 2 · 3)
   └─► grava a avaliação e passa ao próximo; 🔴 volta daqui a ~5 cartões
Toque no cartão / Arrastar ↑ ─► resposta + as tuas notas + Claude + adiar
   └─ os mesmos 3 botões estão no fundo da resposta
Arrastar ← / →  ────────► próximo (só depois de avaliar) / anterior
   ├─ ⏱ 10 min / 1 h / 1 dia / 7 dias ─► o cartão volta depois desse tempo
   └─ ✓ Já sei ────────────────────────► não volta a aparecer
♪ (topo) ───────────────► música de estudo calma (gerada na app, funciona offline)
☰ (topo) ───────────────► modo (Tudo / Teste teórico / Entrevista), temas, P1/P2, chave API, exportar notas
   └─ 🗂 Ver e editar todos os cartões ─► lista com pesquisa ─► editar pergunta, resposta e notas
```

### Ordem de cada voo

```
🔴 Não sabia ─► 🟡 Tive de pensar ─► nunca vistos ─► vistos sem avaliação ─► 🟢 Fácil (revisão no fim)
   (dentro de cada grupo: P1 antes de P2, baralhados)
```

Em ☰ ▸ **Estudo** podes escolher «Só difíceis» (🔴 + 🟡) para estudar apenas o que te custa. A lista de cartões também filtra por avaliação. As avaliações ficam no telemóvel (entram na cópia de segurança: Exportar / Importar).

### Imagens nas notas

```
Cartão ─► toca/↑ para abrir a resposta ─► As minhas notas ─► 📷 Adicionar imagem (galeria ou câmara)
   │      (ou ☰ ▸ 🗂 Ver e editar ▸ cartão ▸ 📷 Adicionar imagem)
   ▼
app reduz a foto (≤1400 px, JPEG) ─► grava img/<id>-<código>.jpg no repositório (precisa do token) ─► aparece nas notas
Toca na miniatura = ver grande · ✕ = remover das notas
```

- As imagens ficam na pasta `img/` do repositório (**público = visíveis a todos**) e os caminhos entram no `notes.json` (☰ ▸ Sincronizar notas).
- Remover tira a imagem das notas, mas o ficheiro continua em `img/` no GitHub (apaga à mão se quiseres).
- A imagem aparece 1-2 min depois de enviada (tempo do GitHub Pages); nesta sessão aparece logo. Offline só vês as que já abriste uma vez.

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
