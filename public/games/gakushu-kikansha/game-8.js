/* 学習機関車 / TRAINING DATA — 進行
 * 設問 → レバー（30秒） → 急加速して看板を跳ね飛ばす → そのまま次の分岐へ流れ込む → … → 最終問題 → 診断
 */
(function () {
  'use strict';
  const M = window.KikanshaModel, QS = window.TrainQuestions, ACTS = window.TrainActs;
  const $ = s => document.querySelector(s);
  const FAST = /[?&]fast=1/.test(location.search) ? 0.25 : 1;
  const wait = ms => new Promise(r => setTimeout(r, ms * FAST));
  const TIME = 30000 * FAST;
  const pad = n => String(n).padStart(2, '0');
  const fmt = n => (typeof n === 'number' ? n.toLocaleString('ja-JP') : n);
  // 共有ページ（公式サイトのときだけ）。カード画像は診断の型ごとに事前生成（tools/gakushu-kikansha-share-images.mjs）
  const PUBLIC_GAME_URL = 'https://ogyanuntiusxiii.com/games/gakushu-kikansha/';
  const HOST = location.hostname;
  const SHARE_BASE = /(^|\.)ogyanuntiusxiii\.com$|\.pages\.dev$/.test(HOST) ? PUBLIC_GAME_URL : /^(localhost|127\.0\.0\.1)$/.test(HOST) ? new URL('./', location.href).href : null;
  const sharePageUrl = key => SHARE_BASE ? new URL('share/' + key, SHARE_BASE).href : null;
  const FINAL_SIGNS = [{ head: 'クリエイターの権利', lines: ['学習には原則許可', '強い自己決定権・市場保護'] }, { head: 'AI技術の発展', lines: ['広範な学習を許可', '低コスト・国際競争力'] }];

  /* ---------- 音（WebAudioで合成） ---------- */
  const Snd = {
    ctx: null, muted: false,
    ensure() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    tone(f, dur, type, gain) { if (this.muted || !this.ctx) return; const o = this.ctx.createOscillator(), g = this.ctx.createGain(), t = this.ctx.currentTime; o.type = type || 'square'; o.frequency.value = f; o.connect(g); g.connect(this.ctx.destination); g.gain.setValueAtTime(gain || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.start(t); o.stop(t + dur); },
    noise(dur, gain) { if (this.muted || !this.ctx) return; const n = Math.floor(this.ctx.sampleRate * dur), b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = b; g.gain.value = gain || 0.2; s.connect(g); g.connect(this.ctx.destination); s.start(); },
    gakon() { this.tone(68, 0.4, 'sine', 0.5); this.noise(0.18, 0.25); setTimeout(() => this.tone(52, 0.3, 'sine', 0.3), 90); },
    whoosh() { this.noise(0.5, 0.12); this.tone(220, 0.25, 'sawtooth', 0.02); },
    click() { this.tone(180, 0.07, 'square', 0.06); this.noise(0.04, 0.08); },
    beep() { this.tone(880, 0.1, 'square', 0.035); },
    tick() { this.tone(1500, 0.03, 'square', 0.015); },
    chime() { [660, 880, 1100].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, 'triangle', 0.06), i * 140)); },
  };

  /* ---------- 画面部品 ---------- */
  const board = { q: [], busy: false };
  const ui = {
    show(el) { el.hidden = false; void el.offsetWidth; el.classList.add('on'); },
    hide(el) { el.classList.remove('on'); setTimeout(() => { if (!el.classList.contains('on')) el.hidden = true; }, 240); },
    hud(act, q) { $('#hud-act').textContent = act; $('#hud-q').textContent = q; },
    act(big, word) { const h = $('#act'); $('#act-no').textContent = big; $('#act-word').textContent = word; h.classList.remove('run'); void h.offsetWidth; h.classList.add('run'); Snd.click(); },
    card(eyebrow, text) { $('#card-eyebrow').textContent = eyebrow; $('#card-text').textContent = text; $('#card-timer').textContent = ''; $('#card-bar').style.transform = 'scaleX(0)'; this.show($('#card')); },
    hideCard() { this.hide($('#card')); },
    timer(ms, textEl, barEl, onEnd) {
      const t0 = performance.now(); let last = -1, done = false;
      const id = setInterval(() => {
        const left = Math.max(0, ms - (performance.now() - t0)), sec = Math.ceil(left / (1000 * FAST));
        if (textEl) { textEl.textContent = '残り ' + sec + ' 秒'; textEl.classList.toggle('low', sec <= 10); }
        if (barEl) { barEl.style.transform = 'scaleX(' + (left / ms).toFixed(3) + ')'; barEl.classList.toggle('low', sec <= 10); }
        if (sec !== last && sec <= 10 && sec > 0) Snd.tick(); last = sec;
        if (left <= 0 && !done) { done = true; clearInterval(id); onEnd(); }
      }, 100);
      return () => { done = true; clearInterval(id); };
    },
    logBlock(header, lines, append) {
      const box = $('#log'); box.hidden = false;
      let blk = append ? box.lastElementChild : null;
      if (!blk) { blk = document.createElement('div'); blk.className = 'blk'; box.appendChild(blk); while (box.children.length > 2) box.removeChild(box.firstElementChild); }
      if (header) { const h = document.createElement('h3'); h.textContent = header; blk.appendChild(h); }
      lines.forEach((l, i) => setTimeout(() => { const p = document.createElement('p'); p.textContent = l; blk.appendChild(p); void p.offsetWidth; p.classList.add('on'); Snd.tick(); }, i * 420 * FAST));
    },
    boardPush(line) { board.q.push(line); if (!board.busy) this.boardNext(); },
    boardNext() {
      const line = board.q.shift(); if (line == null) { board.busy = false; return; }
      board.busy = true; $('#board').hidden = false; const b = $('#board-text'); b.textContent = line; b.classList.remove('blink'); void b.offsetWidth; b.classList.add('blink'); Snd.beep();
      // 画面より長い文は、電光掲示板のように横へ流して最後まで見せる（スマホで途中が切れていた）。
      // 幅は流し始める瞬間に測る（表示した直後はドット書体が読み込み前で、短く測ってしまう）
      b.style.transition = 'none'; b.style.transform = 'translateX(0)';
      const base = board.q.length > 2 ? 1300 : Math.min(3200, 1300 + line.length * 55), hold = 800;
      setTimeout(() => {
        if (b.textContent !== line) return;
        const bs = getComputedStyle($('#board')), avail = $('#board').clientWidth - parseFloat(bs.paddingLeft) - parseFloat(bs.paddingRight);
        const over = b.scrollWidth > avail ? b.scrollWidth - avail + 12 : 0;
        if (!over) { setTimeout(() => this.boardNext(), Math.max(0, base - hold) * FAST); return; }
        const speed = board.q.length > 2 ? 160 : 90, scroll = over / speed * 1000;
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        b.style.transition = still ? 'none' : 'transform ' + Math.round(scroll * FAST) + 'ms linear'; b.style.transform = 'translateX(' + (-over) + 'px)';
        setTimeout(() => this.boardNext(), (scroll + 1400) * FAST);
      }, hold * FAST);
    },
    async fade(dark) { const f = $('#fade'); f.hidden = false; void f.offsetWidth; f.classList.toggle('on', dark); await wait(dark ? 650 : 500); if (!dark) f.hidden = true; },
    lever(labels, opt) {
      opt = opt || {};
      return new Promise(res => {
        const box = $('#lever'), handle = $('#handle'), L = $('#lever-l'), R = $('#lever-r');
        const fill = (b, i) => {
          b.textContent = ''; const t = document.createElement('b'); t.textContent = labels[i]; b.appendChild(t);
          if (opt.signs) { const s = document.createElement('small'); s.textContent = '轢かれるもの：' + [].concat(opt.signs[i]).join(''); b.appendChild(s); }
          b.toggleAttribute('data-default', !opt.stuck && opt.def === i);   // 「時間切れならこちら」は箱の上に出す（箱の大きさを揃える）
        };
        fill(L, 0); fill(R, 1); handle.style.transform = 'rotate(0deg)'; handle.classList.remove('shake'); this.show(box);
        document.documentElement.style.setProperty('--lever-h', box.offsetHeight + 'px');   // 運行記録をレバーの上に置くため
        let attempts = 0, finished = false, stop = () => {};
        const cleanup = () => { L.removeEventListener('click', onL); R.removeEventListener('click', onR); window.removeEventListener('keydown', key); };
        const finish = (choice, timedOut) => {
          if (finished) return; finished = true; stop(); cleanup();
          if (!opt.stuck) { handle.style.transform = 'rotate(' + (choice === 0 ? -42 : 42) + 'deg)'; setTimeout(() => this.hide(box), 260); }
          res({ choice, timedOut });
        };
        const pull = side => {
          if (finished) return;
          if (opt.stuck) { attempts++; Snd.click(); handle.classList.remove('shake'); void handle.offsetWidth; handle.classList.add('shake'); if (opt.onStuck) opt.onStuck(attempts); if (attempts >= (opt.attempts || 3)) finish(-1, false); return; }
          Snd.click(); finish(side, false);
        };
        const onL = () => pull(0), onR = () => pull(1);
        const key = e => { if (e.key === 'ArrowLeft') { e.preventDefault(); pull(0); } else if (e.key === 'ArrowRight') { e.preventDefault(); pull(1); } };
        L.addEventListener('click', onL); R.addEventListener('click', onR); window.addEventListener('keydown', key);
        stop = this.timer(TIME, $('#card-timer'), $('#card-bar'), () => finish(opt.stuck ? -1 : opt.def, true));
      });
    },
    hideLever() { this.hide($('#lever')); },
    panel(text, options, opt) {
      return new Promise(res => {
        const p = $('#panel'), list = $('#panel-options'); $('#panel-text').textContent = text; list.textContent = '';
        let stop = () => {}, done = false;
        const pick = (i, timedOut) => { if (done) return; done = true; stop(); Snd.click(); this.hide(p); res({ choice: i, timedOut }); };
        options.forEach((o, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = o; b.addEventListener('click', () => pick(i, false)); list.appendChild(b); });
        this.show(p); setTimeout(() => { const f = list.querySelector('button'); if (f) f.focus(); }, 250);
        stop = this.timer(TIME, $('#panel-timer'), $('#panel-bar'), () => pick(opt.def, true));
      });
    },
  };

  /* ---------- 世界 ---------- */
  let world = null;
  function boot() {
    if (!window.THREE) { $('#title-note').textContent = '3D表示に必要な部品を読み込めませんでした。通信環境を確認して読み直してください。'; return; }
    world = new window.TrainWorld($('#gl')); window.__world = world;
    try { document.fonts.load('17px "DotGothic16"'); } catch (e) { /* 読めなくても代わりの書体で出る */ }
  }

  /* ---------- 本編 ---------- */
  async function play() {
    const S = M.defaultState(); S.reason = null; S.humanReason = null;
    const A = {}; let num = 0, lastAct = 0, seg = 1, firstTimeout = true;
    const cite = id => A[id] ? 'あなたは第' + A[id].num + '問で「' + A[id].label + '」と回答しました。' : '';
    const nextIndex = from => { for (let i = from + 1; i < QS.length; i++) { const qd = QS[i]; if (!qd.when || qd.when(S, A)) return i; } return -1; };
    const signsOf = qd => qd.options.map(o => ({ head: o.label, lines: o.sign }));
    let qi = nextIndex(-1);
    world.prepare(1, signsOf(QS[qi]), { def: QS[qi].def });
    world.begin();
    while (qi !== -1) {
      const qd = QS[qi]; num++;
      if (qd.act !== lastAct) { ui.act('ACT ' + qd.act, ACTS[qd.act]); lastAct = qd.act; }
      ui.hud('ACT ' + qd.act + '　' + ACTS[qd.act], '第 ' + num + ' 問');
      ui.card('QUESTION ' + pad(num), typeof qd.text === 'function' ? qd.text(S, A, cite) : qd.text);
      const r = await ui.lever(qd.options.map(o => o.label), { signs: qd.options.map(o => o.sign), def: qd.def });
      const c = r.choice;
      A[qd.id] = { choice: c, label: qd.options[c].label, num, timedOut: r.timedOut };
      if (qd.set) qd.set(c, S);
      const nqi = nextIndex(qi);
      if (nqi === -1) world.prepare(seg + 1, FINAL_SIGNS, { final: true, def: 0 });
      else world.prepare(seg + 1, signsOf(QS[nqi]), { def: QS[nqi].def });
      ui.hideCard(); Snd.whoosh();
      await Promise.race([new Promise(res => world.choose(seg, c, res)), wait(7000)]);
      Snd.gakon();
      const lines = [];
      if (r.timedOut) { lines.push('時間切れ。レバーは引かれませんでした。'); if (firstTimeout) { lines.push('何もしないことも、一つの政策です。'); firstTimeout = false; } }
      ui.logBlock('第' + num + '問「' + qd.options[c].label + '」', lines.concat(qd.after ? qd.after(c, S) : []));
      (qd.news ? qd.news(c, S) : []).forEach(n => ui.boardPush(n));
      const fu = qd.followup ? qd.followup(c, S, A) : null;
      if (fu) {
        await wait(450);
        const pr = await ui.panel(fu.text, fu.options, { def: fu.def });
        fu.set(pr.choice, S, fu.options);
        ui.logBlock('→「' + fu.options[pr.choice] + '」', (pr.timedOut ? [fu.timeoutLine] : []).concat(fu.after ? fu.after(pr.choice, S, fu.options) : []), true);
      } else await wait(400);
      seg++; qi = nqi;
    }
    await finalAct(S, A, seg);
  }

  async function finalAct(S, A, seg) {
    ui.act('ACT FINAL', '二択'); ui.hud('ACT FINAL　二択', '最終問題');
    await Promise.race([world.arrived(seg), wait(15000)]);
    world.setCinematic('final');
    ui.card('最終問題', '左の線路には「クリエイターの権利」。\n右の線路には「AI技術の発展」。\nレバーを引いて、どちらかを轢いてください。');
    ui.logBlock('最終問題', []);
    await ui.lever(['左へ', '右へ'], { signs: [['クリエイターの権利'], ['AI技術の発展']], stuck: true, attempts: 3, onStuck: n => { world.kick(0.7); ui.logBlock(null, [n < 3 ? 'レバーは動きません。' : 'レバーは、動きません。'], true); } });
    await wait(600); ui.hideLever(); ui.hideCard(); await wait(300);
    ui.card('', '本当に、\n二択にする必要がありますか？'); Snd.beep();
    await wait(2400); ui.hideCard();
    world.revealCenter(); Snd.click(); ui.logBlock(null, ['三本目の線路が現れました。'], true);
    await wait(900);
    await policyPanel(S);
    world.runCenter(); Snd.whoosh();
    await wait(2300);
    await ui.fade(true);
    ending(S, A);
  }

  function policyPanel(S) {
    return new Promise(res => {
      const p = $('#policy'), list = $('#policy-list'); list.textContent = '';
      ['transparency', 'optout', 'targeting', 'replication', 'levy', 'oss', 'research', 'bigtech'].forEach(id => {
        const l = M.LEVERS.find(x => x.id === id), row = document.createElement('div'); row.className = 'prow';
        if (l.type === 'tri') {
          row.innerHTML = '<div class="pt"><b>' + l.name + '</b><span>' + l.plain + '</span></div><div class="seg" role="radiogroup">' + l.options.map((o, i) => '<label><input type="radio" name="p-' + id + '" value="' + i + '"' + (S[id] === i ? ' checked' : '') + '><span>' + o + '</span></label>').join('') + '</div>';
          row.querySelectorAll('input').forEach(inp => inp.addEventListener('change', e => { S[id] = +e.target.value; Snd.tick(); }));
        } else {
          row.innerHTML = '<label class="sw"><input type="checkbox"' + (S[id] ? ' checked' : '') + '><span class="knob"></span><span class="pt"><b>' + l.name + '</b><span>' + l.plain + '</span></span></label>';
          row.querySelector('input').addEventListener('change', e => { S[id] = e.target.checked; Snd.tick(); });
        }
        list.appendChild(row);
      });
      const lm = $('#policy-levy'); lm.value = S.levyMode || 'B'; lm.onchange = e => { S.levyMode = e.target.value; };
      const btn = $('#policy-go'); let stop = () => {}, done = false;
      const go = timedOut => { if (done) return; done = true; stop(); btn.onclick = null; if (timedOut) ui.logBlock(null, ['時間切れ。その時点のレバーで運行します。'], true); Snd.click(); ui.hide(p); res(); };
      btn.onclick = () => go(false);
      ui.show(p);
      stop = ui.timer(TIME, $('#policy-timer'), $('#policy-bar'), () => go(true));
    });
  }

  /* ---------- 8角グラフ（SVG と Canvas で同じ形） ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  const el = (n, a, t) => { const e = document.createElementNS(NS, n); Object.entries(a || {}).forEach(([k, v]) => e.setAttribute(k, v)); if (t != null) e.textContent = t; return e; };
  const geo = (cx, cy, R, n) => (i, val) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + R * val / 100 * Math.cos(a), cy + R * val / 100 * Math.sin(a)]; };
  function labelPos(i, n) { const ang = -90 + i * 360 / n, cos = Math.cos(ang * Math.PI / 180), sin = Math.sin(ang * Math.PI / 180); return { align: cos > 0.15 ? 'start' : cos < -0.15 ? 'end' : 'middle', sin }; }
  function drawRadar(svg, r) {
    [...svg.querySelectorAll(':scope > :not(title)')].forEach(n => n.remove());
    const n = r.axes.length, pt = geo(320, 280, 180, n), poly = vals => vals.map((v, i) => pt(i, v).map(x => x.toFixed(1)).join(',')).join(' ');
    [25, 50, 75, 100].forEach(lv => svg.appendChild(el('polygon', { points: poly(r.axes.map(() => lv)), fill: lv === 100 ? '#26251f' : 'none', stroke: '#3f3c34', 'stroke-width': lv === 100 ? 1.5 : 1 })));
    r.axes.forEach((a, i) => { const [x, y] = pt(i, 100); svg.appendChild(el('line', { x1: 320, y1: 280, x2: x, y2: y, stroke: '#3f3c34' })); });
    svg.appendChild(el('polygon', { points: poly(r.axes.map(a => a.base)), fill: 'none', stroke: '#8e8878', 'stroke-width': 2, 'stroke-dasharray': '5 5' }));
    svg.appendChild(el('polygon', { points: poly(r.axes.map(a => a.value)), fill: 'rgba(232,86,74,.2)', stroke: '#e8564a', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
    r.axes.forEach((a, i) => {
      const [x, y] = pt(i, a.value); svg.appendChild(el('circle', { cx: x, cy: y, r: 5, fill: '#e8564a', stroke: '#1e1d1a', 'stroke-width': 2 }));
      const [lx, ly] = pt(i, 119), lp = labelPos(i, n), baseY = lp.sin < -0.5 ? ly - 22 : lp.sin > 0.5 ? ly + 6 : ly - 8;
      const g = el('g', { 'text-anchor': lp.align, 'font-family': 'BIZ UDPGothic, sans-serif', 'font-size': 13, fill: '#ece6d6' });
      a.short.forEach((line, k) => g.appendChild(el('text', { x: lx, y: baseY + k * 15 }, line)));
      g.appendChild(el('text', { x: lx, y: baseY + a.short.length * 15 + 2, 'font-family': 'DotGothic16, monospace', 'font-size': 16, fill: '#e8564a' }, String(a.value)));
      svg.appendChild(g);
    });
  }
  function radarCanvas(g, r, cx, cy, R) {
    const n = r.axes.length, pt = geo(cx, cy, R, n);
    const path = vals => { g.beginPath(); vals.forEach((v, i) => { const [x, y] = pt(i, v); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); };
    [100, 75, 50, 25].forEach(lv => { path(r.axes.map(() => lv)); if (lv === 100) { g.fillStyle = '#26251f'; g.fill(); } g.strokeStyle = '#3f3c34'; g.lineWidth = lv === 100 ? 2 : 1; g.stroke(); });
    r.axes.forEach((a, i) => { const [x, y] = pt(i, 100); g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y); g.strokeStyle = '#3f3c34'; g.lineWidth = 1; g.stroke(); });
    g.setLineDash([7, 7]); path(r.axes.map(a => a.base)); g.strokeStyle = '#8e8878'; g.lineWidth = 2.5; g.stroke(); g.setLineDash([]);
    path(r.axes.map(a => a.value)); g.fillStyle = 'rgba(232,86,74,.22)'; g.fill(); g.strokeStyle = '#e8564a'; g.lineWidth = 3.5; g.lineJoin = 'round'; g.stroke();
    r.axes.forEach((a, i) => {
      const [x, y] = pt(i, a.value); g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fillStyle = '#e8564a'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#1b1a17'; g.stroke();
      const [lx, ly] = pt(i, 121), lp = labelPos(i, n), baseY = lp.sin < -0.5 ? ly - 30 : lp.sin > 0.5 ? ly + 8 : ly - 12;
      g.textAlign = lp.align === 'start' ? 'left' : lp.align === 'end' ? 'right' : 'center'; g.textBaseline = 'alphabetic';
      g.fillStyle = '#ece6d6'; g.font = '700 17px "BIZ UDPGothic", sans-serif'; a.short.forEach((line, k) => g.fillText(line, lx, baseY + k * 20));
      g.fillStyle = '#e8564a'; g.font = '22px "DotGothic16", monospace'; g.fillText(String(a.value), lx, baseY + a.short.length * 20 + 4);
    });
  }
  function wrapText(g, text, x, y, maxW, font, size, lh, maxLines) {
    let s = size, lines;
    do { g.font = font.replace('{s}', s); lines = []; let cur = ''; for (const ch of text) { if (g.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; } else cur += ch; } if (cur) lines.push(cur); s -= 2; } while (lines.length > maxLines && s > 18);
    lines.forEach((l, i) => g.fillText(l, x, y + i * (s + 2) * lh)); return y + lines.length * (s + 2) * lh;
  }
  async function makeBanner(r, ar, unresolved) {
    const W = 1200, H = 630, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    try { await Promise.race([Promise.all(['900 40px "Zen Old Mincho"', '700 20px "BIZ UDPGothic"', '20px "DotGothic16"'].map(f => document.fonts.load(f))), new Promise(z => setTimeout(z, 2500))]); } catch (e) { /* 代替書体で描く */ }
    g.fillStyle = '#1b1a17'; g.fillRect(0, 0, W, H); g.fillStyle = '#b8261c'; g.fillRect(0, 0, W, 10);
    radarCanvas(g, r, 300, 312, 150);
    const x0 = 600; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#8e8878'; g.font = '700 22px "BIZ UDPGothic", sans-serif'; g.fillText('学習機関車　あなたはこんな総理大臣でした', x0, 84);
    g.fillStyle = '#ece6d6'; let y = wrapText(g, ar.name, x0, 150, 560, '900 {s}px "Zen Old Mincho", serif', 50, 1.12, 2) + 12;
    const row = (label, value, color) => { g.fillStyle = '#8e8878'; g.font = '700 19px "BIZ UDPGothic", sans-serif'; g.fillText(label, x0, y); y += 36; g.fillStyle = color; y = wrapText(g, value, x0, y, 560, '700 {s}px "BIZ UDPGothic", sans-serif', 30, 1.1, 1) + 16; };
    row('守ったもの', r.top.name, '#ece6d6'); row('犠牲にしたもの', r.bottom.name, '#e8564a');
    g.fillStyle = '#8e8878'; g.font = '700 19px "BIZ UDPGothic", sans-serif'; g.fillText('最後まで解決できなかったもの', x0, y); y += 32;
    g.fillStyle = '#c0b9a6'; wrapText(g, unresolved, x0, y, 560, '700 {s}px "BIZ UDPGothic", sans-serif', 22, 1.15, 2);
    g.fillStyle = '#e5b400'; g.fillRect(0, H - 54, W, 54);
    g.fillStyle = '#1b1a17'; g.font = '700 21px "BIZ UDPGothic", sans-serif'; g.fillText('#学習機関車　　人口100万人の国の政策シミュレーション（数値は出典つきの試算です）', 36, H - 19);
    return cv;
  }
  const xLen = s => { let n = 0; for (const ch of s) n += ch.codePointAt(0) <= 0x10FF ? 1 : 2; return n; };

  /* ---------- 診断 ---------- */
  async function ending(S, A) {
    ['#card', '#lever', '#log', '#board', '#hud', '#act'].forEach(s => { const e = $(s); if (e) e.hidden = true; });
    const st = M.normalize(S), r = M.radar(st), o = M.outcomes(st), ar = M.archetype(st), unresolved = M.unresolved(st);
    drawRadar($('#radar'), r);
    $('#arch-name').textContent = ar.name; $('#arch-body').textContent = ar.body;
    const reasons = [];
    if (S.reason) reasons.push('人間とプログラムの違いを、あなたは「' + S.reason + '」と答えました。');
    if (S.humanReason) reasons.push('人間には許されてAIには許されない理由を、あなたは「' + S.humanReason + '」と答えました。');
    $('#reasons').textContent = reasons.join(' ');
    const ol = $('#stats'); ol.textContent = '';
    o.items.filter(i => i.basis !== '—').forEach(i => {
      const li = document.createElement('li'); li.className = 'stat' + (i.id === 'ethics' ? ' zero' : '');
      li.innerHTML = '<span class="label"></span><span class="value">' + fmt(i.value) + '<small>' + i.unit + '</small></span><span class="note"><span class="badge b-' + i.basis.slice(0, 2) + '">' + i.basis + '</span></span>';
      li.querySelector('.label').textContent = i.label; li.querySelector('.note').appendChild(document.createTextNode(i.note)); ol.appendChild(li);
    });
    $('#kept-top').textContent = r.top.name + '（' + r.top.plain + '）';
    $('#kept-bottom').textContent = r.bottom.name + '（' + r.bottom.plain + '）';
    const ex = M.exceptions(st); if (S.styleProtect) ex.push('「画風を保護対象にする」'); if (S.userLiability) ex.push('「生成して使った人にも責任を問う」');
    $('#kept-ex').innerHTML = ex.length ? '<ul>' + ex.map(e => '<li>' + e + '</li>').join('') + '</ul>' : '例外は作りませんでした。';
    $('#kept-q').textContent = unresolved;
    $('#answers').textContent = Object.values(A).sort((a, b) => a.num - b.num).map(a => '第' + a.num + '問「' + a.label + '」' + (a.timedOut ? '（時間切れ）' : '')).join('　');
    const tb = $('#axis-table tbody'); tb.textContent = '';
    r.axes.forEach(a => { const tr = document.createElement('tr'); tr.innerHTML = '<td>' + a.name + '</td><td>' + a.plain + '</td><td class="n">' + a.base + '</td><td class="n">' + a.value + '</td>'; tb.appendChild(tr); });
    const src = $('#sources'); src.textContent = '';
    Object.values(M.SOURCES).forEach(s => { const li = document.createElement('li'), a = document.createElement('a'); a.href = s.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = s.label; li.appendChild(a); src.appendChild(li); });

    // 共有文（Xの上限280。日本語は1字2として数える）
    // URLはXが23字として数える
    const url = sharePageUrl(ar.id + '-' + r.top.id + '-' + r.bottom.id);
    const lines = ['#学習機関車', '私は' + ar.name + 'の総理大臣でした。', '守ったもの：' + r.top.name, '犠牲にしたもの：' + r.bottom.name, '解決できなかったもの：' + unresolved];
    const tail = url ? '\n\n↓スマホ・PCで今すぐプレイ↓\n' : '';
    if (xLen(lines.join('\n') + tail) + (url ? 23 : 0) > 275) lines.splice(4, 1);
    const text = lines.join('\n') + tail + (url || '');
    $('#share-text').value = text;
    $('#x-share').href = 'https://x.com/intent/post?text=' + encodeURIComponent(text);
    $('.hint').textContent = url
      ? 'Xでポストすると、あなたの診断のカード画像が付きます。カードのグラフは、同じ診断になった形の代表例です。自分のグラフそのものを付けたいときは、画像をコピーして投稿画面に貼ってください。'
      : 'Xの投稿画面が開いたら、コピーした画像を貼り付けてください。画像は長押し（右クリック）でも保存できます。';

    const e = $('#ending'); e.hidden = false; void e.offsetWidth; e.classList.add('on'); e.scrollTop = 0;
    $('#fade').hidden = true; $('#fade').classList.remove('on'); Snd.chime();

    const cv = await makeBanner(r, ar, unresolved);
    $('#banner').src = cv.toDataURL('image/png');
    cv.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], 'gakushu-kikansha.png', { type: 'image/png' });
      try { if (navigator.canShare && navigator.canShare({ files: [file] })) { const b = $('#img-share'); b.hidden = false; b.onclick = async () => { try { await navigator.share({ files: [file], text }); } catch (err) { /* 取り消し */ } }; } } catch (err) { /* 共有シートなし */ }
      $('#img-copy').onclick = async () => {
        const done = $('#copy-done');
        try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); done.textContent = '画像をコピーしました。Xの投稿画面に貼り付けてください'; }
        catch (err) { done.textContent = 'この環境では画像をコピーできません。画像を長押し（右クリック）して保存してください'; }
      };
    }, 'image/png');
  }

  /* ---------- プレイ回数（サイトの /api/plays。公式ドメインのときだけ・3秒以内の二度押しは数えない） ---------- */
  let lastPlayCount = 0;
  function countPlay() {
    const now = Date.now();
    if (now - lastPlayCount < 3000 || !/(^|\.)ogyanuntiusxiii\.com$/.test(location.hostname)) return;
    lastPlayCount = now;
    try { fetch('/api/plays?g=gakushu-kikansha', { method: 'POST', keepalive: true }).catch(() => {}); } catch (e) { /* 数えられなくてもゲームは動く */ }
  }

  /* ---------- 起動 ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    boot();
    $('#start').addEventListener('click', async () => {
      Snd.ensure(); Snd.click();
      if (!world) return;
      countPlay();
      ui.hide($('#title')); await wait(250);
      $('#hud').hidden = false;
      play().catch(err => { console.error(err); ui.card('運行障害', '進行中に問題が起きました。ページを読み直してください。\n' + (err && err.message ? err.message : err)); });
    });
    $('#mute').addEventListener('click', () => { Snd.muted = !Snd.muted; $('#mute').textContent = Snd.muted ? '音：切' : '音：入'; $('#mute').setAttribute('aria-pressed', String(Snd.muted)); });
    $('#again').addEventListener('click', () => location.reload());
    $('#copy').addEventListener('click', async () => {
      const ta = $('#share-text'), done = $('#copy-done');
      try { await navigator.clipboard.writeText(ta.value); done.textContent = '文章をコピーしました'; }
      catch (e) { ta.select(); try { document.execCommand('copy'); done.textContent = '文章をコピーしました'; } catch (e2) { done.textContent = '選択したので Ctrl+C で写してください'; } }
    });
  });
})();
