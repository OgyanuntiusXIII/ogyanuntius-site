/* 777コンボの宣伝映像を、**音つきで**録る。
 *
 *   node record.mjs <ビューポート幅> <ビューポート高さ> <到達コンボ> <出力名>
 *
 * アリアのときに作った仕組みと同じ形（Vaultの「自動プレイ録画」節）。
 * ゲーム本体は触らない。一時フォルダへコピーして bot.js を1枚差し込むだけ。
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const DIR     = import.meta.dirname;
const SRC     = "C:/Users/owner/ogyanuntius-site/public/games/777-combo";
const GAME    = path.join(DIR, "game");
const OUT     = path.join(DIR, "out");
const PORT     = 8791;
const CDP_PORT = 9344;
const CHROME   = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PROFILE  = path.join(DIR, "chrome-profile");
const TIMEOUT_MS = 9 * 60 * 1000;

const VW     = Number(process.argv[2] || 1600);
const VH     = Number(process.argv[3] || 900);
const TARGET = Number(process.argv[4] || 40);
const NAME   = process.argv[5] || "take";
const SCRIPT = process.argv[6] || "";        // 台本（bot.js の SCRIPT。"long" で 7777 まで）
const OUTFILE = path.join(OUT, NAME + ".webm");

const sleep = ms => new Promise(r => setTimeout(r, ms));

// --- ゲームをコピーして bot.js を差し込む -------------------------------
fs.rmSync(GAME, { recursive: true, force: true });
fs.mkdirSync(GAME, { recursive: true });
for (const f of fs.readdirSync(SRC)) fs.copyFileSync(path.join(SRC, f), path.join(GAME, f));
fs.copyFileSync(path.join(DIR, "bot.js"), path.join(GAME, "bot.js"));
{
  const p = path.join(GAME, "index.html");
  let html = fs.readFileSync(p, "utf8");
  html = html.replace("</body>", '<script src="bot.js"></script>\n</body>');
  fs.writeFileSync(p, html);
}
fs.rmSync(PROFILE, { recursive: true, force: true });   // BESTを毎回まっさらから
fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(OUTFILE, { force: true });

// --- ローカルサーバー ----------------------------------------------------
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
               ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
let saved = null;
const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/save"){
    const ws = fs.createWriteStream(OUTFILE);
    req.pipe(ws);
    ws.on("finish", () => { saved = fs.statSync(OUTFILE).size; res.writeHead(200); res.end("ok"); });
    return;
  }
  if (req.url.startsWith("/api/")){ res.writeHead(204); res.end(); return; }
  // ⚠️ クエリを外したあとに "/" だと、フォルダを読みにいって落ちる（実際落ちた）
  let rel = req.url.split("?")[0];
  if (rel === "/" || rel === "") rel = "/index.html";
  let f = path.join(GAME, path.normalize(rel).replace(/^[\/\\]+/, ""));
  if (!f.startsWith(GAME) || !fs.existsSync(f)){ res.writeHead(404); res.end("nope"); return; }
  if (fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));

// --- Chrome -------------------------------------------------------------
const chrome = spawn(CHROME, [
  `--user-data-dir=${PROFILE}`,
  "--no-first-run", "--no-default-browser-check", "--disable-sync",
  "--autoplay-policy=no-user-gesture-required",
  "--auto-accept-this-tab-capture",
  // ⚠️ この3つが無いと、ウィンドウが裏に回った瞬間に rAF が止まってゲームが壊れる
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-features=CalculateNativeWinOcclusion,Translate",
  `--remote-debugging-port=${CDP_PORT}`,
  "--window-position=0,0",
  `--window-size=${VW + 16},${VH + 88}`,
  `--app=http://127.0.0.1:${PORT}/?target=${TARGET}`,
], { stdio: "ignore" });

function shutdown(code){
  try { spawnSync("taskkill", ["/PID", String(chrome.pid), "/T", "/F"], { stdio: "ignore" }); } catch (_) {}
  try { server.close(); } catch (_) {}
  console.log("saved bytes:", saved);
  process.exit(code);
}

let target = null;
for (let i = 0; i < 80 && !target; i++){
  await sleep(400);
  try {
    const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    target = list.find(t => t.type === "page" && t.url.includes(`:${PORT}/`));
  } catch (_) {}
}
if (!target){ console.error("CDPのページが見つからない"); shutdown(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
let msgId = 0; const pending = new Map();
ws.addEventListener("message", ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)){ pending.get(m.id)(m); pending.delete(m.id); }
});
await new Promise(r => ws.addEventListener("open", r, { once: true }));
const cdp = (method, params = {}) => new Promise((res, rej) => {
  const id = ++msgId;
  pending.set(id, m => m.error ? rej(new Error(method + ": " + JSON.stringify(m.error))) : res(m.result));
  ws.send(JSON.stringify({ id, method, params }));
});
const evalJs = async expr => {
  const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description));
  return r.result.value;
};

await cdp("Page.enable"); await cdp("Runtime.enable"); await cdp("Page.bringToFront");
await sleep(1500);

// ビューポートをきっちり合わせる（枠の厚みは環境で変わるので測って直す）
const { windowId } = await cdp("Browser.getWindowForTarget", { targetId: target.id });
for (let i = 0; i < 4; i++){
  const v = JSON.parse(await evalJs("JSON.stringify({w:innerWidth,h:innerHeight})"));
  if (v.w === VW && v.h === VH) break;
  const b = (await cdp("Browser.getWindowBounds", { windowId })).bounds;
  await cdp("Browser.setWindowBounds", { windowId, bounds: {
    width: b.width + (VW - v.w), height: b.height + (VH - v.h),
  }});
  await sleep(500);
}
const vp = await evalJs("JSON.stringify({w:innerWidth,h:innerHeight,ready:!!document.getElementById('startBtn'),bot:!!window.__REC})");
console.log("viewport", vp);
if (SCRIPT) await evalJs("window.__SCRIPT = " + JSON.stringify(SCRIPT) + "; true");
await sleep(800);

// 本物のクリック（getDisplayMedia はユーザー操作の中でしか許可が取れない）
for (const type of ["mousePressed", "mouseReleased"]){
  await cdp("Input.dispatchMouseEvent", {
    type, x: 60, y: VH - 60, button: "left", clickCount: 1,   // 左上はリンク（← 戻る）があるので踏まない
    buttons: type === "mousePressed" ? 1 : 0,
  });
  await sleep(70);
}

const t0 = Date.now();
let lastLog = "";
while (Date.now() - t0 < TIMEOUT_MS){
  await sleep(2000);
  let st;
  try { st = await evalJs("JSON.stringify(window.__REC)"); } catch (e){ continue; }
  if (st !== lastLog){ console.log(`[${((Date.now()-t0)/1000).toFixed(0)}s]`, st); lastLog = st; }
  const o = JSON.parse(st);
  if (o.phase === "done" || o.phase === "error") break;
}
const final = JSON.parse(await evalJs("JSON.stringify(window.__REC)").catch(() => '{"phase":"lost"}'));
console.log("FINAL", JSON.stringify(final));
await sleep(700);
shutdown(final.phase === "done" && saved ? 0 : 2);
