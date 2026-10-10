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
  const data = Object.assign({ notes: {}, snooze: {}, seen: {}, day: '', today: 0, streak: 0, total: 0,
    settings: { mode: 'all', themes: null, prio: 'all', vol: .45, music: false, apiKey: '', model: 'claude-sonnet-5-5' } }, store.load());
  const S = data.settings;
  const persist = () => store.save(data);

  let cards = [], deck = [], idx = 0, chats = {};

  // ---------- Leitura dos cartões ----------
  const hash = s => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.codePointAt(0)) | 0; return (h >>> 0).toString(36); };
  function parse(md) {
    const out = [];
    for (const line of md.split(/\r?\n/)) {
      const m = line.match(/^- \*\*(.+?)\*\*\s*(.*?)\s*_\[(.+?)\]_\s*$/);
      if (!m) continue;
      const tags = m[3].trim().split(/\s+/);
      const theme = tags[0];
      const prio = tags.find(t => /^P[12]$/.test(t)) || 'P2';
      out.push({ id: hash(m[1]), q: m[1], a: m[2], theme, prio, flags: tags.slice(1).filter(t => t !== prio) });
    }
    return out;
  }

  // ---------- Baralho ----------
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const activeThemes = () => S.themes || MODES[S.mode] || Object.keys(THEMES);
  const hidden = c => { const s = data.snooze[c.id]; return s === -1 || (s && s > Date.now()); };

  function buildDeck() {
    const th = new Set(activeThemes());
    let pool = cards.filter(c => th.has(c.theme) && !hidden(c));
    if (S.prio !== 'all') pool = pool.filter(c => c.prio === S.prio);
    const p1 = shuffle(pool.filter(c => c.prio === 'P1'));
    const p2 = shuffle(pool.filter(c => c.prio !== 'P1'));
    deck = [...p1, ...p2];
    idx = 0;
  }

  // Cartões adiados cujo tempo já passou voltam a entrar no baralho
  function requeueExpired() {
    const now = Date.now(), inDeck = new Set(deck.slice(idx).map(c => c.id));
    const th = new Set(activeThemes());
    for (const [id, until] of Object.entries(data.snooze)) {
      if (until > 0 && until <= now) {
        delete data.snooze[id];
        const c = cards.find(x => x.id === id);
        if (c && th.has(c.theme) && !inDeck.has(id)) deck.splice(Math.min(idx + 2, deck.length), 0, c);
      }
    }
  }

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
        <div><small>Visto</small><span>${data.seen[c.id] || 0}×</span></div>
      </div>
      <div class="q">${esc(c.q)}</div>
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

    updateProgress();
    if (idx >= deck.length) { renderEnd(el); return; }

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
  }

  function renderEnd(el) {
    const div = document.createElement('div');
    div.className = 'end';
    const none = deck.length === 0;
    div.innerHTML = none
      ? `<div class="big">🛬</div><h2>Sem cartões aqui</h2><p>Todos os cartões deste filtro estão escondidos ou adiados.</p><button class="primary" id="openMenu2">Mudar filtros</button>`
      : `<div class="big">🛬</div><h2>Aterragem!</h2><p>${deck.length} cartões revistos neste voo.</p><button class="primary" id="again">Novo voo (baralhar)</button>`;
    el.appendChild(div);
    if (!none) confetti();
    div.querySelector('button').addEventListener('click', e => {
      e.stopPropagation();
      if (none) openPanel(); else { buildDeck(); render(1); }
    });
  }

  function updateProgress() {
    const p = deck.length ? Math.min(idx / deck.length, 1) : 0;
    $('#fill').style.width = p * 100 + '%';
    $('#plane').style.left = p * 100 + '%';
    document.documentElement.style.setProperty('--p', p.toFixed(3));
    $('#dest').textContent = deck.length ? `${Math.min(idx + 1, deck.length)}/${deck.length}` : 'FIM';
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
    if (idx >= deck.length) return;
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
    const open = $('#sheet').classList.contains('open');
    if (e.key === 'Escape') { closeSheet(); closePanel(); }
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
    renderChat();
    $('#keyHint').style.display = S.apiKey ? 'none' : '';
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
    const cur = $('#deck .card:not(.ghost)');
    if (cur && deck[idx]) cur.innerHTML = cardHTML(deck[idx], idx + 1, deck.length);
  }
  backdrop.addEventListener('click', closeSheet);
  $('#closeSheet').addEventListener('click', closeSheet);

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
      persist(); $('#noteSaved').textContent = 'guardado ✓';
    }, 400);
  });

  sheet.querySelectorAll('[data-snooze]').forEach(b => b.addEventListener('click', () => {
    const c = deck[idx]; if (!c) return;
    const ms = +b.dataset.snooze;
    data.snooze[c.id] = ms === -1 ? -1 : Date.now() + ms;
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
  $('#openClaude').addEventListener('click', () => {
    const c = deck[idx]; if (!c) return;
    const extra = $('#askInput').value.trim();
    const prompt = `${SYSTEM}\n\n${cardContext(c)}\n\n${extra || 'Explica-me isto de forma simples e diz se a resposta do cartão está correta e completa.'}`;
    window.open('https://claude.ai/new?q=' + encodeURIComponent(prompt), '_blank', 'noopener');
  });
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
            $('#notes').value = data.notes[c.id]; persist(); toast('Guardado nas notas ✎');
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
    if (!S.apiKey) {
      $('#askInput').value = question;
      toast('Sem chave API: a abrir no claude.ai');
      setTimeout(() => $('#openClaude').click(), 500);
      return;
    }
    const hist = chats[c.id] = chats[c.id] || [];
    hist.push({ role: 'user', content: question });
    const bot = { role: 'assistant', content: '', pending: true };
    hist.push(bot); renderChat(); scrollChat();

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
    $('#vol').value = S.vol;
    $('#apiKey').value = S.apiKey;
    $('#model').value = S.model;
    const mastered = Object.values(data.snooze).filter(v => v === -1).length;
    const later = Object.values(data.snooze).filter(v => v > Date.now()).length;
    $('#stats').innerHTML = `
      <div class="stat"><b>${data.today}</b><span>hoje</span></div>
      <div class="stat"><b>${mastered}</b><span>dominados</span></div>
      <div class="stat"><b>${later}</b><span>adiados</span></div>
      <div class="stat"><b>${data.streak}</b><span>dias seguidos</span></div>
      <div class="stat"><b>${Object.keys(data.notes).length}</b><span>com notas</span></div>
      <div class="stat"><b>${cards.length}</b><span>cartões</span></div>`;
    panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false');
  }
  function closePanel() { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); }
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
  $('#vol').addEventListener('input', e => { S.vol = +e.target.value; StudyMusic.setVolume(S.vol); persist(); });
  $('#apiKey').addEventListener('change', e => { S.apiKey = e.target.value.trim(); persist(); });
  $('#model').addEventListener('change', e => { S.model = e.target.value; persist(); });
  $('#applyBtn').addEventListener('click', () => {
    const modeBtn = $('#modeSeg .sel');
    const sel = [...$('#themeChips').querySelectorAll('.sel')].map(b => b.dataset.theme);
    if (!sel.length) { toast('Escolhe pelo menos um tema'); return; }
    if (modeBtn) { S.mode = modeBtn.dataset.mode; S.themes = null; } else { S.themes = sel; }
    S.prio = $('#prioSeg .sel')?.dataset.prio || 'all';
    S.apiKey = $('#apiKey').value.trim(); S.model = $('#model').value;
    persist(); closePanel(); buildDeck(); render(1);
    toast(`🛫 ${deck.length} cartões a bordo`);
  });
  $('#resetSnooze').addEventListener('click', () => {
    if (!confirm('Repor todos os cartões dominados e adiados?')) return;
    data.snooze = {}; persist(); toast('Cartões repostos'); openPanel();
  });
  $('#exportBtn').addEventListener('click', () => {
    const out = { exportado: new Date().toISOString(), notas: cards.filter(c => data.notes[c.id]).map(c => ({ pergunta: c.q, nota: data.notes[c.id] })), raw: data };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `cartoes-tap-notas-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('#importFile').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text()); const r = j.raw || j;
      Object.assign(data.notes, r.notes || {}); Object.assign(data.snooze, r.snooze || {});
      persist(); toast('Notas importadas ✓'); openPanel();
    } catch { toast('Ficheiro inválido'); }
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
    cards = parse(md);
    if (!cards.length) { $('#deck').innerHTML = '<div class="end"><h2>Não consegui ler cards.md</h2><p>Abre a app através do GitHub Pages (ou de um servidor), não a partir do ficheiro.</p></div>'; return; }
    buildDeck(); render(0);
  }
  init();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
