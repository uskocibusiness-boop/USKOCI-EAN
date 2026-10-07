"""
The P6 Zadaci map pins as MapLibre sprites (assets/discovery/p6-pin-*.png).

They redraw the PricePill capsule (src/ui/v2/discovery/PricePill.tsx) for the native map layers, which cannot host React views:
a white capsule 42 dp high with a 1 dp hairline (sys.color.line), a soft shadow and the existing USKOCI mark (assets/entry-splash-mark.png)
in its 34 dp mark well. A task is the mark alone; a group of tasks leaves room after the mark for its count, which the map draws as text
(1 to 4 characters: "7", "42", "512", "999+"). The chosen variant is the same capsule with the orange edge and the two quiet orange halo
rings of PricePill; the map draws it 6 % larger. Every image keeps a 6 dp margin on all sides (halo and shadow), so its centre is the
capsule's centre. Drawn at 4 px per dp (the map's icon-size is 1/4), supersampled 4x for smooth edges.

    python scripts/design/generate_p6_pins.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / 'discovery'
MARK = ROOT / 'assets' / 'entry-splash-mark.png'

PX = 4            # pixels per dp in the sprite (icon-size 0.25)
SUPER = 4         # supersampling for anti-aliased edges
MARGIN = 6        # dp around the capsule: the 4 dp outer halo and the shadow
HEIGHT = 42       # dp: 1 border + 3 padding + 34 mark + 3 padding + 1 border (PricePill)
MARK_WELL = 34    # dp
MARK_SIZE = 30    # dp: BrandMark size in PricePill
# PricePill: border 1, paddingLeft 4, mark 34, gap 4, words, paddingRight 12 (sys.space.md), border 1. A digit of the map's 14 dp
# Noto Sans is about 8 dp wide.
WIDTHS = {0: 1 + 4 + MARK_WELL + 4 + 1}
WIDTHS.update({chars: 1 + 4 + MARK_WELL + 4 + (8 * chars + 2) + 12 + 1 for chars in (1, 2, 3, 4)})

SURFACE = (255, 255, 255, 255)
LINE = (0xEB, 0xEB, 0xEB, 255)          # sys.color.line
INK = (0x20, 0x20, 0x20)                # sys.color.ink
ORANGE = (0xFF, 0x7A, 0x1A)             # sys.color.orange
ORANGE_HALO = (0xFF, 0xD2, 0xA8, 255)   # sys.color.orangeHalo


def rounded(draw, box, fill=None, outline=None, width=0):
    x0, y0, x1, y1 = box
    draw.rounded_rectangle(box, radius=(y1 - y0) / 2, fill=fill, outline=outline, width=width)


def ring(size, box, grow, width, color, alpha):
    """A capsule ring `width` dp wide whose outer edge lies `grow` dp outside `box` (PricePill's halo views)."""
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    x0, y0, x1, y1 = box
    g, w = grow * PX * SUPER, width * PX * SUPER
    rounded(ImageDraw.Draw(layer), (x0 - g, y0 - g, x1 + g, y1 + g), outline=color + (round(255 * alpha),), width=w)
    return layer


def pin(width_dp, chosen):
    s = PX * SUPER
    size = ((width_dp + 2 * MARGIN) * s, (HEIGHT + 2 * MARGIN) * s)
    box = (MARGIN * s, MARGIN * s, (MARGIN + width_dp) * s - 1, (MARGIN + HEIGHT) * s - 1)
    image = Image.new('RGBA', size, (0, 0, 0, 0))
    # Android elevation 1 under the white capsule: a soft shadow one dp down.
    shadow = Image.new('RGBA', size, (0, 0, 0, 0))
    rounded(ImageDraw.Draw(shadow), (box[0], box[1] + s, box[2], box[3] + s), fill=INK + (round(255 * 0.16),))
    image = Image.alpha_composite(image, shadow.filter(ImageFilter.GaussianBlur(2 * s)))
    if chosen:
        image = Image.alpha_composite(image, ring(size, box, 4, 4, ORANGE, 0.08))
        image = Image.alpha_composite(image, ring(size, box, 2, 2, ORANGE, 0.16))
    body = Image.new('RGBA', size, (0, 0, 0, 0))
    rounded(ImageDraw.Draw(body), box, fill=SURFACE, outline=ORANGE_HALO if chosen else LINE, width=s)
    image = Image.alpha_composite(image, body)
    mark = Image.open(MARK).convert('RGBA')
    mark = mark.crop(mark.getchannel('A').getbbox()).resize((MARK_SIZE * s, MARK_SIZE * s), Image.LANCZOS)
    well_x = box[0] + (1 + 4) * s
    left = well_x + (MARK_WELL - MARK_SIZE) * s // 2
    top = box[1] + (HEIGHT * s - MARK_SIZE * s) // 2
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    layer.paste(mark, (left, top), mark)
    image = Image.alpha_composite(image, layer)
    return image.resize((size[0] // SUPER, size[1] // SUPER), Image.LANCZOS)


def main():
    for chars, width in WIDTHS.items():
        name = 'task' if chars == 0 else f'count-{chars}'
        for chosen in (False, True):
            path = OUT / f"p6-pin-{name}{'-chosen' if chosen else ''}.png"
            pin(width, chosen).save(path, optimize=True)
            print(path.relative_to(ROOT), (width + 2 * MARGIN) * PX, (HEIGHT + 2 * MARGIN) * PX)


if __name__ == '__main__':
    main()
