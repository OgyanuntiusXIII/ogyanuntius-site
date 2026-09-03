"""777 のロゴをドット絵で焼く。

小さい文字をそのまま拡大すると「フォントを拡大しただけ」に見える。
**大きく組んでから、ドットへ落とす。** そのうえで
  ・上を明るく、下を暗く（2階調の陰）
  ・外周に黒いフチ
  ・その外にもう一段だけ暗い赤の縁
を機械で付ける。ここまでやると図形として立つ。
"""
import sys
from PIL import Image, ImageDraw, ImageFont

FONT = "C:/Windows/Fonts/ariblk.ttf"
RED     = (232, 51, 42)
RED_HI  = (255, 122, 108)
RED_LO  = (150, 22, 16)
EDGE    = (60, 8, 5)
OUTLINE = (18, 8, 8)


def main():
    text = sys.argv[1] if len(sys.argv) > 1 else "777"
    out = sys.argv[2] if len(sys.argv) > 2 else "px/logo.png"
    dot_h = int(sys.argv[3]) if len(sys.argv) > 3 else 26

    # ① 大きく組む
    big = 400
    font = ImageFont.truetype(FONT, big)
    tmp = Image.new("L", (10, 10))
    bb = ImageDraw.Draw(tmp).textbbox((0, 0), text, font=font)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    mask = Image.new("L", (w + big // 6, h + big // 6), 0)
    ImageDraw.Draw(mask).text((big // 12 - bb[0], big // 12 - bb[1]), text, 255, font=font)
    mask = mask.crop(mask.getbbox())

    # ② ドットへ落とす（面積平均 → 濃さで切る）
    dw = max(1, round(mask.width * dot_h / mask.height))
    small = mask.resize((dw, dot_h), Image.BOX).point(lambda v: 255 if v > 118 else 0)

    # ③ 陰を付ける。上が明るく、下が暗い
    W, H = small.size
    pad = 2
    im = Image.new("RGBA", (W + pad * 2, H + pad * 2), (0, 0, 0, 0))
    px = im.load()
    m = small.load()
    at = lambda x, y: (0 if x < 0 or y < 0 or x >= W or y >= H else m[x, y])
    for y in range(H):
        for x in range(W):
            if not at(x, y):
                continue
            col = RED
            if not at(x, y - 1):
                col = RED_HI
            elif not at(x, y + 1):
                col = RED_LO
            px[x + pad, y + pad] = col + (255,)

    # ④ 外周に暗い赤の縁 → さらに外に黒いフチ
    for col, dist in ((EDGE, 1), (OUTLINE, 2)):
        add = []
        for y in range(im.height):
            for x in range(im.width):
                if px[x, y][3]:
                    continue
                hit = False
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < im.width and 0 <= ny < im.height and px[nx, ny][3]:
                            hit = True
                if hit:
                    add.append((x, y))
        for xy in add:
            px[xy] = col + (255,)

    im = im.crop(im.getbbox())
    im.save(out)
    print(out, "->", im.size[0], "x", im.size[1], "dots")


if __name__ == "__main__":
    main()
