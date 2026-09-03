/* 『777コンボ』の実験台。headless Chrome を CDP で素で叩く（依存なし・Node 24）。
 *
 *   node lab.js snap <url> <W> <H> <出力フォルダ> <状態,状態,...>
 *       状態: title / intro / c12 (12コンボ・落ち着いた所) / h12 (12コンボ目が止まった瞬間)
 *             m10 (10コンボの節目の演出中) / over20 (20コンボで外して結果画面)
 *   node lab.js sim  <url> <モデルJSON> [回数]
 *       人のモデルで遊ばせて、到達コンボの分布を返す
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9500 + Math.floor(Math.random() * 400);
const sleep = ms => new Promise(r => setTimeout(r, ms));

class CDP {
  constructor(ws){ this.ws = ws; this.id = 0; this.waiting = new Map(); }
  static async connect(wsUrl){
    const ws = new WebSocket(wsUrl);
    await new Promise((ok, ng) => { ws.onopen = ok; ws.onerror = ng; });
    const c = new CDP(ws);
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && c.waiting.has(m.id)){
        const { ok, ng } = c.waiting.get(m.id); c.waiting.delete(m.id);
        m.error ? ng(new Error(JSON.stringify(m.error))) : ok(m.result);
      }
    };
    return c;
  }
  send(method, params){
    const id = ++this.id;
    return new Promise((ok, ng) => { this.waiting.set(id, { ok, ng }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); });
  }
  async evalJs(expression, awaitPromise){
    const r = await this.send("Runtime.evaluate", { expression, awaitPromise: !!awaitPromise, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
}

/* ページの中に入れる運転手。時計は手で回す。音は作らない */
const DRIVER = `
(() => {
  window.requestAnimationFrame = () => 0;
  initAudio = () => {};
  const FR = 1000/60;
  const gauss = (m, s) => { let u=0,v=0; while(u===0)u=Math.random(); while(v===0)v=Math.random(); return m + s*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
  let T = performance.now() + 500;
  const D = window.__lab = { T: () => T };
  D.begin = () => { S.t = T; last = 0; try{ localStorage.removeItem("ogyanun.777combo.top"); }catch(e){} start(); };
  D.tick = (n) => { for (let i = 0; i < (n||1); i++){ T += FR; frame(T); } };
  // いま回っている（止められる）リール。無ければ -1
  D.spinningReel = () => { if (S.phase === "intro") { for (let k = 0; k < 3; k++) if (S.reels[k].state === "spin") return k; return -1; }
                           if (S.phase !== "round") return -1; for (const i of S.actives) if (S.reels[i].state === "spin") return i; return -1; };
  D.anySpin = () => D.spinningReel() >= 0;
  D.anySnap = () => S.phase === "round" && S.actives.some(i => S.reels[i].state === "snap");
  D.quiet = () => S.phase === "round" && S.actives.length > 0 && S.actives.every(i => S.reels[i].state === "wait");
  D.at = (ph) => ph === "settle" ? D.quiet() : ph === "snap" ? D.anySnap() : ph === "spin" ? D.anySpin() : ph === "over" ? !S.running : false;
  // 完璧な目押し（導入も本編も。向きつき）
  D.perfect = () => {
    if (S.phase === "intro" && S.introStarted){
      for (let k = 0; k < 3; k++){
        const r = S.reels[k];
        if (r.state !== "spin") continue;
        if (k > 0 && !S.reels[k-1].stopped) continue;
        if (!canPress(k)) continue;
        const d = r.pos - nearestSevenOn(k, r.pos);
        if (d >= -S.win*0.6 && d <= -S.win*0.15){ press(k); return; }
      }
      return;
    }
    if (S.phase === "round"){
      for (const i of S.actives){
        const r = S.reels[i];
        if (r.state !== "spin" || !canPress(i)) continue;
        for (const c of r.targets){ const d = (r.pos - c) * r.dir; if (d >= -S.win*0.6 && d <= -S.win*0.1){ press(i); return; } }
      }
    }
  };
  D.drive = (target, stopPhase) => {
    let g = 0;
    while (S.running && g++ < 60*60*10){
      D.tick(1); D.perfect();
      if (S.combo >= target && D.at(stopPhase||"settle")) break;
    }
    render();
    return { combo: S.combo, phase: S.phase, kind: S.roundKind };
  };
  D.stepPerfect = (n) => { for (let i = 0; i < n; i++){ D.tick(1); D.perfect(); } render(); return { combo: S.combo, phase: S.phase }; };
  D.untilPhase = (ph, max) => { let g = 0; while (S.running && !D.at(ph) && g++ < (max||600)){ D.tick(1); D.perfect(); } render(); return { combo: S.combo, phase: S.phase, g }; };
  D.untilSpin = (max) => { let g = 0; while (S.running && !D.anySpin() && g++ < (max||600)){ D.tick(1); D.perfect(); } render(); return { combo: S.combo, phase: S.phase }; };
  D.miss = () => { const a = D.spinningReel(); if (a >= 0) autoMissReel(a); let g = 0; while (S.running && g++ < 400) D.tick(1); render(); return { combo: S.combo, running: S.running }; };
  /* 拍の検証：7が dueAt ちょうどに中央線へ来ているか。各回の誤差（コマ）と、拍の間隔。単発だけにして測る */
  D.verify = (rounds) => {
    window.__NO_STAGES = true;
    D.begin();
    const errs = [], gaps = []; let lastDue = 0, g = 0, seen = new Set();
    while (S.running && errs.length < rounds && g++ < 60*60*10){
      D.tick(1);
      if (S.phase === "intro" && S.introStarted){ D.perfect(); continue; }
      const a = D.spinningReel();
      if (a < 0) continue;
      const r = S.reels[a];
      if (T < r.dueAt) continue;
      if (!seen.has(r.dueAt)){
        seen.add(r.dueAt);
        const over = (T - r.dueAt) / 1000 * r.vNow * r.dir;
        const p = r.pos - over;
        errs.push(Math.round((p - nearestSevenOn(a, p)) * 100) / 100);
        if (lastDue) gaps.push(Math.round((r.dueAt - lastDue) / beatMs() * 100) / 100);
        lastDue = r.dueAt;
        press(a);
      }
    }
    window.__NO_STAGES = false;
    return { errs, gaps, combo: S.combo };
  };
  /* 指定の dd（進む向きで見た7との差）で押す */
  D.pressAtDd = (dd) => {
    let g = 0;
    while (S.running && g++ < 2000){
      D.tick(1);
      if (S.phase === "intro" && S.introStarted){ D.perfect(); continue; }
      const a = D.spinningReel();
      if (a >= 0 && canPress(a)){
        const r = S.reels[a];
        const d = (r.pos - nearestSevenOn(a, r.pos)) * r.dir;
        if (dd < 0 ? (d <= dd && d > dd - 0.6) : (d >= dd && d < dd + 0.6)){ press(a); return { pressed: true, d: Math.round(d*100)/100, reel: a }; }
      }
    }
    return { pressed: false };
  };
  D.lateSeq = (dd, frames) => {
    const r0 = D.pressAtDd(dd); const idx = (r0.reel == null) ? 0 : r0.reel;
    const out = [];
    for (let i = 0; i < frames; i++){ out.push({ f: i, pos: Math.round(S.reels[idx].pos*100)/100, phase: S.phase, combo: S.combo }); D.tick(1); }
    render();
    return out;
  };
  /* 人のモデル */
  D.playHuman = (opt) => {
    const lat = () => Math.max(60, gauss(opt.latency||220, opt.latencySd||25));
    const DISP = opt.display == null ? 25 : opt.display;
    D.begin();
    let pressAt = -1, pressReel = -1, armedFor = -1, seenPass = null, g = 0;
    while (S.running && g++ < 60*60*6){
      D.tick(1);
      if (S.phase === "intro" && S.introStarted){ D.perfect(); continue; }
      const a = D.spinningReel();
      if (a < 0){ pressAt = -1; armedFor = -1; seenPass = null; continue; }
      const r = S.reels[a];
      if (pressAt >= 0){ if (T >= pressAt){ press(pressReel); pressAt = -1; } continue; }
      const seenPos = r.pos - r.dir * r.v * DISP/1000;
      const st = opt.strategy;
      if (st === "react7"){
        for (const c of r.targets){ const d = (seenPos - c) * r.dir; if (d >= -1.75 && d <= -1.2 && armedFor !== c){ armedFor = c; pressReel = a; pressAt = T + lat(); break; } }
      } else if (st === "any7"){
        const q = nearestSevenOn(a, seenPos);
        if (Math.abs(seenPos - q) <= 0.3 && armedFor !== q){ armedFor = q; pressReel = a; pressAt = T + lat(); }
      } else if (st === "beat"){
        // 拍に合わせて押す。7が来る拍（過ぎていれば次の拍）
        const key = a * 1e9 + r.spinAt;
        if (armedFor !== key){
          armedFor = key;
          let due = r.dueAt; while (due < T + 60) due += beatMs();
          pressReel = a; pressAt = due - (opt.early||0) + gauss(0, opt.jitter||50);
        }
      } else if (st === "watch1"){
        if (!seenPass){
          for (const c of r.targets){
            if ((seenPos - c) * r.dir >= -0.1 && (seenPos - c) * r.dir <= 0.6){
              const nxt = r.targets.find(x => (x - c) * r.dir > 0);
              if (nxt){ seenPass = c; pressReel = a; pressAt = T + (Math.abs(nxt - seenPos)/r.v)*1000 - (opt.lead||0.5)/r.v*1000 + gauss(0, opt.jitter||40); }
              break;
            }
          }
        }
      }
    }
    return { combo: S.combo, dead: S.deadSym, late: S.lastMiss || null };
  };
  D.sim = (opt, n) => {
    const out = []; for (let i = 0; i < (n||10); i++) out.push(D.playHuman(opt));
    const c = out.map(o => o.combo).sort((a,b)=>a-b);
    return { n: c.length, min: c[0], median: c[Math.floor(c.length/2)], mean: Math.round(c.reduce((a,b)=>a+b,0)/c.length*10)/10, max: c[c.length-1], combos: c };
  };
  return "driver ready";
})()`;

async function launch(url, W, H, keepAudio){
  const profile = path.resolve(__dirname, "chrome-profile-" + PORT);
  fs.rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    "--headless", "--hide-scrollbars", "--mute-audio", "--force-device-scale-factor=1", "--disable-lcd-text", "--autoplay-policy=no-user-gesture-required",
    `--window-size=${W},${H}`, "--no-first-run", "--no-default-browser-check", url,
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let err = ""; chrome.stderr.on("data", d => { err += d; });
  let targets = null;
  for (let i = 0; i < 60; i++){
    try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (targets.some(t => t.type === "page")) break; } catch (e){}
    await sleep(250);
  }
  if (!targets) throw new Error("Chrome起動失敗 " + err.slice(0, 500));
  const page = targets.find(t => t.type === "page");
  const cdp = await CDP.connect(page.webSocketDebuggerUrl);
  await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.navigate", { url });
  let ready = false;
  for (let i = 0; i < 80; i++){ await sleep(200); try { ready = await cdp.evalJs('typeof layout === "function" && !!L && !!SPRITES.seven && typeof frame === "function" && typeof start === "function"'); } catch (e){} if (ready) break; }
  if (!ready) throw new Error("ゲームが立ち上がらない");
  await sleep(1200);
  await cdp.evalJs(keepAudio ? DRIVER.replace("initAudio = () => {};", "") : DRIVER);
  const kill = () => { try { chrome.kill(); } catch (e){} try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e){} };
  return { cdp, kill };
}

async function shot(cdp, file){
  const s = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  fs.writeFileSync(file, Buffer.from(s.data, "base64"));
}

async function main(){
  const [mode, url, ...rest] = process.argv.slice(2);
  if (mode === "snap"){
    const [W, H, outDir, states] = [Number(rest[0]), Number(rest[1]), rest[2], rest[3]];
    fs.mkdirSync(outDir, { recursive: true });
    const { cdp, kill } = await launch(url, W, H);
    try {
      for (const st of states.split(",")){
        const m = st.match(/^([a-z]+)(\d*)$/);
        const kind = m[1], n = Number(m[2] || 0);
        let info = "";
        if (kind === "title"){ /* そのまま */ }
        else if (kind === "intro"){ info = await cdp.evalJs("__lab.begin(); __lab.tick(75); render(); JSON.stringify({phase:S.phase})"); await sleep(150); }
        else if (kind === "c"){ info = await cdp.evalJs(`__lab.begin(); JSON.stringify(__lab.drive(${n}, "settle"))`); await sleep(150); }
        else if (kind === "h"){ info = await cdp.evalJs(`__lab.begin(); __lab.drive(${n-1}, "settle"); JSON.stringify(__lab.untilPhase("snap")) + JSON.stringify(__lab.untilPhase("settle"))`); await sleep(150); }
        else if (kind === "m"){ info = await cdp.evalJs(`__lab.begin(); __lab.drive(${n}, "settle"); JSON.stringify(__lab.stepPerfect(7))`); await sleep(150); }
        else if (kind === "s"){ info = await cdp.evalJs(`__lab.begin(); __lab.drive(${n}, "settle"); JSON.stringify(__lab.untilSpin()) + JSON.stringify(__lab.stepPerfect(3))`); await sleep(150); }
        else if (kind === "late"){
          // n = 押したときの dd（10倍。late25 → +2.5コマ遅れ）。押した直後から6コマを1コマおきに撮る
          await cdp.evalJs(`__lab.begin(); __lab.drive(4, "settle"); true`);
          for (let f = 0; f < 6; f++){
            const r = f === 0 ? await cdp.evalJs(`JSON.stringify(__lab.lateSeq(${n/10}, 0))`) : await cdp.evalJs(`__lab.tick(1); render(); "t"`);
            await sleep(80);
            await shot(cdp, path.join(outDir, st + "_" + f + ".png"));
            info += r + " ";
          }
          continue;
        }
        else if (kind === "pe" || kind === "pl"){
          // pe80 = 7の8.0コマ手前で押す（早い） / pl42 = 7を4.2コマ過ぎて押す（遅い）。止まった絵を撮る
          const dd = (kind === "pe" ? -1 : 1) * n / 10;
          info = await cdp.evalJs(`__lab.begin(); __lab.drive(5, "settle"); JSON.stringify(__lab.pressAtDd(${dd})) + JSON.stringify(__lab.stepPerfect(36)) + JSON.stringify(S.lastMiss)`);
          await sleep(120);
        }
        else if (kind === "just"){
          info = await cdp.evalJs(`__lab.begin(); __lab.drive(3, "settle"); JSON.stringify(__lab.pressAtDd(-0.05)) + JSON.stringify(__lab.untilPhase("settle")) + JSON.stringify(__lab.stepPerfect(5)) + " dd=" + S.lastHitDd.toFixed(2) + " justN=" + S.justN`);
          await sleep(120);
        }
        else if (kind === "over"){ info = await cdp.evalJs(`__lab.begin(); __lab.drive(${n}, "settle"); __lab.untilSpin(); JSON.stringify(__lab.miss())`); await sleep(2400); }
        await shot(cdp, path.join(outDir, st + ".png"));
        console.log(st, info);
      }
    } finally { kill(); }
  } else if (mode === "verify"){
    const { cdp, kill } = await launch(url, 800, 600);
    try {
      await cdp.evalJs("render = () => {}; true");
      console.log(await cdp.evalJs(`JSON.stringify(__lab.verify(${Number(rest[0] || 30)}))`));
    } finally { kill(); }
  } else if (mode === "smoke"){
    const { cdp, kill } = await launch(url, 800, 600, true);
    try {
      const errors = [];
      cdp.ws.addEventListener("message", ev => { const m = JSON.parse(ev.data); if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description || JSON.stringify(m.params.exceptionDetails).slice(0, 300)); });
      await cdp.evalJs("window.__errs = []; window.addEventListener('error', e => __errs.push(String(e.message))); true");
      const r1 = await cdp.evalJs(`__lab.begin(); JSON.stringify(__lab.drive(175, "settle")) + " justN=" + S.justN + " v=" + S.v + " stage=" + S.stageLv`);
      const r2 = await cdp.evalJs(`__lab.untilSpin(); JSON.stringify(__lab.miss())`);
      await sleep(2300);
      const r3 = await cdp.evalJs(`__lab.begin(); JSON.stringify(__lab.drive(25, "settle"))`);
      const r4 = await cdp.evalJs(`JSON.stringify({ actx: !!actx, state: actx && actx.state, voices, bgmOn, errs: __errs })`);
      console.log(r1, r2, r3, r4, "cdp-errors:", JSON.stringify(errors.slice(0, 5)));
    } finally { kill(); }
  } else if (mode === "eval"){
    // 任意の式をページで評価する（デバッグ用）。第2引数が式。第3引数があればスクショの出力先
    const { cdp, kill } = await launch(url, Number(process.env.W || 1600), Number(process.env.H || 900));
    try {
      console.log(await cdp.evalJs(rest[0]));
      if (rest[1]) await shot(cdp, rest[1]);
    } finally { kill(); }
  } else if (mode === "sim"){
    const opt = JSON.parse(rest[0]); const n = Number(rest[1] || 10);
    const { cdp, kill } = await launch(url, 800, 600);
    try {
      await cdp.evalJs("render = () => {}; true");
      const r = await cdp.evalJs(`JSON.stringify(__lab.sim(${JSON.stringify(opt)}, ${n}))`);
      console.log(JSON.stringify(opt), r);
    } finally { kill(); }
  } else {
    console.log("mode: snap | sim");
  }
}
main().catch(e => { console.error(e); process.exit(1); });
