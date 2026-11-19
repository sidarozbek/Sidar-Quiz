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
  const input = { l: false, r: false, j: false };

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
    conn = peer.connect(QUIZ.ROOM_PREFIX + room, { reliable: true });
    const thisConn = conn;
    const timer = setTimeout(() => {
      if (!thisConn.open) {
        if (joined) scheduleReconnect();
        else fail('Odaya bağlanılamadı. Kodu kontrol et ya da tekrar dene.');
      }
    }, 10000);
    conn.on('open', () => {
      clearTimeout(timer);
      thisConn.send({ t: 'join', name: myName, token, char: CHARS[charIndex].id });
    });
    conn.on('data', onMessage);
    conn.on('close', () => { if (joined && conn === thisConn) scheduleReconnect(); });
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
    if (conn && conn.open) conn.send({ t: 'in', ...input });   // hem nabız hem güncel tuş durumu
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
      $('meName').textContent = msg.name;
      $('meChar').style.backgroundImage = `url(${spriteUrl(msg.char || CHARS[charIndex].id)})`;
      $('meDot').style.background = msg.color;
      document.documentElement.style.setProperty('--me', msg.color);
      return;
    }
    if (msg.t === 'st') render(msg);
  }

  // ---------------------------------------------------------------------------
  // Ekran
  // ---------------------------------------------------------------------------
  const card = $('card');
  let lastPhase = '';

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
    const L = (i) => QUIZ.ANSWERS[i].letter;
    document.body.classList.toggle('locked', !(s.phase === 'lobby' || s.phase === 'question'));

    if (s.phase !== lastPhase && navigator.vibrate) {
      if (s.phase === 'question') navigator.vibrate(60);
      if (s.phase === 'reveal') navigator.vibrate(s.last && s.last.points > 0 ? [40, 40, 40] : 200);
    }
    lastPhase = s.phase;

    switch (s.phase) {
      case 'lobby':
        showMessage(null, 'KATILDIN!', 'Oyunun başlamasını bekle. Bu arada karakterini büyük ekranda yürütebilirsin.');
        break;
      case 'countdown':
        showMessage(QUIZ.PAL.plum, `SORU ${s.q}/${s.n}`, 'Hazır ol! Büyük ekrana bak.');
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
        if (!r) break;
        if (r.points > 0) showMessage(QUIZ.PAL.green, `DOĞRU! +${r.points}`, `Sıralaman: ${s.rank} / ${s.total}`, r.correct, QUIZ.PAL.ink);
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
  function sendInput() {
    if (conn && conn.open) conn.send({ t: 'in', ...input });
  }

  // Aynı tuşa birden çok düğme bağlı olabilir (yukarı ok ve A ikisi de zıplatır)
  const held = { l: new Set(), r: new Set(), j: new Set() };
  for (const btn of document.querySelectorAll('.ctl')) {
    const k = btn.dataset.key;
    const set = (v) => (e) => {
      e.preventDefault();
      if (v) held[k].add(btn); else held[k].delete(btn);
      btn.classList.toggle('down', v);
      const now = held[k].size > 0;
      if (input[k] === now) return;
      input[k] = now;
      sendInput();
    };
    btn.addEventListener('pointerdown', (e) => { btn.setPointerCapture(e.pointerId); set(true)(e); });
    btn.addEventListener('pointerup', set(false));
    btn.addEventListener('pointercancel', set(false));
    btn.addEventListener('lostpointercapture', set(false));
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Tam ekran + yatay kilit (Android'de çalışır; iPhone'da "yan çevir" uyarısı devreye girer)
  function goLandscape() {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    Promise.resolve(req.call(el, { navigationUI: 'hide' }))
      .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
      .catch(() => { /* desteklenmiyor */ });
  }

  // Ekran dik/yatay değişince basılı kalmış tuşları bırak
  window.addEventListener('orientationchange', () => {
    for (const k of Object.keys(held)) held[k].clear();
    input.l = input.r = input.j = false;
    document.querySelectorAll('.ctl.down').forEach((b) => b.classList.remove('down'));
    sendInput();
  });

  // Bilgisayardan katılanlar için klavye
  const KEYS = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'j', KeyW: 'j', Space: 'j' };
  const onKey = (v) => (e) => {
    const k = KEYS[e.code];
    if (!k || !joined) return;
    e.preventDefault();
    if (input[k] === v) return;
    input[k] = v;
    sendInput();
  };
  window.addEventListener('keydown', onKey(true));
  window.addEventListener('keyup', onKey(false));

  // Testler için
  window.__play = { get joined() { return joined; }, input, sendInput };
})();
