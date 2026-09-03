"""立ち絵をドット絵に落とす。

    python topixel.py <入力> <出力> <縦のドット数> [色数] [切り取り率]

やっていること
  1. 透明が付いていればそれを使う。無ければ四隅から流し込んで背景だけ抜く
  2. 余白を切る（必要なら上から <切り取り率> だけ残してバストにする）
  3. 面積平均で縮める → 色数を絞る（ここでドットになる）
  4. 半端な透明を落として、外周に1ドットの暗いフチを付ける
     筐体の絵柄と同じ処理。小さくても形が読めるのはこのフチのおかげ
"""
import sys
from PIL import Image, ImageDraw

OUTLINE = (20, 16, 26, 255)


def has_alpha(im):
    if im.mode not in ("RGBA", "LA") and "transparency" not in im.info:
        return False
    a = im.convert("RGBA").getchannel("A")
    return a.getextrema()[0] < 250


def cut_background(im, tol=26):
    """四隅から流し込んで背景を透明にする（透明が付いていない絵のため）"""
    im = im.convert("RGBA")
    w, h = im.size
    rgb = im.convert("RGB")
    mark = (255, 0, 255)
    for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        try:
            ImageDraw.floodfill(rgb, xy, mark, thresh=tol)
        except Exception:
            pass
    px_rgb, px = rgb.load(), im.load()
    for y in range(h):
        for x in range(w):
            if px_rgb[x, y] == mark:
                px[x, y] = (0, 0, 0, 0)
    return im


def pixelize(im, dot_h, colors):
    w, h = im.size
    dot_w = max(1, round(w * dot_h / h))
    small = im.resize((dot_w, dot_h), Image.BOX)
    a = small.getchannel("A").point(lambda v: 255 if v > 120 else 0)
    rgb = Image.new("RGB", small.size, (255, 255, 255))
    rgb.paste(small.convert("RGB"), (0, 0), a)
    q = rgb.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE).convert("RGB")
    q.putalpha(a)
    return q


def outline(im):
    w, h = im.size
    out = Image.new("RGBA", (w + 2, h + 2), (0, 0, 0, 0))
    out.paste(im, (1, 1))
    px = out.load()
    W, H = out.size
    add = []
    for y in range(H):
        for x in range(W):
            if px[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and px[nx, ny][3]:
                    add.append((x, y))
                    break
    for xy in add:
        px[xy] = OUTLINE
    return out


def main():
    src, dst, dot_h = sys.argv[1], sys.argv[2], int(sys.argv[3])
    colors = int(sys.argv[4]) if len(sys.argv) > 4 else 14
    y0 = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0   # 上から何割の位置から
    y1 = float(sys.argv[6]) if len(sys.argv) > 6 else 1.0   # どこまで

    im = Image.open(src)
    im = im.convert("RGBA") if has_alpha(im) else cut_background(im)
    # 半端な透明（うすい影やグロー）を先に落とす
    a = im.getchannel("A").point(lambda v: 255 if v > 100 else 0)
    im.putalpha(a)
    bb = im.getbbox()
    if bb:
        im = im.crop(bb)
    if y0 > 0 or y1 < 1.0:              # 図の縦を割合で切る（上半身／下半身）
        w, h = im.size
        im = im.crop((0, int(h * y0), w, int(h * y1)))
        bb = im.getbbox()
        if bb:
            im = im.crop(bb)

    # ⚠️ 締めすぎると顔が白黒に飛んで**遺影みたいになる**（実際なった）。
    #    明るさは触らず、色みだけ少し起こす
    from PIL import ImageEnhance
    a2 = im.getchannel("A")
    rgb2 = ImageEnhance.Color(im.convert("RGB")).enhance(1.45)
    im = rgb2.convert("RGBA"); im.putalpha(a2)

    im = pixelize(im, dot_h, colors)
    im = outline(im)
    im.save(dst)
    print(dst, "->", im.size[0], "x", im.size[1], "dots /", colors, "colors")


if __name__ == "__main__":
    main()
