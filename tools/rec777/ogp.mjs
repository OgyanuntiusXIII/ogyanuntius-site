/* X・OGP のバナー（1200x630）を、実プレイの1コマから組む。
 *
 *   node tools/rec777/ogp.mjs
 *   → public/games/777-combo/ogp.jpg
 *
 * 素材は promo.mjs が焼き直した out/_norm/promo_full.mp4（1600x900・色補正済み）。
 * ⚠️ 生の webm は目次を持たないので秒数指定がずれる。**必ず _norm の mp4 から取る。**
 *
 * 作り：左に文字、右に筐体。前は**ただのスクショ**だったので、
 *       小さく表示されたときに何のゲームか読み取れなかった。
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const DIR = import.meta.dirname;
const SRC = path.join(DIR, "out", "_norm", "promo_full.mp4");
const DST = path.join(DIR, "..", "..", "public", "games", "777-combo", "ogp.jpg");
const FONT = "C\\:/Windows/Fonts/meiryob.ttc";
const AT = 25.4;                 // 777が線に乗って紙吹雪が出ている一コマ
const YEL = "0xFFE14A", CY = "0x9EF1FF", INK = "0x140C00";
const X = 72;                    // 文字の左端

if (!fs.existsSync(SRC)) throw new Error("素材が無い。先に promo.mjs を回す: " + SRC);

const esc = (t) => String(t).replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\u0027");
const text = (o) => "drawtext=" + [
  `fontfile='${FONT}'`, `text='${esc(o.t)}'`, `fontsize=${o.size}`, `x=${X}`, `y=${o.y}`,
  ...(o.box
    ? [`fontcolor=${INK}`, "box=1", `boxcolor=${o.box}@1`, "boxborderw=16", "borderw=0"]
    : [`fontcolor=${o.color}`, "borderw=6", "bordercolor=black", "shadowx=0", "shadowy=4", "shadowcolor=0x000000B0"]),
].join(":");

/* 背景は同じ絵を覆うように敷いて暗く落とす。右に筐体を切って重ねる */
const chain = [
  "[0:v]split=2[a][b]",
  "[a]scale=1200:675,crop=1200:630:0:22,eq=brightness=-0.30:saturation=0.85,boxblur=6:1[bg]",
  "[b]crop=506:900:547:0,scale=-2:630[fg]",
  "[bg][fg]overlay=804:0[m]",
  // 文字側だけさらに沈めて、白文字を確実に読ませる
  "[m]drawbox=x=0:y=0:w=800:h=630:c=black@0.42:t=fill[d]",
  "[d]" + [
    text({ t: "777コンボ", size: 100, y: 138, color: YEL }),
    text({ t: "777を、揃え続けろ。", size: 46, y: 276, color: "white" }),
    text({ t: "揃うたびに、リールが1つ回り直す", size: 28, y: 350, color: "0xD9D9DE" }),
    text({ t: "無料 / ブラウザ / スマホOK", size: 28, y: 442, box: YEL }),
    text({ t: "ogyanuntiusxiii.com/games/777-combo", size: 24, y: 528, color: CY }),
  ].join(",") + "[v]",
].join(";");

execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(AT), "-i", SRC,
  "-filter_complex", chain, "-map", "[v]", "-frames:v", "1", "-q:v", "3", DST], { stdio: ["ignore", "pipe", "inherit"] });

const kb = (fs.statSync(DST).size / 1024).toFixed(0);
console.log("→", path.relative(process.cwd(), DST), "1200x630", kb + "KB");
