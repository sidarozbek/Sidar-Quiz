"""Sidar Quiz skinleri: kahverengi takımlı sprite'tan kodla piksel düzenleyerek üretilir."""
from PIL import Image
import numpy as np, colorsys, os, sys

SRC = 'assets/sprites/kahve/'
OUT = 'assets/sprites/'
FRAMES = ['front_idle', 'idle_1', 'idle_2', 'walk_1', 'walk_2', 'walk_3', 'walk_4', 'run_1', 'run_2']

def hx(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)])

def classify(a):
    """Her piksel için bölge etiketi."""
    H, W = a.shape[:2]
    lab = np.full((H, W), '', dtype=object)
    for y in range(H):
        for x in range(W):
            r, g, b, al = a[y, x]
            if al == 0: continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255); h *= 360
            if v > 0.85 and s < 0.15: c = 'W'
            elif s >= 0.68 and (h >= 345 or h <= 5) and v >= 0.3: c = 'T'
            elif (h <= 30 or h >= 340) and s >= 0.4 and v <= 0.45: c = 's'
            elif h <= 35 and v > 0.5 and s > 0.3: c = 'k'
            elif v < 0.15: c = '#'
            elif s < 0.2 and v > 0.5: c = 'g'
            else: c = '?'
            lab[y, x] = c
    return lab

def ramp(v, base_h, base_s, vmul=1.0, smul=1.0):
    r, g, b = colorsys.hsv_to_rgb(base_h / 360, min(1, base_s * smul), min(1, v * vmul))
    return np.array([round(r * 255), round(g * 255), round(b * 255)])

def val(px):
    return colorsys.rgb_to_hsv(*(px[:3] / 255))[2]

def head_box(a, lab):
    """Saçın üst sınırı ve kafa genişliği (satır satır)."""
    rows = {}
    for y in range(14, 34):
        xs = [x for x in range(a.shape[1]) if a[y, x, 3] > 0]
        if xs: rows[y] = (min(xs), max(xs))
    top = min(rows)
    return top, rows

def body_x(a, y0, y1):
    xs = [x for y in range(y0, y1) for x in range(a.shape[1]) if a[y, x, 3] > 0]
    return min(xs), max(xs)

def put(a, x, y, col):
    if 0 <= y < a.shape[0] and 0 <= x < a.shape[1]:
        a[y, x, :3] = col; a[y, x, 3] = 255

INK = hx('#1a1c2c')

# ---------------------------------------------------------------- yardımcı dönüşümler
def recolor(a, lab, mask_fn, color_fn):
    out = a.copy()
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            if mask_fn(lab[y, x], x, y):
                out[y, x, :3] = color_fn(a[y, x], x, y)
    return out

UPPER = lambda y: y <= 80
LEGS = lambda y: 81 <= y <= 102
SHOES = lambda y: y >= 103

# ---------------------------------------------------------------- skinler
def subay(a, lab, front):
    olive = lambda px, x, y: ramp(val(px), 72, 0.42, 1.25)
    out = recolor(a, lab, lambda c, x, y: c == 's' and y <= 102, olive)
    out = recolor(out, lab, lambda c, x, y: c == 's' and SHOES(y), lambda px, x, y: ramp(val(px), 240, 0.2, 0.6))
    out = recolor(out, lab, lambda c, x, y: c == 'W' and 44 <= y <= 62, lambda px, x, y: hx('#d8c79c'))
    out = recolor(out, lab, lambda c, x, y: c == 'T', lambda px, x, y: ramp(val(px), 230, 0.35, 0.45))
    gold, gold_d = hx('#ffcd75'), hx('#c98a2a')
    # Düğmeler ve apoletteki yıldızlar
    if front:
        for y in (60, 66, 72): put(out, 64, y, gold); put(out, 65, y, gold_d)
        for x in (50, 53, 75, 78): put(out, x, 49, gold)
    else:
        for y in (58, 64, 70): put(out, 46, y, gold)
        sy = min(y for y in range(44, 60) if any(lab[y, x] == 's' for x in range(a.shape[1])))
        sxs = [x for x in range(a.shape[1]) if lab[sy + 1, x] == 's']
        if sxs:
            mx = (min(sxs) + max(sxs)) // 2
            put(out, mx - 2, sy + 1, gold); put(out, mx + 1, sy + 1, gold)
    # Siperlikli şapka
    top, rows = head_box(a, lab)
    x0 = min(r[0] for r in rows.values()) - 1
    x1 = max(r[1] for r in rows.values()) + 1
    cap_top = top - 3
    olive_c, olive_d, olive_l = ramp(0.42, 72, 0.42), ramp(0.28, 72, 0.42), ramp(0.55, 72, 0.4)
    for y in range(cap_top, top + 9):
        k = y - cap_top
        w_in = 3 if k == 0 else 1 if k == 1 else 0
        for x in range(x0 + w_in, x1 - w_in + 1):
            if k == 0 or x in (x0 + w_in, x1 - w_in): c = INK
            elif k <= 2: c = olive_l
            elif k <= 7: c = olive_c
            else: c = INK
            put(out, x, y, c)
        if 6 <= k <= 7:
            for x in range(x0 + 1, x1):
                put(out, x, y, gold if k == 6 else gold_d)
    # Siperlik
    vy = top + 9
    if front:
        for x in range(x0 + 2, x1 - 1): put(out, x, vy, INK); put(out, x, vy + 1, olive_d)
        cx = (x0 + x1) // 2
        for dx, dy in ((0, 0), (-1, 1), (1, 1), (0, 1), (-2, 2), (2, 2), (0, 2), (-1, 3), (1, 3)):
            put(out, cx + dx, cap_top + 2 + dy, gold)
    else:
        for x in range(x1 - 6, x1 + 7): put(out, x, vy, INK); put(out, x, vy - 1, olive_d)
        for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1), (0, 2)):
            put(out, x1 - 6 + dx, cap_top + 3 + dy, gold)
    return out

def aydin(a, lab, front):
    # Kadife ceket (açık kahve, dikey çizgiler), koyu pantolon, siyah balıkçı yaka, kırmızı atkı, sadece bıyık
    def cord(px, x, y):
        c = ramp(val(px), 28, 0.62, 1.45)
        return (c * 0.82).astype(int) if x % 2 == 0 else c
    out = recolor(a, lab, lambda c, x, y: c == 's' and UPPER(y), cord)
    out = recolor(out, lab, lambda c, x, y: c == 's' and LEGS(y), lambda px, x, y: ramp(val(px), 24, 0.45, 0.85))
    turtle = hx('#1e1d27'); turtle_l = hx('#333c57')
    out = recolor(out, lab, lambda c, x, y: c in ('W', 'T', 'g') and 44 <= y <= 62, lambda px, x, y: turtle_l if x % 3 == 0 else turtle)
    # Kırmızı atkı
    red, red_d = hx('#b13e53'), hx('#7a2638')
    if front:
        strips = [(56, 59), (69, 72)]
        for y in range(46, 50):
            for x in range(54, 75): put(out, x, y, red if (x + y) % 3 else red_d)
        for sx0, sx1 in strips:
            for y in range(50, 78):
                for x in range(sx0, sx1 + 1): put(out, x, y, red_d if (y % 3 == 0 or x == sx1) else red)
            for x in range(sx0, sx1 + 1): put(out, x, 78, INK)
    else:
        txs = [x for y in range(47, 60) for x in range(a.shape[1]) if lab[y, x] in ('T', 'W')]
        fx = int(np.median(txs)) if txs else 48
        for y in range(44, 49):
            for x in range(fx - 10, fx + 2):
                if out[y, x, 3] > 0: put(out, x, y, red if (x + y) % 3 else red_d)
        for y in range(49, 76):
            for x in range(fx - 1, fx + 3): put(out, x, y, red_d if (y % 3 == 0 or x == fx + 2) else red)
        for x in range(fx - 1, fx + 3): put(out, x, 76, INK)
    return out

def eylemci(a, lab, front):
    parka = lambda px, x, y: ramp(val(px), 70, 0.38, 1.4)
    out = recolor(a, lab, lambda c, x, y: c == 's' and UPPER(y), parka)
    out = recolor(out, lab, lambda c, x, y: c == 's' and LEGS(y), lambda px, x, y: ramp(val(px), 225, 0.55, 1.15))
    out = recolor(out, lab, lambda c, x, y: c == 's' and SHOES(y), lambda px, x, y: ramp(val(px), 20, 0.3, 0.55))
    out = recolor(out, lab, lambda c, x, y: c in ('W', 'T', 'g') and 44 <= y <= 62, lambda px, x, y: ramp(val(px), 30, 0.5, 0.5))
    # Kapüşon: boynun etrafında parka rengi yaka
    hood, hood_d = ramp(0.5, 70, 0.38), ramp(0.33, 70, 0.38)
    if front:
        for y in range(44, 50):
            for x in range(47, 82):
                if out[y, x, 3] > 0 and lab[y, x] in ('#', '?') and (x < 54 or x > 74): put(out, x, y, hood if (x + y) % 4 else hood_d)
    else:
        for y in range(40, 50):
            for x in range(30, 40):
                if out[y, x, 3] > 0: put(out, x, y, hood if (x + y) % 4 else hood_d)
    # Kol bantları
    band_rows = range(57, 62)
    lx0, lx1 = body_x(a, 57, 62)
    for y in band_rows:
        for x in list(range(lx0 + 1, lx0 + 7)) + list(range(lx1 - 6, lx1)):
            if out[y, x, 3] > 0 and lab[y, x] == 's':
                put(out, x, y, hx('#f4f4f4') if (y == 59 and x % 2 == 0) else INK)
    return out

def yetmisler(a, lab, front):
    def tee(px, x, y):
        v = val(px)
        return hx('#f4f4f4') if v > 0.33 else hx('#c9d2dc') if v > 0.24 else hx('#94b0c2')
    out = recolor(a, lab, lambda c, x, y: c in ('s', 'W', 'T', 'g') and UPPER(y) and y >= 44, tee)
    out = recolor(out, lab, lambda c, x, y: c == 's' and LEGS(y), lambda px, x, y: ramp(val(px), 215, 0.42, 1.9))
    out = recolor(out, lab, lambda c, x, y: c == 's' and SHOES(y), lambda px, x, y: ramp(val(px), 28, 0.5, 1.3))
    # Ceketin iç çizgileri (yaka, cep) silinsin: tişört gibi görünsün
    for y in range(50, 80):
        for x in range(1, a.shape[1] - 1):
            if lab[y, x] == '#' and a[y, x - 1, 3] > 0 and a[y, x + 1, 3] > 0 \
               and lab[y, x - 1] != 'k' and lab[y, x + 1] != 'k' and a[y, x - 2, 3] > 0 and a[y, x + 2, 3] > 0:
                put(out, x, y, hx('#c9d2dc'))
    # Dağınık saç: üstten ve yanlardan rastgele tutamlar
    rng = np.random.RandomState(4)
    top, rows = head_box(a, lab)
    hair, hair_l = hx('#16131f'), hx('#2a2636')
    for y, (lo, hi) in rows.items():
        if y > top + 6: break
        for x in range(lo, hi + 1):
            if y == top or rng.rand() < 0.08:
                h = rng.randint(1, 5) if y == top else rng.randint(1, 3)
                dx = rng.choice([-1, 0, 0, 1])
                for k in range(1, h + 1): put(out, x + dx * (k // 2), y - k, hair if k < h else hair_l)
        for side, sx in ((-1, lo), (1, hi)):
            if rng.rand() < 0.5:
                for k in range(1, rng.randint(2, 4)): put(out, sx + side * k, y + rng.randint(-1, 2), hair)
    return out

def uykucu(a, lab, front):
    def pin(px, x, y):
        c = ramp(val(px), 228, 0.55, 1.25)
        return hx('#94b0c2') if (x % 4 == 0 and val(px) > 0.22) else c
    out = recolor(a, lab, lambda c, x, y: c == 's' and y <= 102, pin)
    out = recolor(out, lab, lambda c, x, y: c == 'T', lambda px, x, y: ramp(val(px), 228, 0.55, 0.9))
    out = recolor(out, lab, lambda c, x, y: c == 's' and SHOES(y), lambda px, x, y: ramp(val(px), 350, 0.6, 1.5))
    # Göz bandı alına kaldırılmış
    top, rows = head_box(a, lab)
    # alnın başladığı satır: ilk ten pikseli
    fy = next(y for y in range(top, 40) if any(lab[y, x] == 'k' for x in range(a.shape[1])))
    xs_all = [x for y in range(fy, fy + 3) for x in range(a.shape[1]) if a[y, x, 3] > 0]
    lo, hi = min(xs_all), max(xs_all)
    for y in range(fy - 1, fy + 3):
        for x in range(lo, hi + 1):
            if a[y, x, 3] == 0: continue
            c = hx('#94b0c2') if y == fy - 1 else hx('#566c86') if y == fy else hx('#0f0e16')
            put(out, x, y, c)
    # Ekose battaniye omuzlarda
    base, c1, c2, c3 = hx('#d9c29a'), hx('#b13e53'), hx('#29366f'), hx('#7a4a2c')
    def plaid(x, y):
        if x % 8 in (0, 1): return c1 if y % 8 not in (3, 4) else c3
        if y % 8 in (3, 4): return c2
        if x % 8 == 5 or y % 8 == 7: return c3
        return base
    lx0, lx1 = body_x(a, 50, 72)
    for y in range(46, 74):
        for x in range(a.shape[1]):
            if out[y, x, 3] == 0 or lab[y, x] in ('k',): continue
            inside = (x <= lx0 + 10 or x >= lx1 - 10) if front else (x <= (lx0 + lx1) // 2 + 2)
            if inside and y <= 46 + (74 - 46) * (1 if not front else 1):
                if lab[y, x] == '#' and (x in (lx0, lx1)): continue
                put(out, x, y, plaid(x, y))
    # Battaniye püskülleri
    for x in range(a.shape[1]):
        if out[73, x, 3] > 0 and tuple(out[73, x, :3]) in [tuple(c) for c in (base, c1, c2, c3)]:
            if x % 2 == 0: put(out, x, 74, base); put(out, x, 75, c3)
    return out

SKINS = {'subay': subay, 'aydin': aydin, 'eylemci': eylemci, 'yetmisler': yetmisler, 'uykucu': uykucu}

if __name__ == '__main__':
    want = sys.argv[1:] or list(SKINS)
    for sid in want:
        os.makedirs(OUT + sid, exist_ok=True)
        for f in FRAMES:
            a = np.array(Image.open(SRC + f + '.png').convert('RGBA')).astype(int)
            lab = classify(a)
            out = SKINS[sid](a, lab, f == 'front_idle')
            Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(f'{OUT}{sid}/{f}.png')
    # önizleme
    sheet = Image.new('RGBA', (128 * 4, 128 * len(want)), (51, 60, 87, 255))
    for i, sid in enumerate(want):
        for j, f in enumerate(['front_idle', 'walk_1', 'walk_3', 'run_2']):
            sheet.alpha_composite(Image.open(f'{OUT}{sid}/{f}.png'), (j * 128, i * 128))
    sheet.resize((sheet.width * 3, sheet.height * 3), Image.NEAREST).save('skins_preview.png')
    print('ok')
