"""10 yeni skin: make_skins.py'deki yardımcılarla."""
from make_skins import *
import make_skins as M

SKIN = hx('#e8a07c')
def skin_px(px):
    v = val(px); return ramp(v, 20, 0.42, 1.0 / max(v, 0.01) * min(0.92, 0.5 + v))

def strip_inner(out, a, lab, y0=50, y1=80, color=None):
    """Ceketin iç çizgilerini (yaka, cep) sil."""
    for y in range(y0, y1):
        for x in range(2, a.shape[1] - 2):
            if lab[y, x] == '#' and all(a[y, x + d, 3] > 0 for d in (-2, -1, 1, 2)) \
               and lab[y, x - 1] != 'k' and lab[y, x + 1] != 'k':
                put(out, x, y, color if color is not None else out[y, x - 1, :3])

def upper_mask(c, x, y): return c == 's' and y <= 80
def collar_mask(c, x, y): return c in ('W', 'T', 'g') and 44 <= y <= 62

def forehead(a, lab):
    top, rows = head_box(a, lab)
    fy = next(y for y in range(top, 40) if any(lab[y, x] == 'k' for x in range(a.shape[1])))
    return top, rows, fy

def hat(out, a, lab, front, crown, crown_up, brim, col, dark, light=None, band=None, brim_rows=2, inset=1, puff=0, dome=0, pinch=False):
    """Genel şapka: crown_up satır yukarı taşan tepe, brim kadar yana uzayan kenar."""
    top, rows = head_box(a, lab)
    x0 = min(r[0] for r in rows.values()); x1 = max(r[1] for r in rows.values())
    light = light if light is not None else col
    y_top = top - crown_up
    for y in range(y_top, top + crown):
        k = y - y_top
        ins = inset + (puff if k < 2 else 0) * 0
        xa, xb = x0 + ins - (puff if 1 < k < crown_up - 1 else 0), x1 - ins + (puff if 1 < k < crown_up - 1 else 0)
        if k == 0: xa += 2; xb -= 2
        d = max(0, dome - k) * 2 if dome else 0
        xa += d; xb -= d
        cxm = (xa + xb) // 2
        for x in range(xa, xb + 1):
            if pinch and k == 0 and abs(x - cxm) <= 2: continue
            top_edge = k == 0 or (pinch and k == 1 and abs(x - cxm) <= 2)
            c = INK if (top_edge or x in (xa, xb)) else light if k <= 2 else col
            put(out, x, y, c)
        if band and y >= top + crown - band:
            for x in range(xa + 1, xb): put(out, x, y, dark)
    by = top + crown
    if brim is not None:
        if front: bx0, bx1 = x0 - brim, x1 + brim
        else: bx0, bx1 = x0 - brim[0], x1 + brim[1]
        for r in range(brim_rows + 1):
            for x in range(bx0, bx1 + 1):
                put(out, x, by + r, INK if (r == brim_rows or x in (bx0, bx1)) else dark if r else col)
    return top, x0, x1

def digits(out, n, cx, y, col, s=2):
    F = {'7': ['111', '001', '010', '010', '010'], '1': ['010', '110', '010', '010', '111'],
         '0': ['111', '101', '101', '101', '111'], '9': ['111', '101', '111', '001', '111']}
    w = len(n) * 4 * s - s
    x = cx - w // 2
    for ch in n:
        for r, row in enumerate(F[ch]):
            for c, bit in enumerate(row):
                if bit == '1':
                    for dy in range(s):
                        for dx in range(s): put(out, x + c * s + dx, y + r * s + dy, col)
        x += 4 * s

def basketbolcu(a, lab, front):
    jers = lambda px, x, y: ramp(val(px), 225, 0.68, 2.0)
    out = recolor(a, lab, upper_mask, jers)
    out = recolor(out, lab, collar_mask, lambda px, x, y: hx('#f4f4f4'))
    strip_inner(out, a, lab)
    lx0, lx1 = body_x(a, 52, 76)
    if front:   # kolsuz: kollar ten rengi
        for y in range(52, 77):
            for x in list(range(lx0, lx0 + 7)) + list(range(lx1 - 6, lx1 + 1)):
                if lab[y, x] == 's': put(out, x, y, SKIN if val(a[y, x]) > 0.3 else hx('#c47a5a'))
            put(out, lx0 + 7, y, hx('#f4f4f4')); put(out, lx1 - 7, y, hx('#f4f4f4'))
        digits(out, '7', 64, 58, hx('#f4f4f4'))
    else:
        digits(out, '7', (lx0 + lx1) // 2 - 3, 58, hx('#f4f4f4'), s=1)
    for y in range(81, 103):
        for x in range(a.shape[1]):
            if lab[y, x] != 's': continue
            if y <= 91: put(out, x, y, jers(a[y, x], x, y))
            elif y <= 98: put(out, x, y, SKIN if val(a[y, x]) > 0.3 else hx('#c47a5a'))
            else: put(out, x, y, hx('#f4f4f4'))
    out2 = recolor(out, lab, lambda c, x, y: c == 's' and SHOES(y), lambda px, x, y: hx('#f4f4f4') if val(px) > 0.3 else hx('#3b5dc9'))
    top, rows, fy = forehead(a, lab)
    for y in (fy, fy + 1):
        for x in range(a.shape[1]):
            if a[y, x, 3] > 0 and lab[y, x] in ('k', '#', '?'): put(out2, x, y, hx('#f4f4f4') if y == fy else hx('#3b5dc9'))
    return out2

def asci(a, lab, front):
    white = lambda px, x, y: hx('#f4f4f4') if val(px) > 0.33 else hx('#c9d2dc') if val(px) > 0.24 else hx('#94b0c2')
    out = recolor(a, lab, lambda c, x, y: (upper_mask(c, x, y) or collar_mask(c, x, y)), white)
    strip_inner(out, a, lab, color=hx('#c9d2dc'))
    out = recolor(out, lab, lambda c, x, y: c == 's' and LEGS(y), lambda px, x, y: hx('#1a1c2c') if (x // 2 + y // 2) % 2 else hx('#94b0c2'))
    if front:
        for y in range(58, 76, 5):
            for x in (58, 70): put(out, x, y, hx('#566c86'))
        for y in range(46, 51):
            for x in range(56, 73): put(out, x, y, hx('#b13e53') if (x + y) % 3 else hx('#7a2638'))
    else:
        for y in range(56, 76, 5): put(out, (body_x(a, 56, 76)[1]) - 3, y, hx('#566c86'))
    # Uzun aşçı şapkası
    top, rows = head_box(a, lab)
    x0 = min(r[0] for r in rows.values()); x1 = max(r[1] for r in rows.values())
    for y in range(top - 16, top + 6):
        k = y - (top - 16)
        bulge = 3 if k < 10 else 1
        xa, xb = x0 + 1 - bulge, x1 - 1 + bulge
        if k == 0: xa += 3; xb -= 3
        if k == 1: xa += 1; xb -= 1
        for x in range(xa, xb + 1):
            c = INK if (k == 0 or x in (xa, xb) or y == top + 5) else hx('#c9d2dc') if (y >= top + 2 or (x - xa) % 5 == 0) else hx('#f4f4f4')
            put(out, x, y, c)
    return out

def doktor(a, lab, front):
    coat = lambda px, x, y: hx('#f4f4f4') if val(px) > 0.33 else hx('#c9d2dc') if val(px) > 0.24 else hx('#94b0c2')
    out = recolor(a, lab, upper_mask, coat)
    scrub = lambda px, x, y: ramp(max(val(px), 0.2), 178, 0.6, 1.9)
    out = recolor(out, lab, collar_mask, scrub)
    out = recolor(out, lab, lambda c, x, y: c == 's' and LEGS(y), scrub)
    out = recolor(out, lab, lambda c, x, y: c == 's' and SHOES(y), lambda px, x, y: hx('#f4f4f4') if val(px) > 0.25 else hx('#94b0c2'))
    g, gl = hx('#566c86'), hx('#94b0c2')
    if front:   # steteskop
        pts = [(54, 48), (54, 52), (55, 56), (56, 60), (57, 63), (58, 66), (74, 48), (74, 52), (73, 56), (72, 60)]
        for x, y in pts:
            for dy in range(4): put(out, x, y + dy, g)
        for dx in range(-1, 3):
            for dy in range(3): put(out, 58 + dx, 69 + dy, gl if dy == 1 else g)
    else:
        fx = body_x(a, 50, 60)[1] - 4
        for y in range(47, 64): put(out, fx, y, g)
        for dx in range(-1, 2):
            for dy in range(3): put(out, fx + dx, 64 + dy, gl)
    return out

def kovboy(a, lab, front):
    suede = lambda px, x, y: ramp(val(px), 30, 0.55, 1.7)
    out = recolor(a, lab, upper_mask, suede)
    out = recolor(out, lab, lambda c, x, y: c == 's' and LEGS(y), lambda px, x, y: ramp(val(px), 215, 0.5, 1.9))
    out = recolor(out, lab, lambda c, x, y: c == 's' and SHOES(y), lambda px, x, y: ramp(val(px), 22, 0.65, 1.05))
    out = recolor(out, lab, collar_mask, lambda px, x, y: hx('#f4f4f4') if (x + y) % 4 == 0 else hx('#b13e53'))
    # püsküller (ceket alt kenarı)
    for x in range(a.shape[1]):
        if out[80, x, 3] > 0 and lab[80, x] == 's' and x % 2 == 0: put(out, x, 81, ramp(0.5, 30, 0.55)); put(out, x, 82, ramp(0.4, 30, 0.55))
    tan, tan_d, tan_l = hx('#c98a4b'), hx('#8a5a2c'), hx('#e0a868')
    hat(out, a, lab, front, crown=4, crown_up=7, brim=7 if front else (6, 8), col=tan, dark=tan_d, light=tan_l, band=2)
    return out

def astronot(a, lab, front):
    suit = lambda px, x, y: hx('#f4f4f4') if val(px) > 0.34 else hx('#c9d2dc') if val(px) > 0.25 else hx('#94b0c2')
    out = recolor(a, lab, lambda c, x, y: c == 's' and y <= 102, suit)
    out = recolor(out, lab, collar_mask, lambda px, x, y: hx('#566c86'))
    strip_inner(out, a, lab, color=hx('#c9d2dc'))
    out = recolor(out, lab, lambda c, x, y: c == 's' and SHOES(y), lambda px, x, y: hx('#566c86'))
    # eldivenler
    out = recolor(out, lab, lambda c, x, y: c == 'k' and y >= 70, lambda px, x, y: hx('#94b0c2') if val(px) > 0.5 else hx('#566c86'))
    if front:   # göğüs arması ve kontrol kutusu
        for y in range(56, 60):
            for x in range(70, 76): put(out, x, y, hx('#b13e53') if y % 2 else hx('#3b5dc9'))
        for y in range(62, 68):
            for x in range(58, 70): put(out, x, y, hx('#566c86') if y in (62, 67) else hx('#333c57'))
        put(out, 60, 64, hx('#a7f070')); put(out, 63, 64, hx('#b13e53')); put(out, 66, 64, hx('#ffcd75'))
    else:
        lx0, lx1 = body_x(a, 56, 60)
        for y in range(56, 60):
            for x in range(lx0 + 4, lx0 + 9): put(out, x, y, hx('#b13e53') if y % 2 else hx('#3b5dc9'))
    # cam kask: başın etrafında halka
    top, rows = head_box(a, lab)
    cy = top + 13; cx = (min(r[0] for r in rows.values()) + max(r[1] for r in rows.values())) / 2
    R = 17
    for y in range(int(cy - R - 1), int(cy + R + 2)):
        for x in range(int(cx - R - 1), int(cx + R + 2)):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if R - 1.2 <= d <= R + 0.4 and y < cy + 12: put(out, x, y, hx('#c9d2dc'))
            elif R + 0.4 < d <= R + 1.4 and y < cy + 12: put(out, x, y, INK)
    for k in range(5): put(out, int(cx - 9 + k), int(cy - 13 + k // 2), hx('#f4f4f4'))
    for x in range(int(cx - R), int(cx + R + 1)):   # boyun halkası
        for y in (int(cy + 12), int(cy + 13)):
            if out[y, x, 3] > 0: put(out, x, y, hx('#566c86') if y == int(cy + 12) else INK)
    return out

def korsan(a, lab, front):
    def stripes(px, x, y):
        if val(px) < 0.22: return hx('#7a2638')
        return hx('#f4f4f4') if (y // 3) % 2 else hx('#b13e53')
    out = recolor(a, lab, lambda c, x, y: upper_mask(c, x, y) or collar_mask(c, x, y), stripes)
    strip_inner(out, a, lab)
    out = recolor(out, lab, lambda c, x, y: c == 's' and LEGS(y), lambda px, x, y: ramp(val(px), 240, 0.25, 0.9) if y < 92 else ramp(val(px), 22, 0.6, 0.8))
    out = recolor(out, lab, lambda c, x, y: c == 's' and SHOES(y), lambda px, x, y: ramp(val(px), 22, 0.6, 0.8))
    for y in range(74, 80):   # kuşak
        for x in range(a.shape[1]):
            if out[y, x, 3] > 0 and lab[y, x] == 's': put(out, x, y, hx('#ffcd75') if y in (74, 79) else hx('#ef7d57'))
    # üç köşeli şapka
    top, x0, x1 = hat(out, a, lab, front, crown=5, crown_up=6, brim=4 if front else (5, 5), col=hx('#2a2a35'), dark=hx('#1a1c2c'), light=hx('#333c57'), brim_rows=1)
    for side in (x0 - (4 if front else 5), x1 + (4 if front else 5)):
        for k in range(1, 5): put(out, side + (1 if side < x0 else -1) * (k // 2), top + 5 - k, INK)
    cxh = (x0 + x1) // 2
    for dx, dy in ((0, 0), (-1, 0), (1, 0), (-1, 1), (1, 1), (0, 2)): put(out, cxh + dx, top - 2 + dy, hx('#f4f4f4'))
    # göz bandı
    top2, rows, fy = forehead(a, lab)
    ey = fy + 5
    if front:
        for y in range(ey - 1, ey + 3):
            for x in range(57, 63): put(out, x, y, INK)
        for x in range(min(r[0] for r in rows.values()), 57): put(out, x, fy + 1, INK)
        for x in range(63, max(r[1] for r in rows.values()) + 1): put(out, x, fy + 1, INK)
    else:
        hx1 = max(rows[y][1] for y in rows if y >= fy)
        for y in range(ey - 1, ey + 3):
            for x in range(hx1 - 7, hx1 - 2): put(out, x, y, INK)
        for x in range(min(r[0] for r in rows.values()), hx1 - 7): put(out, x, fy + 1, INK)
    return out

def rockci(a, lab, front):
    def leather(px, x, y):
        v = val(px)
        return hx('#566c86') if v > 0.36 else hx('#333c57') if v > 0.26 else hx('#1a1c2c')
    out = recolor(a, lab, upper_mask, leather)
    out = recolor(out, lab, collar_mask, lambda px, x, y: hx('#94b0c2') if (x * 7 + y * 3) % 5 == 0 else hx('#333c57'))
    rng = np.random.RandomState(9)
    def jeans(px, x, y):
        if 88 <= y <= 91 and rng.rand() < 0.35: return SKIN
        return ramp(val(px), 230, 0.25, 0.75)
    out = recolor(out, lab, lambda c, x, y: c == 's' and LEGS(y), jeans)
    out = recolor(out, lab, lambda c, x, y: c == 's' and SHOES(y), lambda px, x, y: INK)
    lx0, lx1 = body_x(a, 48, 54)
    for x in range(lx0 + 2, lx1 - 1, 3):   # zımbalar
        if out[49, x, 3] > 0: put(out, x, 49, hx('#f4f4f4'))
    # uzun saç omuzlara
    top, rows = head_box(a, lab)
    hair = hx('#16131f')
    x0 = min(r[0] for r in rows.values()); x1 = max(r[1] for r in rows.values())
    cols = [x0, x0 + 1, x0 + 2] + ([x1, x1 - 1, x1 - 2] if front else [x0 + 3, x0 + 4])
    for x in cols:
        for y in range(top + 8, top + 30):
            if front and 56 <= x <= 72: continue
            put(out, x, y, hair if (x + y) % 5 else hx('#2a2636'))
    return out

def itfaiyeci(a, lab, front):
    coat = lambda px, x, y: ramp(val(px), 38, 0.55, 1.75)
    out = recolor(a, lab, lambda c, x, y: c == 's' and y <= 102, coat)
    strip_inner(out, a, lab)
    out = recolor(out, lab, collar_mask, lambda px, x, y: hx('#333c57'))
    out = recolor(out, lab, lambda c, x, y: c == 's' and SHOES(y), lambda px, x, y: INK)
    for y0 in (62, 72, 94):
        for y in (y0, y0 + 1, y0 + 2):
            for x in range(a.shape[1]):
                if out[y, x, 3] > 0 and lab[y, x] == 's': put(out, x, y, hx('#ffcd75') if y == y0 + 1 else hx('#c9d2dc'))
    red, red_d, red_l = hx('#b13e53'), hx('#7a2638'), hx('#ef7d57')
    top, x0, x1 = hat(out, a, lab, front, crown=5, crown_up=7, brim=3 if front else (8, 2), col=red, dark=red_d, light=red_l, dome=4)
    if front:
        cx = (x0 + x1) // 2
        for dy in range(5):
            for dx in range(-2 + dy // 3, 3 - dy // 3): put(out, cx + dx, top - 1 + dy, hx('#ffcd75'))
    return out

def ressam(a, lab, front):
    smock = lambda px, x, y: ramp(val(px), 222, 0.62, 1.9)
    out = recolor(a, lab, upper_mask, smock)
    strip_inner(out, a, lab)
    out = recolor(out, lab, collar_mask, lambda px, x, y: hx('#f4f4f4'))
    out = recolor(out, lab, lambda c, x, y: c == 's' and LEGS(y), lambda px, x, y: ramp(val(px), 40, 0.25, 2.3))
    rng = np.random.RandomState(3)
    paints = [hx('#b13e53'), hx('#ffcd75'), hx('#38b764'), hx('#f4f4f4'), hx('#ef7d57')]
    for y in range(52, 103):
        for x in range(a.shape[1]):
            if lab[y, x] == 's' and rng.rand() < 0.035:
                c = paints[rng.randint(len(paints))]
                put(out, x, y, c)
                if rng.rand() < 0.5: put(out, x + 1, y, c)
    top, rows = head_box(a, lab)
    x0 = min(r[0] for r in rows.values()); x1 = max(r[1] for r in rows.values())
    red, red_d = hx('#b13e53'), hx('#7a2638')
    for y in range(top - 3, top + 4):   # bere: yana eğik
        k = y - (top - 3)
        xa, xb = x0 - (1 if k > 2 else -1), x1 + (4 if k > 1 else 1)
        for x in range(xa, xb + 1):
            put(out, x, y, INK if (k == 0 or x in (xa, xb) or k == 6) else red_d if k >= 5 else red)
    put(out, (x0 + x1) // 2, top - 4, INK); put(out, (x0 + x1) // 2, top - 5, INK)
    return out

def dedektif(a, lab, front):
    trench = lambda px, x, y: ramp(val(px), 38, 0.45, 1.95)
    out = recolor(a, lab, lambda c, x, y: c == 's' and y <= 88, trench)
    out = recolor(out, lab, lambda c, x, y: c == 's' and 89 <= y <= 102, lambda px, x, y: ramp(val(px), 230, 0.2, 0.9))
    out = recolor(out, lab, lambda c, x, y: c == 's' and SHOES(y), lambda px, x, y: ramp(val(px), 20, 0.5, 0.8))
    for y in (72, 73, 74):   # kemer
        for x in range(a.shape[1]):
            if out[y, x, 3] > 0 and lab[y, x] == 's': put(out, x, y, ramp(0.35, 34, 0.5))
    if front:
        for y in (72, 73, 74):
            for x in range(62, 67): put(out, x, y, hx('#ffcd75') if x in (62, 66) or y in (72, 74) else ramp(0.35, 34, 0.5))
    gray, gray_d, gray_l = hx('#566c86'), hx('#1a1c2c'), hx('#94b0c2')
    top, x0, x1 = hat(out, a, lab, front, crown=4, crown_up=4, brim=6 if front else (5, 7), col=gray, dark=gray_d, light=gray_l, band=2, brim_rows=1, dome=1, pinch=True)
    return out

SKINS2 = {'basketbolcu': basketbolcu, 'asci': asci, 'doktor': doktor, 'kovboy': kovboy, 'astronot': astronot,
          'korsan': korsan, 'rockci': rockci, 'itfaiyeci': itfaiyeci, 'ressam': ressam, 'dedektif': dedektif}

if __name__ == '__main__':
    import sys
    want = sys.argv[1:] or list(SKINS2)
    for sid in want:
        os.makedirs(OUT + sid, exist_ok=True)
        for f in FRAMES:
            a = np.array(Image.open(SRC + f + '.png').convert('RGBA')).astype(int)
            lab = classify(a)
            out = SKINS2[sid](a, lab, f == 'front_idle')
            Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(f'{OUT}{sid}/{f}.png')
    sheet = Image.new('RGBA', (128 * 4 * 2, 128 * ((len(want) + 1) // 2)), (51, 60, 87, 255))
    for i, sid in enumerate(want):
        for j, f in enumerate(['front_idle', 'walk_1', 'walk_3', 'run_2']):
            sheet.alpha_composite(Image.open(f'{OUT}{sid}/{f}.png'), ((i % 2) * 512 + j * 128, (i // 2) * 128))
    sheet.save('skins2_preview.png')
    print('ok')
