"""
Aquarium sprite generator — run once before opening the app.
Outputs pixel-art PNGs to assets/sprites/
Requirements: pip install Pillow
"""

from PIL import Image, ImageDraw
import os, math, random, colorsys

OUT = "assets/sprites"
os.makedirs(f"{OUT}/plants", exist_ok=True)
os.makedirs(f"{OUT}/hardscape", exist_ok=True)
os.makedirs(f"{OUT}/background", exist_ok=True)

def save(img, path):
    img.save(path)
    print(f"  wrote {path}")

def clamp(v, lo=0, hi=255):
    return max(lo, min(hi, int(v)))

def lighten(rgb, amt):
    return tuple(clamp(c + amt) for c in rgb)

def darken(rgb, amt):
    return tuple(clamp(c - amt) for c in rgb)

def blend(c1, c2, t):
    return tuple(int(c1[i]*(1-t) + c2[i]*t) for i in range(len(c1)))

def pixel_noise(c, n):
    return (clamp(c[0] + n), clamp(c[1] + n), clamp(c[2] + n))

# Stardew Valley-style hue-shifted shading
def hue_shift_shadow(rgb, amt, hue_shift_deg=15):
    """Darken AND shift hue — shadows on warm hues go purple, cool go teal."""
    r, g, b = [c / 255.0 for c in rgb]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    warm = h < 0.17 or h > 0.83
    shift = -hue_shift_deg / 360.0 if warm else hue_shift_deg / 360.0
    h = (h + shift) % 1.0
    v = max(0.0, v - amt / 255.0)
    r2, g2, b2 = colorsys.hsv_to_rgb(h, min(1.0, s), v)
    return (clamp(r2 * 255), clamp(g2 * 255), clamp(b2 * 255))

def hue_shift_highlight(rgb, amt, hue_shift_deg=10):
    """Lighten AND shift hue slightly warmer (toward yellow-white)."""
    r, g, b = [c / 255.0 for c in rgb]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    h = (h + hue_shift_deg / 360.0) % 1.0
    s = max(0.0, s - 0.12)
    v = min(1.0, v + amt / 255.0)
    r2, g2, b2 = colorsys.hsv_to_rgb(h, s, v)
    return (clamp(r2 * 255), clamp(g2 * 255), clamp(b2 * 255))

# ─────────────────────────────────────────────────────────────
# SHRIMP SPRITES  (16×9px per frame — neocaridina scale)
# ─────────────────────────────────────────────────────────────

VARIANTS = {
    "red_cherry":    ((200, 40,  30),  (220, 80,  60)),
    "rili":          ((200, 40,  30),  (195,220, 225)),
    "blue_dream":    ((50,  100, 200), (80, 140, 230)),
    "blue_rili":     ((50,  100, 200), (195,220, 225)),
    "yellow_fire":   ((220, 200, 30),  (240, 220, 80)),
    "orange_pumpkin":((220, 130, 30),  (240, 165, 60)),
    "snowball":      ((230, 230, 240), (255, 255, 255)),
    "black_rose":    ((40,  25,  35),  (80,  50,  60)),
    "green_jade":    ((60,  160, 80),  (90,  200, 110)),
    "carbon_rili":   ((40,  25,  35),  (195,220, 225)),
}

RILI_VARIANTS = {"rili", "blue_rili", "carbon_rili"}

FW = 30   # frame width
FH = 10   # frame height

def draw_shrimp_frame(img, ox, oy, body_color, accent_color,
                      is_berried=False, is_molt=False, rili=False, head_dip=0):
    """
    Draw one 16×9 neocaridina shrimp frame onto img at offset (ox, oy).

    Anatomy layout (facing right, head_dip=0):
      y=0: . a . . . . . . . . . . . . . .   antennae
      y=1: a . . . C C C . . . . . . . . .   antenna, carapace top-arch
      y=2: . R R H C C C C . . . . . . . .   rostrum, head, carapace hump
      y=3: . . . H H C C C b b b . . . . .   head, carapace, abdomen
      y=4: . . . E H C C C b b b b . . T .   eye, carapace, abdomen, tail
      y=5: . . . . H C C b b b b b . . T T   belly, tail spread
      y=6: . . . . . C b b b b b . . . T .   lower abdomen, tail
      y=7: . . . . L . L . L . . . . . . .   legs
      y=8: . . . . . . . . . . . . . . . .
    """
    px = img.load()

    base = body_color
    hi   = hue_shift_highlight(base, 35)
    sh   = hue_shift_shadow(base, 35)
    dark = hue_shift_shadow(base, 60)
    ant  = darken(base, 25)
    eye  = (15, 12, 18)
    rili_c = (195, 220, 225)

    def put(x, y, c, a=255):
        rx, ry = ox + x, oy + y
        if 0 <= rx < img.width and 0 <= ry < img.height:
            px[rx, ry] = (*c[:3], a)

    # ── Molt: ghost outline only ──────────────────────────────
    if is_molt:
        out = (150, 180, 200)
        put(0, 0+head_dip, out); put(1, 1+head_dip, out)  # antennae
        put(1, 2+head_dip, out); put(2, 2+head_dip, out)  # rostrum
        for x in range(2, 5):
            put(x, 1+head_dip, out); put(x, 5+head_dip, out)  # head top/bottom
        put(3, 2+head_dip, out)  # extra head outline
        for x in range(4, 9):
            put(x, 1, out); put(x, 6, out)  # carapace top/bottom
        for seg in range(3):
            sx = 8 + seg*2
            put(sx, 2, out); put(sx+1, 2, out)  # abdomen top
            put(sx, 6, out); put(sx+1, 6, out)  # abdomen bottom
        put(13, 4, out); put(14, 4, out); put(15, 5, out)  # tail
        return

    # ── Antennae (2 fine lines from head) ────────────────────
    hd = min(head_dip, 1)  # cap dip to keep within frame
    put(0, 0+hd, ant)
    put(1, 1+hd, ant)
    put(2, 1+hd, ant)

    # ── Rostrum ───────────────────────────────────────────────
    put(1, 2+hd, hi)
    put(2, 2+hd, darken(base, 10))

    # ── Head (x=2-4, y=1+hd .. 5+hd) ────────────────────────
    for x in range(2, 5):
        for y in range(1+hd, 6+hd):
            if y == 1+hd:
                c = hi
            elif y == 5+hd:
                c = sh
            elif x == 4 and y == 2+hd:
                c = darken(base, 15)  # head/carapace border
            else:
                c = base
            put(x, y, c)

    # Eye
    put(3, 2+hd, eye)

    # ── Carapace (x=4-8, y=1..6) — the arch hump ─────────────
    for x in range(4, 9):
        for y in range(1, 7):
            if y == 1:
                c = hi
            elif y == 6:
                c = sh
            elif x == 4:
                c = darken(base, 20)  # front wall of carapace
            elif x == 8:
                c = darken(base, 15)  # back wall
            elif y == 2:
                c = hue_shift_highlight(base, 20)  # sub-highlight
            else:
                c = base
            put(x, y, c)

    # ── Abdomen segments (x=8-13, 3 segs × 2px wide) ─────────
    for seg in range(3):
        sx = 8 + seg * 2
        is_rili_seg = rili and seg == 1  # middle segment = transparent in rili
        for dx in range(2):
            for y in range(2, 7):
                if is_rili_seg:
                    put(sx+dx, y, rili_c, 60)
                    continue
                if y == 2:
                    c = hi
                elif y == 6:
                    c = sh
                elif y == 3 and dx == 0:
                    c = hue_shift_highlight(base, 15)
                else:
                    c = base
                put(sx+dx, y, c)
        # segment divider line (single dark pixel column at left edge of each seg)
        put(sx, 3, dark)
        put(sx, 5, dark)

    # ── Tail fan (x=13-15, y=3-6) ────────────────────────────
    put(13, 4, hi);  put(13, 5, base)
    put(14, 3, hi);  put(14, 4, base); put(14, 5, sh)
    put(15, 4, base); put(15, 5, sh)

    # ── Walking legs (3 dots below body) ─────────────────────
    for lx in [5, 7, 9]:
        put(lx, 7, darken(base, 35))

    # ── Berried eggs (under abdomen) ─────────────────────────
    if is_berried:
        egg_c = (215, 155, 40)
        egg_hi = lighten(egg_c, 30)
        for i in range(4):
            ex = 9 + (i % 2)
            ey = 7 + (i // 2)
            put(ex, ey, egg_hi if i % 2 == 0 else egg_c)


def draw_shrimp_frame_v2(img, ox, oy, body_color, accent_color,
                         is_berried=False, is_molt=False, rili=False, head_dip=0):
    """Draw a longer, thinner neocaridina frame with a 22x8 native footprint."""
    px = img.load()
    base = body_color
    hi = hue_shift_highlight(base, 35)
    sh = hue_shift_shadow(base, 35)
    dark = hue_shift_shadow(base, 60)
    ant = darken(base, 28)
    eye = (15, 12, 18)
    rili_c = (195, 220, 225)

    def put(x, y, c, a=255):
        rx, ry = ox + x, oy + y
        if 0 <= rx < img.width and 0 <= ry < img.height:
            px[rx, ry] = (*c[:3], a)

    hd = min(head_dip, 1)

    if is_molt:
        out = (150, 180, 200)
        outline = [
            (0,0), (1,0), (2,1), (3,1), (3,2), (4,2),
            (5,2), (6,1), (7,1), (8,0), (9,0), (10,1),
            (11,2), (12,2), (13,2), (14,2), (15,2),
            (16,3), (17,3), (18,3), (19,4), (20,3), (21,4),
        ]
        for x, y in outline:
            put(x, y + (hd if x < 8 else 0), out)
        for x in range(5, 19):
            put(x, 5, out)
        return

    # Long antennae and rostrum.
    for x, y in [(0,0), (1,0), (2,1), (3,1), (0,2), (1,2), (2,2)]:
        put(x, y + hd, ant)
    for x, y, c in [(3,2,hi), (4,2,hi), (5,2,base)]:
        put(x, y + hd, c)

    # Compact head with a visible eye.
    for x in range(5, 8):
        for y in range(2 + hd, 5 + hd):
            c = hi if y == 2 + hd else (sh if y == 4 + hd else base)
            put(x, y, c)
    put(6, 2 + hd, eye)

    # Pronounced female-style carapace arch, still slender at the belly.
    carapace = {7: (1, 5), 8: (0, 5), 9: (0, 5), 10: (1, 5), 11: (2, 5)}
    for x, (yt, yb) in carapace.items():
        for y in range(yt, yb + 1):
            if y == yt:
                c = hi
            elif y == yb:
                c = sh
            elif x in (7, 11):
                c = darken(base, 14)
            elif y == yt + 1:
                c = hue_shift_highlight(base, 16)
            else:
                c = base
            put(x, y, c)

    # Four narrow abdomen segments taper toward the tail.
    segments = [(11, 12, 2, 5), (13, 14, 2, 5), (15, 16, 3, 5), (17, 18, 3, 4)]
    for seg, (x0, x1, yt, yb) in enumerate(segments):
        is_rili_seg = rili and seg in (1, 2)
        for x in range(x0, x1 + 1):
            for y in range(yt, yb + 1):
                if is_rili_seg:
                    put(x, y, rili_c, 58)
                else:
                    c = hi if y == yt else (sh if y == yb else base)
                    put(x, y, c)
        put(x0, yt + 1, dark)
        if yb - yt > 2:
            put(x0, yb - 1, dark)

    # Tiny fan tail.
    put(19, 3, hi); put(19, 4, base)
    put(20, 2, hi); put(20, 4, sh)
    put(21, 3, base); put(21, 5, sh)

    # Fine legs/swimmerets, sparse enough to keep the body from looking heavy.
    for lx in [7, 9, 12, 14]:
        put(lx, 6, darken(base, 38))
    put(10, 7, darken(base, 45))

    if is_berried:
        egg_c = (215, 155, 40)
        egg_hi = lighten(egg_c, 30)
        for i, (ex, ey) in enumerate([(12,6), (13,6), (14,6), (13,7)]):
            put(ex, ey, egg_hi if i % 2 == 0 else egg_c)


def draw_shrimp_frame_v3(img, ox, oy, body_color, accent_color,
                         is_berried=False, is_molt=False, rili=False, head_dip=0, sex="female"):
    """Higher-detail 30x10 neocaridina, drawn small in the renderer."""
    px = img.load()
    base = body_color
    hi = hue_shift_highlight(base, 38)
    mid_hi = hue_shift_highlight(base, 18)
    sh = hue_shift_shadow(base, 38)
    dark = hue_shift_shadow(base, 64)
    ant = darken(base, 30)
    eye = (12, 10, 14)
    rili_c = (195, 220, 225)

    def put(x, y, c, a=255):
        rx, ry = ox + x, oy + y
        if 0 <= rx < img.width and 0 <= ry < img.height:
            px[rx, ry] = (*c[:3], a)

    hd = min(head_dip, 1)

    if is_molt:
        out = (150, 180, 200)
        outline = [
            (0,1), (1,1), (2,2), (3,2), (4,2), (5,3), (6,3),
            (7,3), (8,2), (9,2), (10,1), (11,1), (12,1), (13,1),
            (14,2), (15,3), (16,3), (17,3), (18,3), (19,3),
            (20,3), (21,3), (22,4), (23,4), (24,4), (25,5),
            (26,4), (27,3), (28,4), (29,5),
        ]
        for x, y in outline:
            put(x, y + (hd if x < 10 else 0), out)
        for x in range(7, 26):
            put(x, 7, out)
        return

    # Antennae and rostrum.
    for x, y in [(0,1), (1,1), (2,2), (3,2), (4,2), (0,3), (1,3), (2,3), (3,3)]:
        put(x, y + hd, ant)
    for x, y, c in [(4,3,hi), (5,3,hi), (6,3,base), (7,3,base)]:
        put(x, y + hd, c)

    # Head.
    for x in range(7, 11):
        for y in range(3 + hd, 7 + hd):
            c = hi if y == 3 + hd else (sh if y == 6 + hd else base)
            if x == 10 and y in (4 + hd, 5 + hd):
                c = darken(base, 12)
            put(x, y, c)
    put(8, 3 + hd, eye)

    male = sex == "male"

    # Carapace high arch and saddle (male is narrower/leaner).
    carapace = {10: (2, 6 if male else 7), 11: (1, 6 if male else 7), 12: (1, 6 if male else 7),
                13: (1, 6 if male else 7), 14: (2, 6 if male else 7), 15: (3, 6 if male else 7)}
    for x, (yt, yb) in carapace.items():
        for y in range(yt, yb + 1):
            if y == yt:
                c = hi
            elif y == yb:
                c = sh
            elif y == yt + 1:
                c = mid_hi
            elif x in (10, 15):
                c = darken(base, 16)
            else:
                c = base
            put(x, y, c)

    # Five slender abdomen segments tapering down to a fan tail.
    segments = [
        (15, 16, 3, 6 if male else 7),
        (17, 18, 3, 6 if male else 7),
        (19, 20, 3, 5 if male else 6),
        (21, 22, 4, 5 if male else 6),
        (23, 24, 4, 4 if male else 5),
    ]
    for seg, (x0, x1, yt, yb) in enumerate(segments):
        is_rili_seg = rili and seg in (1, 2, 3)
        for x in range(x0, x1 + 1):
            for y in range(yt, yb + 1):
                if is_rili_seg:
                    put(x, y, rili_c, 55)
                else:
                    c = hi if y == yt else (sh if y == yb else base)
                    if y == yt + 1 and x == x0 + 1:
                        c = mid_hi
                    put(x, y, c)
        put(x0, yt + 1, dark)

    # Tail fan and uropods.
    for x, y, c in [
        (25,4,hi), (25,5,base), (26,4,base), (26,6,sh),
        (27,3,hi), (27,5,base), (28,4,base), (28,6,sh), (29,5,sh),
    ]:
        put(x, y, c)

    # Fine legs/swimmerets.
    leg_y = 7 if male else 8
    for lx in [10, 12, 15, 17, 19]:
        put(lx, leg_y, darken(base, 42))
    for lx in [13, 16, 18]:
        put(lx, min(9, leg_y + 1), darken(base, 48))

    # Males show a slightly longer rostrum and slimmer tail profile.
    if male:
        put(6, 2 + hd, hi)
        put(25, 4, darken(base, 12))

    if is_berried:
        egg_c = (215, 155, 40)
        egg_hi = lighten(egg_c, 30)
        for i, (ex, ey) in enumerate([(16,8), (17,8), (18,8), (17,9), (19,8)]):
            put(ex, ey, egg_hi if i % 2 == 0 else egg_c)


def draw_shrimp_frame_v4(img, ox, oy, body_color, accent_color,
                         is_berried=False, is_molt=False, rili=False, head_dip=0, sex="female"):
    """Slender neocaridina profile with visible feeding claws (30x10)."""
    px = img.load()
    base = body_color
    hi = hue_shift_highlight(base, 34)
    mid_hi = hue_shift_highlight(base, 16)
    sh = hue_shift_shadow(base, 34)
    dark = hue_shift_shadow(base, 58)
    eye = (12, 10, 14)
    rili_c = (195, 220, 225)
    male = sex == "male"

    def put(x, y, c, a=255):
        rx, ry = ox + x, oy + y
        if 0 <= rx < img.width and 0 <= ry < img.height:
            px[rx, ry] = (*c[:3], a)

    hd = min(head_dip, 1)

    if is_molt:
        out = (150, 180, 200)
        for x, y in [(2,3), (4,3), (6,3), (8,2), (10,2), (12,2), (14,2), (16,2), (18,2), (20,2), (22,3), (24,3), (26,4), (28,5)]:
            put(x, y, out)
        for x in range(9, 25):
            put(x, 6, out)
        return

    # Antennae and rostrum (softened for a cuter read).
    for x, y in [(0,2), (1,2), (2,3), (3,3), (4,3), (2,4), (3,4)]:
        put(x, y + hd, darken(base, 26))
    put(4, 4 + hd, hi)
    put(5, 4 + hd, mid_hi)

    # Head and carapace, reduced hump.
    for x in range(6, 14):
        yt = 3 if x < 10 else 2
        yb = 6 if male else 7
        for y in range(yt, yb + 1):
            c = base
            if y == yt:
                c = hi
            elif y == yb:
                c = sh
            elif x in (6, 13):
                c = darken(base, 14)
            elif y == yt + 1:
                c = mid_hi
            put(x, y, c)
    put(7, 3 + hd, eye)
    put(8, 4 + hd, lighten(eye, 45))

    # Long abdomen with subtle taper.
    segs = [(13, 15, 3, 6 if male else 7), (16, 18, 3, 6 if male else 7),
            (19, 21, 3, 6), (22, 24, 4, 6), (25, 26, 4, 5)]
    for si, (x0, x1, yt, yb) in enumerate(segs):
        rili_seg = rili and si in (1, 2, 3)
        for x in range(x0, x1 + 1):
            for y in range(yt, yb + 1):
                if rili_seg:
                    put(x, y, rili_c, 58)
                else:
                    c = hi if y == yt else (sh if y == yb else base)
                    if y == yt + 1 and x == x0 + 1:
                        c = mid_hi
                    put(x, y, c)
        put(x0, yt + 1, dark)

    # Tail fan.
    for x, y, c in [
        (27, 4, hi), (27, 5, base), (28, 3, hi), (28, 5, sh),
        (29, 4, base), (29, 6, sh),
    ]:
        put(x, y, c)

    # Smaller rounded picking hands (cute, less "crab-claw" look).
    hand_base = darken(base, 22)
    hand_hi = lighten(hand_base, 22)
    for x, y in [(5, 7 + hd), (4, 7 + hd), (4, 8 + hd), (6, 7 + hd)]:
        put(x, min(9, y), hand_base)
    put(4, min(9, 7 + hd), hand_hi)
    put(5, min(9, 7 + hd), hand_hi)

    # Remaining walking/swimmeret legs kept subtle.
    leg_y = 7 if male else 8
    for lx in [10, 13, 16, 19]:
        put(lx, leg_y, darken(base, 40))
    for lx in [12, 15, 18]:
        put(lx, min(9, leg_y + 1), darken(base, 46))

    if is_berried:
        egg_c = (215, 155, 40)
        egg_hi = lighten(egg_c, 28)
        for i, (ex, ey) in enumerate([(16,8), (17,8), (18,8), (17,9), (19,8)]):
            put(ex, ey, egg_hi if i % 2 == 0 else egg_c)


def make_shrimp_sheet(name, body_color, accent_color, rili=False,
                      is_berried=False, is_molt=False, sex="female"):
    """
    Sprite sheet: 6 cols × 4 rows, each frame FW×FH
    Row 0 (y=0):        6-frame walk strip
    Row 1 (y=FH):       4-frame idle strip
    Row 2 (y=FH*2):     4-frame graze strip
    Row 3 (y=FH*3):     4-frame swim_burst strip
    Total: 96×36px
    """
    W = FW * 6
    H = FH * 4
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    # Walk: 6 frames, alternate leg positions via slight body offset
    for f in range(6):
        draw_shrimp_frame_v4(img, f*FW, 0, body_color, accent_color,
                             rili=rili, is_berried=is_berried, is_molt=is_molt, sex=sex)

    # Idle: 4 frames, gentle y-bob
    for f in range(4):
        dip = 1 if f in (1, 3) else 0
        draw_shrimp_frame_v4(img, f*FW, FH, body_color, accent_color,
                             head_dip=dip, rili=rili, is_berried=is_berried,
                             is_molt=is_molt, sex=sex)

    # Graze: head dips down 0→1→1→0
    for f, dip in enumerate([0, 1, 1, 0]):
        draw_shrimp_frame_v4(img, f*FW, FH*2, body_color, accent_color,
                             head_dip=dip, rili=rili, is_berried=is_berried,
                             is_molt=is_molt, sex=sex)

    # Swim burst: same as idle (shrimp tucks legs)
    for f in range(4):
        draw_shrimp_frame_v4(img, f*FW, FH*3, body_color, accent_color,
                             rili=rili, is_berried=is_berried, is_molt=is_molt, sex=sex)

    return img


print("Generating shrimp sprites...")
for vname, (body, acc) in VARIANTS.items():
    rili = vname in RILI_VARIANTS
    male_img = make_shrimp_sheet(vname, body, acc, rili=rili, sex="male")
    female_img = make_shrimp_sheet(vname, body, acc, rili=rili, sex="female")
    save(male_img, f"{OUT}/{vname}_male.png")
    save(female_img, f"{OUT}/{vname}_female.png")

img = make_shrimp_sheet("red_cherry_berried",
                        VARIANTS["red_cherry"][0], VARIANTS["red_cherry"][1],
                        is_berried=True, sex="female")
save(img, f"{OUT}/red_cherry_berried.png")

img = make_shrimp_sheet("molt", (150,180,200), (180,200,220), is_molt=True)
save(img, f"{OUT}/molt.png")


# ─────────────────────────────────────────────────────────────
# PLANTS
# ─────────────────────────────────────────────────────────────

print("Generating plant sprites...")

def java_fern():
    """3 leaf sizes: small(16×26), medium(24×39), large(32×52) → 76×52px"""
    img = Image.new("RGBA", (76, 52), (0, 0, 0, 0))
    px = img.load()
    base = (55, 120, 55)
    hi   = lighten(base, 50)
    sh   = darken(base, 40)
    vein = lighten(base, 70)

    def draw_leaf(ox, oy, w, h):
        mid = ox + w // 2
        for y in range(h):
            frac = y / max(1, h - 1)
            half_w = int((w / 2) * math.sin(frac * math.pi) * (1 - frac * 0.3))
            wave = int(math.sin(frac * math.pi * 3) * 1.5)
            for dx in range(-half_w, half_w + 1):
                x = mid + dx + wave
                if 0 <= x < img.width and 0 <= oy + y < 52:
                    edge = abs(dx) >= half_w - 1
                    if y == 0:
                        c = hi
                    elif edge:
                        c = sh
                    elif abs(dx) < 2:
                        c = vein
                    elif (x + y) % 7 == 0:
                        c = lighten(base, 18)
                    else:
                        c = base
                    px[x, oy + y] = (*c, 255)

    draw_leaf(0,  26, 16, 26)
    draw_leaf(20, 13, 24, 39)
    draw_leaf(44, 0,  32, 52)
    return img

save(java_fern(), f"{OUT}/plants/java_fern.png")


def carpet_tile():
    """8×6px tileable ground cover"""
    img = Image.new("RGBA", (8, 6), (0, 0, 0, 0))
    px = img.load()
    base = (60, 140, 50)
    hi   = lighten(base, 50)
    sh   = darken(base, 35)
    dark = darken(base, 60)
    pattern = [
        [sh,   base, hi,   base, sh,   hi,   base, sh  ],
        [base, hi,   base, sh,   base, base, sh,   hi  ],
        [hi,   base, sh,   hi,   dark, base, hi,   base],
        [base, sh,   hi,   base, hi,   sh,   base, sh  ],
        [sh,   base, base, sh,   base, hi,   sh,   base],
        [dark, sh,   base, base, sh,   base, dark, sh  ],
    ]
    for y in range(6):
        for x in range(8):
            px[x, y] = (*pattern[y][x], 255)
    return img

save(carpet_tile(), f"{OUT}/plants/carpet.png")


def anubias():
    """Broad rounded leaf sprite — 64×28px (two leaves)"""
    img = Image.new("RGBA", (64, 28), (0, 0, 0, 0))
    px = img.load()
    base = (45, 105, 45)
    hi   = lighten(base, 55)
    sh   = darken(base, 40)
    vein = lighten(base, 80)
    stem = darken(base, 20)

    def draw_anubias_leaf(ox, scale=1.0):
        w, h = int(30 * scale), int(22 * scale)
        mid = ox + w // 2
        for y in range(h, h + 3):
            if 0 <= y < 28:
                px[mid, y] = (*stem, 255)
        for y in range(h):
            frac = y / max(1, h - 1)
            half = int((w / 2) * math.sin(frac * math.pi) * (0.9 + 0.1 * math.cos(frac * 4)))
            wave = int(math.sin(frac * math.pi * 2) * 1.0)
            for dx in range(-half, half + 1):
                x = mid + dx + wave
                if 0 <= x < img.width and 0 <= y < 28:
                    edge = abs(dx) >= half - 1
                    if frac < 0.15 and not edge:
                        c = hi
                    elif edge:
                        c = sh
                    elif abs(dx) < 2:
                        c = vein
                    elif (x + y) % 9 == 0:
                        c = lighten(base, 18)
                    elif abs(dx) < 4 and 0.2 < frac < 0.8:
                        c = lighten(base, 20)
                    else:
                        c = base
                    px[x, y] = (*c, 255)

    draw_anubias_leaf(1,  1.0)
    draw_anubias_leaf(34, 0.85)
    return img

save(anubias(), f"{OUT}/plants/anubias.png")


def vallisneria():
    """Tall ribbon plant, 28×70."""
    img = Image.new("RGBA", (28, 70), (0, 0, 0, 0))
    px = img.load()
    base = (62, 150, 70)
    hi   = lighten(base, 48)
    sh   = darken(base, 42)
    for blade in range(7):
        root = 8 + blade * 2
        h = 42 + (blade * 9) % 27
        phase = blade * 0.8
        for i in range(h):
            y = 69 - i
            x = int(root + math.sin(i * 0.12 + phase) * (1 + i / h * 3.0))
            if 0 <= x < 28 and 0 <= y < 70:
                c = hi if blade % 3 == 0 else (sh if blade % 3 == 1 else base)
                px[x, y] = (*c, 245)
                if blade % 2 == 0 and x + 1 < 28 and i < h - 3:
                    px[x + 1, y] = (*base, 210)
    return img

save(vallisneria(), f"{OUT}/plants/vallisneria.png")


def buce():
    """Small Bucephalandra rhizome with oval leaves, 38×24."""
    img = Image.new("RGBA", (38, 24), (0, 0, 0, 0))
    px = img.load()
    base = (42, 92, 64)
    blue = (58, 112, 98)
    hi   = (126, 174, 150)
    sh   = (24, 60, 48)
    stem = (56, 64, 42)
    for x in range(7, 32):
        px[x, 18] = (*stem, 255)
    for cx, cy, w, h, col in [(9, 14, 9, 6, base), (15, 11, 10, 7, blue), (21, 13, 11, 7, base), (28, 10, 10, 7, blue), (31, 16, 8, 5, base)]:
        for y in range(cy - h // 2, cy + h // 2 + 1):
            for x in range(cx - w // 2, cx + w // 2 + 1):
                if 0 <= x < 38 and 0 <= y < 24 and ((x - cx) / (w / 2)) ** 2 + ((y - cy) / (h / 2)) ** 2 <= 1:
                    c = hi if y <= cy - h // 2 + 1 else (sh if abs(x - cx) > w // 2 - 2 else col)
                    px[x, y] = (*c, 255)
    return img

def buce_hd():
    """Tiger lotus focal with long petioles and clear leaf silhouette, 48x84."""
    W, H = 48, 84
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = img.load()
    stem = (86, 110, 58)
    stem_sh = (54, 72, 36)
    leaf_red = (166, 66, 84)
    leaf_rose = (188, 96, 122)
    leaf_bronze = (142, 98, 70)
    hi = (234, 166, 170)
    sh = (78, 36, 46)

    def leaf(cx, cy, w, h, col):
        for y in range(cy - h // 2, cy + h // 2 + 1):
            for x in range(cx - w // 2, cx + w // 2 + 1):
                if 0 <= x < W and 0 <= y < H:
                    nx = (x - cx) / max(1, (w / 2))
                    ny = (y - cy) / max(1, (h / 2))
                    if nx * nx + ny * ny <= 1:
                        c = col
                        if y <= cy - h // 2 + 1:
                            c = hi
                        elif y >= cy + h // 2 - 1:
                            c = sh
                        elif abs(nx) > 0.86:
                            c = darken(col, 18)
                        px[x, y] = (*c, 255)
        for y in range(max(0, cy - h // 2 + 1), min(H, cy + h // 2)):
            if 0 <= cx < W and (y + cx) % 2 == 0:
                px[cx, y] = (*lighten(col, 22), 255)

    pads = [(12, 32, 15, 10, leaf_bronze), (20, 23, 17, 12, leaf_red), (30, 18, 16, 12, leaf_rose),
            (36, 30, 14, 10, leaf_bronze), (24, 40, 16, 11, leaf_red)]
    for cx, cy, w, h, col in pads:
        # Long petioles to push vertical composition.
        for y in range(H - 3, cy + h // 2, -1):
            x = cx + int(math.sin((H - y) * 0.18 + cx * 0.11) * 1.4)
            if 0 <= x < W:
                px[x, y] = (*stem, 255)
                if x - 1 >= 0 and y % 3 == 0:
                    px[x - 1, y] = (*stem_sh, 200)
        leaf(cx, cy, w, h, col)

    for x in range(8, 40):
        px[x, H - 2] = (64, 84, 42, 255)
    return img

save(buce_hd(), f"{OUT}/plants/buce.png")


def plant_rotala():
    """Rotala stem set: three bottom-anchored growth stages, 16x48 each."""
    img = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    px = img.load()
    stem = (74, 134, 66)
    stem_sh = (36, 84, 44)
    leaf = (88, 160, 78)
    tip = (146, 198, 110)
    hi = (172, 232, 140)
    mid = (104, 176, 90)
    heights = [24, 36, 48]
    for stage, h in enumerate(heights):
        ox = stage * 16
        cx = ox + 8
        for y in range(48 - h, 48):
            frac = (48 - y) / h
            c = hi if frac > 0.82 else stem
            px[cx, y] = (*c, 255)
            if y % 3 == 0:
                px[cx - 1, y] = (*stem_sh, 210)
            if y % 4 == 1 and cx + 1 < 48:
                px[cx + 1, y] = (*darken(stem, 12), 220)
        interval = max(3, h // 8)
        for i in range(h // interval):
            y = 47 - i * interval
            if y < 48 - h:
                continue
            frac = i / max(1, h // interval - 1)
            c = blend(leaf, tip, min(1, frac * 0.55))
            reach = 2 + (2 if frac > 0.35 else 1)
            for side in (-1, 1):
                for r in range(1, reach + 1):
                    x = cx + side * r
                    if 0 <= x < 48:
                        lc = hi if r == 1 and frac > 0.62 else (darken(c, 22) if r == reach else c)
                        px[x, y] = (*lc, 255)
                        if r == 2 and y > 0:
                            px[x, y - 1] = (*lighten(lc, 12), 255)
                        if r >= 2 and y + 1 < 48 and frac > 0.38:
                            px[x, y + 1] = (*mid, 255)
                        if r == reach and y + 1 < 48 and frac > 0.55:
                            px[x, y + 1] = (*darken(mid, 14), 220)
        # Fine whorl detail at each node for a denser, "HD" silhouette
        for y in range(48 - h + 1, 48, max(2, interval - 1)):
            for side in (-1, 1):
                nx = cx + side * (4 if y % 2 == 0 else 3)
                if 0 <= nx < 48:
                    px[nx, y] = (*lighten(leaf, 18), 255)
                    if 0 <= nx + side < 48:
                        px[nx + side, y] = (*darken(leaf, 14), 180)
    return img

save(plant_rotala(), f"{OUT}/plants/rotala.png")


def plant_crypt():
    """Cryptocoryne rosette with wavy broad leaves, 44x34."""
    img = Image.new("RGBA", (44, 34), (0, 0, 0, 0))
    px = img.load()
    base = (55, 115, 62)
    olive = (88, 118, 58)
    hi = (120, 165, 95)
    sh = (30, 68, 36)

    def leaf_shape(cx, cy, length, angle, width, color):
        for i in range(length):
            t = i / max(1, length - 1)
            x = int(cx + math.cos(angle) * i + math.sin(t * math.pi * 3) * 1.2)
            y = int(cy - math.sin(angle) * i)
            half = max(0, int(width * math.sin(t * math.pi) * (1 - t * 0.2)))
            for dx in range(-half, half + 1):
                xx = x + dx
                if 0 <= xx < 44 and 0 <= y < 34:
                    c = hi if dx < 0 and t < 0.45 else (sh if abs(dx) == half else color)
                    px[xx, y] = (*c, 255)

    for angle, length, width, color in [
        (-2.35, 22, 4, olive), (-2.0, 28, 5, base), (-1.58, 25, 4, base),
        (-1.24, 30, 5, olive), (-0.9, 24, 4, base), (-0.58, 20, 3, base),
    ]:
        leaf_shape(22, 32, length, angle, width, color)
    for x in range(18, 27):
        px[x, 31] = (70, 72, 38, 255)
    return img

def plant_crypt_hd():
    """Ludwigia-style colorful stem bunch, 52x48 (uses 'crypt' key)."""
    img = Image.new("RGBA", (52, 48), (0, 0, 0, 0))
    px = img.load()
    stem = (90, 124, 64)
    stem_sh = (52, 78, 38)
    green = (92, 164, 82)
    amber = (174, 112, 62)
    red = (182, 68, 78)
    hi = (238, 172, 138)
    sh = (76, 38, 34)

    stems = [10, 16, 21, 27, 33, 39, 44]
    for sx in stems:
        for y in range(47, 14, -1):
            px[sx, y] = (*stem, 255)
            if y % 3 == 0 and sx + 1 < 52:
                px[sx + 1, y] = (*stem_sh, 220)

    def stem_leaf(cx, cy, w, h, col):
        for y in range(cy - h // 2, cy + h // 2 + 1):
            for x in range(cx - w // 2, cx + w // 2 + 1):
                if 0 <= x < 52 and 0 <= y < 48:
                    nx = (x - cx) / max(1, (w / 2))
                    ny = (y - cy) / max(1, (h / 2))
                    if nx * nx + ny * ny <= 1:
                        c = col
                        if y <= cy - h // 2 + 1:
                            c = hi
                        elif y >= cy + h // 2 - 1:
                            c = sh
                        elif abs(nx) > 0.86:
                            c = darken(col, 20)
                        px[x, y] = (*c, 255)

    palette = [green, amber, red, amber, green, red, amber]
    for i, sx in enumerate(stems):
        col = palette[i % len(palette)]
        for n in range(6):
            yy = 44 - n * 5 - (i % 2)
            off = 3 + (n % 3)
            stem_leaf(sx - off, yy, 7, 4, col)
            stem_leaf(sx + off, yy - 1, 7, 4, blend(col, red, 0.25))

    for x in range(8, 46):
        if x % 2 == 0:
            px[x, 46] = (72, 84, 42, 255)
    return img

save(plant_crypt_hd(), f"{OUT}/plants/crypt.png")


def plant_moss():
    """Irregular Java moss clump, 46x24."""
    img = Image.new("RGBA", (46, 24), (0, 0, 0, 0))
    px = img.load()
    colors = [(36, 100, 50), (52, 138, 58), (82, 170, 72), (26, 72, 38)]
    rng = random.Random(404)
    for _ in range(220):
        x = rng.randrange(2, 44)
        y = rng.randrange(4, 23)
        if ((x - 23) / 23) ** 2 + ((y - 17) / 10) ** 2 > 1.0:
            continue
        c = colors[rng.randrange(len(colors))]
        px[x, y] = (*c, 255)
        if rng.random() < 0.45 and y > 0:
            px[x, y - 1] = (*lighten(c, 18), 255)
        if rng.random() < 0.16 and x + 1 < 46:
            px[x + 1, y] = (*darken(c, 22), 255)
    return img

save(plant_moss(), f"{OUT}/plants/moss.png")

# Full plant-art direction pass (taller, richer color, cohesive pairing).
def java_fern_hd():
    img = Image.new("RGBA", (40, 88), (0, 0, 0, 0))
    px = img.load()
    leaf = (54, 128, 76); hi = (136, 206, 124); sh = (28, 74, 44)
    rhiz = (82, 72, 46)
    for x in range(8, 32):
        px[x, 86] = (*rhiz, 255)
    for cx, tilt, h, spread in [(9, -0.38, 62, 6), (16, -0.12, 76, 7), (24, 0.18, 80, 8), (31, 0.44, 64, 6)]:
        for i in range(h):
            t = i / max(1, h - 1)
            x = int(cx + math.sin(t * 2.7 + tilt * 2.9) * (1 + t * spread))
            y = 85 - i
            w = max(1, int((1 - abs(t - 0.45) * 1.45) * 4))
            for dx in range(-w, w + 1):
                xx = x + dx
                if 0 <= xx < 40 and 0 <= y < 88:
                    c = hi if dx <= -w + 1 else (sh if dx >= w - 1 else leaf)
                    px[xx, y] = (*c, 255)
    return img

def anubias_hd():
    img = Image.new("RGBA", (52, 38), (0, 0, 0, 0))
    px = img.load()
    base = (58, 126, 66); emerald = (46, 116, 88); hi = (164, 218, 136); sh = (26, 68, 36)
    rhiz = (78, 68, 42)
    for x in range(8, 44):
        px[x, 31] = (*rhiz, 255)
        if x % 2 == 0:
            px[x, 32] = (*darken(rhiz, 10), 255)
    leaves = [(12, 20, 15, 11, base), (20, 15, 18, 12, emerald), (31, 19, 16, 10, base),
              (39, 14, 15, 10, emerald), (27, 10, 14, 9, base)]
    for cx, cy, w, h, col in leaves:
        for y in range(cy - h // 2, cy + h // 2 + 1):
            for x in range(cx - w // 2, cx + w // 2 + 1):
                if 0 <= x < 52 and 0 <= y < 38:
                    nx = (x - cx) / max(1, (w / 2))
                    ny = (y - cy) / max(1, (h / 2))
                    if nx * nx + ny * ny <= 1:
                        c = hi if y <= cy - h // 2 + 1 else (sh if y >= cy + h // 2 - 1 else col)
                        px[x, y] = (*c, 255)
        for y in range(max(0, cy - h // 2 + 1), min(38, cy + h // 2)):
            if 0 <= cx < 52 and (y + cx) % 2 == 0:
                px[cx, y] = (*lighten(col, 20), 255)
    return img

def vallisneria_hd():
    img = Image.new("RGBA", (40, 116), (0, 0, 0, 0))
    px = img.load()
    cols = [(66, 160, 84), (86, 188, 102), (48, 134, 68), (36, 106, 56)]
    for blade in range(12):
        root = 4 + blade * 3
        h = 76 + (blade * 11) % 36
        phase = blade * 0.58
        for i in range(h):
            y = 115 - i
            x = int(root + math.sin(i * 0.088 + phase) * (1 + i / h * 6.6))
            if 0 <= x < 40 and 0 <= y < 116:
                c = cols[blade % len(cols)]
                px[x, y] = (*c, 250)
                if x + 1 < 40 and blade % 2 == 0 and i < h - 5:
                    px[x + 1, y] = (*darken(c, 18), 210)
    return img

def rotala_hd():
    img = Image.new("RGBA", (72, 96), (0, 0, 0, 0))
    px = img.load()
    stem = (84, 142, 74); stem_sh = (44, 84, 44)
    leaf = (98, 164, 92); tip = (196, 138, 128); hi = (166, 220, 136)
    heights = [52, 74, 96]
    for stage, h in enumerate(heights):
        ox = stage * 24
        stem_x = [ox + 7, ox + 12, ox + 17]
        stem_h = [max(34, h - 14), h, max(38, h - 10)]
        for si, cx in enumerate(stem_x):
            hh = stem_h[si]
            for y in range(96 - hh, 96):
                t = (96 - y) / max(1, hh)
                c = hi if t > 0.82 else stem
                px[cx, y] = (*c, 255)
                if cx - 1 >= ox and y % 3 == 0:
                    px[cx - 1, y] = (*stem_sh, 190)
            interval = max(4, hh // 10)
            for i in range(hh // interval):
                y = 95 - i * interval
                if y < 96 - hh:
                    continue
                frac = i / max(1, hh // interval - 1)
                c = blend(leaf, tip, min(0.46, frac * 0.42))
                reach = 2 + (1 if frac > 0.32 else 0) + (1 if frac > 0.66 else 0)
                for side in (-1, 1):
                    for r in range(1, reach + 1):
                        x = cx + side * r
                        yy = y - (1 if r >= reach and frac > 0.45 else 0)
                        if ox <= x < ox + 24 and 0 <= yy < 96:
                            lc = hi if r == 1 and frac > 0.58 else (darken(c, 18) if r == reach else c)
                            px[x, yy] = (*lc, 255)
            ty = 96 - hh
            for tx, ty2 in [(cx, ty), (cx - 1, ty + 1), (cx + 1, ty + 1), (cx, ty + 2)]:
                if ox <= tx < ox + 24 and 0 <= ty2 < 96:
                    px[tx, ty2] = (*blend(tip, hi, 0.35), 245)
    return img

def plant_crypt_hd():
    """Airy red/green accent stem bunch, 56x82."""
    img = Image.new("RGBA", (56, 82), (0, 0, 0, 0))
    px = img.load()
    stem = (86, 128, 76); stem_hi = (122, 170, 108); stem_sh = (52, 82, 52)
    leaf_base = (96, 150, 88); leaf_warm = (176, 102, 90); leaf_hot = (198, 84, 96); hi = (208, 198, 148)
    stems = [8, 16, 24, 32, 40, 48]
    heights = [54, 64, 76, 82, 70, 60]
    for idx, cx in enumerate(stems):
        h = heights[idx]
        for i in range(h):
            y = 81 - i
            if y < 0: continue
            sway = int(math.sin(i * 0.074 + idx * 0.66) * 1.6)
            x = cx + sway
            if 0 <= x < 56:
                c = stem_hi if i > h - 8 else stem
                px[x, y] = (*c, 255)
                if x - 1 >= 0 and i % 3 == 0:
                    px[x - 1, y] = (*stem_sh, 180)
        interval = max(5, h // 8)
        for j in range(h // interval):
            y = 81 - j * interval
            if y < 6: continue
            frac = j / max(1, h // interval - 1)
            leaf_col = blend(leaf_base, leaf_warm, min(0.62, frac * 0.52))
            if frac > 0.7:
                leaf_col = blend(leaf_col, leaf_hot, 0.35)
            for side in (-1, 1):
                reach = 2 + (1 if frac > 0.44 else 0)
                for r in range(1, reach + 1):
                    xx = cx + side * r
                    yy = y - (1 if r > 2 else 0)
                    if 0 <= xx < 56 and 0 <= yy < 82:
                        c = hi if r == 1 and frac > 0.6 else (darken(leaf_col, 18) if r == reach else leaf_col)
                        px[xx, yy] = (*c, 246)
    return img

def moss_hd():
    img = Image.new("RGBA", (64, 34), (0, 0, 0, 0))
    px = img.load()
    cols = [(30, 92, 42), (44, 126, 56), (72, 164, 84), (24, 70, 34)]
    rng = random.Random(1404)
    for _ in range(520):
        x = rng.randrange(2, 62); y = rng.randrange(8, 34)
        if ((x - 32) / 32) ** 2 + ((y - 24) / 13) ** 2 > 1.0: continue
        c = cols[rng.randrange(len(cols))]
        px[x, y] = (*c, 255)
        if rng.random() < 0.56 and y > 0: px[x, y - 1] = (*lighten(c, 18), 255)
        if rng.random() < 0.18 and x + 1 < 64: px[x + 1, y] = (*darken(c, 18), 255)
    return img

# overwrite plant outputs with the HD pass
save(java_fern_hd(), f"{OUT}/plants/java_fern.png")
save(anubias_hd(), f"{OUT}/plants/anubias.png")
save(vallisneria_hd(), f"{OUT}/plants/vallisneria.png")
save(rotala_hd(), f"{OUT}/plants/rotala.png")
save(plant_crypt_hd(), f"{OUT}/plants/crypt.png")
save(moss_hd(), f"{OUT}/plants/moss.png")


# ─────────────────────────────────────────────────────────────
# HARDSCAPE
# ─────────────────────────────────────────────────────────────

print("Generating hardscape sprites...")

# ── Shared driftwood helpers ─────────────────────────────────

def wood_stroke(img, palette, x0, y0, x1, y1, thickness, taper=0.35, seed=0):
    """Tapered branch stroke with bark texture; mutates img in place."""
    W, H = img.size
    px = img.load()
    base    = palette['base']
    hi      = palette['hi']
    sh      = palette['sh']
    bark    = palette['bark']
    bark_hi = palette['bark_hi']
    dx, dy = x1 - x0, y1 - y0
    length = max(1, math.sqrt(dx*dx + dy*dy))
    nx, ny = -dy / length, dx / length
    steps = max(1, int(length) * 2)
    for i in range(steps + 1):
        t = i / steps
        cx_f = x0 + dx * t
        cy_f = y0 + dy * t
        thick = max(1, int(round(thickness * (1.0 - taper * t))))
        for w in range(-thick, thick + 1):
            xx = int(cx_f + nx * w)
            yy = int(cy_f + ny * w)
            if 0 <= xx < W and 0 <= yy < H:
                if w == -thick:
                    c = hi
                elif w == thick:
                    c = sh
                elif thick > 1 and abs(w) == thick - 1:
                    c = bark_hi if w < 0 else darken(base, 12)
                else:
                    sv = (xx * 7 + yy * 13 + seed) % 17
                    c = bark_hi if sv < 2 else (bark if sv < 5 else base)
                if (xx * 13 + yy * 7 + seed) % 17 == 0:
                    c = pixel_noise(c, -10)
                elif (xx * 11 + yy * 5 + seed) % 19 == 0:
                    c = pixel_noise(c, 8)
                px[xx, yy] = (*c, 255)


def gnarl_pass(img, palette, density=1.0, seed=0):
    """Scatter randomized knots, dark crevices, and bark flecks on opaque pixels."""
    W, H = img.size
    px = img.load()
    rng = random.Random(seed + 999)
    count = int(W * H * 0.012 * density)
    for _ in range(count):
        x = rng.randrange(W)
        y = rng.randrange(H)
        if px[x, y][3] == 0:
            continue
        r = rng.random()
        if r < 0.30:   c = palette['hi']
        elif r < 0.50: c = darken(palette['base'], 18)
        elif r < 0.70: c = palette['bark_hi']
        else:          c = palette['sh']
        px[x, y] = (*c, 255)


def top_highlight(img, hi_color, x_start=None, x_end=None):
    """Paint a single bright pixel on the topmost opaque row in each column."""
    W, H = img.size
    px = img.load()
    if x_start is None: x_start = 0
    if x_end is None:   x_end = W
    for x in range(x_start, min(W, x_end)):
        for y in range(H):
            if px[x, y][3] > 0:
                px[x, y] = (*hi_color, 255)
                break


# ── Spider Wood (140×70) ──────────────────────────────────────
def wood_spider():
    """Many gnarled tendrils radiating from a thicker central root mass."""
    W, H = 140, 70
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    palette = dict(
        base=(128, 84, 46),   hi=(195, 148, 88),  sh=(62, 40, 18),
        bark=(148, 102, 56),  bark_hi=(178, 130, 78),
    )
    # Anchor: dense root mass slightly right of center
    branches = [
        # central trunk knot (thicker than before)
        (58, 64, 78, 58, 6, 0.20),
        (78, 58, 104, 60, 4, 0.40),
        # main upward branches from center
        (68, 60, 60, 36, 3, 0.50),
        (70, 60, 48, 18, 3, 0.55),
        (76, 56, 80, 10, 3, 0.65),
        (82, 58, 100, 24, 3, 0.55),
        # secondary tendrils
        (60, 36, 38, 8, 2, 0.80),
        (48, 18, 26, 2, 2, 0.88),
        (80, 10, 90, 1, 1, 0.92),
        (100, 24, 124, 6, 2, 0.85),
        (100, 24, 120, 22, 1, 0.85),
        # side branches
        (58, 64, 32, 56, 3, 0.45),
        (32, 56, 12, 48, 2, 0.80),
        (32, 56, 4, 58, 1, 0.85),
        (104, 60, 126, 54, 3, 0.50),
        (126, 54, 138, 46, 1, 0.85),
        # downward roots
        (58, 64, 50, 68, 2, 0.85),
        (78, 58, 86, 68, 1, 0.92),
        # tertiary twigs
        (80, 10, 68, 2, 1, 0.95),
        (48, 18, 40, 12, 1, 0.95),
        (124, 6, 132, 1, 1, 0.97),
    ]
    for b in branches:
        wood_stroke(img, palette, *b, seed=121)
    gnarl_pass(img, palette, density=0.6, seed=121)
    top_highlight(img, palette['hi'], 4, 138)
    return img


# ── Manzanita (160×80) ────────────────────────────────────────
def wood_manzanita():
    """Smooth tree-branch structure with fine terminal forks; thick trunk."""
    W, H = 160, 80
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    palette = dict(
        base=(140, 90, 62),   hi=(205, 152, 110), sh=(78, 46, 30),
        bark=(160, 108, 78),  bark_hi=(188, 138, 100),
    )
    branches = [
        # main diagonal trunk: lower-left → upper-right (thicker now)
        (8, 70, 56, 48, 8, 0.10),
        (56, 48, 96, 36, 6, 0.20),
        (96, 36, 132, 24, 4, 0.40),
        # major fork upper-left
        (58, 48, 56, 16, 5, 0.45),
        (56, 16, 38, 4, 3, 0.65),
        (56, 16, 72, 2, 2, 0.80),
        # major fork upper-middle
        (94, 36, 100, 10, 5, 0.45),
        (100, 10, 86, 1, 2, 0.85),
        (100, 10, 118, 2, 2, 0.80),
        # right branches
        (130, 24, 152, 8, 3, 0.55),
        (152, 8, 158, 2, 1, 0.92),
        (130, 24, 150, 16, 2, 0.80),
        # downward roots
        (8, 70, 2, 74, 2, 0.85),
        (8, 70, 22, 76, 3, 0.45),
        (22, 76, 38, 73, 2, 0.80),
        # small side twigs
        (42, 56, 30, 48, 2, 0.92),
        (70, 42, 76, 30, 2, 0.92),
        (108, 32, 120, 20, 2, 0.92),
    ]
    for b in branches:
        wood_stroke(img, palette, *b, seed=337)
    gnarl_pass(img, palette, density=0.4, seed=337)
    top_highlight(img, palette['hi'], 4, 158)
    return img


# ── Malaysian Driftwood (90×55) ───────────────────────────────
def wood_malaysian():
    """Compact dense log; dark, lumpy, deep crevice shadows."""
    W, H = 90, 55
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    palette = dict(
        base=(48, 30, 16),    hi=(95, 68, 38),    sh=(18, 12, 6),
        bark=(64, 42, 22),    bark_hi=(82, 56, 30),
    )
    branches = [
        # main chunky log (thick)
        (6, 42, 82, 36, 9, 0.05),
        # upward stub
        (44, 38, 36, 16, 5, 0.45),
        (36, 16, 30, 4, 3, 0.80),
        # small forks
        (60, 36, 68, 20, 4, 0.60),
        (68, 20, 76, 10, 2, 0.85),
        # base broadening
        (20, 44, 14, 50, 3, 0.45),
        (74, 40, 84, 44, 3, 0.45),
        (84, 44, 88, 48, 1, 0.90),
    ]
    for b in branches:
        wood_stroke(img, palette, *b, seed=222)
    gnarl_pass(img, palette, density=0.8, seed=222)
    top_highlight(img, palette['hi'], 4, 88)
    return img


# ── Mopani (110×55) ───────────────────────────────────────────
def wood_mopani():
    """Two-toned chunky wood with hollow holes carved into the silhouette."""
    W, H = 110, 55
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    palette_top = dict(
        base=(155, 115, 75),  hi=(200, 165, 110), sh=(105, 75, 45),
        bark=(170, 130, 90),  bark_hi=(195, 160, 110),
    )
    palette_bot = dict(
        base=(58, 36, 20),    hi=(98, 68, 38),    sh=(20, 12, 6),
        bark=(75, 50, 28),    bark_hi=(95, 65, 38),
    )
    branches = [
        (8, 38, 56, 26, 8, 0.10),
        (56, 26, 102, 32, 6, 0.30),
        (38, 28, 46, 6, 4, 0.55),
        (46, 6, 52, 1, 2, 0.90),
        (76, 28, 84, 12, 3, 0.70),
        (12, 40, 4, 46, 3, 0.45),
        (96, 32, 106, 42, 3, 0.45),
    ]
    for b in branches:
        wood_stroke(img, palette_top, *b, seed=444)
    # Darken bottom half toward palette_bot
    px = img.load()
    split = int(H * 0.55)
    for y in range(split, H):
        depth = (y - split) / max(1, H - split)  # 0..1
        t = min(1.0, depth * 1.5)
        for x in range(W):
            if px[x, y][3] > 0:
                r, g, b, a = px[x, y]
                tgt_r, tgt_g, tgt_b = palette_bot['base']
                rr = int(r * (1 - t) + tgt_r * t)
                gg = int(g * (1 - t) + tgt_g * t)
                bb = int(b * (1 - t) + tgt_b * t)
                px[x, y] = (rr, gg, bb, 255)
    gnarl_pass(img, palette_top, density=1.0, seed=444)
    # Carve hollow holes (cut alpha to 0, darken rim)
    holes = [(28, 32, 3), (62, 30, 2), (88, 30, 2)]
    for cx, cy, r in holes:
        for yy in range(cy - r - 1, cy + r + 2):
            for xx in range(cx - r - 1, cx + r + 2):
                if 0 <= xx < W and 0 <= yy < H:
                    d = math.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
                    if d <= r - 0.3:
                        px[xx, yy] = (0, 0, 0, 0)
                    elif d <= r + 0.7 and px[xx, yy][3] > 0:
                        px[xx, yy] = (*palette_bot['sh'], 255)
    top_highlight(img, palette_top['hi'], 4, 108)
    return img


# ── Redmoor Root (150×45) ─────────────────────────────────────
def wood_redmoor():
    """Twisted root-like piece sprawling horizontally; reddish-orange."""
    W, H = 150, 45
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    palette = dict(
        base=(112, 58, 38),   hi=(165, 95, 65),   sh=(60, 26, 14),
        bark=(130, 72, 48),   bark_hi=(152, 88, 60),
    )
    branches = [
        # main twisted root (thicker)
        (4, 36, 30, 30, 5, 0.15),
        (30, 30, 60, 32, 5, 0.25),
        (60, 32, 95, 22, 4, 0.35),
        (95, 22, 130, 28, 3, 0.50),
        (130, 28, 146, 26, 2, 0.70),
        # secondary upward twist
        (40, 30, 55, 12, 3, 0.55),
        (55, 12, 70, 4, 2, 0.85),
        # right ascending
        (95, 22, 105, 6, 3, 0.65),
        (105, 6, 110, 1, 1, 0.95),
        # downward roots
        (20, 34, 10, 42, 2, 0.85),
        (60, 32, 65, 42, 2, 0.85),
        (110, 28, 118, 40, 2, 0.85),
        # small side twigs
        (75, 30, 85, 16, 2, 0.92),
        (130, 28, 138, 14, 2, 0.92),
    ]
    for b in branches:
        wood_stroke(img, palette, *b, seed=303)
    # Grain striations — horizontal lighter bands along length
    px = img.load()
    for y in range(H):
        for x in range(W):
            if px[x, y][3] > 0 and (x + y * 3) % 13 < 1:
                px[x, y] = (*palette['bark_hi'], 255)
    gnarl_pass(img, palette, density=0.5, seed=303)
    top_highlight(img, palette['hi'], 4, 148)
    return img


save(wood_spider(),    f"{OUT}/hardscape/wood_spider.png")
save(wood_manzanita(), f"{OUT}/hardscape/wood_manzanita.png")
save(wood_malaysian(), f"{OUT}/hardscape/wood_malaysian.png")
save(wood_mopani(),    f"{OUT}/hardscape/wood_mopani.png")
save(wood_redmoor(),   f"{OUT}/hardscape/wood_redmoor.png")


# ── Shared rock silhouette generator ──────────────────────────

def make_rock_base(W, H, palette, lump_terms, rng_seed=0):
    """Elliptical rock silhouette with sin/cos perturbation."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = img.load()
    cx, cy = W // 2, H // 2 + H // 10
    for y in range(H):
        for x in range(W):
            nx = (x - cx) / (W * 0.48)
            ny = (y - cy) / (H * 0.46)
            lump = sum(amp * math.sin(x * fx + y * fy) for (amp, fx, fy) in lump_terms)
            r2 = nx * nx + ny * ny + lump
            if r2 < 1.0:
                is_top = y < cy - H // 5
                is_bot = y > cy + H // 5
                if is_top:           c = palette['hi']
                elif is_bot:         c = palette['sh']
                elif abs(nx) > 0.7:  c = palette['edge']
                else:                c = palette['base']
                px[x, y] = (*c, 255)
    return img


def rock_top_highlight(img, hi_color):
    W, H = img.size
    px = img.load()
    for x in range(W):
        for y in range(H):
            if px[x, y][3] > 0:
                px[x, y] = (*hi_color, 255)
                break


# ── Seiryu Stone (lg=60×40, sm=35×24) ─────────────────────────
def stone_seiryu(W=60, H=40):
    """Blue-grey angular stone with prominent white quartz veins."""
    palette = dict(
        base=(60, 64, 72),    hi=(110, 116, 126), sh=(28, 30, 36),
        edge=(40, 44, 52),    vein=(220, 222, 230),
    )
    img = make_rock_base(W, H, palette, [
        (0.10, 0.5, 0.0), (0.08, 0.0, 0.7), (-0.06, 0.3, 0.3),
    ], rng_seed=W * H)
    px = img.load()
    rng = random.Random(W * H + 7)
    # Stratum lines (horizontal fracture bands)
    for sy in range(0, H, max(3, H // 5)):
        for x in range(W):
            if 0 <= sy < H and px[x, sy][3] > 0:
                px[x, sy] = (*(palette['hi'] if rng.random() < 0.5 else palette['sh']), 255)
    # Quartz veins
    n_veins = max(2, W // 14)
    for _ in range(n_veins):
        vx = rng.randint(W // 5, W * 4 // 5)
        vy = rng.randint(H // 4, H * 3 // 4)
        dy = rng.choice([-1, 1])
        for i in range(rng.randint(4, max(5, H // 3))):
            xx = vx + rng.randint(-1, 1)
            yy = vy + dy * i
            if 0 <= xx < W and 0 <= yy < H and px[xx, yy][3] > 0:
                px[xx, yy] = (*palette['vein'], 255)
                if rng.random() < 0.4 and 0 <= xx + 1 < W:
                    nxc = palette['vein']
                    dimmed = (nxc[0] - 40, nxc[1] - 40, nxc[2] - 40)
                    px[xx + 1, yy] = (*tuple(clamp(c) for c in dimmed), 230)
    # Edge chipping + micro facet shading
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if px[x, y][3] == 0:
                continue
            around = [px[x-1, y][3], px[x+1, y][3], px[x, y-1][3], px[x, y+1][3]]
            if min(around) == 0 and rng.random() < 0.36:
                px[x, y] = (*palette['edge'], 255)
            elif rng.random() < 0.08:
                px[x, y] = (*pixel_noise(px[x, y][:3], rng.randint(-10, 9)), 255)
    rock_top_highlight(img, palette['hi'])
    return img


# ── Dragon Stone / Ohko (70×45) ───────────────────────────────
def stone_dragon(W=70, H=45):
    """Lumpy holey lightweight rock; warm tan with pock-marks + recessed holes."""
    palette = dict(
        base=(135, 102, 58),  hi=(195, 162, 110), sh=(70, 50, 28),
        edge=(95, 70, 40),
    )
    img = make_rock_base(W, H, palette, [
        (0.12, 0.4, 0.0), (0.10, 0.0, 0.6), (0.08, 0.7, 0.7),
        (-0.06, 0.25, 0.5),
    ], rng_seed=W * H + 99)
    px = img.load()
    rng = random.Random(515)
    # Heavy small-pock-mark pass
    for _ in range(W * H // 12):
        x = rng.randint(2, W - 3)
        y = rng.randint(3, H - 3)
        if px[x, y][3] > 0:
            px[x, y] = (*palette['sh'], 255)
            if y > 0 and px[x, y - 1][3] > 0 and rng.random() < 0.4:
                px[x, y - 1] = (*palette['hi'], 255)
    # 3 large hollow holes (alpha=0 craters)
    for cx, cy, r in [(W // 3, H // 2, 2), (W * 2 // 3, H // 3, 3), (W // 2, H * 3 // 4, 2)]:
        for yy in range(cy - r - 1, cy + r + 2):
            for xx in range(cx - r - 1, cx + r + 2):
                if 0 <= xx < W and 0 <= yy < H:
                    d = math.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
                    if d < r - 0.4:
                        px[xx, yy] = (0, 0, 0, 0)
                    elif d < r + 0.4 and px[xx, yy][3] > 0:
                        px[xx, yy] = (*palette['sh'], 255)
    # Extra wormhole grooves for higher visual complexity
    for x in range(4, W - 4):
        gy = int(H * 0.4 + math.sin(x * 0.19) * 4)
        for yy in range(max(1, gy - 1), min(H - 1, gy + 2)):
            if px[x, yy][3] > 0 and (x + yy) % 3 == 0:
                px[x, yy] = (*palette['sh'], 255)
                if yy - 1 >= 0 and px[x, yy - 1][3] > 0:
                    px[x, yy - 1] = (*palette['hi'], 255)
    rock_top_highlight(img, palette['hi'])
    return img


# ── Lava Rock (50×35) ─────────────────────────────────────────
def stone_lava(W=50, H=35):
    """Matte black porous rock with deep red undertones."""
    palette = dict(
        base=(45, 28, 30),    hi=(95, 60, 52),    sh=(15, 10, 12),
        edge=(28, 18, 20),    vein=(135, 50, 40),  # warm red crevice
    )
    img = make_rock_base(W, H, palette, [
        (0.10, 0.6, 0.0), (0.08, 0.0, 0.8), (0.05, 0.4, 0.4),
    ], rng_seed=W * H + 33)
    px = img.load()
    rng = random.Random(616)
    # Dense porous pock-mark pass (lots of micro-pits)
    for _ in range(W * H // 4):
        x = rng.randint(1, W - 2)
        y = rng.randint(2, H - 2)
        if px[x, y][3] > 0:
            r = rng.random()
            if r < 0.60:   px[x, y] = (*palette['sh'], 255)
            elif r < 0.85: px[x, y] = (*palette['vein'], 255)
            else:          px[x, y] = (*palette['hi'], 255)
    # Sparse top highlight
    for x in range(W):
        for y in range(H):
            if px[x, y][3] > 0:
                if (x % 3) > 0:
                    px[x, y] = (*palette['hi'], 255)
                break
    # Larger vesicles (2-3px pores) to avoid flat look
    for cx, cy, r in [(11, 14, 1), (22, 16, 2), (34, 12, 1), (40, 20, 2)]:
        for y in range(cy - r, cy + r + 1):
            for x in range(cx - r, cx + r + 1):
                if 0 <= x < W and 0 <= y < H and (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.2 and px[x, y][3] > 0:
                    px[x, y] = (*palette['sh'], 255)
                    if y > 0 and px[x, y - 1][3] > 0:
                        px[x, y - 1] = (*palette['hi'], 255)
    return img


# ── Frodo Stone (65×40) ───────────────────────────────────────
def stone_frodo(W=65, H=40):
    """Dark grey slate with distinct horizontal strata bands and jagged top."""
    palette = dict(
        base=(50, 55, 62),    hi=(95, 100, 110),  sh=(20, 22, 28),
        edge=(35, 38, 45),    vein=(85, 90, 100),
    )
    img = make_rock_base(W, H, palette, [
        (0.06, 0.5, 0.0), (0.04, 0.0, 0.5),  # less lumpy
    ], rng_seed=W * H + 77)
    px = img.load()
    # Distinct strata bands
    for frac in (0.18, 0.36, 0.55, 0.74):
        sy = int(H * frac)
        for x in range(W):
            if 0 <= sy < H and px[x, sy][3] > 0:
                px[x, sy] = (*palette['hi'], 255)
            if 0 <= sy + 1 < H and px[x, sy + 1][3] > 0:
                px[x, sy + 1] = (*palette['vein'], 255)
    # Jagged top: carve random 1-px notches
    rng = random.Random(W * H + 77)
    for x in range(W):
        for y in range(H):
            if px[x, y][3] > 0:
                if rng.random() < 0.25:
                    px[x, y] = (0, 0, 0, 0)
                    if y + 1 < H and px[x, y + 1][3] > 0:
                        px[x, y + 1] = (*palette['hi'], 255)
                else:
                    px[x, y] = (*palette['hi'], 255)
                break
    return img


# ── Pagoda Stone (55×38) ──────────────────────────────────────
def stone_pagoda(W=55, H=38):
    """Warm brown sedimentary rock with alternating light/dark layer bands."""
    palette = dict(
        base=(115, 78, 50),   hi=(170, 130, 88),  sh=(60, 38, 22),
        edge=(85, 55, 32),    vein=(140, 100, 65),
    )
    img = make_rock_base(W, H, palette, [
        (0.05, 0.4, 0.0), (0.04, 0.0, 0.4),  # round, gentle
    ], rng_seed=W * H + 55)
    px = img.load()
    band_specs = [
        (int(H * 0.15), palette['hi']),
        (int(H * 0.30), palette['vein']),
        (int(H * 0.45), palette['hi']),
        (int(H * 0.60), palette['vein']),
        (int(H * 0.75), palette['hi']),
    ]
    for sy, c in band_specs:
        for x in range(W):
            if 0 <= sy < H and px[x, sy][3] > 0:
                px[x, sy] = (*c, 255)
    rock_top_highlight(img, palette['hi'])
    return img


save(stone_seiryu(60, 40), f"{OUT}/hardscape/stone_seiryu_lg.png")
save(stone_seiryu(35, 24), f"{OUT}/hardscape/stone_seiryu_sm.png")
save(stone_dragon(),       f"{OUT}/hardscape/stone_dragon.png")
save(stone_lava(),         f"{OUT}/hardscape/stone_lava.png")
save(stone_frodo(),        f"{OUT}/hardscape/stone_frodo.png")
save(stone_pagoda(),       f"{OUT}/hardscape/stone_pagoda.png")


# ─────────────────────────────────────────────────────────────
# BACKGROUND TILES
# ─────────────────────────────────────────────────────────────

print("Generating background tiles...")

def water_tile():
    """8×8 tileable water texture — two closely-spaced cool-blues, calm dither.
    At 3× zoom, the larger tile dramatically reduces the visible noise pattern.
    """
    img = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    px = img.load()
    a = (28, 64, 104)   # base
    b = (34, 74, 118)   # subtle highlight (only ~10 lighter)
    rng = random.Random(91)
    for y in range(8):
        for x in range(8):
            # Smooth gradient bias with a tiny noise term, kept in a tight range
            t = ((x + y * 2) % 7) / 7
            c = blend(a, b, t * 0.6 + rng.random() * 0.18)
            px[x, y] = (int(c[0]), int(c[1]), int(c[2]), 255)
    return img

save(water_tile(), f"{OUT}/background/water_tile.png")


def caustics_tile():
    """32×32 tile × 4 frames = 128×32 animated underwater caustics overlay.
    White-cyan light streaks on a transparent background, drawn on substrate
    to suggest dappled sunlight through rippling water."""
    W_FRAME = 32
    H = 32
    FRAMES = 4
    img = Image.new("RGBA", (W_FRAME * FRAMES, H), (0, 0, 0, 0))
    px = img.load()
    light = (215, 235, 255)
    bright = (255, 255, 255)
    for f in range(FRAMES):
        ox = f * W_FRAME
        phase = f * (math.pi / 2)  # 90° between frames
        for y in range(H):
            for x in range(W_FRAME):
                # Two overlapping sine waves create the classic caustic interference
                u = x / W_FRAME * math.pi * 2
                v = y / H * math.pi * 2
                w1 = math.sin(u * 2.0 + v * 1.3 + phase)
                w2 = math.sin(u * 1.4 - v * 2.0 + phase * 1.3)
                w3 = math.sin((u + v) * 1.6 + phase * 0.6)
                amp = (w1 + w2 + w3) / 3
                # Thresholded "lines" of light
                if amp > 0.62:
                    a = int((amp - 0.62) * 320)
                    px[ox + x, y] = (*bright, min(220, a + 40))
                elif amp > 0.42:
                    a = int((amp - 0.42) * 220)
                    px[ox + x, y] = (*light, min(160, a + 20))
                # else: leave transparent
    return img

save(caustics_tile(), f"{OUT}/background/caustics.png")


def led_fixture():
    """240×8 LED bar fixture: dark housing on top, bright LED strip below, soft shadow underside.
    Wide enough to span ~85% of the 280-grid tank width when drawn 1:1 over it."""
    W, H = 240, 8
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = img.load()
    housing = (28, 32, 38)
    housing_hi = (54, 60, 70)
    housing_sh = (16, 18, 22)
    led_warm = (255, 248, 220)
    led_cool = (220, 230, 255)
    for x in range(W):
        # Slight pad on each end
        if x < 2 or x >= W - 2:
            px[x, 0] = (*housing_sh, 255)
            px[x, 1] = (*housing, 255)
            px[x, 2] = (*housing, 255)
            px[x, 3] = (*housing_sh, 255)
            continue
        # Housing top edge (highlight) and second row (base)
        px[x, 0] = (*housing_hi, 255)
        px[x, 1] = (*housing, 255)
        # LED strip rows: a bright warm-white core with a thin cool-white outer band
        # Slight bright/dim alternation creates the impression of individual LEDs
        is_led_chip = (x % 4) < 3
        if is_led_chip:
            px[x, 2] = (*led_warm, 255)
            px[x, 3] = (*led_cool, 255)
        else:
            px[x, 2] = (*housing_hi, 255)
            px[x, 3] = (*housing, 255)
        # Underside housing
        px[x, 4] = (*housing_sh, 255)
        # Soft glow drop below (transparent)
        px[x, 5] = (*led_warm, 90)
        px[x, 6] = (*led_warm, 40)
        px[x, 7] = (*led_warm, 18)
    return img

save(led_fixture(), f"{OUT}/background/led_fixture.png")


def background_films():
    """Four 280x128 aquarium background films: blue, black, frosted, riverbank."""
    W, H = 280, 128
    img = Image.new("RGBA", (W, H * 4), (0,0,0,255))
    px = img.load()

    palettes = [
        ((20, 50, 78), (42, 94, 136), (22, 62, 91)),
        ((7, 16, 20), (12, 24, 27), (5, 10, 14)),
        ((216, 233, 234), (142, 183, 189), (68, 113, 125)),
        ((40, 93, 114), (61, 110, 85), (87, 68, 42)),
    ]
    for frame, (top, mid, bot) in enumerate(palettes):
        oy = frame * H
        for y in range(H):
            t = y / (H - 1)
            c = blend(top, mid, min(1, t * 1.6)) if t < 0.62 else blend(mid, bot, (t - 0.62) / 0.38)
            for x in range(W):
                grain = ((x * 7 + y * 11 + frame * 23) % 17) - 8
                px[x, oy + y] = (*lighten(c, grain), 255)

        if frame == 2:
            # Frosted ADA-style film: pale with soft vertical haze.
            for x in range(0, W, 9):
                haze = 8 + (x * 5) % 14
                for y in range(H):
                    if (x + y) % 5 == 0:
                        px[x, oy + y] = (*lighten(px[x, oy + y][:3], haze), 255)

        if frame == 3:
            # Blurred stem silhouettes behind a riverbank/biotope film.
            for x in range(0, W, 7):
                h = 10 + int((math.sin(x * 0.17) + 1) * 5)
                for yy in range(H - h, H):
                    for xx in range(x, min(W, x + 2)):
                        px[xx, oy + yy] = (22, 45, 32, 170)
    return img

save(background_films(), f"{OUT}/background/background_films.png")


def substrate_tile():
    """24×24 dark aqua-soil substrate (ADA Amazonia inspired).
    Deep brown-black with subtle granule variation and sparse warm pebbles.
    The dark base makes plants pop and frames shrimp colors.
    """
    img = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    px = img.load()
    # Dark aquasoil palette with wider but restrained granule spread
    base = (36, 28, 24)
    hi   = (62, 48, 38)
    sh   = (21, 16, 14)
    deep = (13, 9, 8)
    grain = (46, 36, 30)
    pebble = (76, 62, 48)
    pebble_hi = (102, 84, 66)
    rng = random.Random(77)

    # Base granular surface with clustered grain sizes (no sparkle/no flashing)
    for y in range(24):
        for x in range(24):
            n = ((x * 13 + y * 17 + 9) % 23) / 23.0
            v = 0.65 * rng.random() + 0.35 * n
            if v < 0.10:   c = deep
            elif v < 0.28: c = sh
            elif v < 0.60: c = base
            elif v < 0.88: c = grain
            else:          c = hi
            px[x, y] = (*c, 255)

    # Coarse grains and pebbles of varying diameters (1-3 px)
    pebbles = [
        (4, 4, 1, pebble),
        (9, 7, 2, pebble),
        (16, 8, 1, pebble_hi),
        (7, 14, 1, pebble),
        (13, 17, 2, pebble),
        (21, 20, 1, pebble_hi),
    ]
    for cx, cy, r, c in pebbles:
        for y in range(cy - r, cy + r + 1):
            for x in range(cx - r, cx + r + 1):
                if 0 <= x < 24 and 0 <= y < 24 and (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.4:
                    if y == cy - r:
                        px[x, y] = (*lighten(c, 16), 255)
                    elif y == cy + r:
                        px[x, y] = (*darken(c, 16), 255)
                    else:
                        px[x, y] = (*c, 255)

    # A few dark pits increase depth/readability at 3x without looking noisy.
    for cx, cy in [(2, 10), (18, 5), (20, 14), (6, 20)]:
        if 0 <= cx < 24 and 0 <= cy < 24:
            px[cx, cy] = (*deep, 255)
            if cy > 0:
                px[cx, cy - 1] = (*lighten(sh, 12), 255)
    return img

save(substrate_tile(), f"{OUT}/background/substrate.png")


def food_wafer():
    """12×8px food wafer sprite"""
    img = Image.new("RGBA", (12, 8), (0,0,0,0))
    px = img.load()
    base = (160, 120, 50)
    hi   = lighten(base, 40)
    sh   = darken(base, 40)
    rng  = random.Random(77)
    for y in range(1, 7):
        for x in range(1, 11):
            dist = abs(x-5.5)/4.5 + abs(y-3.5)/3.0
            if dist < 1.0:
                if y == 1: c = hi
                elif y == 6: c = sh
                else: c = base if rng.random() > 0.2 else lighten(base, rng.randint(-15, 20))
                px[x, y] = (*c, 255)
    return img

save(food_wafer(), f"{OUT}/background/food_wafer.png")


def bubble_sprite():
    """6×6 bubble sprite, 3 frames → 18×6 total. Lower contrast for subtle ambiance."""
    W, H = 18, 6
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = img.load()
    rim   = (150, 188, 220, 140)   # was 200 alpha
    inner = (180, 220, 255, 35)    # was 60 alpha
    shine = (240, 250, 255, 130)   # was 200 alpha — much subtler highlight
    for f in range(3):
        ox = f * 6
        for x in range(6):
            for y in range(6):
                dx, dy = x - 2.5, y - 2.5
                r = math.sqrt(dx * dx + dy * dy)
                if 2.0 < r < 3.2:
                    px[ox + x, y] = rim
                elif r < 2.0:
                    px[ox + x, y] = inner
        px[ox + 1, 1] = shine
    return img

save(bubble_sprite(), f"{OUT}/background/bubble.png")

def floating_salvinia():
    """56x32 floating plant mat with hanging roots."""
    W, H = 56, 32
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = img.load()
    leaf_base = (78, 154, 92)
    leaf_hi = (126, 194, 132)
    leaf_sh = (44, 98, 56)
    root = (92, 62, 42)
    for i in range(11):
        cx = 4 + i * 5
        cy = 4 + (i % 2)
        for y in range(cy - 2, cy + 3):
            for x in range(cx - 2, cx + 3):
                if 0 <= x < W and 0 <= y < H and (x - cx) * (x - cx) + (y - cy) * (y - cy) <= 6:
                    c = leaf_base
                    if y <= cy - 1:
                        c = leaf_hi
                    elif y >= cy + 1:
                        c = leaf_sh
                    px[x, y] = (*c, 255)
        root_len = 9 + (i % 5)
        for r in range(root_len):
            rx = cx + (1 if i % 3 == 0 and r > 3 else 0)
            ry = 7 + r
            if 0 <= rx < W and 0 <= ry < H:
                px[rx, ry] = (*root, 230)
                if ry + 1 < H and (r % 3 == 0):
                    px[rx, ry + 1] = (*darken(root, 12), 180)
    return img

def floating_redroot():
    """48x34 red root floater cluster with tiny flower accents."""
    W, H = 48, 34
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = img.load()
    leaf_base = (98, 172, 90)
    leaf_hi = (186, 98, 92)
    leaf_sh = (52, 94, 44)
    root = (128, 42, 54)
    flower = (242, 238, 214)
    for i in range(9):
        cx = 4 + i * 5
        cy = 4 + ((i + 1) % 2)
        for y in range(cy - 2, cy + 3):
            for x in range(cx - 2, cx + 3):
                if 0 <= x < W and 0 <= y < H and (x - cx) * (x - cx) + (y - cy) * (y - cy) <= 6:
                    if (i % 4 == 0) and y <= cy:
                        c = leaf_hi
                    elif y >= cy + 1:
                        c = leaf_sh
                    else:
                        c = leaf_base
                    px[x, y] = (*c, 255)
        root_len = 11 + (i % 4)
        for r in range(root_len):
            rx = cx + (-1 if i % 3 == 1 and r > 4 else 0)
            ry = 7 + r
            if 0 <= rx < W and 0 <= ry < H:
                px[rx, ry] = (*root, 235)
                if ry + 1 < H and (r % 2 == 0):
                    px[rx, ry + 1] = (*darken(root, 20), 190)
        if i in (2, 6):
            px[cx, 1] = (*flower, 255)
            if cx + 1 < W:
                px[cx + 1, 1] = (*flower, 255)
    return img

def neon_tetra_sheet():
    """18x8 per frame, 4-frame strip of neon tetra with crisp silhouette."""
    FW, FH, FR = 18, 8, 4
    img = Image.new("RGBA", (FW * FR, FH), (0, 0, 0, 0))
    px = img.load()
    for f in range(FR):
        ox = f * FW
        tail_shift = [0, 1, 0, -1][f]

        def put(x, y, c):
            if 0 <= x < FW and 0 <= y < FH:
                px[ox + x, y] = c

        # Body silhouette (slender torpedo), all hard opaque pixels for crisp read.
        body = [
            (2, 3), (3, 2), (3, 3), (3, 4),
            (4, 2), (4, 3), (4, 4), (5, 2), (5, 3), (5, 4),
            (6, 2), (6, 3), (6, 4), (7, 2), (7, 3), (7, 4),
            (8, 2), (8, 3), (8, 4), (9, 2), (9, 3), (9, 4),
            (10, 2), (10, 3), (10, 4), (11, 2), (11, 3), (11, 4),
            (12, 3), (12, 4), (13, 3),
        ]
        for x, y in body:
            put(x, y, (86, 108, 132, 255))

        # Top highlight
        for x in range(4, 12):
            put(x, 2, (156, 182, 212, 255))
        # Belly shadow
        for x in range(4, 12):
            put(x, 4, (54, 70, 88, 255))

        # Neon blue stripe
        for x in range(3, 13):
            put(x, 3, (30, 142, 255, 255))
        for x in range(4, 12):
            put(x, 2, (108, 188, 255, 255))

        # Red stripe (rear half)
        for x in range(7, 14):
            put(x, 4, (230, 52, 52, 255))

        # Head details
        put(13, 2, (188, 208, 230, 255))
        put(14, 2, (176, 194, 214, 255))
        put(14, 3, (132, 154, 180, 255))
        put(14, 1, (10, 12, 16, 255))  # eye

        # Tail fork (subtle animated flick; much gentler than before).
        tail_x = 1
        put(tail_x, 3 + tail_shift, (86, 116, 156, 255))
        put(tail_x, 4 + tail_shift, (70, 96, 132, 255))
        put(tail_x + 1, 3, (98, 130, 170, 255))
        put(tail_x + 1, 4, (76, 104, 142, 255))

        # Dorsal + anal fins kept opaque to avoid soft/blurry read.
        put(8, 1, (104, 148, 198, 255))
        put(9, 1, (98, 142, 188, 255))
        put(9, 5, (96, 122, 156, 255))
        put(10, 5, (90, 112, 144, 255))
    return img

save(floating_salvinia(), f"{OUT}/plants/floating_salvinia.png")
save(floating_redroot(), f"{OUT}/plants/floating_redroot.png")
save(neon_tetra_sheet(), f"{OUT}/background/neon_tetra.png")

# Realism/clarity repaint pass for core planted-tank assets.
def rotala_realistic():
    W, H = 72, 72  # 3 stages @ 24x72
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = img.load()
    stem = (95, 146, 88)
    stem_sh = (62, 106, 60)
    leaf_a = (96, 176, 96)
    leaf_b = (132, 204, 114)
    tip = (208, 142, 126)
    stages = [40, 56, 72]
    for s, h in enumerate(stages):
        ox = s * 24
        cx = ox + 12
        y0 = H - 1
        for y in range(H - h, H):
            px[cx, y] = (*stem, 255)
            if (y + s) % 3 == 0 and cx - 1 >= ox:
                px[cx - 1, y] = (*stem_sh, 255)
        for y in range(H - h + 2, H - 2, 3):
            span = 2 + ((H - y) // 10)
            for i in range(span):
                lx = cx - 1 - i
                rx = cx + 1 + i
                if ox <= lx < ox + 24:
                    px[lx, y] = (*leaf_a, 255)
                    if y - 1 >= 0:
                        px[lx, y - 1] = (*leaf_b, 255)
                if ox <= rx < ox + 24:
                    px[rx, y] = (*leaf_a, 255)
                    if y - 1 >= 0:
                        px[rx, y - 1] = (*leaf_b, 255)
        # reddish apical tips
        for y in range(H - h, H - h + 4):
            if 0 <= y < H:
                px[cx, y] = (*tip, 255)
    return img

def vallisneria_realistic():
    W, H = 32, 92
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = img.load()
    dark = (46, 122, 66)
    base = (72, 164, 88)
    hi = (118, 206, 122)
    ribbons = [5, 10, 15, 21, 26]
    for idx, bx in enumerate(ribbons):
        for y in range(H - 2):
            t = y / (H - 1)
            sway = int(math.sin(y * 0.12 + idx * 0.9) * (1 + t * 5))
            x = bx + sway
            if 1 <= x < W - 1:
                px[x, y] = (*base, 255)
                if x - 1 >= 0 and (y % 4 != 0):
                    px[x - 1, y] = (*dark, 255)
                if x + 1 < W and (y % 5 == 0):
                    px[x + 1, y] = (*hi, 255)
    # basal rosette
    for x in range(3, W - 3):
        for y in range(H - 4, H):
            if (x + y) % 2 == 0:
                px[x, y] = (54, 104, 58, 255)
    return img

def java_fern_realistic():
    W, H = 28, 76
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = img.load()
    rhiz = (64, 84, 52)
    leaf_d = (44, 112, 62)
    leaf_m = (68, 148, 84)
    leaf_h = (110, 192, 120)
    for x in range(6, 22):
        px[x, H - 4] = (*rhiz, 255)
        px[x, H - 3] = (*darken(rhiz, 8), 255)
    centers = [7, 11, 15, 19, 23]
    heights = [34, 48, 56, 44, 36]
    for i, cx in enumerate(centers):
        h = heights[i]
        for y in range(H - h, H - 4):
            width = 1 + int((y - (H - h)) / max(1, h // 6))
            for dx in range(-width, width + 1):
                x = cx + dx
                if 0 <= x < W:
                    if dx == 0:
                        c = leaf_h
                    elif abs(dx) == width:
                        c = leaf_d
                    else:
                        c = leaf_m
                    px[x, y] = (*c, 255)
        # serrated tips
        tip_y = H - h
        if tip_y >= 1:
            for dx in (-1, 0, 1):
                x = cx + dx
                if 0 <= x < W:
                    px[x, tip_y] = (*leaf_h, 255)
    return img

def anubias_realistic():
    W, H = 44, 30
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = img.load()
    rhiz = (76, 94, 56)
    leaf_d = (36, 106, 58)
    leaf_m = (62, 148, 82)
    leaf_h = (106, 198, 122)
    for x in range(9, 35):
        px[x, H - 5] = (*rhiz, 255)
        px[x, H - 4] = (*darken(rhiz, 10), 255)
    leaves = [(10, 17, 8, 6), (18, 14, 7, 5), (25, 18, 8, 6), (32, 15, 7, 5)]
    for cx, cy, rx, ry in leaves:
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                if 0 <= x < W and 0 <= y < H:
                    v = ((x - cx) ** 2) / (rx * rx + 0.1) + ((y - cy) ** 2) / (ry * ry + 0.1)
                    if v <= 1.0:
                        c = leaf_m
                        if y <= cy - ry // 2:
                            c = leaf_h
                        elif y >= cy + ry // 2:
                            c = leaf_d
                        px[x, y] = (*c, 255)
        # midrib
        for y in range(cy - ry + 1, cy + ry):
            if 0 <= y < H and 0 <= cx < W:
                px[cx, y] = (*lighten(leaf_h, 12), 255)
    return img

def substrate_realistic():
    img = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    px = img.load()
    rng = random.Random(312)
    tones = [(25, 20, 18), (35, 28, 24), (48, 38, 32), (64, 52, 42)]
    for y in range(24):
        for x in range(24):
            c = tones[(x * 7 + y * 11 + rng.randint(0, 3)) % 4]
            px[x, y] = (*c, 255)
    # rounded granules for clearer but natural texture
    granules = [(3,3,1), (8,4,1), (13,6,2), (18,5,1), (6,13,2), (15,16,2), (21,18,1)]
    for cx, cy, r in granules:
        for y in range(cy-r, cy+r+1):
            for x in range(cx-r, cx+r+1):
                if 0 <= x < 24 and 0 <= y < 24 and (x-cx)*(x-cx)+(y-cy)*(y-cy) <= r*r+0.2:
                    base = (56, 46, 38)
                    if y <= cy - 1:
                        base = lighten(base, 14)
                    elif y >= cy + 1:
                        base = darken(base, 12)
                    px[x, y] = (*base, 255)
    return img

# NOTE:
# The realism experiments above are intentionally not active because they
# currently degrade sprite readability and introduce artifacting.
# Keep the primary generator outputs as the source of truth.

print("\nAll sprites generated successfully!")
print(f"Output directory: {OUT}/")
