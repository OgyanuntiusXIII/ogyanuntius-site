/* 宣伝映像用の自動プレイ＋画面収録。**ゲーム本体は1文字も触っていない。**
   一時フォルダへコピーした index.html にだけ、この1枚を差し込んでいる。

   アリアのときに作った仕組みと同じ形：
     getDisplayMedia({preferCurrentTab}) → MediaRecorder（VP9+Opus）→ POST /save
   canvas.captureStream ではない。それだとDOM側（音量つまみ・覆い）が映らない。 */
(() => {
  const REC = (window.__REC = {
    phase: "init", err: null, bytes: 0, combo: 0, coins: 0, w: 0, h: 0,
  });
  // ⚠️ --app= のURLに付けたクエリは届かないことがある（実際1本目で効かなかった）。
  //    CDP から window.__TARGET を入れられるようにして、押す直前に読む
  const qTarget = Number(new URLSearchParams(location.search).get("target") || 0);
  const getTarget = () => Number(window.__TARGET || qTarget || 40);
  const TITLE_MS = Number(new URLSearchParams(location.search).get("title") || 1500);

  let botOn = false, missed = false;

  /* ---- 自動で目押しする ------------------------------------------------
     窓の真ん中あたりで押す。端で押すと滑りが0か最大に張り付いて、
     人がやったときの「ちょっと滑る」感じが出ない。 */
  function tick(){
    if (!botOn || !S.running) return;

    if (S.phase === "intro" && S.introStarted){
      for (let k = 0; k < 3; k++){
        const r = S.reels[k];
        if (!r.spinning) continue;
        if (k > 0 && !S.reels[k-1].stopped) continue;   // 左→中→右
        if (typeof canPress === "function" && !canPress(k)) continue;   // 加速中は押さない（空打ちが鳴る）
        const d = r.pos - nearestSevenOn(k, r.pos);
        if (d >= -S.win * 0.62 && d <= 0){ press(k); return; }
      }
      return;
    }

    if (S.phase === "spin"){
      if (typeof canPress === "function" && !canPress(S.active)) return;
      const r = S.reels[S.active], p = r.pos;
      if (S.combo >= getTarget() && !missed){
        // 締め。**わざと外す。**7を目の前で蹴らせて終わる
        if (p > r.targets[0] - S.win - 2.4){ missed = true; press(S.active); }
        return;
      }
      for (const c of r.targets){
        const d = p - c;
        if (d >= -S.win * 0.60 && d <= -S.win * 0.10){ press(S.active); return; }
      }
    }
  }
  setInterval(tick, 1);
  (function raf(){ requestAnimationFrame(raf); tick(); })();

  /* ---- 収録 ------------------------------------------------------------ */
  let recorder = null;
  const chunks = [];

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
      REC.combo = S.combo; REC.coins = S.coins; REC.phase2 = S.phase;
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
