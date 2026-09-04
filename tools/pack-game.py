# -*- coding: utf-8 -*-
"""ゲーム1本を「よそのサイトへ投稿できる zip」にまとめる。

    python tools/pack-game.py 777-combo

出力：dist/<slug>.zip（**index.html が zip の直下**。投稿フォームの要求どおり）

⚠️ 前提：ゲームが**自分のサイトの外でも動く**こと。
   ・絵や音は**相対パス**で読む（`loadArt("chara_low.png")` のように）
   ・`/` 始まりの参照（トップへ戻るリンク・favicon・API）は**絶対URLにするか、自分のサイトのときだけ動かす**
   777コンボはこの3か所を 2026-09-04 に直してある。**新しいゲームを詰めるときは同じ点を確認する。**

⚠️ ogp.jpg は入れない。<meta> から**絶対URLで**参照しているので、zip の中に居ても誰も読まない。
"""
import io, os, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {"ogp.jpg"}                       # 使われないもの
SKIP_EXT = {".map", ".psd", ".xcf"}

def main():
    slug = sys.argv[1] if len(sys.argv) > 1 else "777-combo"
    src = os.path.join(ROOT, "public", "games", slug)
    if not os.path.isdir(src):
        raise SystemExit("ゲームが無い: " + src)
    if not os.path.isfile(os.path.join(src, "index.html")):
        raise SystemExit("index.html が無い: " + src)

    # 自分のサイト直下を指したままの参照が残っていないか、詰める前に見る
    html = io.open(os.path.join(src, "index.html"), encoding="utf-8").read()
    import re
    bad = sorted(set(re.findall(r'(?:href|src)="(/[^"]*)"', html)))
    if bad:
        print("⚠️ サイト直下を指す参照が残っている（よそでは壊れる）:")
        for b in bad:
            print("   ", b)

    out_dir = os.path.join(ROOT, "dist")
    os.makedirs(out_dir, exist_ok=True)
    dst = os.path.join(out_dir, slug + ".zip")

    n = 0
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for base, dirs, files in os.walk(src):
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            for f in sorted(files):
                if f in SKIP or os.path.splitext(f)[1].lower() in SKIP_EXT or f.startswith("."):
                    continue
                full = os.path.join(base, f)
                rel = os.path.relpath(full, src).replace("\\", "/")   # index.html が直下に来る
                z.write(full, rel)
                print("  +", rel, "(%.1f KB)" % (os.path.getsize(full) / 1024))
                n += 1
    mb = os.path.getsize(dst) / 1e6
    print("→ %s  %d個  %.2f MB" % (os.path.relpath(dst, ROOT), n, mb))
    if mb > 200:
        print("⚠️ 200MB を超えている。投稿フォームの上限に引っかかる")

if __name__ == "__main__":
    main()
