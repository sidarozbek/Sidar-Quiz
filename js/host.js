// Moderatör ekranı: oda kurar, oyuncu karakterlerini simüle eder, soruları yönetir.
// Bütün oyun mantığı burada çalışır; telefonlar sadece tuş durumunu gönderir.
(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Sahne ve fizik ayarları
  // ---------------------------------------------------------------------------
  const W = 960, H = 540;
  const FLOOR_Y = 476;
  const PAD_W = 192, PAD_GAP = 40, PAD_H = 20;
  const PAD_Y = FLOOR_Y - 128;
  const PAD_X0 = (W - (4 * PAD_W + 3 * PAD_GAP)) / 2;
  const PADS = [0, 1, 2, 3].map((i) => ({ x: PAD_X0 + i * (PAD_W + PAD_GAP), y: PAD_Y, w: PAD_W, dropT: -1, dy: 0 }));

  const GRAVITY = 1900, WALK_SPEED = 230, ACCEL = 2000, FRICTION = 2200;
  const JUMP_SPEED = 740, MAX_FALL = 900, COYOTE = 0.1, BUFFER = 0.12;
  const PW = 22, PH = 84, FOOT_ROW = 109, SPRITE_CX = 64;

  const READ_MIN = 3, READ_MAX = 8;   // soruyu okuma süresi (sn), metin uzunluğuna göre
  const GRACE = 0.5;                   // ilk 0,5 sn içinde karar verene tam puan (Kahoot gibi)
  const DROP_AT = 0.7, SHOW_AT = 1.3;  // açıklama: yanlış platformların çöküşü ve doğru cevabın gösterimi
  const DEFAULT_TIME = 20;
  const MAX_POINTS = 1000;
  const TIMEOUT_MS = 7000;

  const canvas = document.getElementById('stage');
  const screenCtx = canvas.getContext('2d', { alpha: false });
  let ctx = screenCtx;
  ctx.imageSmoothingEnabled = false;

  const $ = (id) => document.getElementById(id);
  const ui = {
    status: $('status'), start: $('btnStart'), confirm: $('btnConfirm'),
    next: $('btnNext'), restart: $('btnRestart'), load: $('loadLabel'), file: $('fileInput'),
    pause: $('btnPause'), time: $('btnTime'), skip: $('btnSkip'), lock: $('btnLock'), sound: $('btnSound'),
  };

  // ---------------------------------------------------------------------------
  // Görseller
  // ---------------------------------------------------------------------------
  const FRAMES = ['front_idle', 'idle_1', 'walk_1', 'walk_2', 'walk_3', 'walk_4', 'run_1', 'run_2'];
  const img = {};          // img[karakter][kare]
  const CHAR_IDS = QUIZ.CHARACTERS.map((c) => c.id);
  const ANIMS = {
    stand: { frames: ['front_idle'], fps: 1 },
    walk: { frames: ['walk_1', 'walk_2', 'walk_3', 'walk_4'], fps: 8 },
    jump: { frames: ['run_2'], fps: 1 },
    fall: { frames: ['walk_2'], fps: 1 },
  };

  function makeCanvas(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    draw(g);
    return c;
  }
  const rect = (g, color, x, y, w, h) => { g.fillStyle = color; g.fillRect(x, y, w, h); };

  const P = QUIZ.PAL;

  function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

  // 4x4 dama deseni: retro "yarı saydamlık" (alfa yerine dithering)
  const ditherPattern = (() => {
    const c = makeCanvas(4, 4, (g) => { rect(g, P.ink, 0, 0, 2, 2); rect(g, P.ink, 2, 2, 2, 2); });
    return ctx.createPattern(c, 'repeat');
  })();
  const ditherHeavy = (() => {
    const c = makeCanvas(4, 4, (g) => { rect(g, P.ink, 0, 0, 4, 4); g.clearRect(0, 0, 2, 2); });
    return ctx.createPattern(c, 'repeat');
  })();

  // Arka plan: bant bant gün batımı, çizgili güneş, şehir silüeti ve kaldırım.
  const background = makeCanvas(W, H, (g) => {
    // Gökyüzü bantları, aralarında dama geçişli satırlar
    const bands = [
      [P.navy, 0, 120], [P.plum, 120, 70], [P.red, 190, 60], [P.orange, 250, 60], [P.yellow, 310, 60],
    ];
    for (const [c, y, h] of bands) rect(g, c, 0, y, W, h);
    for (let i = 1; i < bands.length; i++) {
      const [upper] = bands[i - 1];
      const y = bands[i][1];
      for (let x = 0; x < W; x += 4) { rect(g, upper, x, y, 2, 2); rect(g, upper, x + 2, y + 4, 2, 2); }
    }
    // Yıldızlar
    const rs = seeded(3);
    for (let i = 0; i < 60; i++) rect(g, rs() > 0.7 ? P.cyan : P.white, Math.floor(rs() * W), Math.floor(rs() * 140), 2, 2);

    // Synthwave güneşi: alta doğru açılan yatay boşluklar
    const sx = 740, sy = 300, r = 92;
    for (let y = -r; y <= r; y += 2) {
      const half = Math.floor(Math.sqrt(r * r - y * y) / 2) * 2;
      const t = (y + r) / (2 * r);
      const col = t < 0.5 ? P.yellow : (t < 0.75 ? P.orange : P.red);
      const gapEvery = 14 - Math.floor(t * 8);
      if (y > -10 && ((y + r) % gapEvery) < Math.max(2, Math.floor(t * 8) - 2)) continue;
      rect(g, col, sx - half, sy + y, half * 2, 2);
    }

    // Uzak ve yakın şehir silüetleri
    function skyline(seed, color, win, minH, maxH, winRate) {
      const rnd = seeded(seed);
      let x = -8;
      while (x < W) {
        const w = 32 + Math.floor(rnd() * 12) * 4;
        const h = minH + Math.floor(rnd() * (maxH - minH) / 4) * 4;
        const top = FLOOR_Y - h;
        rect(g, color, x, top, w, h);
        if (rnd() > 0.6) rect(g, color, x + Math.floor(w / 2) - 2, top - 16, 4, 16);  // anten
        if (win) {
          for (let wy = top + 8; wy < FLOOR_Y - 8; wy += 12) {
            for (let wx = x + 6; wx < x + w - 6; wx += 10) {
              if (rnd() < winRate) rect(g, rnd() > 0.85 ? P.cyan : win, wx, wy, 4, 6);
            }
          }
        }
        x += w + Math.floor(rnd() * 3) * 4;
      }
    }
    skyline(11, P.plum, null, 140, 260, 0);
    skyline(42, P.steel, P.yellow, 90, 210, 0.35);

    // Kaldırım ve sokak
    rect(g, P.silver, 0, FLOOR_Y, W, 4);
    rect(g, P.slate, 0, FLOOR_Y + 4, W, 14);
    for (let x = 0; x < W; x += 32) rect(g, P.steel, x, FLOOR_Y + 4, 2, 14);
    rect(g, P.ink, 0, FLOOR_Y + 18, W, 4);
    rect(g, P.steel, 0, FLOOR_Y + 22, W, H - FLOOR_Y - 22);
    for (let x = 8; x < W; x += 64) rect(g, P.yellow, x, FLOOR_Y + 40, 32, 4);
    rect(g, P.ink, 0, H - 6, W, 6);
  });

  // Gemini'den üretilip temizlenen arayüz görselleri (assets/ui/).
  // Biri yüklenemezse o parça kodla çizilen tasarıma geri döner.
  // 9 parçalı kutular: l/r/t/b = kenar kalınlıkları (görsel pikseli), s = ekrandaki ölçek
  const UI_SPEC = {
    background: { file: 'background' },
    sign0: { file: 'sign_A', l: 12, r: 12, t: 10, b: 13, s: 1 },
    sign1: { file: 'sign_B', l: 12, r: 12, t: 10, b: 13, s: 1 },
    sign2: { file: 'sign_C', l: 12, r: 11, t: 10, b: 13, s: 1 },
    sign3: { file: 'sign_D', l: 12, r: 11, t: 10, b: 13, s: 1 },
    navy: { file: 'window_navy', l: 4, r: 4, t: 5, b: 4, s: 2 },
    dark: { file: 'window_dark', l: 6, r: 6, t: 8, b: 8, s: 2 },
    pad0: { file: 'pad_A', l: 8, r: 5 },
    pad1: { file: 'pad_B', l: 8, r: 5 },
    pad2: { file: 'pad_C', l: 8, r: 5 },
    pad3: { file: 'pad_D', l: 8, r: 5 },
  };
  const ui_img = {};
  const uiReady = Promise.all(Object.entries(UI_SPEC).map(([key, spec]) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { ui_img[key] = im; res(); };
    im.onerror = () => res();
    im.src = 'assets/ui/' + spec.file + '.png';
  })));

  // 9 parçalı çizim: köşeler sabit, kenarlar ve orta uzar
  function drawNine(key, x, y, w, h) {
    const im = ui_img[key], m = UI_SPEC[key];
    if (!im) return false;
    const s = m.s, L = m.l, R = m.r, T = m.t, B = m.b;
    const iw = im.width, ih = im.height;
    const cw = w - (L + R) * s, ch = h - (T + B) * s;
    const d = (sx, sy, sw, sh, dx, dy, dw, dh) => { if (dw > 0 && dh > 0) ctx.drawImage(im, sx, sy, sw, sh, x + dx, y + dy, dw, dh); };
    d(0, 0, L, T, 0, 0, L * s, T * s);
    d(iw - R, 0, R, T, w - R * s, 0, R * s, T * s);
    d(0, ih - B, L, B, 0, h - B * s, L * s, B * s);
    d(iw - R, ih - B, R, B, w - R * s, h - B * s, R * s, B * s);
    d(L, 0, 1, T, L * s, 0, cw, T * s);
    d(L, ih - B, 1, B, L * s, h - B * s, cw, B * s);
    d(0, T, L, 1, 0, T * s, L * s, ch);
    d(iw - R, T, R, 1, w - R * s, T * s, R * s, ch);
    d(L, T, 1, 1, L * s, T * s, cw, ch);
    return true;
  }

  // 3 parçalı platform: uçlar sabit, orta uzar
  function drawThree(key, x, y, w) {
    const im = ui_img[key], m = UI_SPEC[key];
    if (!im) return false;
    const h = im.height;
    ctx.drawImage(im, 0, 0, m.l, h, x, y, m.l, h);
    ctx.drawImage(im, im.width - m.r, 0, m.r, h, x + w - m.r, y, m.r, h);
    ctx.drawImage(im, m.l, 0, 1, h, x + m.l, y, w - m.l - m.r, h);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Oyun durumu
  // ---------------------------------------------------------------------------
  let questions = window.DEFAULT_QUESTIONS.slice();
  let questionSource = 'Varsayılan sorular';
  const players = new Map();      // token -> oyuncu
  let phase = 'connecting';       // connecting | lobby | countdown | question | reveal | leaderboard | final
  let phaseTime = 0;
  let qIndex = -1;
  let qTime = DEFAULT_TIME;
  let qElapsed = 0;
  let roomCode = '';
  let joinUrl = '';
  let qrImage = null;
  let peer = null;
  let elapsed = 0;
  let readTime = 4;
  let paused = false, resumeAt = 0, autoPaused = false;
  let joinLocked = false;
  let revealShown = false;
  let lastTickSec = -1;
  const kicked = new Set();
  const isDouble = () => questions.length >= 3 && qIndex === questions.length - 1;   // son soru 2x puan
  const AUDIO = window.SidarAudio || { sfx() {}, play() {}, stop() {}, unlock() {}, setTempo() {}, toggle() { return false; }, enabled: false };

  const currentQ = () => questions[qIndex];

  function setPhase(p) {
    phase = p;
    phaseTime = 0;
    onPhaseEnter(p);
    updateButtons();
    for (const pl of players.values()) sendStatus(pl);
  }

  function onPhaseEnter(p) {
    if (p === 'lobby') AUDIO.play('lobby');
    else if (p === 'read') { AUDIO.play('question'); AUDIO.setTempo(1); }
    else if (p === 'question') AUDIO.sfx('go');
    else if (p === 'reveal') { AUDIO.stop(); AUDIO.sfx('lock'); revealShown = false; }
    else if (p === 'leaderboard') { AUDIO.sfx('whoosh'); }
    else if (p === 'final') AUDIO.play('fanfare');
  }

  function updateButtons() {
    const show = (el, on) => { el.hidden = !on; };
    const live = phase === 'read' || phase === 'question';
    show(ui.pause, live);
    show(ui.time, phase === 'question');
    show(ui.skip, live);
    ui.pause.textContent = paused ? 'Devam' : 'Duraklat';
    ui.lock.textContent = joinLocked ? 'Katılım: kilitli' : 'Katılım: açık';
    ui.sound.textContent = AUDIO.enabled ? 'Ses: açık' : 'Ses: kapalı';
    show(ui.start, phase === 'lobby');
    show(ui.load, phase === 'lobby');
    show(ui.confirm, phase === 'question');
    show(ui.next, phase === 'reveal' || phase === 'leaderboard');
    show(ui.restart, phase === 'final');
    ui.start.disabled = connectedCount() === 0;
    if (phase === 'reveal') ui.next.textContent = 'Puan tablosu';
    if (phase === 'leaderboard') {
      ui.next.textContent = qIndex + 1 < questions.length ? 'Sonraki soru' : 'Kazananları göster';
    }
  }

  const connectedCount = () => [...players.values()].filter((p) => p.connected).length;

  // ---------------------------------------------------------------------------
  // Ağ (PeerJS) — moderatörün tarayıcısı sunucu görevi görür
  // ---------------------------------------------------------------------------
  function openRoom() {
    roomCode = QUIZ.makeRoomCode();
    peer = new Peer(QUIZ.ROOM_PREFIX + roomCode, QUIZ.peerOptions());

    peer.on('open', () => {
      const base = location.href.split('?')[0].replace(/host\.html$/, '') + 'play.html';
      const params = QUIZ.passthroughParams();
      params.set('room', roomCode);
      joinUrl = base + '?' + params.toString();
      qrImage = makeQr(joinUrl);
      ui.status.textContent = '';
      setPhase('lobby');
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => setupFast(conn));
      conn.on('data', (msg) => onMessage(conn, msg));
      conn.on('close', () => onClose(conn));
      conn.on('error', () => onClose(conn));
    });

    peer.on('disconnected', () => {
      // Sinyal sunucusuyla bağlantı koptu; mevcut oyuncular çalışmaya devam eder,
      // ama yeni oyuncuların katılabilmesi için yeniden bağlan.
      ui.status.textContent = 'Sunucu bağlantısı koptu, yeniden bağlanıyor…';
      setTimeout(() => { if (!peer.destroyed) peer.reconnect(); }, 1000);
    });

    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        peer.destroy();
        openRoom();
        return;
      }
      ui.status.textContent = 'Bağlantı hatası: ' + err.type;
      console.error(err);
    });
  }

  function makeQr(text) {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const scale = Math.max(2, Math.floor(168 / (n + 4)));
    const size = (n + 4) * scale;
    return makeCanvas(size, size, (g) => {
      rect(g, '#ffffff', 0, 0, size, size);
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) if (qr.isDark(r, c)) rect(g, QUIZ.PAL.ink, (c + 2) * scale, (r + 2) * scale, scale, scale);
      }
    });
  }

  // Girdi için ayrı, sırasız ve kayıplı veri kanalı: kaybolan bir paket sonrakileri bekletmez.
  // Her iki taraf da aynı id ile "negotiated" kanal açar; PeerJS'in kendi kanalı olaylar için kalır.
  function setupFast(conn) {
    try {
      const ch = conn.peerConnection.createDataChannel('fast', { negotiated: true, id: 5, ordered: false, maxRetransmits: 0 });
      conn._fast = ch;
      ch.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch (err) { return; }
        const p = conn._player;
        if (!p || p.conn !== conn) return;
        p.lastSeen = performance.now();
        if (m.t === 'i') {
          if (typeof m.s === 'number') {
            if (m.s <= p.lastSeq) return;   // eski paket: at
            p.lastSeq = m.s;
          }
          applyInput(p, m);
        } else if (m.t === 'o') onPong(p, m.ts);
      };
    } catch (e) { conn._fast = null; }
  }

  function sendFast(p, msg) {
    const ch = p.conn && p.conn._fast;
    if (ch && ch.readyState === 'open') {
      try { ch.send(JSON.stringify(msg)); return true; } catch (e) { /* yedek yola düş */ }
    }
    return false;
  }

  function applyInput(p, m) {
    const x = typeof m.x === 'number' && isFinite(m.x) ? Math.max(-1, Math.min(1, m.x)) : undefined;
    const j = !!m.j;
    // Zıplama sayacı: kayıp pakette kısa bir dokunuş kaybolmasın
    if (typeof m.jc === 'number') {
      if (p.lastJc !== null && m.jc > p.lastJc) p.jumpPressed = true;
      if (p.lastJc === null || m.jc > p.lastJc) p.lastJc = m.jc;
    } else if (j && !p.input.j) p.jumpPressed = true;
    p.input = { l: !!m.l, r: !!m.r, j, x };
  }

  function onPong(p, ts) {
    if (typeof ts !== 'number') return;
    const rtt = performance.now() - ts;
    p.rtt = p.rtt ? p.rtt * 0.7 + rtt * 0.3 : rtt;
  }

  // Bağlantı türü (LAN / NAT / TURN): getStats ile seçili aday çifti
  async function pollLink(p) {
    const pc = p.conn && p.conn.peerConnection;
    if (!pc || !pc.getStats) return;
    try {
      const stats = await pc.getStats();
      let pair = null;
      stats.forEach((r) => { if (r.type === 'transport' && r.selectedCandidatePairId) pair = stats.get(r.selectedCandidatePairId); });
      if (!pair) stats.forEach((r) => { if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') pair = r; });
      if (!pair) return;
      const l = stats.get(pair.localCandidateId), r = stats.get(pair.remoteCandidateId);
      if (!l || !r) return;
      if (l.candidateType === 'relay' || r.candidateType === 'relay') {
        const proto = (l.relayProtocol || 'udp').toUpperCase();
        p.link = proto === 'UDP' ? 'TURN' : 'TURN-' + proto;
      } else if (l.candidateType === 'host' && r.candidateType === 'host') p.link = 'LAN';
      else p.link = 'NAT';
    } catch (e) { /* desteklenmiyor */ }
  }

  function send(p, msg) {
    if (p.conn && p.conn.open) {
      try { p.conn.send(msg); } catch (e) { /* bağlantı kapanıyor olabilir */ }
    }
  }

  function onMessage(conn, msg) {
    if (!msg || typeof msg !== 'object') return;
    let p = conn._player;
    if (p) p.lastSeen = performance.now();

    if (msg.t === 'join') {
      const token = String(msg.token || '').slice(0, 40);
      const name = String(msg.name || '').trim().slice(0, 12) || 'Oyuncu';
      const char = CHAR_IDS.includes(msg.char) ? msg.char : CHAR_IDS[0];
      p = players.get(token);
      if (kicked.has(token)) {
        conn.send({ t: 'error', msg: 'Moderatör seni bu oyundan çıkardı.' });
        setTimeout(() => conn.close(), 500);
        return;
      }
      if (!p && joinLocked) {
        conn.send({ t: 'error', msg: 'Moderatör katılımı kilitledi.' });
        setTimeout(() => conn.close(), 500);
        return;
      }
      if (!p) {
        if (players.size >= QUIZ.MAX_PLAYERS) {
          conn.send({ t: 'error', msg: 'Oda dolu (en fazla ' + QUIZ.MAX_PLAYERS + ' oyuncu).' });
          setTimeout(() => conn.close(), 500);
          return;
        }
        p = createPlayer(token, uniqueName(name), char);
        players.set(token, p);
        AUDIO.sfx('join');
      } else if (p.conn && p.conn !== conn) {
        p.conn._player = null;
        try { p.conn.close(); } catch (e) { /* zaten kapalı */ }
      }
      p.char = char;
      p.lastSeq = 0;
      p.lastJc = null;
      p.conn = conn;
      p.connected = true;
      p.lastSeen = performance.now();
      conn._player = p;
      send(p, { t: 'welcome', name: p.name, color: p.color, char: p.char });
      sendStatus(p);
      updateButtons();
      return;
    }

    if (!p) return;
    if (msg.t === 'in') applyInput(p, msg);
    else if (msg.t === 'pong') onPong(p, msg.ts);
  }

  function onClose(conn) {
    const p = conn._player;
    if (p && p.conn === conn) {
      p.connected = false;
      p.input = { l: false, r: false, j: false };
      updateButtons();
    }
  }

  function uniqueName(name) {
    const taken = new Set([...players.values()].map((p) => p.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; ; i++) {
      const n = name.slice(0, 10) + i;
      if (!taken.has(n.toLowerCase())) return n;
    }
  }

  function createPlayer(token, name, char) {
    const used = new Set([...players.values()].map((p) => p.color));
    const color = QUIZ.PLAYER_COLORS.find((c) => !used.has(c)) || QUIZ.PLAYER_COLORS[players.size % 15];
    const p = {
      token, name, color, char, conn: null, connected: false, lastSeen: 0,
      x: 0, y: 0, vx: 0, vy: 0, facing: 1, onGround: false, surface: -2,
      coyote: 0, jumpBuffer: 0, jumpPressed: false,
      input: { l: false, r: false, j: false },
      anim: 'stand', animTime: 0,
      zone: -1, zoneSince: 0,
      score: 0, lastPoints: 0, lastAnswer: -1, streak: 0,
      lastSeq: 0, lastJc: null, rtt: 0, link: '',
      px: 0, py: 0, rx: 0, ry: 0,
    };
    spawn(p, players.size);
    return p;
  }

  function spawn(p, i) {
    const n = Math.max(players.size, 1);
    const slot = (i + 0.5) / Math.max(n, 6);
    p.x = 40 + slot * (W - 80 - PW) + (Math.random() - 0.5) * 30;
    p.x = Math.max(4, Math.min(W - PW - 4, p.x));
    p.y = FLOOR_Y - PH - 40;
    p.vx = 0; p.vy = 0;
    p.px = p.rx = p.x; p.py = p.ry = p.y;
    p.zone = -1; p.zoneSince = 0;
  }

  function rankOf(p) {
    const sorted = [...players.values()].sort((a, b) => b.score - a.score);
    return sorted.indexOf(p) + 1;
  }

  function sendStatus(p) {
    const q = currentQ();
    send(p, {
      t: 'st',
      phase,
      q: qIndex + 1,
      n: questions.length,
      zone: p.zone,
      time: phase === 'question' ? Math.max(0, Math.ceil(qTime - qElapsed)) : 0,
      paused,
      streak: p.streak,
      double: isDouble(),
      score: p.score,
      rank: rankOf(p),
      ping: p.rtt ? Math.round(p.rtt) : null,
      total: players.size,
      // Sonuç telefonda büyük ekrandan önce görünmesin
      last: ((phase === 'reveal' && revealShown) || phase === 'leaderboard') && q
        ? { answer: p.lastAnswer, points: p.lastPoints, correct: q.correct }
        : null,
    });
  }

  // ---------------------------------------------------------------------------
  // Oyun akışı
  // ---------------------------------------------------------------------------
  function startGame() {
    for (const p of players.values()) { p.score = 0; p.lastPoints = 0; p.lastAnswer = -1; p.streak = 0; }
    qIndex = -1;
    requestWakeLock();
    nextQuestion();
  }

  function nextQuestion() {
    qIndex++;
    if (qIndex >= questions.length) { setPhase('final'); return; }
    qTime = Number(currentQ().time) || DEFAULT_TIME;
    qElapsed = 0;
    lastTickSec = -1;
    // Okuma süresi: saniyede ~15 karakter, 3-8 sn arası
    readTime = Math.max(READ_MIN, Math.min(READ_MAX, String(currentQ().q).length / 15));
    for (const pad of PADS) { pad.dropT = -1; pad.dy = 0; }
    paused = false; resumeAt = 0;
    let i = 0;
    for (const p of players.values()) spawn(p, i++);
    setPhase('read');
  }

  function lockAnswers() {
    const q = currentQ();
    for (const p of players.values()) {
      p.lastAnswer = p.zone;
      if (p.zone === q.correct) {
        // Kahoot formülü: en az yarım puan; son kez platforma yerleşme anı sayılır, ilk 0,5 sn tam puan
        const t = Math.min(1, Math.max(0, p.zoneSince - GRACE) / qTime);
        p.lastPoints = Math.round(MAX_POINTS * (1 - 0.5 * t)) * (isDouble() ? 2 : 1);
        p.streak++;
      } else {
        p.lastPoints = 0;
        p.streak = 0;
      }
      p.score += p.lastPoints;
    }
    setPhase('reveal');
  }

  function primaryAction() {
    if (paused) { togglePause(); return; }
    if (phase === 'lobby' && !ui.start.disabled) startGame();
    else if (phase === 'read') { phaseTime = readTime; }              // okumayı kısalt
    else if (phase === 'question') lockAnswers();
    else if (phase === 'reveal' && !revealShown) { phaseTime = SHOW_AT; }   // açıklamayı hızlandır
    else if (phase === 'reveal') setPhase('leaderboard');
    else if (phase === 'leaderboard') nextQuestion();
    else if (phase === 'final') restart();
  }

  function restart() {
    for (const p of players.values()) { p.score = 0; p.lastPoints = 0; p.lastAnswer = -1; p.streak = 0; }
    for (const pad of PADS) { pad.dropT = -1; pad.dy = 0; }
    qIndex = -1;
    let i = 0;
    for (const p of players.values()) spawn(p, i++);
    setPhase('lobby');
  }

  // --- Moderatör kontrolleri ---
  function togglePause() {
    if (!(phase === 'read' || phase === 'question')) return;
    if (paused) { if (!resumeAt) resumeAt = performance.now() + 3000; }   // 3-2-1 ile devam
    else { paused = true; resumeAt = 0; AUDIO.stop(); AUDIO.sfx('pause'); }
    autoPaused = false;
    updateButtons();
    for (const p of players.values()) sendStatus(p);
  }
  function addTime() { if (phase === 'question') { qTime += 10; lastTickSec = -1; } }
  function skipQuestion() {
    if (!(phase === 'read' || phase === 'question')) return;
    for (const p of players.values()) { p.lastPoints = 0; p.lastAnswer = -1; }
    paused = false; resumeAt = 0;
    nextQuestion();
  }
  function toggleLock() { joinLocked = !joinLocked; updateButtons(); }
  function toggleSound() { AUDIO.unlock(); AUDIO.toggle(); if (AUDIO.enabled) onPhaseEnter(phase); updateButtons(); }
  function kick(p) {
    kicked.add(p.token);
    send(p, { t: 'kicked' });
    setTimeout(() => { try { p.conn && p.conn.close(); } catch (e) { /* kapalı */ } }, 300);
    players.delete(p.token);
    updateButtons();
  }
  ui.pause.addEventListener('click', togglePause);
  ui.time.addEventListener('click', addTime);
  ui.skip.addEventListener('click', skipQuestion);
  ui.lock.addEventListener('click', toggleLock);
  ui.sound.addEventListener('click', toggleSound);

  // Karaktere tıklayınca oyundan çıkarma
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
    for (const p of players.values()) {
      if (x >= p.x - 18 && x <= p.x + PW + 18 && y >= p.y - 26 && y <= p.y + PH) {
        if (confirm(`${p.name} oyundan çıkarılsın mı?`)) kick(p);
        return;
      }
    }
  });

  // Sekme gizlenince oyun kendiliğinden duraklar (tarayıcı gizli sekmede çizimi durdurur)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && (phase === 'read' || phase === 'question') && !paused) {
      togglePause();
      autoPaused = true;
    }
    if (document.visibilityState === 'visible') requestWakeLock();
  });

  // Ekran kararmasın (projeksiyon bilgisayarı)
  let wakeLock = null;
  async function requestWakeLock() {
    try { if (navigator.wakeLock && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { /* desteklenmiyor */ }
  }

  // İlk tıklamada sesi aç (tarayıcı kuralı)
  const unlockAudio = () => { if (!AUDIO.running) { AUDIO.unlock(); setTimeout(() => onPhaseEnter(phase), 50); } requestWakeLock(); };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  // Kısayollar
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'KeyP') togglePause();
    else if (e.code === 'KeyT') addTime();
    else if (e.code === 'KeyS') skipQuestion();
    else if (e.code === 'KeyL') toggleLock();
    else if (e.code === 'KeyM') toggleSound();
    else if (e.code === 'KeyC') document.querySelector('.crt').classList.toggle('no-crt');
    else if (e.code === 'KeyZ') { pixelPerfect = !pixelPerfect; resize(); }
  });

  ui.start.addEventListener('click', startGame);
  ui.confirm.addEventListener('click', lockAnswers);
  ui.next.addEventListener('click', primaryAction);
  ui.restart.addEventListener('click', restart);
  window.addEventListener('keydown', (e) => {
    if ((e.code === 'Enter' || e.code === 'Space') && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      primaryAction();
    }
  });

  ui.file.addEventListener('change', async () => {
    const f = ui.file.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const list = Array.isArray(data) ? data : data.questions;
      const problems = validateQuestions(list);
      if (problems) throw new Error(problems);
      questions = list;
      questionSource = f.name + ' (' + list.length + ' soru)';
      ui.status.textContent = 'Sorular yüklendi: ' + questionSource;
    } catch (err) {
      ui.status.textContent = 'Dosya okunamadı: ' + err.message;
    }
    ui.file.value = '';
  });

  function validateQuestions(list) {
    if (!Array.isArray(list) || list.length === 0) return 'soru listesi boş';
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      if (!q || typeof q.q !== 'string') return `${i + 1}. soruda "q" metni yok`;
      if (!Array.isArray(q.answers) || q.answers.length !== 4) return `${i + 1}. soruda 4 cevap olmalı`;
      if (![0, 1, 2, 3].includes(q.correct)) return `${i + 1}. soruda "correct" 0-3 arası olmalı`;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Fizik
  // ---------------------------------------------------------------------------
  const approach = (v, t, a) => (v < t ? Math.min(v + a, t) : Math.max(v - a, t));
  const canMove = () => !paused && (phase === 'lobby' || phase === 'read' || phase === 'question');

  function updatePlayer(p, dt) {
    const inp = canMove() && p.connected ? p.input : { l: false, r: false, j: false };
    if (!canMove()) p.jumpPressed = false;
    // Analog çubuk: x = -1..1 (hız orantılı); eski tuşlu istemciler için l/r
    const dir = typeof inp.x === 'number' ? Math.max(-1, Math.min(1, inp.x)) : (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
    if (dir) { p.vx = approach(p.vx, dir * WALK_SPEED, ACCEL * dt); p.facing = Math.sign(dir); }
    else p.vx = approach(p.vx, 0, FRICTION * dt);

    p.coyote = p.onGround ? COYOTE : p.coyote - dt;
    p.jumpBuffer = p.jumpPressed ? BUFFER : p.jumpBuffer - dt;
    p.jumpPressed = false;
    if (p.jumpBuffer > 0 && p.coyote > 0) { p.vy = -JUMP_SPEED; p.coyote = 0; p.jumpBuffer = 0; }
    if (!inp.j && p.vy < -JUMP_SPEED * 0.45) p.vy = -JUMP_SPEED * 0.45;
    p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL);

    p.x = Math.max(0, Math.min(W - PW, p.x + p.vx * dt));

    const prevBottom = p.y + PH;
    p.y += p.vy * dt;
    p.onGround = false;
    p.surface = -2;
    if (p.vy >= 0) {
      const bottom = p.y + PH;
      for (let i = 0; i < PADS.length; i++) {
        const pad = PADS[i];
        if (pad.dropT >= 0) continue;   // çöken platform artık zemin değil
        const cx = p.x + PW / 2;
        if (cx >= pad.x && cx <= pad.x + pad.w && prevBottom <= pad.y + 1 && bottom >= pad.y) {
          p.y = pad.y - PH; p.vy = 0; p.onGround = true; p.surface = i;
          break;
        }
      }
      if (!p.onGround && p.y + PH >= FLOOR_Y) {
        p.y = FLOOR_Y - PH; p.vy = 0; p.onGround = true; p.surface = -1;
      }
    }

    // Hangi cevabın üstünde? Sadece platformda dururken sayılır.
    if (phase === 'question') {
      const zone = p.onGround ? (p.surface >= 0 ? p.surface : -1) : p.zone;
      if (zone !== p.zone) {
        p.zone = zone;
        p.zoneSince = qElapsed;
        sendStatus(p);
      }
    }

    let anim;
    if (!p.onGround) anim = p.vy < 0 ? 'jump' : 'fall';
    else if (Math.abs(p.vx) > 15) anim = 'walk';
    else anim = 'stand';
    if (anim !== p.anim) { p.anim = anim; p.animTime = 0; }
    p.animTime += dt;
  }

  // ---------------------------------------------------------------------------
  // Çizim yardımcıları (piksel tarzı)
  // ---------------------------------------------------------------------------
  const FT = (s) => `${s}px ${QUIZ.FONT_TITLE}`;
  const FB = (s, bold = true) => `${bold ? 700 : 400} ${s}px ${QUIZ.FONT_BODY}`;
  const blink = (rate = 2) => Math.floor(elapsed * rate) % 2 === 0;
  const CYCLE = [P.yellow, P.orange, P.red, P.cyan, P.lime];
  const cycle = (rate = 6, offset = 0) => CYCLE[(Math.floor(elapsed * rate) + offset) % CYCLE.length];

  // Sert gölgeli metin (yumuşak gölge yok)
  function text(str, x, y, font, color, align = 'left', shadow = P.ink, off = 2) {
    // Press Start 2P büyük İ'yi küçük i gibi çiziyor; başlık fontunda düz I kullan
    if (font.includes('Press Start')) str = String(str).replace(/İ/g, 'I');
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    x = Math.round(x); y = Math.round(y);
    if (shadow) { ctx.fillStyle = shadow; ctx.fillText(str, x + off, y + off); }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function wrap(str, maxW, font) {
    ctx.font = font;
    const words = String(str).split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  // Metni kutuya sığana kadar küçült (piksel fontlar için 2'şer adım)
  const fitCache = new Map();
  function fitText(str, maxW, maxH, startSize, minSize, fontFn = FB) {
    const key = `${str}|${maxW}|${maxH}|${startSize}|${minSize}|${fontFn === FT ? 't' : 'b'}`;
    let hit = fitCache.get(key);
    if (!hit) {
      hit = fitTextRaw(str, maxW, maxH, startSize, minSize, fontFn);
      if (fitCache.size > 500) fitCache.clear();
      fitCache.set(key, hit);
    }
    return hit;
  }
  function fitTextRaw(str, maxW, maxH, startSize, minSize, fontFn) {
    for (let s = startSize; s >= minSize; s -= 2) {
      const lines = wrap(str, maxW, fontFn(s));
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
      if (lines.length * s * 1.15 <= maxH && widest <= maxW) return { lines, size: s };
    }
    const lines = wrap(str, maxW, fontFn(minSize));
    return { lines: lines.slice(0, Math.max(1, Math.floor(maxH / (minSize * 1.15)))), size: minSize };
  }

  // Köşeleri kırık piksel kutu
  function box(x, y, w, h, color, notch = 2) {
    ctx.fillStyle = color;
    ctx.fillRect(x + notch, y, w - notch * 2, h);
    ctx.fillRect(x, y + notch, w, h - notch * 2);
  }

  // SNES RPG tarzı çift çerçeveli pencere
  function windowBox(x, y, w, h, fill, opts = {}) {
    if (!opts.plain) {
      if (fill === P.navy && drawNine('navy', x, y, w, h)) return;
      if (fill === P.ink && drawNine('dark', x, y, w, h)) return;
    }
    const border = opts.border || P.white;
    box(x, y, w, h, P.ink, 6);
    box(x + 2, y + 2, w - 4, h - 4, border, 4);
    box(x + 6, y + 6, w - 12, h - 12, P.ink, 2);
    box(x + 8, y + 8, w - 16, h - 16, fill, 0);
    if (opts.light) rect(ctx, opts.light, x + 8, y + 8, w - 16, 4);
    if (opts.dark) rect(ctx, opts.dark, x + 8, y + h - 14, w - 16, 6);
  }

  function dither(x, y, w, h, heavy) {
    ctx.fillStyle = heavy ? ditherHeavy : ditherPattern;
    ctx.fillRect(x, y, w, h);
  }

  const pad6 = (n) => String(Math.max(0, n)).padStart(6, '0');

  // ---------------------------------------------------------------------------
  // Çizim
  // ---------------------------------------------------------------------------
  function drawPad(i) {
    const pad = PADS[i], a = QUIZ.ANSWERS[i];
    const x = pad.x, y = Math.round(pad.y + pad.dy), w = pad.w;
    if (y > H) return;
    // Destek ayakları (platform çökerken onlar da düşer)
    const legH = FLOOR_Y - pad.y - PAD_H;
    for (const lx of [x + 12, x + w - 18]) {
      rect(ctx, P.ink, lx, y + PAD_H - 2, 6, legH + 2);
      rect(ctx, a.light, lx + 2, y + PAD_H - 2, 2, legH + 2);
    }
    if (!drawThree('pad' + i, x, y, w)) {
      box(x - 2, y - 2, w + 4, PAD_H + 4, P.ink, 2);
      rect(ctx, a.color, x, y, w, PAD_H);
      rect(ctx, a.light, x, y, w, 4);
      rect(ctx, a.dark, x, y + PAD_H - 6, w, 6);
    }
    // Büyük harf rozeti: renk körü ve uzaktaki izleyici için rengin yanında ikinci işaret
    const bw = 36, bh = 32, bx = x + w / 2 - bw / 2, by = y + PAD_H / 2 - bh / 2 + 4;
    box(bx - 2, by - 2, bw + 4, bh + 4, P.ink, 4);
    box(bx, by, bw, bh, a.color, 2);
    rect(ctx, a.light, bx + 2, by, bw - 4, 3);
    text(a.letter, bx + bw / 2, by + bh - 7, FT(16), a.text, 'center', a.text === P.ink ? null : a.dark);
    // Canlı oyuncu sayısı (soru ve açıklama aşamasında)
    if (phase === 'question' || phase === 'reveal') {
      const n = phase === 'question' ? zoneCount[i] : answerCount[i];
      if (n > 0) {
        const label = 'x' + n;
        const cw = 14 + label.length * 10, cx = x + w - cw - 6, cy = y - 22;
        box(cx, cy, cw, 18, P.ink, 2);
        text(label, cx + cw / 2, cy + 14, FT(10), P.white, 'center', null);
      }
    }
  }

  // Cevap tabelası (platformun üstünde, daha küçük)
  const SIGN_W = 168, SIGN_H = 84, SIGN_Y = 104;
  function drawSign(i, dim, highlight) {
    const q = currentQ(), pad = PADS[i], a = QUIZ.ANSWERS[i];
    const bw = SIGN_W, bh = SIGN_H, bx = pad.x + (pad.w - bw) / 2, by = SIGN_Y;
    // Direk
    rect(ctx, P.ink, bx + bw / 2 - 4, by + bh - 4, 8, pad.y - by - bh + 4);
    rect(ctx, P.slate, bx + bw / 2 - 2, by + bh - 4, 2, pad.y - by - bh + 4);

    if (!drawNine('sign' + i, bx, by, bw, bh)) {
      windowBox(bx, by, bw, bh, a.color, { border: P.white, light: a.light, dark: a.dark, plain: true });
    }
    const shadow = a.text === P.ink ? null : a.dark;
    text(a.letter, bx + 18, by + 26, FT(10), a.text, 'left', shadow);
    const fit = fitText(q.answers[i], bw - 32, 40, 22, 12);
    const block = fit.lines.length * fit.size * 1.15;
    const top = by + 28 + (40 - block) / 2;
    fit.lines.forEach((ln, k) => text(ln, bx + bw / 2, top + fit.size * 0.9 + k * fit.size * 1.15, FB(fit.size), a.text, 'center', shadow));
    if (dim) dither(bx, by, bw, bh, true);
  }

  // Doğru cevabın yanıp sönen çerçevesi (her karede, önbelleğin üstüne)
  function drawHighlight(i) {
    if (!revealShown) return;
    const pad = PADS[i], bw = SIGN_W, bh = SIGN_H, bx = pad.x + (pad.w - bw) / 2, by = SIGN_Y;
    const c = blink(6) ? P.white : P.yellow;
    rect(ctx, c, bx - 6, by - 6, bw + 12, 4);
    rect(ctx, c, bx - 6, by + bh + 2, bw + 12, 4);
    rect(ctx, c, bx - 6, by - 2, 4, bh + 4);
    rect(ctx, c, bx + bw + 2, by - 2, 4, bh + 4);
  }

  function drawPlayer(p) {
    const a = ANIMS[p.anim];
    const frame = a.frames[Math.floor(p.animTime * a.fps) % a.frames.length];
    const im = img[p.char][frame];
    const sx = Math.round(p.rx + PW / 2);
    const sy = Math.round(p.ry + PH - FOOT_ROW);
    // Ayak altı gölgesi
    if (p.onGround) rect(ctx, P.ink, sx - 14, Math.round(p.ry + PH) - 2, 28, 2);
    if (p.facing < 0 && p.anim !== 'stand') {
      ctx.save(); ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.drawImage(im, -SPRITE_CX, sy); ctx.restore();
    } else {
      ctx.drawImage(im, sx - SPRITE_CX, sy);
    }
    if (!p.connected) dither(sx - 24, sy + 18, 48, FOOT_ROW - 18, false);
  }

  // İsim etiketleri bir kez çizilip saklanır (her karede metin ölçmek yerine)
  const tagCache = new Map();
  function tagImage(p) {
    const col = p.connected ? p.color : P.slate;
    const key = `${p.name}|${col}`;
    let c = tagCache.get(key);
    if (c) return c;
    ctx.font = FB(16);
    const w = Math.ceil(ctx.measureText(p.name).width / 2) * 2 + 14;
    c = makeCanvas(w + 4, 26, (g) => {
      const prev = ctx; ctx = g;
      try {
        box(0, 0, w + 4, 22, P.ink, 2);
        rect(g, col, 2, 2, w, 18);
        rect(g, P.ink, (w + 4) / 2 - 4, 22, 8, 2);
        rect(g, P.ink, (w + 4) / 2 - 2, 24, 4, 2);
        text(p.name, (w + 4) / 2, 16, FB(16), QUIZ.textColorFor(col), 'center', null);
      } finally { ctx = prev; }
    });
    if (tagCache.size > 200) tagCache.clear();
    tagCache.set(key, c);
    return c;
  }

  function drawTag(p) {
    const sx = Math.round(p.rx + PW / 2);
    const top = Math.round(p.ry) - 4;
    const t = tagImage(p);
    ctx.drawImage(t, sx - Math.floor(t.width / 2), top - 22);
    // Doğru cevap serisi: puan değil, rozet (Kahoot'ta motivasyonu en çok rozet artırıyor)
    let above = top - 28;
    if (p.streak >= 2 && phase !== 'lobby') {
      const label = 'SERİ ' + p.streak;
      text(label, sx, above, FT(8), P.yellow, 'center');
      above -= 14;
    }
    if (phase === 'reveal' && revealShown) {
      const rise = Math.min(1, (phaseTime - SHOW_AT) / 0.4) * 10;
      if (p.lastPoints > 0) text('+' + p.lastPoints, sx, above - rise, FT(12), P.lime, 'center');
      else text('X', sx, above - rise, FT(16), P.red, 'center', P.ink);
    }
  }

  const BOX_H = 88, TIMER_W = 104;
  function drawQuestionBox(part) {
    const q = currentQ();
    const showTimer = phase === 'question';
    const tx = W - 16 - TIMER_W, cx = tx + TIMER_W / 2;
    if (part === 'timer') {
      if (phase === 'read') {
        // Okuma süresi: cevaplar henüz kapalı
        const k = Math.min(1, phaseTime / readTime);
        text('OKU', cx, 64, FT(16), blink(3) ? P.yellow : P.white, 'center');
        rect(ctx, P.steel, cx - 36, 70, 72, 8);
        rect(ctx, P.cyan, cx - 36, 70, Math.round(72 * (1 - k)), 8);
      } else if (showTimer) {
        const left = Math.max(0, qTime - qElapsed);
        const urgent = left <= 5;
        text(String(Math.ceil(left)).padStart(2, '0'), cx, 64, FT(20), urgent && blink(4) ? P.red : P.white, 'center');
        const segs = 8, filled = Math.ceil((left / qTime) * segs);
        for (let s = 0; s < segs; s++) {
          const col = s >= filled ? P.steel : (filled <= 2 ? P.red : filled <= 5 ? P.yellow : P.lime);
          rect(ctx, col, cx - 36 + s * 9, 70, 7, 8);
        }
      } else {
        text('--', cx, 64, FT(20), P.slate, 'center');
      }
      return;
    }
    const qw = W - 32 - TIMER_W - 8;
    windowBox(16, 8, qw, BOX_H, P.navy, { light: P.blue });
    text(`SORU ${qIndex + 1}/${questions.length}`, 32, 34, FT(10), P.yellow);
    if (isDouble()) text('SON SORU · 2X PUAN', qw + 4, 34, FT(10), P.lime, 'right');
    const fit = fitText(q.q, qw - 36, 44, 28, 14);
    const block = fit.lines.length * fit.size * 1.15;
    const top = 40 + (44 - block) / 2;
    fit.lines.forEach((ln, k) => text(ln, 32, top + fit.size * 0.9 + k * fit.size * 1.15, FB(fit.size), P.white));

    // Süre penceresi (çerçeve; içerik her karede ayrıca çizilir)
    windowBox(tx, 8, TIMER_W, BOX_H, P.ink);
    text('SÜRE', cx, 36, FT(8), P.silver, 'center', null);
  }

  function drawLogo(x, y, size) {
    const shadows = [[6, P.ink], [4, P.red], [2, P.orange]];
    for (const line of [['SİDAR', 0], ['QUIZ', 1]]) {
      const ly = y + line[1] * (size + 12);
      for (const [o, c] of shadows) text(line[0], x + o, ly + o, FT(size), c, 'left', null);
      text(line[0], x, ly, FT(size), P.yellow, 'left', null);
    }
  }

  function drawLobby() {
    const LH = 196;
    windowBox(16, 8, W - 32, LH, P.navy, { light: P.blue });
    drawLogo(36, 50, 28);
    text('Katılmak için telefonunla QR kodu okut', 36, 110, FB(18), P.white);
    text(`ODA ${roomCode}`, 36, 146, FT(16), P.cyan);
    text(`OYUNCU ${connectedCount()}/${QUIZ.MAX_PLAYERS}`, 300, 146, FT(12), P.white);
    text(`${questionSource} · ${questions.length} soru`, 36, 172, FB(16, false), P.silver);

    if (qrImage) {
      const s = qrImage.width;
      const qx = W - 32 - s - 12, qy = 8 + (LH - s - 12) / 2;
      windowBox(qx, qy, s + 12, s + 12, P.white, { border: P.white, plain: true });
      ctx.drawImage(qrImage, qx + 6, qy + 6);
    }
  }

  function drawLeaderboard() {
    dither(0, 0, W, H, true);
    windowBox(80, 16, W - 160, H - 32, P.ink, { border: P.white });
    text('EN YÜKSEK SKORLAR', W / 2, 66, FT(24), cycle(5), 'center');
    text('SIRA', 124, 100, FT(10), P.silver, 'left', null);
    text('İSİM', 220, 100, FT(10), P.silver, 'left', null);
    text('SKOR', W - 130, 100, FT(10), P.silver, 'right', null);
    const list = [...players.values()].sort((a, b) => b.score - a.score);
    const before = [...players.values()].sort((a, b) => (b.score - b.lastPoints) - (a.score - a.lastPoints));
    const rowH = Math.min(30, 400 / Math.max(list.length, 1));
    const medal = [P.yellow, P.silver, P.orange];
    const k = Math.min(1, phaseTime / 1.2);   // puanlar 1,2 sn içinde sayarak artar
    list.forEach((p, i) => {
      const y = 112 + i * rowH;
      const fs = rowH >= 26 ? 14 : 10;
      const col = medal[i] || P.white;
      text(`${i + 1}.`, 124, y + rowH * 0.7, FT(fs), col);
      // Sıra değişimi oku
      const moved = before.indexOf(p) - i;
      if (moved !== 0 && qIndex > 0) {
        const ax = 172, ay = Math.round(y + rowH / 2);
        const c = moved > 0 ? P.lime : P.red, d = moved > 0 ? -1 : 1;
        rect(ctx, c, ax - 1, ay - 1 * d, 2, 2);
        rect(ctx, c, ax - 3, ay + 1 * d, 6, 2);
        rect(ctx, c, ax - 5, ay + 3 * d, 10, 2);
      }
      box(196, y + rowH / 2 - 7, 14, 14, P.ink, 2);
      rect(ctx, p.color, 198, y + rowH / 2 - 5, 10, 10);
      text(p.name, 220, y + rowH * 0.72, FB(Math.min(24, rowH - 4)), col);
      if (p.streak >= 2) text('SERİ ' + p.streak, W - 380, y + rowH * 0.7, FT(8), P.yellow, 'right');
      if (p.lastPoints) text('+' + p.lastPoints, W - 300, y + rowH * 0.7, FT(fs - 2), P.lime, 'right');
      const shown = Math.round(p.score - p.lastPoints * (1 - k));
      text(pad6(shown), W - 130, y + rowH * 0.7, FT(fs), col, 'right');
    });
  }

  function drawFinal() {
    dither(0, 0, W, H, true);
    text('TEBRİKLER!', W / 2, 70, FT(32), cycle(6), 'center');
    const list = [...players.values()].sort((a, b) => b.score - a.score);
    const podium = [
      { i: 1, x: W / 2 - 220, h: 110, col: P.silver, dark: P.slate },
      { i: 0, x: W / 2, h: 160, col: P.yellow, dark: P.orange },
      { i: 2, x: W / 2 + 220, h: 80, col: P.orange, dark: P.red },
    ];
    const baseY = FLOOR_Y;
    for (const s of podium) {
      const p = list[s.i];
      box(s.x - 82, baseY - s.h - 2, 164, s.h + 2, P.ink, 2);
      rect(ctx, s.col, s.x - 80, baseY - s.h, 160, s.h);
      rect(ctx, P.white, s.x - 80, baseY - s.h, 160, 4);
      rect(ctx, s.dark, s.x - 80, baseY - 10, 160, 10);
      text(String(s.i + 1), s.x, baseY - s.h / 2 + 18, FT(40), P.ink, 'center', s.dark, 4);
      if (!p) continue;
      ctx.drawImage(img[p.char].front_idle, s.x - 64, baseY - s.h - FOOT_ROW);
      const ny = baseY - s.h - 96;
      ctx.font = FB(20);
      const w = Math.ceil(ctx.measureText(p.name).width / 2) * 2 + 18;
      box(s.x - w / 2 - 2, ny - 22, w + 4, 30, P.ink, 2);
      rect(ctx, p.color, s.x - w / 2, ny - 20, w, 26);
      text(p.name, s.x, ny, FB(20), QUIZ.textColorFor(p.color), 'center', null);
      text(pad6(p.score), s.x, baseY + 34, FT(14), s.col, 'center');
    }
    const rest = list.slice(3).map((p, k) => `${k + 4}. ${p.name} ${pad6(p.score)}`).join('   ');
    if (rest) {
      const fit = fitText(rest, W - 80, 40, 18, 12);
      fit.lines.forEach((ln, k) => text(ln, W / 2, 520 + (k - fit.lines.length + 1) * fit.size * 1.15, FB(fit.size, false), P.silver, 'center'));
    }
  }

  // Değişmeyen katman (arka plan, tabelalar, platformlar, soru kutusu) bir kez çizilip saklanır.
  // Sadece aşama ya da soru değişince yeniden çizilir.
  const staticLayer = document.createElement('canvas');
  staticLayer.width = W; staticLayer.height = H;
  const staticCtx = staticLayer.getContext('2d');
  staticCtx.imageSmoothingEnabled = false;
  let staticKey = '';

  function drawStatic() {
    const q = currentQ();
    ctx.drawImage(ui_img.background || background, 0, 0, W, H);
    const answersOpen = phase === 'question' || phase === 'reveal';
    if (answersOpen) for (let i = 0; i < 4; i++) drawSign(i, phase === 'reveal' && i !== q.correct);
    if (phase === 'read' || answersOpen) drawQuestionBox('static');
    if (phase === 'lobby') drawLobby();
  }

  // Platform başına oyuncu sayıları (her karede, tek döngüde)
  const zoneCount = [0, 0, 0, 0], answerCount = [0, 0, 0, 0];
  const drawList = [];

  function drawScene() {
    const inQuestion = phase === 'read' || phase === 'question' || phase === 'reveal';
    const lobbyKey = phase === 'lobby' ? `${roomCode}|${connectedCount()}|${questionSource}|${qrImage ? 1 : 0}` : '';
    const key = `${phase}|${inQuestion ? qIndex : -1}|${questions.length}|${lobbyKey}`;
    if (key !== staticKey) {
      ctx = staticCtx;
      try { drawStatic(); } finally { ctx = screenCtx; }
      staticKey = key;
    }
    ctx.drawImage(staticLayer, 0, 0);
    if (phase === 'reveal') drawHighlight(currentQ().correct);

    zoneCount.fill(0); answerCount.fill(0);
    drawList.length = 0;
    for (const p of players.values()) {
      if (p.zone >= 0) zoneCount[p.zone]++;
      if (p.lastAnswer >= 0) answerCount[p.lastAnswer]++;
      drawList.push(p);
    }
    for (let i = 0; i < 4; i++) drawPad(i);
    // y'ye göre sırala (yerinde, yeni dizi üretmeden)
    for (let i = 1; i < drawList.length; i++) {
      const v = drawList[i]; let j = i - 1;
      while (j >= 0 && drawList[j].ry > v.ry) { drawList[j + 1] = drawList[j]; j--; }
      drawList[j + 1] = v;
    }
    for (const p of drawList) drawPlayer(p);
    for (const p of drawList) drawTag(p);

    if (phase === 'connecting') {
      dither(0, 0, W, H, true);
      if (blink(2)) text('YÜKLENİYOR...', W / 2, H / 2, FT(24), P.white, 'center');
    } else if (phase === 'lobby') {
      // Lobi penceresi önbellekte; sadece yanıp sönen yazı her karede
      if (blink(2)) {
        if (connectedCount() === 0) text('OYUNCULAR BEKLENİYOR', 36, 194, FT(10), P.yellow);
        else text('BAŞLAMAK İÇİN ENTER', 36, 194, FT(10), P.lime);
      }
    } else if (inQuestion) {
      drawQuestionBox('timer');
      if (phase === 'read') {
        text('CEVAPLAR BİRAZDAN AÇILIYOR', W / 2, 160, FT(12), blink(2) ? P.white : P.cyan, 'center');
        if (isDouble()) text('2X PUAN!', W / 2, 200, FT(24), cycle(8), 'center');
      }
    } else if (phase === 'leaderboard') drawLeaderboard();
    else if (phase === 'final') drawFinal();

    if (paused) {
      dither(0, 0, W, H, true);
      if (resumeAt) {
        const n = Math.max(1, Math.ceil((resumeAt - performance.now()) / 1000));
        text(String(n), W / 2, 320, FT(64), P.white, 'center');
      } else {
        text('DURAKLATILDI', W / 2, 270, FT(24), P.yellow, 'center');
        text(autoPaused ? 'Sekme gizlendiği için durdu · devam için P' : 'Devam için P ya da Enter', W / 2, 310, FB(18), P.white, 'center');
      }
    }
    if (showDebug) drawDebug();
  }

  // Tanı ekranı: F tuşu ya da ?debug=1 — FPS ve oyuncuların gecikmesi
  let showDebug = new URLSearchParams(location.search).get('debug') === '1';
  const frameTimes = [];
  function drawDebug() {
    const avg = frameTimes.reduce((a, b) => a + b, 0) / Math.max(1, frameTimes.length);
    const worst = Math.max(0, ...frameTimes);
    const list = [...players.values()];
    const h = 40 + list.length * 14;
    rect(ctx, P.ink, 8, H - h - 8, 280, h);
    text(`FPS ${Math.round(1000 / Math.max(1, avg))}  EN KÖTÜ ${Math.round(worst)}ms`, 16, H - h + 10, FT(8), P.lime, 'left', null);
    text('OYUNCU      PING  BAĞLANTI', 16, H - h + 26, FT(8), P.silver, 'left', null);
    list.forEach((p, i) => {
      const ping = p.bot ? 'BOT' : (p.rtt ? Math.round(p.rtt) + 'ms' : '...') + (p.link ? ' ' + p.link : '');
      const col = !p.connected ? P.slate : p.rtt > 150 ? P.red : p.rtt > 80 ? P.yellow : P.white;
      text(`${p.name.slice(0, 10).padEnd(12, ' ')}${ping}`, 16, H - h + 40 + i * 14, FT(8), col, 'left', null);
    });
  }
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyF') showDebug = !showDebug; });

  // ---------------------------------------------------------------------------
  // Ana döngü
  // ---------------------------------------------------------------------------
  let last = 0;
  let statusTick = 0;

  const STEP = 1 / 60;   // fizik her zaman saniyede 60 adım: FPS düşse de oyun hızı değişmez
  let acc = 0;
  let pingTick = 0;

  function step(dt) {
    elapsed += dt;
    if (paused) {
      if (resumeAt && performance.now() >= resumeAt) {
        paused = false; resumeAt = 0; autoPaused = false;
        AUDIO.play('question');
        updateButtons();
        for (const p of players.values()) sendStatus(p);
      }
      return;
    }
    phaseTime += dt;
    if (phase === 'read' && phaseTime >= readTime) setPhase('question');
    if (phase === 'question') {
      qElapsed += dt;
      // Son 5 saniye: tik sesleri ve hızlanan müzik
      const left = Math.ceil(qTime - qElapsed);
      if (left !== lastTickSec) {
        lastTickSec = left;
        if (left <= 5 && left > 0) { AUDIO.sfx('tickFast'); AUDIO.setTempo(1.3); }
      }
      if (qElapsed >= qTime) lockAnswers();
    }
    if (phase === 'reveal') {
      const q = currentQ();
      if (phaseTime >= DROP_AT && PADS.every((pd) => pd.dropT < 0)) {
        PADS.forEach((pd, i) => { if (i !== q.correct) pd.dropT = 0; });
        AUDIO.sfx('crumble');
      }
      if (phaseTime >= SHOW_AT && !revealShown) {
        revealShown = true;
        const anyCorrect = [...players.values()].some((p) => p.lastPoints > 0);
        AUDIO.sfx(anyCorrect ? 'correct' : 'wrong');
        for (const p of players.values()) sendStatus(p);
      }
    }
    for (const pd of PADS) {
      if (pd.dropT >= 0) { pd.dropT += dt; pd.dy = 0.5 * 1600 * Math.max(0, pd.dropT - 0.15) ** 2; }
    }
    for (const p of players.values()) {
      p.px = p.x; p.py = p.y;
      updatePlayer(p, dt);
    }
  }

  let linkTick = 0;
  function frame(now) {
    const frameDt = Math.min((now - last) / 1000 || 0, 0.25);
    last = now;
    frameTimes.push(frameDt * 1000);
    if (frameTimes.length > 60) frameTimes.shift();

    acc += frameDt;
    let steps = 0;
    while (acc >= STEP && steps < 8) { step(STEP); acc -= STEP; steps++; }
    if (steps === 8) acc = 0;   // çok gerideysek yetişmeye çalışma
    // Ara kare: fizik 60 Hz, ekran daha hızlıysa (120/144 Hz) konumlar arası yumuşak geçiş
    const alpha = acc / STEP;
    for (const p of players.values()) {
      p.rx = p.px + (p.x - p.px) * alpha;
      p.ry = p.py + (p.y - p.py) * alpha;
    }

    // Sessiz kalan bağlantıları kopmuş say
    const nowMs = performance.now();
    for (const p of players.values()) {
      if (p.connected && nowMs - p.lastSeen > TIMEOUT_MS) {
        p.connected = false;
        p.input = { l: false, r: false, j: false };
        updateButtons();
      }
    }

    statusTick += frameDt;
    if (statusTick >= 1) {
      statusTick = 0;
      for (const p of players.values()) sendStatus(p);
    }
    // Ping: saniyede bir, mümkünse hızlı kanaldan (gerçek oyun gecikmesini ölçer)
    pingTick += frameDt;
    if (pingTick >= 1) {
      pingTick = 0;
      const ts = performance.now();
      for (const p of players.values()) if (!sendFast(p, { t: 'ping', ts })) send(p, { t: 'ping', ts });
    }
    linkTick += frameDt;
    if (linkTick >= 3) { linkTick = 0; for (const p of players.values()) pollLink(p); }

    drawScene();
    requestAnimationFrame(frame);
  }

  let pixelPerfect = false;   // Z: tam sayı ölçek (keskin) / ekranı doldur
  function resize() {
    const barH = document.getElementById('bar').offsetHeight || 64;
    let s = Math.min(window.innerWidth / W, (window.innerHeight - barH) / H);
    if (pixelPerfect && s >= 1) {
      const dpr = window.devicePixelRatio || 1;
      s = Math.floor(s * dpr) / dpr;
    }
    canvas.style.width = Math.floor(W * s) + 'px';
    canvas.style.height = Math.floor(H * s) + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  const fontsReady = Promise.all([
    document.fonts.load(`16px ${QUIZ.FONT_TITLE}`, 'AİŞĞÜÖÇ'),
    document.fonts.load(`700 16px ${QUIZ.FONT_BODY}`, 'AİŞĞÜÖÇ'),
    document.fonts.load(`400 16px ${QUIZ.FONT_BODY}`, 'AİŞĞÜÖÇ'),
  ]).catch(() => null);

  const spriteLoads = [];
  for (const cid of CHAR_IDS) {
    img[cid] = {};
    for (const name of FRAMES) {
      spriteLoads.push(new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => { img[cid][name] = im; res(); };
        im.onerror = () => rej(new Error(cid + '/' + name));
        im.src = 'assets/sprites/' + cid + '/' + name + '.png';
      }));
    }
  }
  Promise.all([fontsReady, uiReady, ...spriteLoads]).then(() => {
    openRoom();
    requestAnimationFrame((t) => { last = t; frame(t); });
  }).catch((e) => { ui.status.textContent = 'Görsel yüklenemedi: ' + e.message; });

  // Yük testi: adrese ?bots=15 eklenirse sahte oyuncular katılır ve rastgele dolaşır
  const BOTS = Math.min(QUIZ.MAX_PLAYERS, Number(new URLSearchParams(location.search).get('bots')) || 0);
  if (BOTS) {
    const names = ['Ada', 'Bora', 'Cem', 'Defne', 'Ece', 'Fırat', 'Gül', 'Hakan', 'Işıl', 'Jale', 'Kaan', 'Lale', 'Mert', 'Nil', 'Oya'];
    const addBots = () => {
      for (let i = 0; i < BOTS; i++) {
        const p = createPlayer('bot' + i, names[i], CHAR_IDS[i % CHAR_IDS.length]);
        p.connected = true; p.bot = true;
        players.set(p.token, p);
      }
      updateButtons();
      setInterval(() => {
        for (const p of players.values()) {
          if (!p.bot) continue;
          p.lastSeen = performance.now();
          const r = Math.random();
          const x = r < 0.35 ? -1 : r < 0.7 ? 1 : 0;
          const j = Math.random() < 0.3;
          if (j && !p.input.j) p.jumpPressed = true;
          p.input = { l: x < 0, r: x > 0, j, x };
        }
      }, 400);
    };
    const wait = setInterval(() => { if (phase === 'lobby') { clearInterval(wait); addBots(); } }, 100);
  }

  // Testler için
  window.__host = {
    get phase() { return phase; }, get room() { return roomCode; }, get joinUrl() { return joinUrl; },
    get players() { return [...players.values()].map((p) => ({ name: p.name, zone: p.zone, score: p.score, connected: p.connected, x: p.x, y: p.y })); },
    pads: PADS, primaryAction, renderOnce: () => drawScene(),
  };
})();
