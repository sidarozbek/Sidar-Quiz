// Oyuncu telefonu: moderatöre bağlanır, tuş durumunu gönderir, durum mesajlarını gösterir.
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);

  const nameInput = $('name');
  const joinError = $('joinError');
  const joinBtn = $('joinBtn');

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* gizli mod */ } },
  };

  // Oyuncular sadece QR ile katılır: oda kodu QR'daki adresten gelir
  const roomFromUrl = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Karakter seçimi
  const CHARS = QUIZ.CHARACTERS;
  let charIndex = Math.max(0, CHARS.findIndex((c) => c.id === store.get('quiz-char')));
  const spriteUrl = (id) => `assets/sprites/${id}/front_idle.png`;

  function buildGrid() {
    const grid = $('charGrid');
    grid.replaceChildren();
    CHARS.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'char-tile';
      b.setAttribute('role', 'option');
      b.setAttribute('aria-label', c.name);
      b.innerHTML = `<img src="${spriteUrl(c.id)}" alt="">`;
      b.addEventListener('click', () => { charIndex = i; updateSelection(); });
      grid.appendChild(b);
    });
    updateSelection();
  }
  function updateSelection() {
    document.querySelectorAll('.char-tile').forEach((t, i) => {
      t.classList.toggle('selected', i === charIndex);
      t.setAttribute('aria-selected', String(i === charIndex));
    });
    $('charName').textContent = CHARS[charIndex].name;
  }
  function showStep(id) {
    for (const sid of ['select', 'join']) $(sid).hidden = sid !== id;
  }
  $('pickBtn').addEventListener('click', () => {
    store.set('quiz-char', CHARS[charIndex].id);
    $('preview').src = spriteUrl(CHARS[charIndex].id);
    showStep('join');
    nameInput.focus();
  });
  $('backBtn').addEventListener('click', () => showStep('select'));

  if (roomFromUrl.length === QUIZ.ROOM_LEN) {
    nameInput.value = store.get('quiz-name') || '';
    buildGrid();
    showStep('select');
  } else {
    $('noroom').hidden = false;
  }

  // Aynı odaya yeniden bağlanınca puanın korunsun diye kalıcı bir kimlik
  let token = store.get('quiz-token');
  if (!token) {
    token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    store.set('quiz-token', token);
  }

  let peer = null;
  let conn = null;
  let room = '';
  let myName = '';
  let lastStatusAt = 0;
  let joined = false;
  let reconnecting = false;
  const input = { x: 0, j: false };   // x: analog çubuk -1..1, j: zıpla

  // ---------------------------------------------------------------------------
  // Bağlantı
  // ---------------------------------------------------------------------------
  $('joinForm').addEventListener('submit', (e) => {
    e.preventDefault();
    room = roomFromUrl;
    myName = nameInput.value.trim();
    if (!myName) { joinError.textContent = 'Adını yaz.'; return; }
    goLandscape();
    store.set('quiz-name', myName);
    joinError.textContent = '';
    joinBtn.disabled = true;
    joinBtn.textContent = 'BAĞLANIYOR...';
    connect();
  });

  function connect() {
    if (!peer || peer.destroyed) {
      peer = new Peer(undefined, QUIZ.peerOptions());
      peer.on('open', openConn);
      peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') fail('Bu kodla açık bir oda bulunamadı.');
        else if (!joined) fail('Bağlantı hatası (' + err.type + ').');
        else scheduleReconnect();
      });
      peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
    } else if (peer.open) {
      openConn();
    }
  }

  function openConn() {
    if (conn) { try { conn.close(); } catch (e) { /* yok */ } }
    conn = peer.connect(QUIZ.ROOM_PREFIX + room, { reliable: true, serialization: 'json' });
    const thisConn = conn;
    const timer = setTimeout(() => {
      if (!thisConn.open) {
        if (joined) scheduleReconnect();
        else fail('Odaya bağlanılamadı. Kodu kontrol et ya da tekrar dene.');
      }
    }, 10000);
    conn.on('open', () => {
      clearTimeout(timer);
      setupFast(thisConn);
      thisConn.send({ t: 'join', name: myName, token, char: CHARS[charIndex].id });
    });
    conn.on('data', onMessage);
    conn.on('close', () => { if (joined && conn === thisConn) scheduleReconnect(); });
  }

  // Girdi için sırasız ve kayıplı ayrı kanal (moderatördeki ile aynı id): kayıp bir paket sonrakileri bekletmez
  let fast = null;
  function setupFast(c) {
    try {
      fast = c.peerConnection.createDataChannel('fast', { negotiated: true, id: 5, ordered: false, maxRetransmits: 0 });
      fast.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.t === 'ping') sendFastRaw({ t: 'o', ts: m.ts });
      };
    } catch (e) { fast = null; }
  }
  function sendFastRaw(m) {
    if (fast && fast.readyState === 'open' && fast.bufferedAmount < 1024) {
      try { fast.send(JSON.stringify(m)); return true; } catch (e) { /* yedek */ }
    }
    return false;
  }

  function fail(msg) {
    joinError.textContent = msg;
    joinBtn.disabled = false;
    joinBtn.textContent = 'KATIL';
    if (!joined && peer) { peer.destroy(); peer = null; }
  }

  function scheduleReconnect() {
    if (reconnecting) return;
    reconnecting = true;
    showMessage(QUIZ.PAL.steel, 'BAĞLANTI KOPTU', 'Yeniden bağlanılıyor…');
    setTimeout(() => {
      reconnecting = false;
      if (peer && !peer.destroyed && peer.open) openConn();
      else { if (peer) peer.destroy(); peer = null; connect(); }
    }, 1500);
  }

  // Kopmayı fark etmek için: moderatör her saniye durum gönderir
  setInterval(() => {
    if (!joined) return;
    if (conn && conn.open) sendInput(true);   // hem nabız hem güncel girdi
    if (performance.now() - lastStatusAt > 8000) scheduleReconnect();
  }, 2000);

  function onMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    lastStatusAt = performance.now();
    if (msg.t === 'error') { fail(msg.msg); return; }
    if (msg.t === 'welcome') {
      joined = true;
      myName = msg.name;
      $('join').hidden = true;
      $('pad').hidden = false;
      $('rotate').hidden = false;
      document.body.classList.add('joined');
      requestWakeLock();
      $('meName').textContent = msg.name;
      $('meChar').style.backgroundImage = `url(${spriteUrl(msg.char || CHARS[charIndex].id)})`;
      $('meDot').style.background = msg.color;
      document.documentElement.style.setProperty('--me', msg.color);
      return;
    }
    if (msg.t === 'ping') { if (conn && conn.open) conn.send({ t: 'pong', ts: msg.ts }); return; }
    if (msg.t === 'kicked') {
      joined = false;
      document.body.classList.remove('joined');
      $('pad').hidden = true; $('rotate').hidden = true;
      $('noroom').hidden = false;
      $('noroom').querySelector('.window p').textContent = 'Moderatör seni bu oyundan çıkardı.';
      try { peer.destroy(); } catch (e) { /* yok */ }
      return;
    }
    if (msg.t === 'st') render(msg);
  }

  // ---------------------------------------------------------------------------
  // Ekran
  // ---------------------------------------------------------------------------
  const card = $('card');
  let lastPhase = '';
  let lastHadResult = false;
  let currentPhase = '';

  const badgeEl = $('badge');

  // color: kart arka planı; textColor: yazı rengi; letterIndex: gösterilecek cevap harfi
  function showMessage(color, big, small, letterIndex, textColor) {
    card.style.background = color || '';
    card.style.setProperty('--card-text', textColor || QUIZ.PAL.white);
    badgeEl.textContent = letterIndex >= 0 ? QUIZ.ANSWERS[letterIndex].letter : '';
    $('msgBig').textContent = String(big).replace(/İ/g, 'I');  // başlık fontu için
    $('msgSmall').textContent = small || '';
  }

  function render(s) {
    $('meScore').textContent = String(s.score).padStart(6, '0');
    const sig = $('signal');
    const bars = s.ping == null ? 0 : s.ping < 80 ? 3 : s.ping < 160 ? 2 : 1;
    sig.dataset.bars = bars;
    sig.title = s.ping == null ? 'Bağlantı ölçülüyor' : `Gecikme: ${s.ping} ms`;
    const L = (i) => QUIZ.ANSWERS[i].letter;
    currentPhase = s.phase;
    const active = !s.paused && (s.phase === 'lobby' || s.phase === 'read' || s.phase === 'question');
    document.body.classList.toggle('locked', !active);

    if (navigator.vibrate) {
      if (s.phase !== lastPhase && s.phase === 'question') navigator.vibrate(60);
      if (s.phase !== lastPhase && s.phase === 'reveal') navigator.vibrate(30);
      if (s.phase === 'reveal' && s.last && !lastHadResult) navigator.vibrate(s.last.points > 0 ? [40, 40, 40] : 200);
    }
    lastHadResult = !!(s.phase === 'reveal' && s.last);
    lastPhase = s.phase;
    const streak = s.streak >= 2 ? ` · SERİ ${s.streak}` : '';

    if (s.paused) {
      showMessage(QUIZ.PAL.steel, 'DURAKLATILDI', 'Moderatör oyunu kısa bir süre durdurdu.');
      return;
    }

    switch (s.phase) {
      case 'lobby':
        showMessage(null, 'KATILDIN!', 'Oyunun başlamasını bekle. Bu arada karakterini büyük ekranda yürütebilirsin.');
        break;
      case 'read':
        showMessage(QUIZ.PAL.plum, `SORU ${s.q}/${s.n}${s.double ? ' · 2X' : ''}`, 'Soruyu büyük ekrandan oku. Cevaplar birazdan açılacak, şimdiden yerini alabilirsin.');
        break;
      case 'question':
        if (s.zone >= 0) {
          const a = QUIZ.ANSWERS[s.zone];
          showMessage(a.color, `${a.letter} CEVABI`, `Kalan süre: ${s.time} sn · Fikrini değiştirmek için platformdan in`, s.zone, a.text);
        } else {
          showMessage(null, 'ZIPLA!', `Doğru bildiğin cevabın platformuna çık · Kalan süre: ${s.time} sn`);
        }
        break;
      case 'reveal': {
        const r = s.last;
        if (!r) { showMessage(QUIZ.PAL.steel, 'KİLİTLENDİ!', 'Büyük ekrana bak…'); break; }
        if (r.points > 0) showMessage(QUIZ.PAL.green, `DOĞRU! +${r.points}`, `Sıralaman: ${s.rank} / ${s.total}${streak}`, r.correct, QUIZ.PAL.ink);
        else if (r.answer < 0) showMessage(QUIZ.PAL.steel, 'CEVAP YOK', `Doğru cevap: ${L(r.correct)}`, r.correct);
        else showMessage(QUIZ.PAL.red, 'YANLIŞ', `Sen ${L(r.answer)} dedin, doğru cevap ${L(r.correct)}`, r.correct);
        break;
      }
      case 'leaderboard':
        showMessage(QUIZ.PAL.navy, `${s.rank}. SIRA`, `${String(s.score).padStart(6, '0')} puan · ${s.total} oyuncu`);
        break;
      case 'final':
        showMessage(s.rank <= 3 ? QUIZ.PAL.yellow : QUIZ.PAL.navy, s.rank === 1 ? 'BİRİNCİ OLDUN!' : `OYUN BİTTİ: ${s.rank}.`, `${String(s.score).padStart(6, '0')} puan`, -1, s.rank <= 3 ? QUIZ.PAL.ink : QUIZ.PAL.white);
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Kontroller
  // ---------------------------------------------------------------------------
  // Girdinin üç kaynağı: analog çubuk, A düğmesi, klavye (bilgisayardan katılanlar için)
  const stickState = { x: 0, up: false };
  const keys = { l: false, r: false, j: false };
  let aHeld = false;

  // Gönderim: oyun aşamalarında (lobi, okuma, soru) değişmese de sabit 30 Hz — telefonun Wi-Fi'si uyuklamasın,
  // kaybolan paketin yerini hemen yenisi alsın. Diğer aşamalarda sadece değişince ve 2 sn'de bir nabız.
  let seq = 0;
  let jumpCount = 0;     // her zıplama basışında artar: kayıp pakette kısa dokunuş kaybolmaz
  let lastSent = { x: null, j: null };
  function sendInput(force) {
    const changed = input.x !== lastSent.x || input.j !== lastSent.j;
    if (!force && !changed) return;
    const m = { t: 'i', s: ++seq, x: input.x, j: input.j, jc: jumpCount };
    if (!sendFastRaw(m)) {
      if (conn && conn.open) conn.send({ t: 'in', x: input.x, j: input.j, jc: jumpCount });
      else return;
    }
    lastSent = { x: input.x, j: input.j };
  }
  setInterval(() => {
    if (joined && (currentPhase === 'lobby' || currentPhase === 'read' || currentPhase === 'question')) sendInput(true);
  }, 33);

  function updateInput() {
    const kx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
    input.x = stickState.x !== 0 ? stickState.x : kx;
    const j = aHeld || stickState.up || keys.j;
    if (j && !input.j) jumpCount++;
    input.j = j;
    sendInput();
  }

  // --- Analog çubuk ---
  const stick = $('stick');
  const knob = $('knob');
  const DEAD = 0.18;        // ölü bölge: küçük titremeler karakteri yürütmesin
  const UP_ON = 0.6, UP_OFF = 0.3;   // yukarı itince zıpla; tekrar için önce 0,3'ün altına in
  const UP_CONE = 50 * Math.PI / 180;  // dikeyden en fazla ±50° sapma (çapraz yürürken zıplamasın)
  let stickPointer = null;

  function stickMove(e) {
    const r = stick.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const max = r.width * 0.32;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    // Topuz 2 piksellik adımlarla hareket etsin (retro his)
    knob.style.transform = `translate(${Math.round(dx / 2) * 2}px, ${Math.round(dy / 2) * 2}px)`;
    let nx = dx / max;
    const ny = dy / max;
    nx = Math.abs(nx) < DEAD ? 0 : Math.sign(nx) * (Math.abs(nx) - DEAD) / (1 - DEAD);
    stickState.x = Math.round(nx * 10) / 10;   // 0.1'lik adımlar: gereksiz mesaj olmasın
    const ang = Math.abs(Math.atan2(dx / max, -ny));   // dikeyden sapma açısı
    if (stickState.up) { if (-ny < UP_OFF) stickState.up = false; }
    else if (-ny > UP_ON && ang < UP_CONE) stickState.up = true;
    stick.classList.toggle('up', stickState.up);
    updateInput();
  }
  function stickEnd(e) {
    if (e && stickPointer !== e.pointerId) return;
    stickPointer = null;
    stickState.x = 0; stickState.up = false;
    knob.style.transform = '';
    stick.classList.remove('active', 'up');
    updateInput();
  }
  // Sol tarafın tamamı dokunma alanı: parmak çubuğun tam üstüne gelmese de çalışır
  const stickArea = document.querySelector('.side.left');
  stickArea.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    stickPointer = e.pointerId;
    stickArea.setPointerCapture(e.pointerId);
    stick.classList.add('active');
    stickMove(e);
  });
  stickArea.addEventListener('pointermove', (e) => { if (e.pointerId === stickPointer) stickMove(e); });
  stickArea.addEventListener('pointerup', stickEnd);
  stickArea.addEventListener('pointercancel', stickEnd);
  stickArea.addEventListener('lostpointercapture', stickEnd);
  stickArea.addEventListener('contextmenu', (e) => e.preventDefault());

  // --- A (zıpla) düğmesi ---
  const aBtn = document.querySelector('.abtn');
  const aSet = (v) => (e) => {
    e.preventDefault();
    aHeld = v;
    aBtn.classList.toggle('down', v);
    updateInput();
  };
  aBtn.addEventListener('pointerdown', (e) => { aBtn.setPointerCapture(e.pointerId); aSet(true)(e); });
  aBtn.addEventListener('pointerup', aSet(false));
  aBtn.addEventListener('pointercancel', aSet(false));
  aBtn.addEventListener('lostpointercapture', aSet(false));
  aBtn.addEventListener('contextmenu', (e) => e.preventDefault());

  // Tam ekran + yatay kilit (Android'de çalışır; iPhone'da "yan çevir" uyarısı devreye girer)
  function goLandscape() {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    Promise.resolve(req.call(el, { navigationUI: 'hide' }))
      .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
      .catch(() => { /* desteklenmiyor */ });
  }

  // Ekran kararmasın (iOS 18.4+ ve diğer tarayıcılar)
  let wakeLock = null;
  async function requestWakeLock() {
    try { if (navigator.wakeLock && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { /* desteklenmiyor */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && joined) requestWakeLock();
    else releaseAll();
  });
  window.addEventListener('blur', () => releaseAll());
  function releaseAll() {
    stickEnd({ pointerId: stickPointer });
    aHeld = false; aBtn.classList.remove('down');
    keys.l = keys.r = keys.j = false;
    updateInput();
  }

  // Ekran dik/yatay değişince basılı kalmış her şeyi bırak
  window.addEventListener('orientationchange', () => {
    stickEnd({ pointerId: stickPointer });
    aHeld = false; aBtn.classList.remove('down');
    keys.l = keys.r = keys.j = false;
    updateInput();
  });

  // Bilgisayardan katılanlar için klavye
  const KEYS = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'j', KeyW: 'j', Space: 'j' };
  const onKey = (v) => (e) => {
    const k = KEYS[e.code];
    if (!k || !joined) return;
    e.preventDefault();
    if (keys[k] === v) return;
    keys[k] = v;
    updateInput();
  };
  window.addEventListener('keydown', onKey(true));
  window.addEventListener('keyup', onKey(false));

  // Testler için
  window.__play = { get joined() { return joined; }, input, sendInput };
})();
