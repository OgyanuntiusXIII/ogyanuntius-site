/* 宣伝動画を組む。**素材は tools/rec777 で撮った実プレイ。ここでは切って貼るだけ。**
 *
 *   node promo.mjs
 *
 * 素材（out/）：
 *   promo_full.webm … 777 まで通した長い回（+ .marks.json）
 *   promo_gim.webm  … ルーレット・課題・復活を出した短い回（+ .marks.json）
 *   marks は**収録開始からの秒数**。kind: just / phase / extra / rescue / end / combo100
 *   ⚠️ 切る位置は marks から取る。**目分量で秒数を書かない。**
 *
 * 出力（out/）：
 *   promo-x.mp4      16:9 / 約25秒 / X（音を切って見られる前提で字幕を厚く）
 *   promo-yt.mp4     16:9 / 約50秒 / YouTube
 *   promo-short.mp4  9:16 / 約30秒 / ショート
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
const YEL = "0xFFE14A", CY = "0x9EF1FF", RED = "0xFF6A4A", WHT = "white";

const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...a], { stdio: ["ignore", "pipe", "inherit"] });
const dur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", f]).toString().trim());

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

/* ---- 素材と見せ場 ------------------------------------------------------ */
function load(name){
  const src = path.join(OUT, name + ".webm");
  const marks = JSON.parse(fs.readFileSync(path.join(OUT, name + ".marks.json"), "utf8"));
  const phase = (p) => marks.find((m) => m.kind === "phase" && m.p === p);
  const phaseAfter = (p, t) => marks.find((m) => m.kind === "phase" && m.p === p && m.t > t);
  const justs = marks.filter((m) => m.kind === "just");
  // ビタがいちばん詰まっている所
  let hot = { t: justs.length ? justs[0].t : 6, n: 0 };
  for (const j of justs){
    const n = justs.filter((k) => k.t >= j.t && k.t < j.t + 3.2).length;
    if (n > hot.n) hot = { t: j.t, n };
  }
  return { name, src, marks, phase, phaseAfter, justs, hot,
    extra: (i = 0) => marks.filter((m) => m.kind === "extra")[i],
    rescue: (i = 0) => marks.filter((m) => m.kind === "rescue")[i],
    end: (step) => marks.find((m) => m.kind === "end" && m.step === step) };
}
const FULL = load("promo_full");
const GIM = load("promo_gim");
const need = (m, what) => { if (!m) throw new Error("見せ場が無い: " + what); return m.t; };

console.log("素材:",
  "full ビタ" + FULL.justs.length, "密集" + FULL.hot.t.toFixed(1) + "s×" + FULL.hot.n,
  "| ending", need(FULL.phase("ending"), "ending").toFixed(1),
  "7777", need(FULL.end(584), "7777").toFixed(1),
  "|| gim ルーレット", need(GIM.phase("roulette"), "roulette").toFixed(1),
  "課題", need(GIM.extra(0), "extra").toFixed(1),
  "暗転", need(GIM.phase("dead"), "dead").toFixed(1),
  "レバー", need(GIM.phase("pull"), "pull").toFixed(1));

/* ---- 部品 -------------------------------------------------------------- */
const esc = (t) => String(t).replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\u0027").replace(/%/g, "\\%");
function T(o){
  const p = [
    `fontfile='${FONT}'`, `text='${esc(o.text)}'`,
    `fontcolor=${o.color || WHT}`, `fontsize=${o.size || 60}`,
    "x=(w-text_w)/2", `y=${o.y}`,
    `borderw=${o.borderw || 9}`, "bordercolor=black",
    "shadowx=0", "shadowy=5", "shadowcolor=0x000000C0",
  ];
  if (o.from != null) p.push(`enable='between(t,${o.from},${o.to == null ? 999 : o.to})'`);
  return "drawtext=" + p.join(":");
}
let n = 0;
const nm = (tag) => path.join(TMP, String(n++).padStart(2, "0") + "-" + tag + ".mp4");

/** 16:9 の1カット */
function cut(S, start, len, { texts = [], tag = "c", fadeIn = 0 } = {}){
  const f = nm(tag);
  const vf = [
    `scale=${W}:${H}:force_original_aspect_ratio=decrease`,
    `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black`, "fps=60",
    ...texts.map(T),
    ...(fadeIn ? [`fade=t=in:st=0:d=${fadeIn}`] : []),
    "format=yuv420p",
  ].join(",");
  ff(["-ss", String(start), "-t", String(len), "-i", S.src, "-vf", vf, "-af", "aresample=48000",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-r", "60", f]);
  return f;
}
/** 9:16 の1カット。**背景は同じ映像を引き伸ばしてぼかす**（黒い帯で埋めない）。台は中央、上下へ字幕 */
function cutS(S, start, len, { texts = [], tag = "s" } = {}){
  const f = nm(tag);
  const fc = [
    // 背景：画面いっぱいに広げて、ぼかして、暗くする
    `[0:v]scale=${SW}:${SH}:force_original_aspect_ratio=increase,crop=${SW}:${SH},boxblur=28:2,eq=brightness=-0.16:saturation=0.7[bg]`,
    // 前景：脇まで入る範囲を切って、幅いっぱいに
    `[0:v]crop=990:900:305:0,scale=${SW}:-2[fg]`,
    `[bg][fg]overlay=0:(H-h)/2,fps=60,` + texts.map((t) => T({ ...t, borderw: 11 })).join(",") + ",format=yuv420p[v]",
  ].join(";");
  ff(["-ss", String(start), "-t", String(len), "-i", S.src,
      "-filter_complex", fc, "-map", "[v]", "-map", "0:a?", "-af", "aresample=48000",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-r", "60", f]);
  return f;
}
function card(len, texts, { tag = "card", w = W, h = H } = {}){
  const f = nm(tag);
  ff(["-f", "lavfi", "-i", `color=c=0x0b0b0c:s=${w}x${h}:d=${len}:r=60`,
      "-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo:d=${len}`,
      "-vf", texts.map(T).join(",") + ",format=yuv420p",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-shortest", f]);
  return f;
}
function join(files, outFile){
  const list = path.join(TMP, "l-" + path.basename(outFile) + ".txt");
  fs.writeFileSync(list, files.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"));
  ff(["-f", "concat", "-safe", "0", "-i", list,
      "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", outFile]);
  console.log("→", path.basename(outFile), dur(outFile).toFixed(1) + "s", (fs.statSync(outFile).size / 1e6).toFixed(1) + "MB");
}

/* ---- 見せ場の秒数（marks から） ---------------------------------------- */
const P = {
  hook: Math.max(0, FULL.hot.t - 0.9),                 // ビタが詰まっている所
  beat: FULL.justs[3] ? FULL.justs[3].t - 0.8 : 8,     // 序盤の連打
  extra: need(FULL.extra(2), "課題") - 1.4,             // 7を狙え！
  rl: need(GIM.phase("roulette"), "ルーレット") - 1.0,
  dead: need(GIM.phase("dead"), "暗転") - 1.2,
  bar: need(GIM.extra(2), "BARを狙え") - 0.6,
  end: need(FULL.phase("ending"), "エンディング") - 0.8,
  fin: need(FULL.end(584), "7777") - 1.2,
};
const TOP = "h*0.085", BOT = "h*0.855";
const sTOP = "h*0.10", sBOT = "h*0.82";

/* ---- ① X（16:9・約25秒）------------------------------------------------ */
join([
  cut(FULL, P.hook, 4.2, { tag: "x1", texts: [
    { text: "777が揃ったら、そこがスタート", size: 68, y: TOP, color: YEL, from: 0.1, to: 2.6 },
    { text: "揃うたびに、リールが1つ回り直す", size: 50, y: BOT, from: 1.5 },
  ]}),
  cut(FULL, P.beat, 4.0, { tag: "x2", texts: [
    { text: "線の上ぴったり ＝ ビタ", size: 66, y: TOP, color: YEL, from: 0.1, to: 2.2 },
    { text: "一気に +4 コンボ", size: 56, y: BOT, color: YEL, from: 1.2 },
  ]}),
  cut(GIM, P.rl, 4.0, { tag: "x3", texts: [
    { text: "ビタを重ねると、台が動き出す", size: 62, y: TOP, color: CY, from: 0.1 },
  ]}),
  cut(GIM, P.dead, 4.6, { tag: "x4", texts: [
    { text: "外した。……で、終わりじゃない", size: 60, y: TOP, color: RED, from: 0.2, to: 2.4 },
    { text: "レバーを叩け", size: 60, y: TOP, color: YEL, from: 2.5 },
  ]}),
  cut(FULL, P.end, 5.5, { tag: "x5", texts: [
    { text: "777 まで行くと、台が壊れる", size: 64, y: TOP, color: YEL, from: 0.3, to: 3.2 },
  ]}),
  cut(FULL, P.fin, 2.8, { tag: "x6", texts: [
    { text: "7777 COMBO", size: 100, y: TOP, color: YEL, from: 0.2 },
  ]}),
  card(3.4, [
    { text: "777コンボ", size: 136, y: "h*0.28", color: YEL, from: 0 },
    { text: "無料 / ブラウザ / スマホOK", size: 50, y: "h*0.52", from: 0.25 },
    { text: URL, size: 44, y: "h*0.66", color: CY, from: 0.5 },
  ], { tag: "x7" }),
], path.join(OUT, "promo-x.mp4"));

/* ---- ② YouTube（16:9・約50秒）------------------------------------------ */
join([
  card(2.4, [
    { text: "777コンボ", size: 144, y: "h*0.32", color: YEL, from: 0 },
    { text: "777が揃ったところから始まる、目押しゲーム", size: 46, y: "h*0.56", from: 0.3 },
  ], { tag: "y0" }),
  cut(FULL, P.hook, 6.5, { tag: "y1", fadeIn: 0.3, texts: [
    { text: "揃うたびに、リールが1つ回り直す", size: 58, y: TOP, color: YEL, from: 0.4, to: 3.4 },
    { text: "それを 7 で止め続けた回数がコンボ", size: 50, y: BOT, from: 2.2 },
  ]}),
  cut(FULL, P.beat, 6.0, { tag: "y2", texts: [
    { text: "7 は音の拍に乗って来る", size: 58, y: TOP, color: CY, from: 0.2, to: 3.0 },
    { text: "見てからでは遅い。拍で押す", size: 50, y: BOT, from: 2.4 },
  ]}),
  cut(FULL, P.extra, 6.5, { tag: "y3", texts: [
    { text: "ビタ5回 ▶ 「7を狙え！」", size: 58, y: TOP, color: YEL, from: 0.2, to: 3.4 },
    { text: "指定の線に 7 を3つ揃えろ", size: 50, y: BOT, from: 2.6 },
  ]}),
  cut(GIM, P.rl, 5.5, { tag: "y4", texts: [
    { text: "ビタ3連続 ▶ ルーレット", size: 58, y: TOP, color: CY, from: 0.2 },
  ]}),
  cut(GIM, P.dead, 7.5, { tag: "y5", texts: [
    { text: "外した。音も光も消える", size: 56, y: TOP, color: RED, from: 0.3, to: 3.0 },
    { text: "でっかいレバーを下げろ ▶ BARを狙え！", size: 50, y: BOT, color: RED, from: 3.2 },
  ]}),
  cut(FULL, P.end, 8.0, { tag: "y6", texts: [
    { text: "777 COMBO", size: 84, y: TOP, color: YEL, from: 0.2, to: 2.6 },
    { text: "そこから先は、台が勝手に揃えていく", size: 50, y: BOT, from: 2.8 },
  ]}),
  cut(FULL, P.fin, 4.0, { tag: "y7", texts: [
    { text: "7777 COMBO", size: 108, y: TOP, color: YEL, from: 0.2 },
  ]}),
  card(4.0, [
    { text: "777コンボ", size: 140, y: "h*0.24", color: YEL, from: 0 },
    { text: "無料 / ブラウザ / スマホOK", size: 50, y: "h*0.48", from: 0.3 },
    { text: URL, size: 46, y: "h*0.62", color: CY, from: 0.6 },
    { text: "オギャヌンティウス十三世", size: 34, y: "h*0.80", color: "0x8C8C93", from: 0.9 },
  ], { tag: "y8" }),
], path.join(OUT, "promo-yt.mp4"));

/* ---- ③ ショート（9:16・約30秒）---------------------------------------- */
join([
  cutS(FULL, P.hook, 4.6, { tag: "s1", texts: [
    { text: "777を、揃え続けろ", size: 78, y: sTOP, color: YEL, from: 0.1 },
    { text: "揃うたびに1つ回り直す", size: 56, y: sBOT, from: 1.3 },
  ]}),
  cutS(FULL, P.beat, 4.4, { tag: "s2", texts: [
    { text: "ビタ押し", size: 92, y: sTOP, color: YEL, from: 0.1 },
    { text: "線の上ぴったりで +4", size: 56, y: sBOT, from: 0.7 },
  ]}),
  cutS(GIM, P.rl, 4.4, { tag: "s3", texts: [
    { text: "台が動き出す", size: 84, y: sTOP, color: CY, from: 0.1 },
    { text: "ビタ3連続でルーレット", size: 52, y: sBOT, from: 0.7 },
  ]}),
  cutS(GIM, P.dead, 5.2, { tag: "s4", texts: [
    { text: "外した", size: 92, y: sTOP, color: RED, from: 0.1, to: 2.3 },
    { text: "でも戻れる", size: 92, y: sTOP, color: YEL, from: 2.4 },
    { text: "レバーを叩け", size: 54, y: sBOT, from: 2.5 },
  ]}),
  cutS(FULL, P.end, 5.6, { tag: "s5", texts: [
    { text: "777 到達", size: 86, y: sTOP, color: YEL, from: 0.2, to: 2.6 },
    { text: "台が壊れる", size: 86, y: sTOP, color: YEL, from: 2.7 },
  ]}),
  cutS(FULL, P.fin, 2.8, { tag: "s6", texts: [
    { text: "7777 COMBO", size: 88, y: sTOP, color: YEL, from: 0.1 },
  ]}),
  card(3.4, [
    { text: "777コンボ", size: 128, y: "h*0.38", color: YEL, from: 0 },
    { text: "無料 / ブラウザ", size: 56, y: "h*0.50", from: 0.3 },
    { text: URL, size: 38, y: "h*0.59", color: CY, from: 0.5 },
  ], { tag: "s7", w: SW, h: SH }),
], path.join(OUT, "promo-short.mp4"));

console.log("done");
