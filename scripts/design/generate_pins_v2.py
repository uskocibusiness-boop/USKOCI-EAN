"""Map pin sprites, owner-approved look of 25.11.2026: a green pin with the small USKOČI mark (a task), a dark pin
for the chosen task, and green rounded bubbles that carry the count (a place or an area). 4 px per dp.
Run: python scripts/design/generate_pins_v2.py"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / 'discovery'
LOGO = ROOT / 'assets' / 'brand' / 'app-icon' / 'icon.png'
GREEN, INK, WHITE = (0, 107, 79, 255), (23, 34, 29, 255), (255, 255, 255, 255)
S = 4  # supersampling for smooth edges


def pin(fill, size_dp=(36, 46)):
    w, h = size_dp[0] * 4, size_dp[1] * 4
    W, H = w * S, h * S
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    body = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    r = W // 2 - 6 * S
    cx, cy = W // 2, r + 6 * S
    for layer, colour, dy in ((shadow, (0, 0, 0, 70), 3 * S), (body, fill, 0)):
        d = ImageDraw.Draw(layer)
        d.ellipse((cx - r, cy - r + dy, cx + r, cy + r + dy), fill=colour)
        d.polygon([(cx - r * 0.62, cy + r * 0.72 + dy), (cx + r * 0.62, cy + r * 0.72 + dy), (cx, H - 4 * S + dy)], fill=colour)
    shadow = shadow.filter(ImageFilter.GaussianBlur(4 * S))
    out = Image.alpha_composite(shadow, body)
    d = ImageDraw.Draw(out)
    inner = int(r * 0.74)
    d.ellipse((cx - inner, cy - inner, cx + inner, cy + inner), fill=WHITE)
    logo = Image.open(LOGO).convert('RGBA')
    side = int(inner * 1.55)
    logo = logo.resize((side, side), Image.LANCZOS)
    # The app icon has a square background: keep only what falls inside the white circle.
    mask = Image.new('L', out.size, 0)
    ImageDraw.Draw(mask).ellipse((cx - inner, cy - inner, cx + inner, cy + inner), fill=255)
    layer = Image.new('RGBA', out.size, (0, 0, 0, 0))
    layer.alpha_composite(logo, (cx - side // 2, cy - side // 2))
    layer.putalpha(Image.composite(layer.getchannel('A'), Image.new('L', out.size, 0), mask))
    out.alpha_composite(layer)
    return out.resize((w, h), Image.LANCZOS)


def bubble(digits):
    h = 32 * 4
    w = h + max(0, digits - 1) * 24 * 4 // 2
    W, H = w * S, h * S
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    body = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    pad = 5 * S
    for layer, colour, dy in ((shadow, (0, 0, 0, 60), 2 * S), (body, GREEN, 0)):
        ImageDraw.Draw(layer).rounded_rectangle((pad, pad + dy, W - pad, H - pad + dy), radius=(H - 2 * pad) // 2, fill=colour)
    shadow = shadow.filter(ImageFilter.GaussianBlur(3 * S))
    out = Image.alpha_composite(shadow, body)
    ImageDraw.Draw(out).rounded_rectangle((pad, pad, W - pad, H - pad), radius=(H - 2 * pad) // 2, outline=WHITE, width=3 * S)
    return out.resize((w, h), Image.LANCZOS)


def chosen_bubble(digits):
    img = bubble(digits)
    halo = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(halo).rounded_rectangle((0, 0, img.size[0] - 1, img.size[1] - 1), radius=img.size[1] // 2, fill=(255, 122, 26, 90))
    return Image.alpha_composite(halo, img)


if __name__ == '__main__':
    pin(GREEN).save(OUT / 'p6-pin-task.png')
    pin(INK).save(OUT / 'p6-pin-task-chosen.png')
    for n in range(1, 5):
        bubble(n).save(OUT / f'p6-pin-count-{n}.png')
        chosen_bubble(n).save(OUT / f'p6-pin-count-{n}-chosen.png')
    print('pins written to', OUT)
