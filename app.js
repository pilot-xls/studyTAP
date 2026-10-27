/* Cartões TAP — PWA de estudo */
(() => {
  'use strict';

  // ---------- Configuração ----------
  const THEMES = {
    Performance: '#e2683c', Regulamentos: '#3d6fd8', Aero_Mach: '#8a54d6', Instrumentos: '#1f9e8a',
    Meteo: '#2f8fd1', Nav: '#d14b8f', Luzes: '#c9971a', Calculo: '#5b8c2a', Cenarios: '#d9483b',
    TAP_A320: '#22406e', Soft: '#c05a9c', Entrevista: '#b5487a',
  };
  const LABEL = { Aero_Mach: 'Aero/Mach', TAP_A320: 'TAP A320', Calculo: 'Cálculo', Cenarios: 'Cenários' };
  const MODES = {
    all: null,
    tech: ['Performance', 'Regulamentos', 'Aero_Mach', 'Instrumentos', 'Meteo', 'Nav', 'Luzes', 'Calculo', 'TAP_A320'],
    interview: ['Entrevista', 'Soft', 'Cenarios'],
  };
  const SYSTEM = `És um instrutor experiente que ajuda um candidato a piloto da TAP a preparar a entrevista e o teste teórico.
Responde sempre em português de Portugal (nunca do Brasil), de forma direta e curta (máx. ~150 palavras, salvo se te pedirem mais).
Usa o cartão como ponto de partida. Se detetares um erro ou imprecisão no cartão, diz claramente e corrige.
Para contas de cabeça, dá uma única regra simples. Quando ajudar, explica fluxos com setas (A -> B -> C).
Se te pedirem uma pergunta de treino, não dês a resposta até o candidato responder.`;

  const $ = s => document.querySelector(s);
  const store = {
    k: 'tapcards.v1',
    load() { try { return JSON.parse(localStorage.getItem(this.k)) || {}; } catch { return {}; } },
    save(d) { try { localStorage.setItem(this.k, JSON.stringify(d)); } catch {} },
  };
  // Repositório do cards.md: deduzido do endereço do GitHub Pages (utilizador.github.io/repo/)
  function detectRepo() {
    const h = location.hostname.match(/^([^.]+)\.github\.io$/i);
    if (!h) return 'pilot-xls/studyTAP';
    const seg = location.pathname.split('/').filter(Boolean)[0];
    return `${h[1]}/${seg && !seg.includes('.') ? seg : h[1] + '.github.io'}`;
  }
  const data = Object.assign({ notes: {}, snooze: {}, seen: {}, rate: {}, pending: [], notesDirty: false, day: '', today: 0, streak: 0, total: 0 }, store.load());
  // definições novas ganham valor por omissão mesmo em dados antigos
  const S = data.settings = Object.assign({ mode: 'all', themes: null, prio: 'all', study: 'all', vol: .45, music: false, apiKey: '', model: 'claude-sonnet-5-5',
    ghToken: '', ghRepo: detectRepo(), ghBranch: 'main' }, data.settings);

  // Avaliação de cada cartão: f = fácil, p = tive de pensar, n = não sabia
  const RATE = { f: { icon: '🟢', label: 'Fácil' }, p: { icon: '🟡', label: 'Tive de pensar' }, n: { icon: '🔴', label: 'Não sabia' } };
  const lvl = c => (data.rate[c.id] && data.rate[c.id].l) || '';
  const persist = () => store.save(data);
  // Sincronização automática das notas: 20 s depois de sair do cartão, só se houve alterações
  const SYNC_DELAY = 20000;
  let syncTimer, syncing = false, lastSyncErr = 0;
  const markNotes = () => { data.notesDirty = true; persist(); queueSync(); };
  function queueSync() {
    clearTimeout(syncTimer);
    if (!data.notesDirty || !S.ghToken) return;
    if (['#sheet', '#library', '#panel'].some(q => $(q).classList.contains('open'))) return;
    syncTimer = setTimeout(autoSync, SYNC_DELAY);
  }
  async function autoSync() {
    if (!data.notesDirty || !S.ghToken || syncing || !navigator.onLine) return;
    syncing = true;
    try { await syncNotes(); toast('☁ Notas guardadas no GitHub'); }
    catch (e) { if (Date.now() - lastSyncErr > 300000) { lastSyncErr = Date.now(); toast('☁ Notas por sincronizar: ' + e.message); } }
    syncing = false;
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(syncTimer); autoSync(); } });
  window.addEventListener('online', queueSync);

  let cards = [], deck = [], idx = 0, chats = {};
  let rated = new WeakSet(), moving = false; // cartões já avaliados neste voo (só passas ao próximo depois de avaliar)

  // ---------- Leitura dos cartões ----------
  const hash = s => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.codePointAt(0)) | 0; return (h >>> 0).toString(36); };
  function parseLine(line) {
    const m = line.match(/^- \*\*(.+?)\*\*\s*(.*?)\s*_\[(.+?)\]_\s*$/);
    if (!m) return null;
    const tags = m[3].trim().split(/\s+/);
    const theme = tags[0];
    const prio = tags.find(t => /^P[12]$/.test(t)) || 'P2';
    return { id: hash(m[1]), q: m[1], a: m[2], theme, prio, flags: tags.slice(1).filter(t => t !== prio), tags: m[3].trim(), line };
  }
  const parse = md => md.split(/\r?\n/).map(parseLine).filter(Boolean);

  // Edições já gravadas no GitHub que o GitHub Pages ainda não publicou (demora 1-2 min)
  function applyPending(md) {
    if (!data.pending.length) return md;
    const lines = md.split(/\r?\n/);
    data.pending = data.pending.filter(p => {
      if (Date.now() - p.at > 864e5 || lines.includes(p.to)) return false; // já publicada
      const i = lines.indexOf(p.from);
      if (i < 0) return false; // a linha mudou noutro sítio
      lines[i] = p.to;
      return true;
    });
    persist();
    return lines.join('\n');
  }

  // ---------- Baralho ----------
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const activeThemes = () => S.themes || MODES[S.mode] || Object.keys(THEMES);
  const hidden = c => { const s = data.snooze[c.id]; return s === -1 || (s && s > Date.now()); };

  function buildDeck() {
    const th = new Set(activeThemes());
    let pool = cards.filter(c => th.has(c.theme) && !hidden(c));
    if (S.prio !== 'all') pool = pool.filter(c => c.prio === S.prio);
    if (S.study === 'hard') pool = pool.filter(c => lvl(c) === 'n' || lvl(c) === 'p');
    // dentro de cada grupo: P1 antes de P2, baralhados
    const byPrio = a => [...shuffle(a.filter(c => c.prio === 'P1')), ...shuffle(a.filter(c => c.prio !== 'P1'))];
    // Ordem: não sabia -> tive de pensar -> nunca vistos -> vistos sem avaliação -> fáceis (revisão no fim)
    deck = [
      ...byPrio(pool.filter(c => lvl(c) === 'n')),
      ...byPrio(pool.filter(c => lvl(c) === 'p')),
      ...byPrio(pool.filter(c => !lvl(c) && !data.seen[c.id])),
      ...byPrio(pool.filter(c => !lvl(c) && data.seen[c.id])),
      ...shuffle(pool.filter(c => lvl(c) === 'f')),
    ];
    rated = new WeakSet();
    idx = 0;
  }

  // «Não sabia»: o cartão volta daqui a ~5 cartões, neste voo (cópia, para voltar a ter de ser avaliado)
  function requeueHard(c) {
    if (deck.slice(idx + 1).some(x => x.id === c.id)) return;
    deck.splice(Math.min(idx + 6, deck.length), 0, Object.create(c));
  }

  // Cartões adiados cujo tempo já passou voltam a entrar no baralho (respeitando tema e prioridade)
  function requeueExpired() {
    const now = Date.now(), inDeck = new Set(deck.slice(idx).map(c => c.id));
    const th = new Set(activeThemes());
    let n = 0, changed = false;
    for (const [id, until] of Object.entries(data.snooze)) {
      if (until > 0 && until <= now) {
        delete data.snooze[id]; changed = true;
        const c = cards.find(x => x.id === id);
        if (c && th.has(c.theme) && (S.prio === 'all' || c.prio === S.prio) && (S.study !== 'hard' || lvl(c) === 'n' || lvl(c) === 'p') && !inDeck.has(id)) {
          deck.splice(Math.min(idx + 2, deck.length), 0, Object.create(c)); n++;
        }
      }
    }
    if (changed) persist();
    return n;
  }
  // Sem depender de deslizar: verifica de 30 em 30 s e ao voltar à app
  function checkSnoozed() {
    const wasEnd = idx >= deck.length;
    const n = requeueExpired();
    if (!n) return;
    if (wasEnd) { render(1); toast('⏱ Voltou um cartão adiado'); }
    else { updateProgress(); toast('⏱ Voltou um cartão adiado'); }
  }
  setInterval(checkSnoozed, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkSnoozed(); });

  // ---------- Render ----------
  const esc = s => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const pad3 = n => String(n).padStart(3, '0');

  function cardHTML(c, n, total) {
    const note = data.notes[c.id] ? '<span class="tag-note">✎ nota</span>' : `<div class="barcode"></div>`;
    return `
      <div class="stub"><span>Cartão de embarque</span><b>${pad3(n)}/${pad3(total)}</b></div>
      <div class="meta">
        <div><small>Tema</small><span>${esc(LABEL[c.theme] || c.theme)}</span></div>
        <div><small>Classe</small><span>${c.prio}</span></div>
        <div><small>Visto</small><span>${data.seen[c.id] || 0}×${lvl(c) ? ' ' + RATE[lvl(c)].icon : ''}</span></div>
      </div>
      <div class="q">${esc(c.q)}</div>
      <div class="card-rate" role="group" aria-label="Como correu este cartão?">
        ${['f', 'p', 'n'].map(r => `<button class="r-${r}${lvl(c) === r ? ' sel' : ''}" data-rate="${r}"><span>${RATE[r].icon}</span>${RATE[r].label}</button>`).join('')}
      </div>
      <div class="foot">${note}<span class="up-hint">↑ resposta</span></div>`;
  }

  function render(dir) {
    const el = $('#deck');
    const old = el.querySelector('.card:not(.ghost)');
    if (old && dir) {
      old.classList.remove('in');
      old.classList.add(dir === 1 ? 'out-next' : 'out-prev');
      old.style.pointerEvents = 'none';
      old.addEventListener('animationend', () => old.remove(), { once: true });
      setTimeout(() => old.remove(), 600);
    } else if (old) old.remove();
    el.querySelectorAll('.ghost, .end').forEach(g => g.remove());

    if (idx >= deck.length) { updateProgress(); renderEnd(el); return; }

    if (idx + 1 < deck.length) {
      const g = document.createElement('div');
      g.className = 'card ghost';
      g.style.setProperty('--theme', THEMES[deck[idx + 1].theme] || '#999');
      g.innerHTML = cardHTML(deck[idx + 1], idx + 2, deck.length);
      el.prepend(g);
    }
    const c = deck[idx];
    const d = document.createElement('div');
    d.className = 'card' + (dir ? ' in' : '');
    d.style.setProperty('--theme', THEMES[c.theme] || '#999');
    d.innerHTML = cardHTML(c, idx + 1, deck.length);
    el.appendChild(d);
    data.seen[c.id] = (data.seen[c.id] || 0) + 1;
    persist();
    updateProgress();
  }

  function renderEnd(el) {
    const div = document.createElement('div');
    div.className = 'end';
    const none = deck.length === 0;
    div.innerHTML = none
      ? `<div class="big">🛬</div><h2>Sem cartões aqui</h2><p>${S.study === 'hard' ? 'Ainda não tens cartões difíceis (🔴 / 🟡) neste filtro.' : 'Todos os cartões deste filtro estão escondidos ou adiados.'}</p><button class="primary" id="openMenu2">Mudar filtros</button>`
      : `<div class="big">🛬</div><h2>Aterragem!</h2><p>${deck.length} cartões revistos neste voo.</p><button class="primary" id="again">Novo voo (baralhar)</button>`;
    el.appendChild(div);
    if (!none) confetti();
    div.querySelector('button').addEventListener('click', e => {
      e.stopPropagation();
      if (none) openPanel(); else { buildDeck(); render(1); }
    });
  }

  // perguntas diferentes já vistas, de todos os cartões (não só deste voo nem só de hoje)
  const seenCount = () => cards.reduce((n, c) => n + (data.seen[c.id] ? 1 : 0), 0);

  function updateProgress() {
    const seen = seenCount();
    const p = cards.length ? seen / cards.length : 0;
    $('#fill').style.width = p * 100 + '%';
    $('#plane').style.left = p * 100 + '%';
    document.documentElement.style.setProperty('--p', p.toFixed(3));
    $('#dest').textContent = `${seen}/${cards.length}`;
    $('#streak').textContent = `🔥 ${data.today} · ${data.streak}d`;
  }

  // ---------- Navegação ----------
  function countToday() {
    const today = new Date().toISOString().slice(0, 10);
    if (data.day !== today) {
      const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      data.streak = data.day === y ? data.streak + 1 : 1;
      data.day = today; data.today = 0;
    }
    data.today++; data.total++;
    if (data.today % 25 === 0) { toast(`✈ FL${pad3(data.today * 4)} atingido! ${data.today} cartões hoje`); confetti(); }
  }

  function next() {
    if (idx >= deck.length || moving) return;
    // obrigatório avaliar antes de passar: mostra a resposta com os 3 botões
    if (!rated.has(deck[idx])) {
      openSheet();
      const r = $('#rate'); r.classList.remove('nudge'); void r.offsetWidth; r.classList.add('nudge'); // pulso a chamar a atenção para os 3 botões
      return;
    }
    countToday();
    idx++;
    requeueExpired();
    buzz(); render(1);
    if (idx === 3) $('#hint').style.opacity = 0;
  }
  function prev() { if (idx > 0) { idx--; buzz(); render(-1); } }
  const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch {} };

  // ---------- Gestos ----------
  const stage = $('#stage');
  let g = null;
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    g = { x: e.clientX, y: e.clientY, t: Date.now(), card: $('#deck .card:not(.ghost)') };
  });
  stage.addEventListener('pointermove', e => {
    if (!g || !g.card) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (Math.abs(dy) > Math.abs(dx) && dy < 0) {
      g.card.style.transform = `translateY(${Math.max(dy * .5, -120)}px) scale(${1 + Math.max(dy, -120) / -2400})`;
    } else if (Math.abs(dx) > 10) {
      g.card.style.transform = `translateX(${dx * .6}px) rotate(${dx / 30}deg)`;
    }
  });
  const endGesture = e => {
    if (!g) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y, dt = Date.now() - g.t;
    if (g.card) { g.card.style.transition = 'transform .25s'; g.card.style.transform = ''; setTimeout(() => g && g.card && (g.card.style.transition = ''), 260); }
    const card = g.card; g = null;
    if (!card) return;
    if (dy < -60 && Math.abs(dy) > Math.abs(dx)) openSheet();
    else if (dx < -70) next();
    else if (dx > 70) prev();
    else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 500) next();
  };
  stage.addEventListener('pointerup', endGesture);
  stage.addEventListener('pointercancel', () => { if (g && g.card) g.card.style.transform = ''; g = null; });

  document.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea, select')) return;
    const open = $('#sheet').classList.contains('open') || $('#library').classList.contains('open') || $('#panel').classList.contains('open');
    if (e.key === 'Escape') { closeSheet(); closePanel(); closeLib(); }
    else if ('123'.includes(e.key) && e.key.length === 1 && !e.repeat && !$('#library').classList.contains('open') && !$('#panel').classList.contains('open')) rateCard({ 1: 'f', 2: 'p', 3: 'n' }[e.key]); // teclado: 1 fácil · 2 pensei · 3 não sabia
    else if (open) return;
    else if (e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'ArrowUp') openSheet();
  });

  // ---------- Folha: resposta, notas, Claude, adiar ----------
  const sheet = $('#sheet'), backdrop = $('#backdrop');
  let noteTimer;
  function openSheet() {
    const c = deck[idx]; if (!c) return;
    sheet.style.setProperty('--theme', THEMES[c.theme]);
    $('#sheetQ').textContent = c.q;
    $('#sheetA').textContent = c.a;
    $('#sheetFlags').innerHTML = [`<span class="flag">${esc(LABEL[c.theme] || c.theme)} · ${c.prio}</span>`]
      .concat(c.flags.map(f => `<span class="flag ${esc(f)}">${esc(f)}</span>`)).join('');
    $('#notes').value = data.notes[c.id] || '';
    $('#noteSaved').textContent = '';
    $('#rate').querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.rate === lvl(c)));
    renderChat();
    refreshClaudeUI();
    $('#sheetBody').scrollTop = 0;
    sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('show');
    buzz();
  }
  function closeSheet() {
    sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('show');
    sheet.style.transform = '';
    document.activeElement && document.activeElement.blur();
    refreshCard();
    queueSync();
  }
  function refreshCard() {
    const cur = $('#deck .card:not(.ghost)');
    if (cur && deck[idx]) cur.innerHTML = cardHTML(deck[idx], idx + 1, deck.length);
  }
  backdrop.addEventListener('click', closeSheet);
  $('#closeSheet').addEventListener('click', closeSheet);
  $('#editCard').addEventListener('click', () => { const c = deck[idx]; if (!c) return; closeSheet(); openLib(c.id); });

  // arrastar a pega para baixo fecha
  let sd = null;
  $('#grab').addEventListener('pointerdown', e => { sd = e.clientY; sheet.classList.add('dragging'); $('#grab').setPointerCapture(e.pointerId); });
  $('#grab').addEventListener('pointermove', e => { if (sd != null) sheet.style.transform = `translateY(${Math.max(0, e.clientY - sd)}px)`; });
  $('#grab').addEventListener('pointerup', e => {
    sheet.classList.remove('dragging');
    if (sd != null && e.clientY - sd > 90) closeSheet(); else sheet.style.transform = '';
    sd = null;
  });

  $('#notes').addEventListener('input', e => {
    const c = deck[idx]; if (!c) return;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      const v = e.target.value.trim();
      if (v) data.notes[c.id] = e.target.value; else delete data.notes[c.id];
      markNotes(); $('#noteSaved').textContent = 'guardado ✓';
    }, 400);
  });

  // Avaliação: guarda, fecha a folha e passa ao próximo cartão (os «Não sabia» voltam daqui a ~5 cartões)
  function rateCard(l) {
    const c = deck[idx]; if (!c || !RATE[l] || moving) return;
    moving = true;
    data.rate[c.id] = { l, at: Date.now() };
    rated.add(c);
    if (l === 'n') requeueHard(c);
    persist();
    closeSheet();
    toast(`${RATE[l].icon} ${RATE[l].label}${l === 'n' ? ' · volta já a seguir' : ''}`);
    setTimeout(() => { moving = false; next(); }, 250);
  }
  $('#rate').querySelectorAll('button').forEach(b => b.addEventListener('click', () => rateCard(b.dataset.rate)));
  // os mesmos 3 botões, diretamente no cartão (não é preciso abrir a resposta)
  $('#deck').addEventListener('click', e => {
    const b = e.target.closest('.card-rate [data-rate]'); if (!b) return;
    const card = b.closest('.card');
    if (card.classList.contains('ghost') || card.classList.contains('out-next') || card.classList.contains('out-prev')) return;
    rateCard(b.dataset.rate);
  });

  sheet.querySelectorAll('[data-snooze]').forEach(b => b.addEventListener('click', () => {
    const c = deck[idx]; if (!c) return;
    rated.add(c); // adiar / «já sei» também deixam passar
    const ms = +b.dataset.snooze;
    data.snooze[c.id] = ms === -1 ? -1 : Date.now() + ms;
    deck = deck.filter((x, i) => i <= idx || x.id !== c.id); // tira as cópias «Não sabia» que ainda vinham a caminho
    persist();
    closeSheet();
    toast(ms === -1 ? '✓ Dominado — não volta a aparecer' : `⏱ Volta daqui a ${b.textContent.trim().replace('1 hora','1 h')}`);
    setTimeout(next, 250);
  }));

  // Claude
  function cardContext(c) {
    return `Cartão de estudo (tema: ${LABEL[c.theme] || c.theme}, ${c.prio}):\nPergunta: ${c.q}\nResposta no cartão: ${c.a}` +
      (data.notes[c.id] ? `\nAs minhas notas: ${data.notes[c.id]}` : '');
  }
  // Ligação ao Claude: 1) conta Claude (quando a app abre pelo link do Claude), 2) chave API, 3) link para claude.ai
  let sampleFn = null;
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('sample').then(s => { sampleFn = s || null; refreshClaudeUI(); }).catch(() => {});
  }
  const chatMode = () => sampleFn ? 'account' : S.apiKey ? 'key' : 'none';
  function refreshClaudeUI() {
    const mode = chatMode();
    $('#keyHint').hidden = mode !== 'none';
    $('#openClaude').hidden = mode === 'account';
    $('#sampleNote').hidden = mode !== 'account';
    $('#keyBox').hidden = mode === 'account';
    updateClaudeLink();
  }
  function updateClaudeLink() {
    const c = deck[idx]; if (!c) return;
    const extra = $('#askInput').value.trim();
    const prompt = `${SYSTEM}\n\n${cardContext(c)}\n\n${extra || 'Explica-me isto de forma simples e diz se a resposta do cartão está correta e completa.'}`;
    $('#openClaude').href = 'https://claude.ai/new?q=' + encodeURIComponent(prompt);
  }
  $('#askInput').addEventListener('input', updateClaudeLink);
  $('#keyHint').addEventListener('click', () => { closeSheet(); openPanel(); setTimeout(() => $('#apiKey').focus(), 350); });
  sheet.querySelectorAll('.quick button').forEach(b => b.addEventListener('click', () => ask(b.dataset.q)));
  $('#askForm').addEventListener('submit', e => { e.preventDefault(); const v = $('#askInput').value.trim(); if (v) ask(v); });

  function md(t) {
    const lines = esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').split('\n');
    let html = '', list = false;
    for (const l of lines) {
      const li = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
      if (li) { if (!list) { html += '<ul>'; list = true; } html += `<li>${li[1]}</li>`; continue; }
      if (list) { html += '</ul>'; list = false; }
      if (l.trim()) html += `<p>${l}</p>`;
    }
    return html + (list ? '</ul>' : '');
  }

  function renderChat() {
    const c = deck[idx]; const box = $('#chat'); box.innerHTML = '';
    (chats[c?.id] || []).forEach((m, i, arr) => {
      const d = document.createElement('div');
      d.className = 'msg ' + (m.role === 'user' ? 'user' : m.err ? 'bot err' : 'bot');
      if (m.role === 'user') d.textContent = m.content;
      else {
        d.innerHTML = md(m.content || '');
        if (m.pending) d.classList.add('typing');
        else if (!m.err) {
          const s = document.createElement('button'); s.className = 'save'; s.textContent = '＋ Guardar nas notas';
          s.onclick = () => {
            data.notes[c.id] = ((data.notes[c.id] || '') + '\n\n[Claude] ' + m.content).trim();
            $('#notes').value = data.notes[c.id]; markNotes(); toast('Guardado nas notas ✎');
          };
          d.appendChild(s);
        }
      }
      box.appendChild(d);
    });
  }

  async function ask(question) {
    const c = deck[idx]; if (!c) return;
    $('#askInput').value = '';
    const hist = chats[c.id] = chats[c.id] || [];
    hist.push({ role: 'user', content: question });
    const mode = chatMode();
    if (mode === 'none') {
      hist.push({ role: 'assistant', err: true, content:
        'Para falares comigo aqui dentro da app, abre-a pelo link do Claude (usa a tua conta, sem custos extra) ou mete uma chave API em ☰ ▸ Claude.\nPor agora, «Abrir no claude.ai» leva a pergunta para lá.' });
      renderChat(); scrollChat(); updateClaudeLink();
      return;
    }
    const bot = { role: 'assistant', content: '', pending: true };
    hist.push(bot); renderChat(); scrollChat();

    if (mode === 'account') {
      const turns = hist.filter(m => !m.pending && !m.err).map(m => ({ role: m.role, content: m.content })).slice(-12);
      while (turns.length && turns[0].role !== 'user') turns.shift();
      try {
        const { text } = await sampleFn(
          [{ role: 'user', content: SYSTEM + '\n\n' + cardContext(c) + '\n\nResponde às minhas perguntas sobre este cartão.' }, ...turns],
          { cache: false, onText: ({ text }) => { bot.content = text; renderChat(); scrollChat(); } });
        bot.content = text; bot.pending = false;
      } catch (e) {
        bot.pending = false;
        const msgs = {
          not_granted: 'Não autorizaste a app a usar o Claude. Podes autorizar no menu de permissões do artifact.',
          sampling_disabled: 'O Claude não está disponível nesta conta.',
          rate_limited: 'Muitas perguntas seguidas ou limite de uso atingido. Tenta daqui a pouco.',
          session_expired: 'A sessão expirou. Volta a entrar no Claude.',
          refused: 'O Claude não respondeu a esta pergunta. Reformula.',
          cancelled: 'Cancelado.',
        };
        if (e && e.text) { bot.content = e.text + '\n\n(resposta interrompida)'; }
        else { bot.err = true; bot.content = msgs[e && e.code] || 'Falhou a ligação ao Claude. Tenta outra vez.'; }
      }
      renderChat(); scrollChat();
      return;
    }

    const messages = hist.filter(m => !m.pending && !m.err).map(m => ({ role: m.role, content: m.content }));
    messages[0] = { role: 'user', content: cardContext(c) + '\n\n' + messages[0].content };
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json', 'x-api-key': S.apiKey, 'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model: S.model, max_tokens: 1024, system: SYSTEM, stream: true, messages }),
      });
      if (!res.ok) {
        let msg = `Erro ${res.status}`;
        try { const j = await res.json(); msg += ': ' + (j.error?.message || ''); } catch {}
        throw new Error(msg);
      }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n'); buf = parts.pop();
        for (const p of parts) {
          if (!p.startsWith('data:')) continue;
          try {
            const ev = JSON.parse(p.slice(5));
            if (ev.type === 'content_block_delta' && ev.delta?.text) { bot.content += ev.delta.text; renderChat(); scrollChat(); }
            if (ev.type === 'error') throw new Error(ev.error?.message || 'erro');
          } catch (err) { if (err.message && !(err instanceof SyntaxError)) throw err; }
        }
      }
      bot.pending = false;
    } catch (err) {
      bot.pending = false; bot.err = true;
      bot.content = (navigator.onLine ? '' : 'Sem internet. ') + (err.message || 'Falhou o pedido') + '\nVerifica a chave API no menu ou usa «Abrir no claude.ai».';
    }
    renderChat(); scrollChat();
  }
  const scrollChat = () => { const b = $('#sheetBody'); const box = $('#chat'); b.scrollTop = box.offsetTop + box.offsetHeight - b.clientHeight + 120; };

  // ---------- Menu ----------
  const panel = $('#panel');
  function openPanel() {
    const th = new Set(activeThemes());
    const counts = {}; cards.forEach(c => counts[c.theme] = (counts[c.theme] || 0) + 1);
    $('#themeChips').innerHTML = Object.keys(counts).map(t =>
      `<button data-theme="${t}" class="${th.has(t) ? 'sel' : ''}" style="--chip:${THEMES[t] || '#888'}">${LABEL[t] || t} <small>${counts[t]}</small></button>`).join('');
    $('#themeChips').querySelectorAll('button').forEach(b => b.onclick = () => { b.classList.toggle('sel'); markMode(null); });
    markMode(S.themes ? null : S.mode);
    $('#prioSeg').querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.prio === S.prio));
    $('#studySeg').querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.study === S.study));
    $('#vol').value = S.vol;
    $('#apiKey').value = S.apiKey;
    $('#model').value = S.model;
    $('#ghToken').value = S.ghToken;
    $('#ghRepo').value = S.ghRepo;
    $('#ghBranch').value = S.ghBranch;
    const mastered = Object.values(data.snooze).filter(v => v === -1).length;
    const later = Object.values(data.snooze).filter(v => v > Date.now()).length;
    const rc = { f: 0, p: 0, n: 0 }; cards.forEach(c => { const l = lvl(c); if (l) rc[l]++; });
    const seen = seenCount(), pct = cards.length ? Math.floor(seen / cards.length * 100) : 0;
    $('#stats').innerHTML = `
      <div class="stat wide"><b>${seen}<small> / ${cards.length}</small></b><span>perguntas diferentes já vistas · ${pct}%</span>
        <i class="bar"><i style="width:${pct}%"></i></i></div>
      <div class="stat"><b>${data.today}</b><span>hoje</span></div>
      <div class="stat"><b>${data.total}</b><span>passagens no total</span></div>
      <div class="stat"><b>${data.streak}</b><span>dias seguidos</span></div>
      <div class="stat"><b>${mastered}</b><span>dominados</span></div>
      <div class="stat"><b>${later}</b><span>adiados</span></div>
      <div class="stat"><b>${Object.keys(data.notes).length}</b><span>com notas</span></div>
      <div class="stat"><b>${rc.n}</b><span>🔴 não sabia</span></div>
      <div class="stat"><b>${rc.p}</b><span>🟡 tive de pensar</span></div>
      <div class="stat"><b>${rc.f}</b><span>🟢 fácil</span></div>`;
    panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false');
  }
  function closePanel() { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); queueSync(); }
  function markMode(m) {
    $('#modeSeg').querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.mode === m));
  }
  $('#menuBtn').addEventListener('click', openPanel);
  $('#closePanel').addEventListener('click', closePanel);
  panel.addEventListener('click', e => { if (e.target === panel) closePanel(); });
  $('#modeSeg').querySelectorAll('button').forEach(b => b.onclick = () => {
    markMode(b.dataset.mode);
    const set = new Set(MODES[b.dataset.mode] || Object.keys(THEMES));
    $('#themeChips').querySelectorAll('button').forEach(x => x.classList.toggle('sel', set.has(x.dataset.theme)));
  });
  $('#prioSeg').querySelectorAll('button').forEach(b => b.onclick = () => {
    $('#prioSeg').querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
  });
  $('#studySeg').querySelectorAll('button').forEach(b => b.onclick = () => {
    $('#studySeg').querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
  });
  $('#vol').addEventListener('input', e => { S.vol = +e.target.value; StudyMusic.setVolume(S.vol); persist(); });
  $('#apiKey').addEventListener('change', e => { S.apiKey = e.target.value.trim(); persist(); });
  $('#model').addEventListener('change', e => { S.model = e.target.value; persist(); });
  $('#ghToken').addEventListener('change', e => { S.ghToken = e.target.value.trim(); persist(); });
  $('#ghRepo').addEventListener('change', e => { S.ghRepo = e.target.value.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '') || detectRepo(); e.target.value = S.ghRepo; persist(); });
  $('#ghBranch').addEventListener('change', e => { S.ghBranch = e.target.value.trim() || 'main'; e.target.value = S.ghBranch; persist(); });
  $('#ghTest').addEventListener('click', async () => {
    const b = $('#ghTest');
    if (!$('#ghToken').value.trim()) { toast('Mete primeiro o token'); return; }
    ['#ghToken', '#ghRepo', '#ghBranch'].forEach(s => $(s).dispatchEvent(new Event('change')));
    b.disabled = true; b.textContent = 'A testar…';
    try {
      const f = await ghFile();
      toast(`✓ Ligado: ${parse(f.text).length} cartões no GitHub`);
    } catch (e) { toast(e.message); }
    b.disabled = false; b.textContent = 'Testar ligação';
  });
  $('#syncNotes').addEventListener('click', async () => {
    const b = $('#syncNotes');
    if (!$('#ghToken').value.trim()) { toast('Mete primeiro o token'); return; }
    ['#ghToken', '#ghRepo', '#ghBranch'].forEach(s => $(s).dispatchEvent(new Event('change')));
    b.disabled = true; b.textContent = 'A sincronizar…';
    try { const n = await syncNotes(); toast(`✓ ${n} notas sincronizadas`); }
    catch (e) { toast(e.message); }
    b.disabled = false; b.textContent = 'Sincronizar notas';
  });
  $('#openLib').addEventListener('click', () => { closePanel(); openLib(); });
  $('#applyBtn').addEventListener('click', () => {
    const modeBtn = $('#modeSeg .sel');
    const sel = [...$('#themeChips').querySelectorAll('.sel')].map(b => b.dataset.theme);
    if (!sel.length) { toast('Escolhe pelo menos um tema'); return; }
    if (modeBtn) { S.mode = modeBtn.dataset.mode; S.themes = null; } else { S.themes = sel; }
    S.prio = $('#prioSeg .sel')?.dataset.prio || 'all';
    S.study = $('#studySeg .sel')?.dataset.study || 'all';
    S.apiKey = $('#apiKey').value.trim(); S.model = $('#model').value;
    ['#ghToken', '#ghRepo', '#ghBranch'].forEach(s => $(s).dispatchEvent(new Event('change')));
    persist(); closePanel(); buildDeck(); render(1);
    toast(`🛫 ${deck.length} cartões a bordo`);
  });
  $('#resetSnooze').addEventListener('click', () => {
    const b = $('#resetSnooze');
    if (!b.dataset.armed) {
      b.dataset.armed = '1'; b.textContent = 'Tocar de novo para confirmar';
      setTimeout(() => { delete b.dataset.armed; b.textContent = 'Repor escondidos'; }, 3000);
      return;
    }
    delete b.dataset.armed; b.textContent = 'Repor escondidos';
    data.snooze = {}; persist(); toast('Cartões repostos'); openPanel();
  });
  let downloadsCap = null;
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('downloads').then(d => { downloadsCap = d || null; }).catch(() => {});
  }
  $('#exportBtn').addEventListener('click', async () => {
    const raw = JSON.parse(JSON.stringify(data)); raw.settings.apiKey = ''; raw.settings.ghToken = ''; // nunca exportar chaves
    const out = { exportado: new Date().toISOString(), notas: cards.filter(c => data.notes[c.id]).map(c => ({ pergunta: c.q, nota: data.notes[c.id] })), raw };
    const json = JSON.stringify(out, null, 2);
    const filename = `cartoes-tap-notas-${new Date().toISOString().slice(0, 10)}.json`;
    if (downloadsCap) {
      try { await downloadsCap.save({ filename, data: json }); toast('Notas exportadas ✓'); } catch { toast('Exportação cancelada'); }
      return;
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('#importFile').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text()); const r = j.raw || j;
      Object.assign(data.notes, r.notes || {}); Object.assign(data.snooze, r.snooze || {}); Object.assign(data.rate, r.rate || {});
      markNotes(); toast('Notas importadas ✓'); openPanel();
    } catch { toast('Ficheiro inválido'); }
  });

  // ---------- GitHub: ler e gravar o cards.md ----------
  const b64dec = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), ch => ch.charCodeAt(0)));
  const b64enc = s => {
    const b = new TextEncoder().encode(s); let bin = '';
    for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  async function gh(path, opts = {}, file = 'cards.md') {
    if (!/^[\w.-]+\/[\w.-]+$/.test(S.ghRepo)) throw new Error('Repositório inválido (usa utilizador/repositório)');
    let res;
    try {
      res = await fetch(`https://api.github.com/repos/${S.ghRepo}/contents/${file}${path}`, {
        cache: 'no-store', ...opts,
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${S.ghToken}`, ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
      });
    } catch { throw new Error(navigator.onLine ? 'Falhou a ligação ao GitHub' : 'Sem internet'); }
    if (res.ok) return res.json();
    const err = new Error({
      401: 'Token GitHub inválido ou expirado',
      403: 'O token não tem permissão (precisa de Contents: Read and write)',
      404: `Não encontrei ${file} em ${S.ghRepo} (${S.ghBranch}) — ou o token não tem acesso a este repositório`,
      409: 'O ficheiro mudou entretanto no GitHub',
    }[res.status] || `Erro GitHub ${res.status}`);
    err.status = res.status;
    throw err;
  }
  async function ghFile(file = 'cards.md') {
    const f = await gh(`?ref=${encodeURIComponent(S.ghBranch)}`, {}, file);
    if (typeof f.content !== 'string' || !f.sha) throw new Error('Resposta inesperada do GitHub');
    return { sha: f.sha, text: b64dec(f.content) };
  }
  // Sincroniza as notas com notes.json (junta; em conflito, a versão deste telemóvel ganha)
  async function syncNotes() {
    let remote = {}, sha;
    try {
      const f = await ghFile('notes.json'); sha = f.sha;
      try { remote = JSON.parse(f.text).notes || {}; } catch { throw new Error('notes.json inválido no GitHub'); }
    } catch (e) { if (e.status !== 404) throw e; }
    const merged = Object.assign({}, remote, data.notes);
    const same = JSON.stringify(Object.entries(merged).sort()) === JSON.stringify(Object.entries(remote).sort());
    data.notes = merged; persist();
    if (same && sha) { data.notesDirty = false; persist(); return Object.keys(merged).length; }
    const body = { message: 'Sincronizar notas', content: b64enc(JSON.stringify({ atualizado: new Date().toISOString(), notes: merged }, null, 2)), branch: S.ghBranch };
    if (sha) body.sha = sha;
    await gh('', { method: 'PUT', body: JSON.stringify(body) }, 'notes.json');
    data.notesDirty = false; persist();
    return Object.keys(merged).length;
  }
  // Troca a linha do cartão no cards.md do GitHub; devolve a linha antiga
  async function commitLine(oldId, newLine, msg, tries = 2) {
    const f = await ghFile();
    const eol = f.text.includes('\r\n') ? '\r\n' : '\n';
    const lines = f.text.split(/\r?\n/);
    const i = lines.findIndex(l => parseLine(l)?.id === oldId);
    if (i < 0) throw new Error('Este cartão já não existe no GitHub (foi mudado noutro sítio). Fecha e volta a abrir a app.');
    const oldLine = lines[i];
    lines[i] = newLine;
    try {
      await gh('', { method: 'PUT', body: JSON.stringify({ message: msg, content: b64enc(lines.join(eol)), sha: f.sha, branch: S.ghBranch }) });
    } catch (e) {
      if (e.status === 409 && tries > 1) return commitLine(oldId, newLine, msg, tries - 1);
      throw e;
    }
    return oldLine;
  }

  // ---------- Todos os cartões: lista e editor ----------
  const lib = $('#library');
  const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let editId = null, libScroll = 0, libNoteT;

  function openLib(id) {
    const counts = {}; cards.forEach(c => counts[c.theme] = (counts[c.theme] || 0) + 1);
    const cur = $('#libTheme').value;
    $('#libTheme').innerHTML = `<option value="">Todos os temas</option>` +
      Object.keys(counts).map(t => `<option value="${t}">${esc(LABEL[t] || t)} (${counts[t]})</option>`).join('');
    $('#libTheme').value = counts[cur] ? cur : '';
    lib.classList.add('open'); lib.setAttribute('aria-hidden', 'false');
    if (id) openEditor(id); else showList();
  }
  function closeLib() {
    if (!lib.classList.contains('open')) return;
    lib.classList.remove('open'); lib.setAttribute('aria-hidden', 'true');
    document.activeElement && document.activeElement.blur();
    editId = null;
    refreshCard();
    queueSync();
  }
  $('#closeLib').addEventListener('click', closeLib);
  lib.addEventListener('click', e => { if (e.target === lib) closeLib(); });

  function showList() {
    editId = null;
    $('#libTitle').textContent = 'Cartões';
    $('#libEdit').hidden = true; $('#libList').hidden = false;
    renderList();
    $('#libIn').scrollTop = libScroll;
  }
  function cardStatus(c) {
    const s = data.snooze[c.id];
    return s === -1 ? '✓ dominado' : s > Date.now() ? '⏱ adiado' : '';
  }
  function renderList() {
    const q = fold($('#libSearch').value.trim()), th = $('#libTheme').value, show = $('#libShow').value;
    const list = cards.filter(c =>
      (!th || c.theme === th) &&
      (show !== 'notes' || data.notes[c.id]) &&
      (show !== 'unseen' || !data.seen[c.id]) &&
      (show !== 'hidden' || cardStatus(c)) &&
      (show !== 'diff' || lvl(c) === 'n' || lvl(c) === 'p') &&
      (show !== 'n' || lvl(c) === 'n') && (show !== 'p' || lvl(c) === 'p') && (show !== 'f' || lvl(c) === 'f') &&
      (!q || fold(`${c.q} ${c.a} ${data.notes[c.id] || ''}`).includes(q)));
    $('#libCount').textContent = `${list.length} de ${cards.length} cartões`;
    $('#libRows').innerHTML = list.map(c => {
      const n = data.seen[c.id] || 0, st = cardStatus(c);
      return `<button class="lib-row" data-id="${c.id}" style="--theme:${THEMES[c.theme] || '#999'}">
        <b>${esc(c.q)}</b>
        <span>${esc(LABEL[c.theme] || c.theme)} · ${c.prio} · ${n ? `visto ${n}×` : 'nunca visto'}${lvl(c) ? ' · ' + RATE[lvl(c)].icon + ' ' + RATE[lvl(c)].label : ''}${data.notes[c.id] ? ' · <em>✎ nota</em>' : ''}${st ? ' · ' + st : ''}</span>
      </button>`;
    }).join('') || '<p class="note">Nenhum cartão encontrado.</p>';
  }
  $('#libSearch').addEventListener('input', renderList);
  $('#libTheme').addEventListener('change', renderList);
  $('#libShow').addEventListener('change', renderList);
  $('#libRows').addEventListener('click', e => {
    const b = e.target.closest('.lib-row'); if (!b) return;
    libScroll = $('#libIn').scrollTop;
    openEditor(b.dataset.id);
  });
  $('#libBack').addEventListener('click', showList);

  function openEditor(id) {
    const c = cards.find(x => x.id === id); if (!c) return;
    editId = id;
    $('#libTitle').textContent = 'Editar cartão';
    $('#libList').hidden = true; $('#libEdit').hidden = false;
    $('#editFlags').innerHTML = [`<span class="flag" style="background:${THEMES[c.theme] || '#999'};color:#fff">${esc(LABEL[c.theme] || c.theme)} · ${c.prio}</span>`]
      .concat(c.flags.map(f => `<span class="flag ${esc(f)}">${esc(f)}</span>`))
      .concat(`<span class="flag">${data.seen[c.id] ? `visto ${data.seen[c.id]}×` : 'nunca visto'}</span>`)
      .concat(cardStatus(c) ? `<span class="flag">${cardStatus(c)}</span>` : []).join('');
    $('#editQ').value = c.q;
    $('#editA').value = c.a;
    $('#editNotes').value = data.notes[c.id] || '';
    $('#editNoteSaved').textContent = '';
    $('#editHint').textContent = S.ghToken ? '' : 'Para gravar pergunta e resposta no GitHub, mete o token em ☰ ▸ GitHub. As notas guardam-se sempre aqui.';
    refreshSave();
    $('#libIn').scrollTop = 0;
  }
  const clean = s => s.replace(/\s*\n+\s*/g, ' ').trim(); // cada cartão é uma linha do cards.md
  function refreshSave() {
    const c = cards.find(x => x.id === editId); if (!c) return;
    const changed = clean($('#editQ').value) !== c.q || clean($('#editA').value) !== c.a;
    $('#editSave').disabled = !changed;
    $('#editSave').textContent = changed ? 'Guardar no GitHub' : 'Sem alterações';
  }
  $('#editQ').addEventListener('input', refreshSave);
  $('#editA').addEventListener('input', refreshSave);
  $('#editNotes').addEventListener('input', e => {
    const id = editId; if (!id) return;
    clearTimeout(libNoteT);
    const v = e.target.value; // lido já: o editor pode mudar de cartão antes de gravar
    libNoteT = setTimeout(() => {
      if (v.trim()) data.notes[id] = v; else delete data.notes[id];
      markNotes(); $('#editNoteSaved').textContent = 'guardado ✓';
    }, 400);
  });

  $('#editSave').addEventListener('click', async () => {
    const c = cards.find(x => x.id === editId); if (!c) return;
    if (!S.ghToken) {
      closeLib(); openPanel(); toast('Mete o token do GitHub');
      setTimeout(() => { $('#ghToken').scrollIntoView({ block: 'center' }); $('#ghToken').focus(); }, 350);
      return;
    }
    const q = clean($('#editQ').value), a = clean($('#editA').value);
    if (!q) { toast('A pergunta não pode ficar vazia'); return; }
    const line = [`- **${q}**`, a, `_[${c.tags}]_`].filter(Boolean).join(' ');
    const p = parseLine(line);
    // a linha tem de voltar a ler-se igual, senão estragava o cards.md
    if (!p || p.q !== q || p.a !== a) { toast('Texto inválido: evita ** e _[ … ]_'); return; }
    if (p.id !== c.id && cards.some(x => x.id === p.id)) { toast('Já existe um cartão com esta pergunta'); return; }

    const btn = $('#editSave'); btn.disabled = true; btn.textContent = 'A gravar no GitHub…';
    try {
      const oldLine = await commitLine(c.id, line, `Editar cartão: ${q.length > 60 ? q.slice(0, 57) + '…' : q}`);
      const oldId = c.id;
      if (p.id !== oldId) { // notas, vistos e adiados seguem a pergunta nova
        for (const k of ['notes', 'seen', 'snooze', 'rate']) if (data[k][oldId] !== undefined) { data[k][p.id] = data[k][oldId]; delete data[k][oldId]; }
        if (chats[oldId]) { chats[p.id] = chats[oldId]; delete chats[oldId]; }
      }
      Object.assign(c, { id: p.id, q: p.q, a: p.a, line });
      data.pending.push({ from: oldLine, to: line, at: Date.now() });
      persist();
      editId = p.id;
      $('#editQ').value = p.q; $('#editA').value = p.a;
      toast('✓ Gravado no GitHub');
      $('#editHint').textContent = 'Gravado. Aqui já aparece; noutros aparelhos quando o GitHub Pages atualizar (1-2 min).';
    } catch (e) {
      toast('Não gravou: ' + e.message);
      $('#editHint').textContent = 'Não gravou: ' + e.message;
    }
    refreshSave();
  });

  // ---------- Música ----------
  const mBtn = $('#musicBtn');
  function setMusic(on) {
    S.music = on; persist();
    if (on) { StudyMusic.setVolume(S.vol); StudyMusic.start(); } else StudyMusic.stop();
    mBtn.classList.toggle('on', on); mBtn.classList.toggle('playing', on);
  }
  mBtn.addEventListener('click', () => setMusic(!StudyMusic.playing));
  // o browser só deixa tocar som depois de um toque: retoma a preferência no primeiro toque
  if (S.music) {
    mBtn.classList.add('on');
    const resume = () => { if (S.music && !StudyMusic.playing) setMusic(true); };
    document.addEventListener('pointerdown', resume, { once: true, capture: true });
  }

  // ---------- Toast e confetti ----------
  let toastT;
  function toast(t) {
    const el = $('#toast'); el.textContent = t; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2200);
  }
  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = $('#confetti'), x = cv.getContext('2d');
    const W = cv.width = innerWidth * devicePixelRatio, H = cv.height = innerHeight * devicePixelRatio;
    const cols = ['#ffb547', '#5ee0b5', '#ff7a85', '#8fb3ff', '#fff'];
    const ps = Array.from({ length: 90 }, () => ({
      x: W / 2, y: H * .45, vx: (Math.random() - .5) * 18 * devicePixelRatio, vy: (-Math.random() * 16 - 4) * devicePixelRatio,
      r: (4 + Math.random() * 5) * devicePixelRatio, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6, va: Math.random() * .3 - .15,
    }));
    let f = 0;
    (function loop() {
      x.clearRect(0, 0, W, H);
      ps.forEach(p => { p.vy += .5 * devicePixelRatio; p.x += p.vx; p.y += p.vy; p.vx *= .99; p.a += p.va;
        x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); x.restore(); });
      if (++f < 110) requestAnimationFrame(loop); else x.clearRect(0, 0, W, H);
    })();
  }

  // ---------- Arranque ----------
  async function init() {
    let md = '';
    try { md = await (await fetch('cards.md', { cache: 'no-cache' })).text(); }
    catch { try { md = await (await caches.match('cards.md')).text(); } catch {} }
    cards = parse(applyPending(md));
    if (!cards.length) { $('#deck').innerHTML = '<div class="end"><h2>Não consegui ler cards.md</h2><p>Abre a app através do GitHub Pages (ou de um servidor), não a partir do ficheiro.</p></div>'; return; }
    buildDeck(); render(0);
  }
  init();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // versão nova do service worker → recarrega uma vez para aplicar o CSS/JS novo
    if (navigator.serviceWorker.controller) {
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
    }
    navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
  }
})();
