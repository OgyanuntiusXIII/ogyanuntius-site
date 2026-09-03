/* 『777コンボ』の宣伝映像を、**ゲーム本体の描画そのまま**書き出す。
 *
 *   node shoot.js <url> <幅> <高さ> <出力フォルダ> <到達コンボ> <最大秒>
 *
 * 依存は入れない。Chrome を headless で立てて CDP を素で叩く（Node 24 の WebSocket）。
 * 時計は手で回すので、実時間の速さに関係なく**常に同じ映像**が出る。
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
// 毎回ちがう番号を使う（他のChromeと当たらないように）
const PORT = 9400 + Math.floor(Math.random() * 400);
const FPS = 30;          // 出力
const SUB = 2;           // 1フレームあたり 1/60 を2回進める

const [url, W, H, outDir, targetCombo, maxSec] = [
  process.argv[2],
  Number(process.argv[3]),
  Number(process.argv[4]),
  process.argv[5],
  Number(process.argv[6] || 40),
  Number(process.argv[7] || 45),
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getTargets(){
  const res = await fetch(`http://127.0.0.1:${PORT}/json`);
  return res.json();
}

class CDP {
  constructor(ws){ this.ws = ws; this.id = 0; this.waiting = new Map(); }
  static async connect(wsUrl){
    const ws = new WebSocket(wsUrl);
    await new Promise((ok, ng) => { ws.onopen = ok; ws.onerror = ng; });
    const c = new CDP(ws);
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && c.waiting.has(m.id)){
        const { ok, ng } = c.waiting.get(m.id);
        c.waiting.delete(m.id);
        m.error ? ng(new Error(JSON.stringify(m.error))) : ok(m.result);
      }
    };
    return c;
  }
  send(method, params){
    const id = ++this.id;
    return new Promise((ok, ng) => {
      this.waiting.set(id, { ok, ng });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  async evalJs(expression, awaitPromise){
    const r = await this.send("Runtime.evaluate", {
      expression, awaitPromise: !!awaitPromise, returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval failed");
    return r.result.value;
  }
}

/* --- ページの中で走る台本 -------------------------------------------
   時計を手で回し、狙って止め、最後にわざと外す。
   人が遊んだ映像ではない。**本物のゲームを台本どおりに動かした映像**。 */
const DRIVE = `
(() => {
  const near = (i, p) => nearestSevenOn(i, p);
  window.__v = {
    t: 0, started: false, phase: "title", missed: false, target: ${targetCombo},
    setup(){
      // ⚠️ **rAFを止める。**headless では rAF が普通に回るので、
      //    手で回す時計と二重に進んで、実機の3倍速の映像になっていた
      window.requestAnimationFrame = () => 0;
      muted = true;
      try { localStorage.removeItem("ogyanun.777combo.top"); } catch(e){}
      this.t = performance.now() + 1000;
      S.t = this.t;
      last = 0;
      this.started = false; this.phase = "title"; this.missed = false;
      return true;
    },
    // 1/60 を1回進める
    tick(){
      this.t += 1000 / 60;
      const t = this.t;

      if (!this.started){
        // タイトルを少し見せてから「はじめる」
        if (t > this.t0start){ document.getElementById("startBtn").click(); this.started = true; }
        frame(t);
        return;
      }

      // 導入：左→中→右の順に、少し間を置いて止める
      if (S.phase === "intro" && S.introStarted){
        for (let k = 0; k < 3; k++){
          const r = S.reels[k];
          if (!r.spinning) continue;
          if (k > 0 && !S.reels[k-1].stopped) continue;   // 順番に
          const d = r.pos - near(k, r.pos);
          if (d >= -S.win * 0.75 && d <= 0) press(k);
        }
        frame(t);
        return;
      }

      // 本編：狙って止める。目標まで来たら、わざと外して締める
      if (S.phase === "spin"){
        const r = S.reels[S.active], p = r.pos;
        if (S.combo >= this.target && !this.missed){
          // 少しだけ引っぱってから外す（惜しい止まり方になる）
          if (p > r.targets[0] - S.win - 2.2){ this.missed = true; press(S.active); }
        } else {
          let hit = null;
          for (const c of r.targets){ const d = p - c; if (d >= -S.win && d <= BACK) hit = c; }
          if (hit !== null) press(S.active);
        }
      }
      frame(t);
    },
    step(n){ for (let i = 0; i < n; i++) this.tick(); return { combo: S.combo, phase: S.phase }; },
  };
  window.__v.t0start = window.__v.t + 900;   // タイトルを0.9秒見せる
  window.__v.setup();
  return true;
})()
`;

async function main(){
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const profile = path.resolve(outDir, "..", "chrome-profile-" + PORT);   // Chromeは相対パスのプロファイルを受け付けない
  fs.rmSync(profile, { recursive: true, force: true });

  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--headless",
    "--hide-scrollbars",
    "--mute-audio",
    "--force-device-scale-factor=1",
    "--disable-lcd-text",
    `--window-size=${W},${H}`,
    "--no-first-run", "--no-default-browser-check",
    url,
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let chromeErr = "";
  chrome.stderr.on("data", d => { chromeErr += d.toString(); });
  chrome.on("error", e => { chromeErr += "spawn error: " + e.message; });
  chrome.on("exit", (code) => { chromeErr += " exit code " + code; });

  // 起動待ち
  let targets = null;
  for (let i = 0; i < 60; i++){
    try { targets = await getTargets(); if (targets.some(t => t.type === "page")) break; } catch (e){}
    await sleep(250);
  }
  if (!targets) throw new Error("Chrome がデバッグポートを開かなかった port " + PORT + " / " + chromeErr.slice(0, 900));
  const page = targets.find(t => t.type === "page" && t.url.includes("777-combo"))
            || targets.find(t => t.type === "page");
  if (!page) throw new Error("ページのターゲットが無い: " + JSON.stringify(targets.map(t => t.type)));
  const cdp = await CDP.connect(page.webSocketDebuggerUrl);

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: W, height: H, deviceScaleFactor: 1, mobile: false,
  });
  // 明示的に開き直して、ゲームが立ち上がるまで待つ
  await cdp.send("Page.navigate", { url });
  let ready = false;
  for (let i = 0; i < 80; i++){
    await sleep(250);
    try { ready = await cdp.evalJs('typeof layout === "function" && !!L && !!SPRITES.seven'); } catch (e){}
    if (ready) break;
  }
  const diag = await cdp.evalJs('JSON.stringify({url:location.href, ready:document.readyState, hasLayout: typeof layout, hasS: typeof S, err: (window.__err||null)})');
  console.log("  diag:", diag);
  if (!ready) throw new Error("ゲームが立ち上がらない: " + diag);
  await sleep(1400);                       // 絵（キャラ・ロゴ）の読み込み待ち
  await cdp.evalJs(`window.__CAB_MAX = ${Math.round(Math.min(W * 0.9, 900))}; layout(); true`);
  await sleep(300);
  await cdp.evalJs(DRIVE);

  const maxFrames = Math.round(FPS * maxSec);
  let n = 0, endAt = -1;
  for (; n < maxFrames; n++){
    const st = await cdp.evalJs(`JSON.stringify(window.__v.step(${SUB}))`);
    const s = JSON.parse(st);
    const shot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
    fs.writeFileSync(path.join(outDir, String(n).padStart(5, "0") + ".png"),
                     Buffer.from(shot.data, "base64"));
    if (s.phase === "over" && endAt < 0) endAt = n;
    if (endAt >= 0 && n - endAt > FPS * 3.2) { n++; break; }   // 結果を3.2秒見せて終わり
    if (n % 90 === 0) process.stdout.write(`  ${n}f combo=${s.combo}\n`);
  }
  console.log(`frames=${n} -> ${outDir}`);
  chrome.kill();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
