// Sidar Quiz sesleri: ZzFX ile efektler + küçük bir chiptune çalıcı (dosya gerekmez).
// Sesler sadece moderatör ekranında çalar. Tarayıcılar sesi ilk tıklamadan sonra açar.
(() => {
  'use strict';

  const ctx = window.ZZFX ? ZZFX.audioContext : new AudioContext();
  const master = ctx.createGain();
  master.connect(ctx.destination);
  const musicBus = ctx.createGain();
  musicBus.gain.value = 0.22;
  musicBus.connect(master);

  let enabled = true;
  try { enabled = localStorage.getItem('sidar-sound') !== 'off'; } catch (e) { /* gizli mod */ }
  master.gain.value = enabled ? 1 : 0;
  if (window.ZZFX) ZZFX.volume = enabled ? 0.45 : 0;

  // --- Efektler (ZzFX parametreleri) ---
  // sıra: hacim, rastgelelik, frekans, atak, sürme, bırakma, dalga, eğri, kayma, kayma2, perde atlama, atlama zamanı,
  //       tekrar, gürültü, modülasyon, bit ezme, gecikme, sürme hacmi, sönüm, tremolo
  const SFX = {
    join: [1, 0, 660, 0.01, 0.04, 0.08, 1, 1, 0, 0, 330, 0.04],
    tick: [0.4, 0, 880, 0, 0.01, 0.03, 1],
    tickFast: [0.6, 0, 1320, 0, 0.01, 0.04, 1],
    go: [1, 0, 392, 0.01, 0.12, 0.2, 1, 1, 0, 0, 392, 0.06, 0, 0, 0, 0, 0, 0.8],
    lock: [1, 0, 220, 0.01, 0.05, 0.18, 2, 1, -4],
    crumble: [1.2, 0.2, 90, 0.01, 0.25, 0.45, 4, 1, -1, 0, 0, 0, 0, 1.4],
    correct: [1, 0, 523, 0.02, 0.16, 0.3, 1, 1, 0, 0, 262, 0.09, 0.09],
    wrong: [0.8, 0, 160, 0.01, 0.12, 0.25, 2, 1, -3],
    whoosh: [0.6, 0.1, 300, 0.05, 0.08, 0.2, 3, 1, 9],
    pause: [0.8, 0, 440, 0.01, 0.06, 0.12, 1, 1, 0, 0, -220, 0.06],
  };

  function sfx(name) {
    if (!enabled || !window.ZZFX || ctx.state !== 'running') return;
    try { ZZFX.play(...SFX[name]); } catch (e) { /* ses hatası oyunu durdurmasın */ }
  }

  // --- Chiptune çalıcı ---
  // Notalar: 'C4', 'D#4', '-' (sus). Her şarkı birkaç kanaldan oluşur, her kanal eşit uzunlukta adımlar.
  const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  function freq(n) {
    const m = /^([A-G]#?)(\d)$/.exec(n);
    if (!m) return 0;
    return 440 * Math.pow(2, (NOTE[m[1]] + (Number(m[2]) + 1) * 12 - 69) / 12);
  }
  const seq = (str) => str.trim().split(/\s+/);

  // Kendi yazdığımız kısa döngüler (telif sorunu yok)
  const SONGS = {
    lobby: {
      bpm: 112, steps: 16 * 4,
      ch: [
        { wave: 'square', gain: 0.18, notes: seq(`
          E5 - G5 - A5 - G5 E5  D5 - E5 - C5 - - -
          E5 - G5 - A5 - C6 B5  A5 - G5 - E5 - - -
          D5 - F5 - G5 - F5 D5  C5 - D5 - A4 - - -
          C5 - E5 - G5 - E5 C5  D5 - B4 - C5 - - -`) },
        { wave: 'triangle', gain: 0.35, notes: seq(`
          C3 - C3 - G2 - G2 -  A2 - A2 - E2 - E2 -
          F2 - F2 - C3 - C3 -  G2 - G2 - G2 - G2 -
          D3 - D3 - A2 - A2 -  F2 - F2 - C3 - C3 -
          F2 - F2 - G2 - G2 -  C3 - G2 - C3 - - -`) },
      ],
    },
    question: {
      bpm: 132, steps: 16 * 2,
      ch: [
        { wave: 'square', gain: 0.12, notes: seq(`
          A4 C5 E5 C5 A4 C5 E5 C5  G4 B4 D5 B4 G4 B4 D5 B4
          F4 A4 C5 A4 F4 A4 C5 A4  E4 G#4 B4 G#4 E4 G#4 B4 G#4`) },
        { wave: 'triangle', gain: 0.35, notes: seq(`
          A2 - A2 - A2 - A2 -  G2 - G2 - G2 - G2 -
          F2 - F2 - F2 - F2 -  E2 - E2 - E2 - E2 -`) },
      ],
    },
    fanfare: {
      bpm: 150, steps: 16, loop: false,
      ch: [
        { wave: 'square', gain: 0.2, notes: seq('G4 - C5 - E5 - G5 - - - E5 - G5 - - -') },
        { wave: 'triangle', gain: 0.4, notes: seq('C3 - - - C3 - - - G2 - - - C3 - - -') },
      ],
    },
  };

  let current = null;     // { name, startAt, timer }
  let rate = 1;           // son saniyelerde hızlanma

  function scheduleNote(wave, f, t, dur, gain) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.setValueAtTime(gain, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t + dur * 0.95);
    o.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + dur);
  }

  function play(name) {
    if (current && current.name === name) return;
    stop();
    const song = SONGS[name];
    if (!song) return;
    rate = 1;
    const state = { name, step: 0, next: ctx.currentTime + 0.05 };
    const tick = () => {
      const stepDur = 60 / song.bpm / 4 / rate;
      while (state.next < ctx.currentTime + 0.2) {
        if (song.loop === false && state.step >= song.steps) { stop(); return; }
        const i = state.step % song.steps;
        if (enabled) {
          for (const c of song.ch) {
            const n = c.notes[i % c.notes.length];
            if (n === '-') continue;
            // Notanın süresi: sonraki notaya kadar
            let len = 1;
            while (len < 8 && c.notes[(i + len) % c.notes.length] === '-') len++;
            scheduleNote(c.wave, freq(n), state.next, stepDur * len, c.gain);
          }
        }
        state.step++;
        state.next += stepDur;
      }
    };
    state.timer = setInterval(tick, 50);
    current = state;
    tick();
  }

  function stop() {
    if (current) clearInterval(current.timer);
    current = null;
  }

  function unlock() {
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  }

  function setEnabled(v) {
    enabled = v;
    master.gain.value = v ? 1 : 0;
    if (window.ZZFX) ZZFX.volume = v ? 0.45 : 0;
    try { localStorage.setItem('sidar-sound', v ? 'on' : 'off'); } catch (e) { /* yok */ }
  }

  window.SidarAudio = {
    sfx, play, stop, unlock,
    setTempo(r) { rate = r; },
    get enabled() { return enabled; },
    get running() { return ctx.state === 'running'; },
    toggle() { setEnabled(!enabled); return enabled; },
  };
})();
