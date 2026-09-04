/* 宣伝映像用の自動プレイ＋画面収録。**ゲーム本体は1文字も触っていない。**
   一時フォルダへコピーした index.html にだけ、この1枚を差し込んでいる。

   アリアのときに作った仕組みと同じ形：
     getDisplayMedia({preferCurrentTab}) → MediaRecorder（VP9+Opus）→ POST /save
   canvas.captureStream ではない。それだとDOM側（音量つまみ・覆い）が映らない。

   2026-09-04 作り直し：台が変わった（MAX BET→レバー→導入→回、ナビ回、課題、ルーレット、復活待ち→でっかいレバー）。
   台本（SCRIPT）に沿って「ビタ／普通／わざと外す」を1押しずつ選ぶ。台本が尽きたら外し続けて終わる。 */
(() => {
  const REC = (window.__REC = {
    phase: "init", err: null, bytes: 0, combo: 0, coins: 0, w: 0, h: 0, step: 0,
  });
  const TITLE_MS = Number(new URLSearchParams(location.search).get("title") || 1500);
  // j=ビタ n=普通 m=わざと外す（Vストックがあれば逆回転で救われる。無くて復活が仕込まれていれば暗転→でっかいレバー）
  // 台本は CDP から window.__SCRIPT で差し替えられる。"long" は 7777 まで（j j n の繰り返し：ビタで登り、3連続を避けてルーレットに寄り道しない。外さない）
  const getScript = () => String(window.__SCRIPT || "jjjmjjnmjjjmjjmmmnnjnm");

  let botOn = false, si = 0;
  const now = () => performance.now();
  let waitUntil = 0, betDone = false, leverDone = false, pullAt = 0, rouletteStopAt = 0;

  const nextStyle = () => {
    const sc = getScript();
    if (sc === "long"){ si++; REC.step = si; return (si % 3 === 0) ? "n" : "j"; }
    const c = sc[si] || "m"; if (si < sc.length) si++; REC.step = si; return c;
  };
  const aheadOf = (i) => { const r = S.reels[i]; return r.aim ? aimsAfter(i, r.aim, r.pos - 1, 3) : (r.dir < 0 ? sevensBefore(i, r.pos + 1, 3) : sevensAfter(i, r.pos - 1, 3)); };
  // 押す位置（進む向きで見た狙いとの差）：ビタは線の直前、普通は少し手前で滑らせる、外すのは通り過ぎてから
  const wantD = (style) => style === "j" ? [-0.48, -0.02] : style === "n" ? [-2.6, -1.2] : [3.3, 4.2];

  const pending = {};   // reel -> style（そのリールに決めた押し方）
  function tryPress(i, style){
    const r = S.reels[i];
    if (r.state !== "spin" || !canPress(i) || r.rescue) return false;
    const [lo, hi] = wantD(style);
    if (style === "m"){
      // 通り過ぎてから押す。いちばん近い（すぐ後ろの）狙いを見る
      const behind = r.dir < 0 ? sevensAfter(i, r.pos - 0.5, 1)[0] : sevensBefore(i, r.pos + 0.5, 1)[0];
      if (behind == null) return false;
      const d = (r.pos - behind) * r.dir;
      if (d >= lo && d <= hi){ press(i); return true; }
      return false;
    }
    for (const c of aheadOf(i)){ const d = (r.pos - c) * r.dir; if (d >= lo && d <= hi){ press(i); return true; } }
    return false;
  }

  function tick(){
    if (!botOn || !S.running) return;
    const t = now();
    if (t < waitUntil) return;

    // 最初だけ：MAX BET → レバー
    if (S.phase === "bet"){ if (!betDone){ betDone = true; waitUntil = t + 700; setTimeout(() => pressMaxBet(), 650); } return; }
    if (S.phase === "lever"){ if (!leverDone){ leverDone = true; waitUntil = t + 700; setTimeout(() => pullLever(), 650); } return; }

    // 導入：左→中→右、普通に
    if (S.phase === "intro"){
      if (!S.introStarted) return;
      for (let k = 0; k < 3; k++){
        const r = S.reels[k];
        if (r.state !== "spin") continue;
        if (k > 0 && !S.reels[k-1].stopped) continue;
        if (!canPress(k)) continue;
        const d = r.pos - nearestSevenOn(k, r.pos);
        if (d >= -S.win * 0.62 && d <= -0.6){ press(k); return; }
      }
      return;
    }

    // ルーレット：2.2秒回して MAX BET で止める
    if (S.phase === "roulette"){
      const r = S.roulette;
      if (r && r.stage === "spin"){ if (!rouletteStopAt) rouletteStopAt = t + 2200; if (t >= rouletteStopAt){ pressMaxBet(); rouletteStopAt = 0; } }
      return;
    }
    // 復活待ち：0.9秒見せてからレバー。でっかいレバーは出きって0.7秒後に下げる
    if (S.phase === "dead"){ if (!pullAt) pullAt = t + 900; if (t >= pullAt){ pullLever(); pullAt = 0; } return; }
    if (S.phase === "pull"){ if (S.big && S.big.stage === "ready"){ if (!pullAt) pullAt = t + 700; if (t >= pullAt){ pullLever(); pullAt = 0; } } return; }

    if (S.phase !== "round") return;
    // 課題（7を狙え！／BARを狙え！）は全部当てる
    if (S.extra){
      for (const i of S.actives){ if (tryPress(i, "j")) return; }
      return;
    }
    // ナビ回は順どおり。それ以外は回っているものから
    const order = S.navi ? [S.navi.order[S.navi.k]] : S.actives;
    for (const i of order){
      if (i == null) continue;
      const r = S.reels[i];
      if (r.state !== "spin" || !canPress(i) || r.rescue) continue;
      if (!pending[i]) pending[i] = nextStyle();
      if (tryPress(i, pending[i])){ delete pending[i]; return; }
    }
  }
  setInterval(tick, 1);
  (function raf(){ requestAnimationFrame(raf); tick(); })();

  /* ---- 収録 ------------------------------------------------------------ */
  let recorder = null;
  const chunks = [];
  /* 見せ場の時刻表。**収録開始からの秒数**で残す。編集はこれを見て切る */
  let t0 = 0;
  REC.marks = [];
  const mark = (kind, extra) => { if (!t0) return; REC.marks.push({ t: +((performance.now() - t0) / 1000).toFixed(2), kind, ...(extra || {}) }); };
  (function watchMarks(){
    let lastJust = -1, lastCombo = 0, lastPhase = "", lastExtra = "", lastStock = 0, lastEndStep = -1;
    setInterval(() => {
      // ⚠️ ゲーム側の S は const 宣言なので **window.S にはならない**（var と関数だけが window に載る）。
      //    window.S で見張っていたら、時刻表が空のまま1本撮ってしまった
      if (!t0 || typeof S === "undefined") return;
      if (S.justN !== lastJust){ lastJust = S.justN; if (S.justN) mark("just", { n: S.justN, combo: S.combo }); }
      if (S.phase !== lastPhase){ lastPhase = S.phase; mark("phase", { p: S.phase, combo: S.combo }); }
      const ek = S.extra ? S.extra.kind : "";
      if (ek !== lastExtra){ lastExtra = ek; if (ek) mark("extra", { kind: ek, combo: S.combo }); }
      if (S.vStock < lastStock) mark("rescue", { combo: S.combo });
      lastStock = S.vStock;
      if (S.phase === "ending" && S.endStep !== lastEndStep && (S.endStep === 1 || S.endStep === 200 || S.endStep >= endSteps())){
        lastEndStep = S.endStep; mark("end", { step: S.endStep, combo: S.combo });
      }
      if (S.combo >= 100 && lastCombo < 100) mark("combo100", { combo: S.combo });
      lastCombo = S.combo;
    }, 50);
  })();

  async function upload(){
    try {
      REC.phase = "uploading";
      const blob = new Blob(chunks, { type: "video/webm" });
      REC.bytes = blob.size;
      await fetch("/save", { method: "POST", body: blob });
      REC.phase = "done";
    } catch (e){ REC.phase = "error"; REC.err = String(e); }
  }

  async function beginCapture(){
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 60 },
      audio: true,                 // ← ここが「音が入る」の正体
      preferCurrentTab: true,
      selfBrowserSurface: "include",
      systemAudio: "exclude",
    });
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      .find(m => MediaRecorder.isTypeSupported(m));
    recorder = new MediaRecorder(stream, {
      mimeType: mime, videoBitsPerSecond: 14e6, audioBitsPerSecond: 192e3,
    });
    recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      try { stream.getTracks().forEach(t => t.stop()); } catch (_) {}
      upload();
    };
    recorder.start(1000);
    t0 = performance.now();
    REC.phase = "recording";
    REC.w = innerWidth; REC.h = innerHeight;
  }

  /* 収録の許可はユーザー操作の中でしか取れない。
     CDP が送る本物のクリック（画面のどこでもよい）で取る。 */
  document.addEventListener("click", async () => {
    if (recorder) return;
    try { await beginCapture(); }
    catch (e){ REC.phase = "error"; REC.err = String(e); return; }
    setTimeout(() => {
      document.getElementById("startBtn").click();
      botOn = true;
      watchEnd();
    }, TITLE_MS);
  }, true);

  function watchEnd(){
    let wasRunning = false;
    const iv = setInterval(() => {
      REC.combo = S.combo; REC.coins = S.coins; REC.phase2 = S.phase; REC.stock = S.vStock; REC.justN = S.justN;
      if (S.running){ wasRunning = true; return; }
      if (!wasRunning) return;
      clearInterval(iv);
      botOn = false;
      REC.phase = "tail";
      // 無音 → 数字 → 記録、まで見せてから止める
      setTimeout(() => { try { recorder.stop(); } catch (e){ REC.err = String(e); } }, 4200);
    }, 100);
  }
})();
