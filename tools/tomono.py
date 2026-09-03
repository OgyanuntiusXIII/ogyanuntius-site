"""立ち絵を「黒い画面に赤いドットだけ」のドット絵に落とす（幻想水滸伝のドット立ち絵の線で）。

    python tomono.py <入力> <出力> --head-px <頭の高さpx> --head-dots <頭の高さドット>

やっていること
  1. 透過を使って人物だけにする（余白を切る）
  2. 頭の高さ（お団子の上〜あご）が head-dots ドットになる縮尺に決める
     → 何枚も並べるとき、頭の大きさがそろう
  3. ドット1個ぶんに落として3値にする。**明るい所は暗い線で彫り、暗い所は明るい線で描く**
       シルエットの縁       … 明るい赤（黒い服が黒い背景に溶けないように、必ず灯す）
       明るい領域（肌・白）  … 明るい赤。ただし中の暗い線（目・口・指の間）は消灯で彫る
       中間（灰の陰影）      … 暗い赤
       暗い領域（黒い服・髪）… 消灯。ただし中の明るい線（金の縁取り・袖口・髪の艶）は明るい赤
  4. 頭の中心（横）を印字する。ゲーム側で3枚を重ねるための基準

出力は RGBA PNG。1ピクセル＝1ドット。ゲームは整数倍で貼る。
"""
import argparse
import numpy as np
from PIL import Image
from scipy import ndimage

BRIGHT = (255, 59, 42, 255)
DIM    = (150, 22, 16, 255)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("dst")
    ap.add_argument("--head-px", type=float, required=True, help="元絵で、お団子の上からあごまでのpx")
    ap.add_argument("--head-dots", type=float, required=True, help="それを何ドットにするか")
    ap.add_argument("--light", type=float, default=0.55, help="この平均明るさ以上は「明るい領域」")
    ap.add_argument("--mid", type=float, default=0.28, help="この平均明るさ以上は「中間」")
    ap.add_argument("--carve", type=float, default=0.30, help="明るい領域で、最小がこれ未満なら彫る（消灯）")
    ap.add_argument("--seam", type=float, default=0.20, help="暗い領域で、輪郭の強さがこれ以上なら描く（点灯）")
    ap.add_argument("--y1", type=float, default=1.0, help="上から何割まで使うか（脚を切るとき）")
    ap.add_argument("--cut", type=int, default=0, help="透過が無い絵：四隅から流し込んで背景を抜く（許容差。0で無効）")
    ap.add_argument("--erase", action="append", default=[], help="消す矩形 x0,y0,x1,y1（元絵の座標。生成絵の余計な線や髪を落とす）")
    a = ap.parse_args()

    im = Image.open(a.src).convert("RGBA")
    if a.cut > 0:
        # 生成絵は背景が平坦なので、四隅の色に近い画素を全部透明にする（囲まれた隙間も抜ける）
        # ⚠️ 肌の色が背景のベージュに近い。色だけで抜くと顔まで抜ける（実際そうなった）。
        #    四隅につながっている背景色の領域だけを抜く。囲まれた隙間は、背景色に近く（許容差の半分）かつ小さいものだけ抜く
        arr = np.asarray(im.convert("RGB")).astype(np.int16)
        corners = np.stack([arr[0, 0], arr[0, -1], arr[-1, 0], arr[-1, -1]]).astype(np.int16)
        c0 = np.median(corners, axis=0)
        diff = np.abs(arr - c0).max(axis=2)
        key = diff < a.cut
        lab, n = ndimage.label(key)
        border = set(np.unique(np.concatenate([lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]])))
        border.discard(0)
        reach = np.isin(lab, list(border))
        tight = diff < a.cut * 0.5
        lab2, n2 = ndimage.label(tight & ~reach)
        sizes = ndimage.sum(np.ones_like(lab2), lab2, index=np.arange(1, n2 + 1))
        small = np.isin(lab2, [i + 1 for i, sz in enumerate(sizes) if sz < arr.shape[0] * arr.shape[1] * 0.004])
        bg = ndimage.binary_dilation(reach | small, iterations=1)
        al = np.asarray(im.getchannel("A")).copy(); al[bg] = 0
        im.putalpha(Image.fromarray(al))
    for rect in a.erase:
        x0, y0, x1, y1 = [int(v) for v in rect.split(",")]
        al = np.asarray(im.getchannel("A")).copy(); al[y0:y1, x0:x1] = 0
        im.putalpha(Image.fromarray(al))
    alpha = np.asarray(im.getchannel("A")).astype(np.float32) / 255.0
    ys, xs = np.where(alpha > 0.4)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    y1 = y0 + int((y1 - y0) * a.y1)
    im = im.crop((x0, y0, x1, y1))

    scale = a.head_dots / a.head_px
    K = 6
    W = max(1, int(round(im.width * scale)))
    H = max(1, int(round(im.height * scale)))
    mid = im.resize((W * K, H * K), Image.LANCZOS)
    rgb = np.asarray(mid.convert("RGB")).astype(np.float32) / 255.0
    al = np.asarray(mid.getchannel("A")).astype(np.float32) / 255.0
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    inside = al > 0.5

    # 内側だけの明るさ。外は「1」にして最小に効かないよう、「0」にして平均に効かないよう別に持つ
    lum_in0 = np.where(inside, lum, 0.0)
    lum_in1 = np.where(inside, lum, 1.0)
    sx = ndimage.sobel(lum_in0, axis=1); sy = ndimage.sobel(lum_in0, axis=0)
    edge = np.hypot(sx, sy) / 4.0
    mx = ndimage.sobel(inside.astype(np.float32), axis=1); my = ndimage.sobel(inside.astype(np.float32), axis=0)
    sil = (np.hypot(mx, my) > 0.5) & ndimage.binary_dilation(inside, iterations=1)

    def pool(arr, fn):
        return fn(arr.reshape(H, K, W, K), axis=(1, 3))
    ins_d = pool(inside.astype(np.float32), np.mean)
    cnt = np.maximum(pool(inside.astype(np.float32), np.sum), 1e-6)
    mean_d = pool(lum_in0, np.sum) / cnt
    min_d = pool(lum_in1, np.min)
    edge_d = pool(np.where(inside, edge, 0.0), np.max)
    sil_d = pool(sil.astype(np.float32), np.max)

    on = ins_d > 0.35
    light = on & (mean_d >= a.light)
    midr = on & ~light & (mean_d >= a.mid)
    dark = on & ~light & ~midr
    bright = (on & (sil_d > 0.5)) \
           | (light & (min_d >= a.carve)) \
           | (dark & (edge_d >= a.seam))
    dim = midr & ~bright & (min_d >= a.carve * 0.7)

    out = np.zeros((H, W, 4), dtype=np.uint8)
    out[bright] = BRIGHT
    out[dim] = DIM
    Image.fromarray(out, "RGBA").save(a.dst)
    row = int(min(H - 1, a.head_dots * 0.5))
    cols = np.where(out[row, :, 3] > 0)[0]
    ax = int(cols.mean()) if len(cols) else W // 2
    print(f"{a.dst} -> {W}x{H}  head_center_x={ax}  bright={int(bright.sum())} dim={int(dim.sum())}")


if __name__ == "__main__":
    main()
