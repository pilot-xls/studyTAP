/* Música de estudo generativa (lofi/ambiente), feita com Web Audio.
   Não precisa de ficheiros de áudio: funciona offline e nunca repete igual. */
const StudyMusic = (() => {
  let ctx, master, bus, verb, delay, fb, noiseGain, timer;
  let playing = false, volume = 0.5, nextChordAt = 0, chordIdx = 0, nextNoteAt = 0;

  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  // Progressão calma em Ré maior: Dmaj9 – Bm9 – Gmaj9 – A6sus
  const chords = [
    [50, 57, 61, 64, 66],
    [47, 54, 57, 61, 62],
    [43, 50, 54, 57, 62],
    [45, 52, 57, 59, 62],
  ];
  const scale = [62, 64, 66, 69, 71, 74, 76, 78, 81]; // pentatónica de Ré
  const CHORD_LEN = 8;

  function impulse(seconds = 3.2) {
    const rate = ctx.sampleRate, len = rate * seconds;
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  }

  function setup() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = .3;
    master.connect(lp).connect(ctx.destination);

    bus = ctx.createGain(); bus.gain.value = .9; bus.connect(master);
    verb = ctx.createConvolver(); verb.buffer = impulse();
    const verbGain = ctx.createGain(); verbGain.gain.value = .55;
    verb.connect(verbGain).connect(master);

    delay = ctx.createDelay(2); delay.delayTime.value = .48;
    fb = ctx.createGain(); fb.gain.value = .35;
    const dLp = ctx.createBiquadFilter(); dLp.type = 'lowpass'; dLp.frequency.value = 1800;
    delay.connect(dLp).connect(fb).connect(delay);
    dLp.connect(verb); dLp.connect(master);

    // Chuva/vinil suave: ruído castanho filtrado
    const nb = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const nd = nb.getChannelData(0); let last = 0;
    for (let i = 0; i < nd.length; i++) { const w = Math.random() * 2 - 1; last = (last + .02 * w) / 1.02; nd[i] = last * 3.2; }
    const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 900; nf.Q.value = .4;
    noiseGain = ctx.createGain(); noiseGain.gain.value = .05;
    ns.connect(nf).connect(noiseGain).connect(master); ns.start();
  }

  function pad(notes, t) {
    notes.forEach((n, i) => {
      [-5, 5].forEach(det => {
        const o = ctx.createOscillator(); o.type = i === 0 ? 'sine' : 'triangle';
        o.frequency.value = midi(n); o.detune.value = det;
        const g = ctx.createGain(); const peak = (i === 0 ? .07 : .028);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(peak, t + 2.5);
        g.gain.setValueAtTime(peak, t + CHORD_LEN - 1.5);
        g.gain.linearRampToValueAtTime(0, t + CHORD_LEN + 2);
        o.connect(g); g.connect(bus); g.connect(verb);
        o.start(t); o.stop(t + CHORD_LEN + 2.2);
      });
    });
  }

  function pluck(n, t) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = midi(n);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = midi(n + 12) * 1.002;
    const g = ctx.createGain(); const g2 = ctx.createGain(); g2.gain.value = .25;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(.06, t + .02);
    g.gain.exponentialRampToValueAtTime(.0005, t + 2.4);
    o.connect(g); o2.connect(g2).connect(g);
    g.connect(bus); g.connect(delay); g.connect(verb);
    o.start(t); o2.start(t); o.stop(t + 2.5); o2.stop(t + 2.5);
  }

  function tick() {
    const now = ctx.currentTime;
    while (nextChordAt < now + 1) {
      pad(chords[chordIdx % chords.length], nextChordAt);
      chordIdx++; nextChordAt += CHORD_LEN;
    }
    while (nextNoteAt < now + 1) {
      if (Math.random() < .62) {
        const chord = chords[(chordIdx - 1 + chords.length) % chords.length];
        const pool = scale.filter(s => chord.some(c => (s - c) % 12 === 0) || Math.random() < .4);
        pluck(pool[Math.floor(Math.random() * pool.length)], nextNoteAt);
      }
      nextNoteAt += [0.6, 0.9, 1.2, 1.8][Math.floor(Math.random() * 4)];
    }
  }

  return {
    get playing() { return playing; },
    start() {
      if (!ctx) setup();
      ctx.resume();
      const t = ctx.currentTime;
      nextChordAt = Math.max(nextChordAt, t + .05); nextNoteAt = Math.max(nextNoteAt, t + 1.5);
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(volume * .9, t + 2);
      clearInterval(timer); timer = setInterval(tick, 250); tick();
      playing = true;
    },
    stop() {
      if (!ctx) return;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + 1.2);
      clearInterval(timer);
      setTimeout(() => { if (!playing) ctx.suspend(); }, 1400);
      playing = false;
    },
    setVolume(v) {
      volume = v;
      if (ctx && playing) master.gain.setTargetAtTime(v * .9, ctx.currentTime, .2);
    },
  };
})();
