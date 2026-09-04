/* 宣伝動画を組む。**素材は tools/rec777 で撮った実プレイ。ここでは切って貼るだけ。**
 *
 *   node promo.mjs
 *
 * 素材（out/）：promo_full.webm（777まで通し）／promo_gim.webm（ルーレット・課題・復活）
 *   それぞれ .marks.json に**収録開始からの秒数**で見せ場が入っている。
 *   ⚠️ 切る位置は marks から取る。**目分量で秒数を書かない。**
 *
 * 出力（out/）：promo-x.mp4（16:9）／promo-yt.mp4（16:9）／promo-short.mp4（9:16）
 *
 * 作りの方針（2026-09-04 本人「全然射幸心をあおらない。もっと現代的な感じ。ダサい」を受けて改稿）
 *   ・**結果から始める。** 1カット目は 7777 の爆発。説明は後から追いかけさせる
 *   ・**拍で切る。** 台は160BPM（1拍375ms）。カット長は拍の倍数だけ
 *   ・毎カット頭にパンチズーム＋白フラッシュ2フレーム
 *   ・**字幕は絵を隠さない。** 横は上端と下皿、縦はぼかし帯か下皿。COMBOの数字は絶対に隠さない
 *   ・終わりは**黒板ではなく、動いている絵を暗くした上**に置く（読めないと意味がない）
 *   ・色を立てる（コントラスト・彩度）。音は配信基準まで上げる
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const DIR = import.meta.dirname;
const OUT = path.join(DIR, "out");
const TMP = path.join(OUT, "_cut");
const FONT = "C\\:/Windows/Fonts/meiryob.ttc";
const URL = "ogyanuntiusxiii.com/games/777-combo";
const W = 1600, H = 900, SW = 1080, SH = 1920;
const BEAT = 0.375;                       // 160BPM。カットはこの倍数で
const YEL = "0xFFE14A", CY = "0x9EF1FF", RED = "0xFF5A3C", WHT = "white", INK = "0x140C00";

const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...a], { stdio: ["ignore", "pipe", "inherit"] });
const dur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", f]).toString().trim());
const beats = (n) => +(BEAT * n).toFixed(3);

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

/* ⚠️ 画面キャプチャは**途中で解像度が変わる**（1600x900 で始まって 1920x1012 になっていた。
   ヘッダだけ見ると 1600x900 なので気づけない）。**まず必ず 1600x900 へ揃える。**
   はみ出しは切る（黒帯を作らない）。以降の座標はすべて 1600x900 で考えてよい。
   ⚠️ フィルタの式に , を書くと区切りと衝突する（min(iw,...) で「そんなフィルタは無い」と落ちた）。
      **寸法は整数で埋める。** */
const GRADE = "eq=contrast=1.12:saturation=1.24:gamma=1.02,unsharp=5:5:0.7:5:5:0.0";
const NORM = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},${GRADE},setsar=1`;
/* 1600x900 の中で、筐体は幅およそ 450、左右のモニタまで入れると 304〜1312。
   ・寄り（既定）：中央 506 幅＝ちょうど 9:16。筐体だけで画面が埋まる
   ・引き：1040 幅で両モニタごと取り、上下をぼかしで埋める。字幕はその帯に置ける */
const TIGHT916 = `crop=506:900:547:0,scale=${SW}:${SH},setsar=1`;

/* ⚠️⚠️ MediaRecorder の webm は**目次も長さも持たない生ストリーム**（ffprobe で duration=N/A、
   r_frame_rate=1000/1）。このまま -ss で切ると**数秒ずれた場面が出てくる**（頭に 7777 を置いたのに
   道中が映っていた）。**必ず一度 mp4 へ焼き直してから切る。**
   ついでに 1600x900・60fps・色補正まで済ませておくと、カットごとの処理も速い */
const PREP = path.join(OUT, "_norm");
fs.mkdirSync(PREP, { recursive: true });
function prep(name){
  const src = path.join(OUT, name + ".webm"), dst = path.join(PREP, name + ".mp4");
  if (fs.existsSync(dst) && fs.statSync(dst).mtimeMs > fs.statSync(src).mtimeMs) return dst;
  console.log("  焼き直し:", name);
  ff(["-i", src, "-vf", NORM + ",fps=60", "-fps_mode", "cfr",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-g", "60", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", dst]);
  return dst;
}

/* ---- 素材と見せ場 ------------------------------------------------------ */
function load(name){
  const src = prep(name);
  const marks = JSON.parse(fs.readFileSync(path.join(OUT, name + ".marks.json"), "utf8"));
  const justs = marks.filter((m) => m.kind === "just");
  let hot = { t: justs.length ? justs[0].t : 6, n: 0 };
  for (const j of justs){
    const n = justs.filter((k) => k.t >= j.t && k.t < j.t + 3.2).length;
    if (n > hot.n) hot = { t: j.t, n };
  }
  return { name, src, marks, justs, hot,
    phase: (p) => marks.find((m) => m.kind === "phase" && m.p === p),
    extra: (i = 0) => marks.filter((m) => m.kind === "extra")[i],
    end: (step) => marks.find((m) => m.kind === "end" && m.step === step) };
}
const FULL = load("promo_full"), GIM = load("promo_gim");
const need = (m, what) => { if (!m) throw new Error("見せ場が無い: " + what); return m.t; };

/* ---- 字幕 --------------------------------------------------------------
   kind: "lead"（大きい白/色）／"hit"（ベタ塗りの帯に黒文字。数字向け）／"sub"（小さい） */
const esc = (t) => String(t).replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\u0027").replace(/%/g, "\\%");
function cap(o){
  const from = o.from == null ? 0 : o.from;
  const slide = o.slide == null ? 44 : o.slide;                 // 滑り込む距離
  const dirY = o.up ? "+" : "-";                                // 下から／上から
  const p = [
    `fontfile='${FONT}'`, `text='${esc(o.text)}'`,
    `fontsize=${o.size || 68}`,
    "x=(w-text_w)/2",
    `y='${o.y}${dirY}${slide}*max(0\\,1-(t-${from})/0.14)'`,
    `alpha='if(lt(t,${from}),0,min(1,(t-${from})/0.09))'`,
  ];
  if (o.kind === "hit"){
    p.push(`fontcolor=${INK}`, "box=1", `boxcolor=${o.color || YEL}@0.97`, "boxborderw=26", "borderw=0");
  } else {
    p.push(`fontcolor=${o.color || WHT}`, `borderw=${o.borderw || 12}`, "bordercolor=black",
           "shadowx=0", "shadowy=7", "shadowcolor=0x000000D0");
  }
  if (o.from != null || o.to != null) p.push(`enable='between(t,${from},${o.to == null ? 999 : o.to})'`);
  return "drawtext=" + p.join(":");
}

let n = 0;
const nm = (tag) => path.join(TMP, String(n++).padStart(2, "0") + "-" + tag + ".mp4");
/** 頭のパンチズーム（1.16→1.0・10フレーム）と白フラッシュ2フレーム。
    ⚠️ zoompan は時刻を作り直さないので、**そのあとに setpts を入れないと t が 0 のまま**
       （フラッシュが最後まで白いままになり、字幕が出なかった） */
const punchFor = (w, h, z) => `zoompan=z='if(lte(on,10),${z}-${(z - 1).toFixed(2)}*on/10,1)':d=1:` +
  `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${w}x${h}:fps=60,setpts=N/(60*TB)`;
const PUNCH = punchFor(W, H, 1.16);
const FLASH = "drawbox=c=white@0.85:t=fill:enable='lt(t,0.035)'";
const SCRIM = "drawbox=c=black@0.48:t=fill";

const enc = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-r", "60"];

/** 16:9 の1カット */
function shot(S, start, len, { texts = [], tag = "c", punch = true, flash = true, scrim = false } = {}){
  const f = nm(tag);
  const vf = [
    ...(punch ? [PUNCH] : ["setpts=N/(60*TB)"]),
    ...(flash ? [FLASH] : []),
    ...(scrim ? [SCRIM] : []),
    ...texts.map(cap),
    "format=yuv420p",
  ].join(",");
  ff(["-ss", String(start), "-t", String(len), "-i", S.src, "-vf", vf, "-af", "aresample=48000", ...enc, f]);
  return f;
}
/** 9:16 の1カット。既定は**筐体で画面を埋める**。wide は両モニタごと帯で見せる */
function shotS(S, start, len, { texts = [], tag = "s", wide = false, punch = true, flash = true, scrim = false } = {}){
  const f = nm(tag);
  const post = (punch ? punchFor(SW, SH, 1.12) : `setpts=N/(60*TB)`) +
    (flash ? "," + FLASH : "") + (scrim ? "," + SCRIM : "") +
    (texts.length ? "," + texts.map(cap).join(",") : "") + ",format=yuv420p";
  let chain;
  if (wide){
    // 上下のぼかし帯に字幕を置ける。筐体は幅いっぱい・高さの半分弱
    chain = [
      `[0:v]split=2[a][b]`,
      `[a]scale=${SW}:${SH}:force_original_aspect_ratio=increase,crop=${SW}:${SH},boxblur=26:2,eq=brightness=-0.34:saturation=0.5[bg]`,
      `[b]crop=1040:900:280:0,scale=${SW}:-2[fg]`,
      `[bg][fg]overlay=0:(H-h)/2[m]`,
      `[m]${post}[v]`,
    ].join(";");
  } else {
    chain = [`[0:v]${TIGHT916}[c]`, `[c]${post}[v]`].join(";");
  }
  ff(["-ss", String(start), "-t", String(len), "-i", S.src,
      "-filter_complex", chain, "-map", "[v]", "-map", "0:a?", "-af", "aresample=48000", ...enc, f]);
  return f;
}
function join(files, outFile){
  const list = path.join(TMP, "l-" + path.basename(outFile) + ".txt");
  fs.writeFileSync(list, files.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"));
  // 音は配信基準（-14 LUFS）まで上げる。素材のままだと SNS では小さくて埋もれる
  ff(["-f", "concat", "-safe", "0", "-i", list,
      "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
      "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", outFile]);
  console.log("→", path.basename(outFile), dur(outFile).toFixed(1) + "s", (fs.statSync(outFile).size / 1e6).toFixed(1) + "MB");
}

/* ---- 見せ場の秒数 ------------------------------------------------------ */
const J = FULL.justs;
const E777 = need(FULL.phase("ending"), "エンディング");
const E7777 = need(FULL.end(584), "7777");
const P = {
  hot: FULL.hot.t - 0.55,
  j1: J[3].t - 0.5, j2: J[9].t - 0.5, j3: J[15].t - 0.5, j4: J[24].t - 0.5,
  aim: need(FULL.extra(2), "課題") - 1.1,
  rl: need(GIM.phase("roulette"), "ルーレット") - 0.7,
  dead: need(GIM.phase("dead"), "暗転") - 0.9,
  lever: need(GIM.phase("pull"), "レバー") - 0.3,
  bar: need(GIM.extra(2), "BARを狙え") + 1.2,
  end: E777 - 0.6, endMid: E777 + 8,
  fin: E7777 - 1.4,          // 7777 が乗る瞬間
  hook: E7777 + 0.15,        // 爆発のいちばん濃いところ（頭に置く）
  lock: E7777 + 3.4,         // 落ち着いてから、締めの文字を乗せる
};
console.log("素材: ビタ" + J.length, "密集" + FULL.hot.t.toFixed(1) + "×" + FULL.hot.n,
  "| 777", P.end.toFixed(1), "7777", P.fin.toFixed(1), "| ルーレット", P.rl.toFixed(1), "暗転", P.dead.toFixed(1));

// 横：上端と下皿だけ使う（リールと COMBO の帯は空けておく）
const TOP = "h*0.075", HIT = "h*0.79", SUB = "h*0.905";
// 縦・寄り：上は COMBO の数字があるので触らない。下皿に置く
const zHIT = "h*0.685";
// 縦・引き：ぼかし帯
const wTOP = "h*0.115", wBOT = "h*0.795";

/* ---- ① X（16:9・約23秒）------------------------------------------------
   1カット目は結果。理屈は後から追いかけさせる */
join([
  shot(FULL, P.hook, beats(4), { tag: "x0", texts: [
    { text: "7777 COMBO", size: 108, y: HIT, kind: "hit", from: 0.18 },
  ]}),
  shot(FULL, P.j2, beats(2), { tag: "x1", texts: [
    { text: "これ、全部 目押し", size: 80, y: TOP, from: 0.02 },
  ]}),
  shot(FULL, P.j1, beats(2), { tag: "x2", texts: [
    { text: "1コマもズラすな", size: 78, y: TOP, from: 0.02 },
  ]}),
  shot(FULL, P.j3, beats(2), { tag: "x3", texts: [
    { text: "ビタ ＝ +4", size: 82, y: HIT, kind: "hit", from: 0.02 },
  ]}),
  shot(FULL, P.hot, beats(4), { tag: "x4", texts: [
    { text: "777が止まらない", size: 88, y: TOP, color: YEL, from: 0.04 },
  ]}),
  shot(FULL, P.aim, beats(6), { tag: "x5", texts: [
    { text: "7を狙え", size: 92, y: TOP, color: YEL, from: 0.04 },
    { text: "指定の線に、7を3つ", size: 48, y: SUB, from: 0.9, up: true },
  ]}),
  shot(GIM, P.rl, beats(4), { tag: "x6", texts: [
    { text: "台が動き出す", size: 82, y: TOP, color: CY, from: 0.04 },
  ]}),
  shot(GIM, P.dead, beats(4), { tag: "x7", texts: [
    { text: "外した", size: 96, y: TOP, color: RED, from: 0.62 },
  ]}),
  shot(GIM, P.lever, beats(6), { tag: "x8", texts: [
    { text: "まだ終わらない", size: 86, y: TOP, color: YEL, from: 0.04 },
    { text: "レバーを叩け ▶ BARを狙え", size: 48, y: SUB, from: 0.8, up: true },
  ]}),
  shot(FULL, P.end, beats(6), { tag: "x9", texts: [
    { text: "777 到達", size: 92, y: HIT, kind: "hit", from: 0.04, to: 1.5 },
    { text: "ここから台が壊れる", size: 80, y: TOP, color: YEL, from: 1.6 },
  ]}),
  shot(FULL, P.endMid, beats(6), { tag: "x10", punch: false, texts: [
    { text: "勝手に揃い続ける", size: 76, y: TOP, color: YEL, from: 0.04 },
  ]}),
  shot(FULL, P.fin, beats(8), { tag: "x11", texts: [
    { text: "7777 COMBO", size: 112, y: HIT, kind: "hit", from: 0.55 },
  ]}),
  shot(FULL, P.lock, beats(8), { tag: "x12", punch: false, scrim: true, texts: [
    { text: "777コンボ", size: 140, y: "h*0.28", color: YEL, from: 0.06 },
    { text: "無料 / ブラウザ / スマホOK", size: 52, y: "h*0.50", from: 0.42, up: true },
    { text: URL, size: 50, y: "h*0.66", kind: "hit", color: CY, from: 0.72, up: true },
  ]}),
], path.join(OUT, "promo-x.mp4"));

/* ---- ② YouTube（16:9・約34秒）------------------------------------------ */
join([
  shot(FULL, P.hook, beats(5), { tag: "y0", texts: [
    { text: "7777 COMBO", size: 108, y: HIT, kind: "hit", from: 0.18 },
  ]}),
  shot(FULL, P.hot, beats(6), { tag: "y1", texts: [
    { text: "777が止まらない", size: 88, y: TOP, color: YEL, from: 0.04 },
    { text: "777が揃ったところから始まる、目押しゲーム", size: 46, y: SUB, from: 0.9, up: true },
  ]}),
  shot(FULL, P.j1, beats(4), { tag: "y2", texts: [
    { text: "揃うたびに、1つ回り直す", size: 72, y: TOP, from: 0.04 },
  ]}),
  shot(FULL, P.j2, beats(4), { tag: "y3", texts: [
    { text: "7は音の拍に乗って来る", size: 72, y: TOP, color: CY, from: 0.04 },
    { text: "見てからでは遅い", size: 46, y: SUB, from: 0.8, up: true },
  ]}),
  shot(FULL, P.j3, beats(3), { tag: "y4", texts: [
    { text: "ビタ ＝ +4", size: 82, y: HIT, kind: "hit", from: 0.02 },
  ]}),
  shot(FULL, P.j4, beats(3), { tag: "y5", texts: [
    { text: "ナビ通りに押せ", size: 74, y: TOP, from: 0.02 },
  ]}),
  shot(FULL, P.aim, beats(8), { tag: "y6", texts: [
    { text: "ビタ5回 ▶ 7を狙え", size: 78, y: TOP, color: YEL, from: 0.04 },
    { text: "指定の線に、7を3つ揃えろ", size: 48, y: SUB, from: 1.1, up: true },
  ]}),
  shot(GIM, P.rl, beats(6), { tag: "y7", texts: [
    { text: "ビタ3連続 ▶ ルーレット", size: 74, y: TOP, color: CY, from: 0.04 },
  ]}),
  shot(GIM, P.dead, beats(5), { tag: "y8", texts: [
    { text: "外した。音も光も消える", size: 70, y: TOP, color: RED, from: 0.62 },
  ]}),
  shot(GIM, P.lever, beats(7), { tag: "y9", texts: [
    { text: "レバーを下げろ ▶ BARを狙え", size: 66, y: TOP, color: YEL, from: 0.04 },
  ]}),
  shot(GIM, P.bar, beats(5), { tag: "y10", texts: [
    { text: "復活 +10", size: 90, y: HIT, kind: "hit", from: 0.04 },
  ]}),
  shot(FULL, P.end, beats(7), { tag: "y11", texts: [
    { text: "777 到達", size: 92, y: HIT, kind: "hit", from: 0.04, to: 1.5 },
    { text: "ここから台が壊れる", size: 80, y: TOP, color: YEL, from: 1.6 },
  ]}),
  shot(FULL, P.endMid, beats(7), { tag: "y12", punch: false, texts: [
    { text: "勝手に揃い続ける", size: 76, y: TOP, color: YEL, from: 0.04 },
  ]}),
  shot(FULL, P.fin, beats(8), { tag: "y13", texts: [
    { text: "7777 COMBO", size: 112, y: HIT, kind: "hit", from: 0.55 },
  ]}),
  shot(FULL, P.lock, beats(10), { tag: "y14", punch: false, scrim: true, texts: [
    { text: "777コンボ", size: 148, y: "h*0.26", color: YEL, from: 0.06 },
    { text: "無料 / ブラウザ / スマホOK", size: 54, y: "h*0.48", from: 0.42, up: true },
    { text: URL, size: 52, y: "h*0.63", kind: "hit", color: CY, from: 0.72, up: true },
    { text: "オギャヌンティウス十三世", size: 34, y: "h*0.86", color: "0x9A9AA2", from: 1.0, up: true },
  ]}),
], path.join(OUT, "promo-yt.mp4"));

/* ---- ③ ショート（9:16・約21秒）---------------------------------------- */
join([
  shotS(FULL, P.hook, beats(4), { tag: "s0", texts: [
    { text: "7777 COMBO", size: 92, y: zHIT, kind: "hit", from: 0.15 },
  ]}),
  shotS(FULL, P.j2, beats(2), { tag: "s1", texts: [
    { text: "これ、全部 目押し", size: 76, y: zHIT, from: 0.02 },
  ]}),
  shotS(FULL, P.j1, beats(2), { tag: "s2", texts: [
    { text: "1コマもズラすな", size: 76, y: zHIT, from: 0.02 },
  ]}),
  shotS(FULL, P.j3, beats(2), { tag: "s3", texts: [
    { text: "ビタ ＝ +4", size: 86, y: zHIT, kind: "hit", from: 0.02 },
  ]}),
  shotS(FULL, P.hot, beats(4), { tag: "s4", texts: [
    { text: "777が止まらない", size: 82, y: zHIT, color: YEL, from: 0.04 },
  ]}),
  shotS(FULL, P.aim, beats(6), { tag: "s5", wide: true, texts: [
    { text: "7を狙え", size: 100, y: wTOP, color: YEL, from: 0.04 },
    { text: "指定の線に、7を3つ", size: 52, y: wBOT, from: 0.9, up: true },
  ]}),
  shotS(GIM, P.rl, beats(4), { tag: "s6", texts: [
    { text: "台が動き出す", size: 84, y: zHIT, color: CY, from: 0.04 },
  ]}),
  shotS(GIM, P.dead, beats(4), { tag: "s7", wide: true, texts: [
    { text: "外した", size: 104, y: wTOP, color: RED, from: 0.62 },
  ]}),
  shotS(GIM, P.lever, beats(4), { tag: "s8", wide: true, texts: [
    { text: "まだ終わらない", size: 88, y: wTOP, color: YEL, from: 0.04 },
    { text: "レバーを叩け ▶ BARを狙え", size: 46, y: wBOT, from: 0.55, up: true },
  ]}),
  shotS(FULL, P.end, beats(6), { tag: "s9", texts: [
    { text: "777 到達", size: 96, y: zHIT, kind: "hit", from: 0.04, to: 1.4 },
    { text: "台が壊れる", size: 88, y: zHIT, color: YEL, from: 1.5 },
  ]}),
  shotS(FULL, P.endMid, beats(5), { tag: "s10", punch: false, texts: [
    { text: "勝手に揃い続ける", size: 76, y: zHIT, color: YEL, from: 0.04 },
  ]}),
  shotS(FULL, P.fin, beats(7), { tag: "s11", texts: [
    { text: "7777 COMBO", size: 92, y: zHIT, kind: "hit", from: 0.55 },
  ]}),
  shotS(FULL, P.lock, beats(8), { tag: "s12", wide: true, punch: false, scrim: true, texts: [
    { text: "777コンボ", size: 132, y: "h*0.14", color: YEL, from: 0.06 },
    { text: "無料 / ブラウザ", size: 62, y: "h*0.73", from: 0.42, up: true },
    { text: URL, size: 40, y: "h*0.82", kind: "hit", color: CY, from: 0.72, up: true },
  ]}),
], path.join(OUT, "promo-short.mp4"));

console.log("done");
