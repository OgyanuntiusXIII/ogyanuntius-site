/* 宣伝動画を組む。**素材は tools/rec777 で撮った実プレイ。ここでは切って貼るだけ。**
 *
 *   node promo.mjs [素材名]        （既定 promo_full）
 *
 * 素材：out/<名前>.webm と out/<名前>.marks.json
 *   marks は**収録開始からの秒数**で見せ場が入っている（kind: just / phase / extra / rescue / end / combo100）。
 *   ⚠️ 切る位置は必ず marks から取る。**目分量で秒数を書かない。**
 *
 * 出力（out/）：
 *   promo-x.mp4      16:9 / 約25秒 / X向け（**音を切って見られる**前提で字幕を厚く）
 *   promo-yt.mp4     16:9 / 約50秒 / YouTube向け
 *   promo-short.mp4  9:16 / 約30秒 / ショート向け（台を中央、上下に字幕）
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const DIR = import.meta.dirname;
const OUT = path.join(DIR, "out");
const TMP = path.join(OUT, "_cut");
const NAME = process.argv[2] || "promo_full";
const SRC = path.join(OUT, NAME + ".webm");
const MARKS = JSON.parse(fs.readFileSync(path.join(OUT, NAME + ".marks.json"), "utf8"));

const FONT = "C\\:/Windows/Fonts/meiryob.ttc";
const URL = "ogyanuntiusxiii.com/games/777-combo";
const W = 1600, H = 900;

const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: ["ignore", "pipe", "inherit"] });
const dur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", f]).toString().trim());

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

/* ---- 見せ場を拾う ------------------------------------------------------ */
const find = (p) => MARKS.find(p);
const findLast = (p) => [...MARKS].reverse().find(p);
const phase = (name) => find((m) => m.kind === "phase" && m.p === name);
const justs = MARKS.filter((m) => m.kind === "just");
const extraOf = (k) => find((m) => m.kind === "extra" && m.kind2 === k) || find((m) => m.kind === "extra");
const M = {
  intro: phase("intro"),
  roulette: phase("roulette"),
  extra: find((m) => m.kind === "extra"),
  rescue: find((m) => m.kind === "rescue"),
  dead: phase("dead"),
  pull: phase("pull"),
  ending: phase("ending"),
  endLast: findLast((m) => m.kind === "end"),
  over: phase("over"),
  c100: find((m) => m.kind === "combo100"),
};
const need = (m, label) => { if (!m) throw new Error("見せ場が見つからない: " + label + "（marks を確認）"); return m.t; };

// 連続したビタが多いところ（＝いちばん気持ちいい所）を探す：3秒窓で数える
function hottest(span = 3.2){
  let best = { t: justs.length ? justs[0].t : 5, n: 0 };
  for (const j of justs){
    const n = justs.filter((k) => k.t >= j.t && k.t < j.t + span).length;
    if (n > best.n) best = { t: j.t, n };
  }
  return best;
}
const HOT = hottest();
console.log("marks", MARKS.length, "| ビタ", justs.length,
  "| 密集", HOT.t.toFixed(1) + "s×" + HOT.n,
  "| ルーレット", M.roulette && M.roulette.t,
  "| 課題", M.extra && M.extra.t,
  "| 復活待ち", M.dead && M.dead.t,
  "| エンディング", M.ending && M.ending.t,
  "| 終わり", M.over && M.over.t);

/* ---- 部品 -------------------------------------------------------------- */
const esc = (t) => String(t).replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\u0027").replace(/%/g, "\\%");
/** 字幕1本。y は 16:9 の座標。short 側で作り直す */
function T(o){
  const p = [
    `fontfile='${FONT}'`, `text='${esc(o.text)}'`,
    `fontcolor=${o.color || "white"}`, `fontsize=${o.size || 60}`,
    `x=${o.x || "(w-text_w)/2"}`, `y=${o.y == null ? "h*0.80" : o.y}`,
    `borderw=${o.borderw == null ? 9 : o.borderw}`, `bordercolor=${o.bordercolor || "black"}`,
    `shadowx=0`, `shadowy=4`, `shadowcolor=0x000000AA`,
  ];
  if (o.box) p.push("box=1", `boxcolor=${o.box}`, "boxborderw=20");
  if (o.from != null) p.push(`enable='between(t,${o.from},${o.to == null ? 999 : o.to})'`);
  return "drawtext=" + p.join(":");
}
let clipN = 0;
const nextName = (tag) => path.join(TMP, String(clipN++).padStart(2, "0") + "-" + tag + ".mp4");

/** 素材から切る。texts は clip 内の相対秒で enable する */
function cut(start, len, { texts = [], tag = "clip", speed = 1, fadeIn = 0 } = {}){
  const f = nextName(tag);
  const vf = [
    `scale=${W}:${H}:force_original_aspect_ratio=decrease`,
    `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black`,
    ...(speed !== 1 ? [`setpts=${(1 / speed).toFixed(4)}*PTS`] : []),
    "fps=60",
    ...texts.map(T),
    ...(fadeIn ? [`fade=t=in:st=0:d=${fadeIn}`] : []),
    "format=yuv420p",
  ].join(",");
  const af = speed !== 1 ? `atempo=${speed},aresample=48000` : "aresample=48000";
  ff(["-ss", String(start), "-t", String(len), "-i", SRC,
      "-vf", vf, "-af", af,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-r", "60", f]);
  return f;
}
/** 単色カード（題字・終わりの1枚）。無音 */
function card(len, texts, { tag = "card", bg = "0x0b0b0c" } = {}){
  const f = nextName(tag);
  ff(["-f", "lavfi", "-i", `color=c=${bg}:s=${W}x${H}:d=${len}:r=60`,
      "-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo:d=${len}`,
      "-vf", texts.map(T).join(",") + ",format=yuv420p",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-shortest", f]);
  return f;
}
function join(files, outFile){
  const list = path.join(TMP, "list-" + path.basename(outFile) + ".txt");
  fs.writeFileSync(list, files.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"));
  ff(["-f", "concat", "-safe", "0", "-i", list,
      "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", outFile]);
  console.log("→", path.basename(outFile), dur(outFile).toFixed(1) + "s",
    (fs.statSync(outFile).size / 1e6).toFixed(1) + "MB");
  return outFile;
}

/* ---- 台本 --------------------------------------------------------------
   ドパガキ向け：**最初の1秒で殴る。**待たせない。文字は大きく短く。
   音を切って見られる前提（Xは自動再生が無音）なので、字幕だけで筋が通るようにする */
const YEL = "0xFFE14A", CY = "0x9EF1FF", RED = "0xFF6A4A";
const hookAt = Math.max(0, HOT.t - 1.0);

/* ① X向け（約25秒） */
const xClips = [
  cut(hookAt, 4.0, { tag: "x-hook", texts: [
    { text: "777が揃ったら、そこがスタート", size: 66, y: "h*0.10", color: YEL, from: 0.15, to: 2.6 },
    { text: "揃うたびに、リールが1つ回り直す", size: 52, y: "h*0.855", from: 1.4, to: 4.0 },
  ]}),
  cut(HOT.t + 3.0, 4.0, { tag: "x-just", texts: [
    { text: "線の上ぴったり ＝ ビタ", size: 64, y: "h*0.10", color: YEL, from: 0.1, to: 2.4 },
    { text: "一気に +4 コンボ", size: 56, y: "h*0.855", color: YEL, from: 1.2, to: 4.0 },
  ]}),
  cut(need(M.roulette, "ルーレット") - 1.2, 4.2, { tag: "x-gim", texts: [
    { text: "ビタを重ねると、台が動き出す", size: 62, y: "h*0.10", color: CY, from: 0.1, to: 4.2 },
  ]}),
  cut(need(M.dead, "復活待ち") - 0.8, 5.0, { tag: "x-rev", texts: [
    { text: "外しても、1回だけ戻れる", size: 62, y: "h*0.10", color: RED, from: 0.2, to: 5.0 },
  ]}),
  cut(need(M.ending, "エンディング") - 0.6, 6.5, { tag: "x-end", texts: [
    { text: "777 まで行くと、台が壊れる", size: 64, y: "h*0.10", color: YEL, from: 0.3, to: 3.0 },
  ]}),
  cut(need(M.endLast, "7777") - 0.4, 2.6, { tag: "x-7777", texts: [
    { text: "7777 COMBO", size: 96, y: "h*0.10", color: YEL, from: 0.1 },
  ]}),
  card(3.4, [
    { text: "777コンボ", size: 132, y: "h*0.30", color: YEL, from: 0 },
    { text: "無料 / ブラウザ / スマホOK", size: 50, y: "h*0.52", from: 0.25 },
    { text: URL, size: 44, y: "h*0.68", color: CY, from: 0.5 },
  ], { tag: "x-card" }),
];
join(xClips, path.join(OUT, "promo-x.mp4"));

/* ② YouTube向け（約50秒）。少し息を長く、遊び方まで見せる */
const ytClips = [
  card(2.2, [
    { text: "777コンボ", size: 140, y: "h*0.33", color: YEL, from: 0 },
    { text: "777が揃ったところから始まる、目押しゲーム", size: 46, y: "h*0.56", from: 0.3 },
  ], { tag: "yt-title" }),
  cut(hookAt, 6.0, { tag: "yt-hook", texts: [
    { text: "揃うたびに、リールが1つ回り直す", size: 58, y: "h*0.10", color: YEL, from: 0.3, to: 3.2 },
    { text: "それを 7 で止め続けた回数がコンボ", size: 52, y: "h*0.855", from: 2.0, to: 6.0 },
  ], fadeIn: 0.25 }),
  cut(HOT.t + 3.0, 6.0, { tag: "yt-beat", texts: [
    { text: "7 は音の拍に乗って来る", size: 58, y: "h*0.10", color: CY, from: 0.2, to: 3.0 },
    { text: "見てからでは遅い。拍で押す", size: 52, y: "h*0.855", from: 2.4, to: 6.0 },
  ]}),
  cut(need(M.extra, "課題") - 1.0, 7.0, { tag: "yt-extra", texts: [
    { text: "ビタ5回 ▶ 「7を狙え！」", size: 58, y: "h*0.10", color: YEL, from: 0.2, to: 4.0 },
    { text: "指定の線に 7 を3つ", size: 50, y: "h*0.855", from: 3.0, to: 7.0 },
  ]}),
  cut(need(M.roulette, "ルーレット") - 1.2, 5.5, { tag: "yt-rl", texts: [
    { text: "ビタ3連続 ▶ ルーレット", size: 58, y: "h*0.10", color: CY, from: 0.2, to: 5.5 },
  ]}),
  cut(need(M.dead, "復活待ち") - 1.0, 8.0, { tag: "yt-rev", texts: [
    { text: "外した。……ここで終わりではない", size: 56, y: "h*0.10", color: RED, from: 0.3, to: 3.4 },
    { text: "レバーを叩け ▶ BARを狙え！", size: 54, y: "h*0.855", color: RED, from: 3.6, to: 8.0 },
  ]}),
  cut(need(M.ending, "エンディング") - 0.8, 9.0, { tag: "yt-end", texts: [
    { text: "777 COMBO", size: 84, y: "h*0.10", color: YEL, from: 0.2, to: 2.6 },
    { text: "そこから先は、台が勝手に揃えていく", size: 52, y: "h*0.855", from: 2.8, to: 9.0 },
  ]}),
  cut(need(M.endLast, "7777") - 0.6, 4.0, { tag: "yt-7777", texts: [
    { text: "7777 COMBO", size: 108, y: "h*0.10", color: YEL, from: 0.1 },
  ]}),
  card(4.0, [
    { text: "777コンボ", size: 140, y: "h*0.26", color: YEL, from: 0 },
    { text: "無料 / ブラウザ / スマホOK", size: 50, y: "h*0.50", from: 0.3 },
    { text: URL, size: 46, y: "h*0.64", color: CY, from: 0.6 },
    { text: "オギャヌンティウス十三世", size: 34, y: "h*0.82", color: "0x8C8C93", from: 0.9 },
  ], { tag: "yt-card" }),
];
join(ytClips, path.join(OUT, "promo-yt.mp4"));

/* ③ ショート向け（9:16・約30秒）。台を中央に、上下へ字幕。**縦は文字が主役** */
const SW = 1080, SH = 1920;
const sBand = (o) => T({ ...o, size: o.size || 64, borderw: 10 });
function cutShort(start, len, { texts = [], tag = "s" } = {}){
  const f = nextName(tag);
  const vf = [
    "crop=990:900:305:0",        // 脇まで入る範囲
    `scale=${SW}:-2`,
    `pad=${SW}:${SH}:0:(${SH}-ih)/2:color=0x0b0b0c`,
    "fps=60",
    ...texts.map(sBand),
    "format=yuv420p",
  ].join(",");
  ff(["-ss", String(start), "-t", String(len), "-i", SRC,
      "-vf", vf, "-af", "aresample=48000",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-r", "60", f]);
  return f;
}
function cardShort(len, texts, tag = "s-card"){
  const f = nextName(tag);
  ff(["-f", "lavfi", "-i", `color=c=0x0b0b0c:s=${SW}x${SH}:d=${len}:r=60`,
      "-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo:d=${len}`,
      "-vf", texts.map(sBand).join(",") + ",format=yuv420p",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-shortest", f]);
  return f;
}
const TOP = "h*0.115", BOT = "h*0.80";
const sClips = [
  cutShort(hookAt, 4.5, { tag: "s-hook", texts: [
    { text: "777を、揃え続けろ", size: 76, y: TOP, color: YEL, from: 0.1 },
    { text: "揃うたびに1つ回り直す", size: 58, y: BOT, from: 1.2 },
  ]}),
  cutShort(HOT.t + 3.0, 4.5, { tag: "s-just", texts: [
    { text: "ビタ押し", size: 88, y: TOP, color: YEL, from: 0.1 },
    { text: "線の上ぴったりで +4", size: 58, y: BOT, from: 0.6 },
  ]}),
  cutShort(need(M.roulette, "ルーレット") - 1.2, 4.5, { tag: "s-rl", texts: [
    { text: "台が動き出す", size: 80, y: TOP, color: CY, from: 0.1 },
    { text: "ビタ3連続でルーレット", size: 56, y: BOT, from: 0.6 },
  ]}),
  cutShort(need(M.dead, "復活待ち") - 0.8, 5.5, { tag: "s-rev", texts: [
    { text: "外した", size: 88, y: TOP, color: RED, from: 0.1, to: 2.2 },
    { text: "でも、戻れる", size: 88, y: TOP, color: YEL, from: 2.3 },
    { text: "レバーを叩け", size: 56, y: BOT, from: 2.4 },
  ]}),
  cutShort(need(M.ending, "エンディング") - 0.6, 6.5, { tag: "s-end", texts: [
    { text: "777 到達", size: 84, y: TOP, color: YEL, from: 0.2, to: 2.6 },
    { text: "台が壊れる", size: 84, y: TOP, color: YEL, from: 2.7 },
  ]}),
  cutShort(need(M.endLast, "7777") - 0.4, 2.6, { tag: "s-7777", texts: [
    { text: "7777 COMBO", size: 92, y: TOP, color: YEL, from: 0.1 },
  ]}),
  cardShort(3.4, [
    { text: "777コンボ", size: 130, y: "h*0.36", color: YEL, from: 0 },
    { text: "無料 / ブラウザ", size: 56, y: "h*0.50", from: 0.3 },
    { text: URL, size: 40, y: "h*0.60", color: CY, from: 0.5 },
  ]),
];
join(sClips, path.join(OUT, "promo-short.mp4"));

console.log("done");
