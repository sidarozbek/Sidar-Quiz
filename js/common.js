// Moderatör ve oyuncu sayfalarının ortak ayarları.
'use strict';

const QUIZ = {
  // PeerJS kimliklerinin başına eklenir; başka uygulamalarla çakışmayı önler.
  ROOM_PREFIX: 'sidar-quiz-',
  ROOM_CHARS: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
  ROOM_LEN: 5,
  MAX_PLAYERS: 15,

  // 16 renkli retro palet (Sweetie 16). Sahnedeki bütün renkler buradan gelir.
  PAL: {
    ink: '#1a1c2c', plum: '#5d275d', red: '#b13e53', orange: '#ef7d57',
    yellow: '#ffcd75', lime: '#a7f070', green: '#38b764', teal: '#257179',
    navy: '#29366f', blue: '#3b5dc9', sky: '#41a6f6', cyan: '#73eff7',
    white: '#f4f4f4', silver: '#94b0c2', slate: '#566c86', steel: '#333c57',
  },

  // Cevap renkleri ve şekilleri (Kahoot düzeni, retro renkler)
  ANSWERS: [
    { letter: 'A', color: '#b13e53', light: '#ef7d57', dark: '#5d275d', text: '#f4f4f4', shape: 'triangle' },
    { letter: 'B', color: '#3b5dc9', light: '#41a6f6', dark: '#29366f', text: '#f4f4f4', shape: 'diamond' },
    { letter: 'C', color: '#ffcd75', light: '#f4f4f4', dark: '#ef7d57', text: '#1a1c2c', shape: 'circle' },
    { letter: 'D', color: '#38b764', light: '#a7f070', dark: '#257179', text: '#1a1c2c', shape: 'square' },
  ],

  // Oyuncu renkleri (isim etiketleri ve telefon ekranı), aynı paletten
  PLAYER_COLORS: [
    '#b13e53', '#3b5dc9', '#ffcd75', '#38b764', '#ef7d57',
    '#73eff7', '#5d275d', '#a7f070', '#41a6f6', '#f4f4f4',
    '#257179', '#94b0c2', '#29366f', '#566c86', '#333c57',
  ],

  // Seçilebilir karakterler (assets/sprites/<id>/ klasörleri)
  CHARACTERS: [
    { id: 'kahve', name: 'KAHVE' },
    { id: 'lacivert', name: 'LACIVERT' },
    { id: 'gri', name: 'GRI' },
    { id: 'bordo', name: 'BORDO' },
    { id: 'yesil', name: 'YEŞİL' },
    { id: 'mor', name: 'MOR' },
  ],

  FONT_TITLE: '"Press Start 2P", monospace',
  FONT_BODY: '"Pixelify Sans", monospace',

  makeRoomCode() {
    let s = '';
    for (let i = 0; i < this.ROOM_LEN; i++) {
      s += this.ROOM_CHARS[Math.floor(Math.random() * this.ROOM_CHARS.length)];
    }
    return s;
  },

  // PeerJS bağlantı ayarları. Varsayılan: PeerJS'in ücretsiz genel sunucusu.
  // Kendi sunucunu kullanmak için adrese ?peerhost=...&peerport=...&peerpath=... ekle.
  peerOptions() {
    const p = new URLSearchParams(location.search);
    const opts = { debug: 1 };
    if (p.get('peerhost')) {
      opts.host = p.get('peerhost');
      opts.port = Number(p.get('peerport') || 443);
      opts.path = p.get('peerpath') || '/';
      opts.secure = p.get('peersecure') === '1';
    }
    return opts;
  },

  // Test parametrelerini moderatörden oyuncu bağlantısına taşımak için
  passthroughParams() {
    const p = new URLSearchParams(location.search);
    const out = new URLSearchParams();
    for (const k of ['peerhost', 'peerport', 'peerpath', 'peersecure']) {
      if (p.get(k)) out.set(k, p.get(k));
    }
    return out;
  },

  textColorFor(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? '#1a1c2c' : '#f4f4f4';
  },

  // Cevap şekillerinin 11x11 piksel maskeleri
  _masks: {},
  shapeMask(shape) {
    if (this._masks[shape]) return this._masks[shape];
    const n = 11, c = 5, m = [];
    for (let y = 0; y < n; y++) {
      const row = [];
      for (let x = 0; x < n; x++) {
        let on;
        if (shape === 'square') on = x >= 1 && x <= 9 && y >= 1 && y <= 9;
        else if (shape === 'circle') on = (x - c) ** 2 + (y - c) ** 2 <= 5.3 ** 2;
        else if (shape === 'diamond') on = Math.abs(x - c) + Math.abs(y - c) <= 5;
        else on = y >= 1 && y <= 9 && Math.abs(x - c) <= (y - 1) * 0.6 + 0.5;
        row.push(on);
      }
      m.push(row);
    }
    return (this._masks[shape] = m);
  },

  // Piksel şekli çizer; px = bir pikselin ekrandaki boyutu. outline verilirse 1 piksel kontur ekler.
  drawShape(g, shape, cx, cy, px, color, outline) {
    const m = this.shapeMask(shape);
    const n = m.length;
    const x0 = Math.round(cx - (n * px) / 2), y0 = Math.round(cy - (n * px) / 2);
    if (outline) {
      g.fillStyle = outline;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        if (!m[y][x]) continue;
        g.fillRect(x0 + (x - 1) * px, y0 + y * px, px * 3, px);
        g.fillRect(x0 + x * px, y0 + (y - 1) * px, px, px * 3);
      }
    }
    g.fillStyle = color;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y][x]) g.fillRect(x0 + x * px, y0 + y * px, px, px);
  },
};
