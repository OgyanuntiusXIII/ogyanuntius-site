/* 30 TRAPS — 本体
   構成：釣り画像 → ブロック崩し → 報酬 → TRAPデスク(30枚) → リザルト
   計測は「釣り画像を押した瞬間」から「30枚目をどかした瞬間」まで。途中で止まらない。
   YouTube の実プレイヤーは常に1個だけ。29枚はサムネの静止ウィンドウ。 */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var STORE = 'ogyanun:30traps:v1';
  var TOTAL = TRAPS.length;

  /* ---------------- 保存 ---------------- */
  function load() {
    try {
      var v = JSON.parse(localStorage.getItem(STORE) || '{}');
      return {
        first: typeof v.first === 'number' ? v.first : null,
        rtaBest: typeof v.rtaBest === 'number' ? v.rtaBest : null,
        rtaUnlocked: !!v.rtaUnlocked,
        clears: v.clears || 0
      };
    } catch (e) {
      return { first: null, rtaBest: null, rtaUnlocked: false, clears: 0 };
    }
  }
  function save(rec) { try { localStorage.setItem(STORE, JSON.stringify(rec)); } catch (e) {} }
  var REC = load();

  /* ---------------- 表示 ---------------- */
  function fmt(ms) {
    if (ms == null) return '--:--.---';
    var t = Math.max(0, Math.round(ms));
    var m = Math.floor(t / 60000);
    var s = Math.floor((t % 60000) / 1000);
    var f = t % 1000;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + ('00' + f).slice(-3);
  }
  /* 最後に出す表記。**直感的に「これだけ失った」と分かる形**（本人の指示・2026-09-02） */
  function fmtJp(ms) {
    if (ms == null) return '—';
    var t = Math.max(0, Math.round(ms / 100) / 10);      // 0.1秒まで
    var m = Math.floor(t / 60);
    var sec = (t - m * 60).toFixed(1);
    return (m > 0 ? m + '分' : '') + sec + '秒';
  }

  /* 積み上がった合計。桁が大きくなるので単位を切り替える */
  function fmtTotal(ms) {
    var sec = Math.floor(ms / 1000);
    var d = Math.floor(sec / 86400);
    var h = Math.floor((sec % 86400) / 3600);
    var m = Math.floor((sec % 3600) / 60);
    if (d > 0) return d + '日 ' + h + '時間 ' + m + '分';
    if (h > 0) return h + '時間 ' + m + '分';
    return m + '分 ' + (sec % 60) + '秒';
  }

  function fmtShort(ms) {
    var t = Math.max(0, Math.round(ms));
    return Math.floor(t / 60000) + ':' + ('0' + Math.floor((t % 60000) / 1000)).slice(-2) +
      '.' + Math.floor((t % 1000) / 100);
  }
  function show(id) {
    var all = document.querySelectorAll('.screen');
    for (var i = 0; i < all.length; i++) all[i].classList.toggle('on', all[i].id === id);
  }

  /* ---------------- 状態 ---------------- */
  var state = {
    mode: 'first',      // first（初見・1回だけ）/ rta（2回目以降）
    t0: 0,
    total: 0,
    idx: 0,
    moved: 0,
    started: false
  };
  /* 初見は1回だけ。**2回目からは全部RTA**（本人の指示・2026-09-02）。
     rtaUnlocked が決めるのは「タイマーを出すかどうか」だけで、記録の種類ではない。 */
  function decideMode() {
    return REC.first == null ? 'first' : 'rta';
  }

  /* ---------------- 広告 ----------------
     外周の10枠は全部が本物の売り物。偽広告は置かない。
     売れていない枠は「空いてます」と価格を出すだけ。 */

  var ZONES = [
    { key: 'top',    sel: '#adTop',    kind: 'wide' },
    { key: 'left',   sel: '#adLeft',   kind: 'tall' },
    { key: 'right',  sel: '#adRight',  kind: 'tall' },
    { key: 'bottom', sel: '#adBottom', kind: 'wide' },
    { key: 'pop',    sel: '#popAd',    kind: 'wide' }
  ];

  function yen(n) { return String(n).replace(/\B(?=(\d{3})+$)/g, ',') + SPONSOR.currency; }
  function sizeOf(zoneKey) { return SLOT_SIZE[zoneKey] || 'small'; }

  /* 今日（日本時間の YYYY-MM-DD）。掲載期限の判定だけに使う */
  function today() {
    return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  }
  /* 期限切れ・掲載前の枠は「無い」ものとして扱う。
     **手で外す作業を残さないための仕掛け。** until を過ぎたら勝手に空き枠へ戻る。 */
  function live(s) {
    if (!s || !s.name) return null;
    if (s.self) return s;                           // 自分の宣伝。期限は要らない
    var d = today();
    if (!s.until || s.until < d) return null;       // until が無い枠も出さない（貼りっぱなし防止）
    if (s.from && s.from > d) return null;
    return s;
  }
  function slotsOf(zoneKey) {
    return (SPONSORS[zoneKey] || []).map(live);
  }

  /* 広告のリンク先を通すかどうか。**javascript: や data: を弾く。**
     いまは自分で書いているので安全だが、Discordで原稿を受け取るようになると
     ここが唯一の関門になる。先に付けておく。 */
  function safeUrl(u) {
    if (typeof u !== 'string' || !u) return null;
    var v = u.trim();
    if (/^\//.test(v) && !/^\/\//.test(v)) return v;      // 自サイト内。//evil.com は弾く
    return /^https?:\/\//i.test(v) ? v : null;
  }
  function isExternal(u) { return /^https?:\/\//i.test(u); }

  /* ---- 埋まっている枠 ---- */
  function realAdEl(s, kind) {
    var href = safeUrl(s.url);
    var box = href ? document.createElement('a') : document.createElement('div');
    box.className = 'ad real ' + kind + (s.self ? ' own' : '');
    if (href) {
      box.href = href;
      if (isExternal(href)) {
        box.target = '_blank';
        // 有料で貼ったリンクであることを明示する。付け忘れない
        box.rel = 'nofollow sponsored noopener noreferrer';
      }
      // 自分のサイト内へのリンクに sponsored を付けると自分が損をするので付けない
    }
    var lab = document.createElement('span');
    lab.className = 'adlabel'; lab.textContent = s.self ? 'PR' : '広告';
    box.appendChild(lab);
    var isrc = safeUrl(s.image);
    if (isrc) {
      var img = document.createElement('img');
      img.src = isrc; img.alt = ''; img.loading = 'lazy';
      box.appendChild(img);
    }
    var wrap = document.createElement('div');
    var h = document.createElement('div');
    h.className = 'head'; h.textContent = s.name;
    wrap.appendChild(h);
    if (s.text) {
      var t = document.createElement('div');
      t.className = 'sub'; t.textContent = s.text;
      wrap.appendChild(t);
    }
    box.appendChild(wrap);
    return box;
  }

  /* ---- 空いている枠 ---- */
  function vacantAdEl(kind, zoneKey) {
    var a = document.createElement('a');
    a.className = 'ad vacant ' + kind;
    a.href = SPONSOR.contact;
    var lab = document.createElement('span');
    lab.className = 'adlabel'; lab.textContent = '広告枠';
    var h = document.createElement('div');
    h.className = 'head'; h.textContent = 'この枠、空いてます';
    var p = document.createElement('div');
    p.className = 'price'; p.textContent = yen(SPONSOR.price[sizeOf(zoneKey)]);
    var t = document.createElement('div');
    t.className = 'term'; t.textContent = SPONSOR.term + ' ／ 出す →';
    a.appendChild(lab); a.appendChild(h); a.appendChild(p); a.appendChild(t);
    return a;
  }

  function renderAds() {
    ZONES.forEach(function (z) {
      var el = $(z.sel);
      if (!el) return;
      var slots = slotsOf(z.key);
      el.textContent = '';
      for (var i = 0; i < slots.length; i++) {
        el.appendChild(slots[i] ? realAdEl(slots[i], z.kind) : vacantAdEl(z.kind, z.key));
      }
    });
  }

  function killAds() {
    ZONES.forEach(function (z) { var e = $(z.sel); if (e) e.textContent = ''; });
    ['#adPop', '#marquee', '#navbar', '#siteHead'].forEach(function (s) {
      var e = $(s); if (e) e.style.display = 'none';
    });
    $('#chrome').classList.add('bare');
  }

  /* ---- 売れている枠の一覧 ---- */
  function soldSlots() {
    var out = [];
    ZONES.forEach(function (z) {
      slotsOf(z.key).forEach(function (s) { if (s && !s.self) out.push(s); });
    });
    return out;
  }
  function countSlots() {
    var c = { large: { total: 0, free: 0 }, small: { total: 0, free: 0 } };
    ZONES.forEach(function (z) {
      var k = sizeOf(z.key);
      slotsOf(z.key).forEach(function (s) { c[k].total++; if (!s || s.self) c[k].free++; });
    });
    return c;
  }

  /* ---- 30枚目のあと。売れている枠だけ結果の下に一行残す ---- */
  function renderEndCredit() {
    var el = $('#endCredit');
    var sold = soldSlots();
    if (!el) return;
    if (!sold.length) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = '';
    el.appendChild(document.createTextNode('この記録は '));
    sold.forEach(function (s, i) {
      if (i) el.appendChild(document.createTextNode('・'));
      var n, h = safeUrl(s.url);
      if (h) {
        n = document.createElement('a');
        n.href = h;
        if (isExternal(h)) { n.target = '_blank'; n.rel = 'nofollow sponsored noopener noreferrer'; }
      } else {
        n = document.createElement('b');
      }
      n.textContent = s.name;
      el.appendChild(n);
    });
    el.appendChild(document.createTextNode(' の提供でお送りしました。'));
  }

  /* ---------------- ブロック崩し ----------------
     よくある「崩すと画像が出てくる」やつの形。ただし出てくるのは絵の続きではなく
     **再生ボタン**。顔は最初からブロックの上に出ている。
     全部崩し切ると、その再生ボタンがそのまま押せるようになる。 */
  var BW = 480, BH = 400;                        // 論理サイズ。CSSで縮む
  var FIELD = { x: 0, y: 100, w: 480, h: 200 };  // ブロックの敷き詰め範囲＝再生ボタンが隠れている場所
  var ROWS = 5, COLS = 8;                        // 5段固定
  var BRICK_COLORS = ['#e0301e', '#ff8a00', '#ffd400', '#00a000', '#00b7c3'];
  var MAX_BALLS = 8;
  var RAMP = 1.005;
  var SPEED = 2.7, SPEED_MAX = 4.0, PAD_W = 112, LIVES = 5;

  var bk = {
    ctx: null, raf: 0,
    bricks: [], left: 0, lives: LIVES,
    padX: BW / 2, padW: PAD_W, padY: BH - 24, padH: 10,
    balls: [], r: 5,
    stuck: true, dead: false, done: false, running: false,
    pic: null, picReady: false
  };

  function led(el, v) { el.textContent = ('00' + Math.max(0, Math.min(999, v))).slice(-3); }

  // 顔と足を出すための絵。読めなくてもゲームは成立する
  function loadPic() {
    if (bk.pic) return;
    var im = new Image();
    im.onload = function () { bk.picReady = true; draw(); };
    im.onerror = function () { bk.picReady = false; };
    im.src = './bait-full.webp';
    bk.pic = im;
  }

  function buildBoard() {
    var c = $('#bcanvas');
    bk.ctx = c.getContext('2d');
    bk.padW = PAD_W;
    bk.padX = BW / 2;
    bk.lives = LIVES;
    bk.dead = false; bk.done = false;
    bk.bricks = [];
    $('#playBtn').hidden = true;
    loadPic();

    var gap = 2;
    var bw = (FIELD.w - gap * (COLS + 1)) / COLS;
    var bh = (FIELD.h - gap * (ROWS + 1)) / ROWS;
    for (var r = 0; r < ROWS; r++) {
      for (var i = 0; i < COLS; i++) {
        bk.bricks.push({
          x: FIELD.x + gap + i * (bw + gap),
          y: FIELD.y + gap + r * (bh + gap),
          w: bw, h: bh, alive: true,
          c: BRICK_COLORS[r % BRICK_COLORS.length],
          // **手前の一列は全部ボール増殖。** 最初の一撃で一気に楽になる
          bonus: r === ROWS - 1
        });
      }
    }
    bk.left = bk.bricks.length;
    led($('#brickLed'), bk.left);
    led($('#lifeLed'), bk.lives);
    $('#faceBtn').textContent = '🙂';
    resetBall();
    if (!bk.running) { bk.running = true; bk.raf = requestAnimationFrame(step); }
    draw();
  }

  function newBall(x, y, vx, vy) { return { x: x, y: y, vx: vx, vy: vy }; }

  function resetBall() {
    bk.stuck = true;
    var a = (-20 - Math.random() * 40) * Math.PI / 180;
    bk.balls = [newBall(bk.padX, bk.padY - bk.r - 1, Math.sin(a) * SPEED, -Math.abs(Math.cos(a)) * SPEED)];
  }
  function launch() {
    if (bk.dead || bk.done) return;
    bk.stuck = false;
  }

  function splitBall(b, bx, by) {
    if (bk.balls.length >= MAX_BALLS) return;
    var sp = Math.max(Math.sqrt(b.vx * b.vx + b.vy * b.vy), SPEED);
    var base = Math.atan2(b.vy, b.vx);
    var a = base + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5);
    bk.balls.push(newBall(bx, by, Math.cos(a) * sp, Math.sin(a) * sp));
  }

  function step() {
    bk.raf = requestAnimationFrame(step);
    if (!$('#scr-break').classList.contains('on')) return;
    if (!bk.dead && !bk.done) update();
    draw();
  }

  function update() {
    if (bk.stuck) {
      bk.balls[0].x = bk.padX;
      bk.balls[0].y = bk.padY - bk.r - 1;
      return;
    }
    for (var bi = bk.balls.length - 1; bi >= 0; bi--) {
      if (moveBall(bk.balls[bi]) === 'out') bk.balls.splice(bi, 1);
      if (bk.done) return;
    }
    if (bk.balls.length === 0) miss();
  }

  function moveBall(b) {
    var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    var steps = Math.max(1, Math.ceil(sp / 3));

    for (var s = 0; s < steps; s++) {
      b.x += b.vx / steps;
      b.y += b.vy / steps;

      if (b.x - bk.r < 0) { b.x = bk.r; b.vx = Math.abs(b.vx); }
      if (b.x + bk.r > BW) { b.x = BW - bk.r; b.vx = -Math.abs(b.vx); }
      if (b.y - bk.r < 0) { b.y = bk.r; b.vy = Math.abs(b.vy); }

      if (b.vy > 0 && b.y + bk.r >= bk.padY && b.y - bk.r <= bk.padY + bk.padH) {
        var half = bk.padW / 2;
        if (b.x >= bk.padX - half - 2 && b.x <= bk.padX + half + 2) {
          var hit = Math.max(-1, Math.min(1, (b.x - bk.padX) / half));
          var ang = hit * (60 * Math.PI / 180);
          var v = Math.max(sp, SPEED);
          b.vx = Math.sin(ang) * v;
          b.vy = -Math.cos(ang) * v;
          // ど真ん中で受け続けると真上に往復して詰む。横をわずかに残す
          if (Math.abs(b.vx) < v * 0.09) {
            b.vx = (b.vx < 0 || (b.vx === 0 && Math.random() < 0.5) ? -1 : 1) * v * 0.09;
            b.vy = -Math.sqrt(Math.max(0.0001, v * v - b.vx * b.vx));
          }
          b.y = bk.padY - bk.r - 0.5;
        }
      }

      for (var i = 0; i < bk.bricks.length; i++) {
        var k = bk.bricks[i];
        if (!k.alive) continue;
        if (b.x + bk.r < k.x || b.x - bk.r > k.x + k.w ||
            b.y + bk.r < k.y || b.y - bk.r > k.y + k.h) continue;

        k.alive = false;
        bk.left--;
        led($('#brickLed'), bk.left);

        var ox = Math.min(b.x + bk.r - k.x, k.x + k.w - (b.x - bk.r));
        var oy = Math.min(b.y + bk.r - k.y, k.y + k.h - (b.y - bk.r));
        if (ox < oy) b.vx = -b.vx; else b.vy = -b.vy;

        var now = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (now < SPEED_MAX) {
          var f = Math.min(RAMP, SPEED_MAX / now);
          b.vx *= f; b.vy *= f;
        }

        if (k.bonus) splitBall(b, k.x + k.w / 2, k.y + k.h / 2);
        if (bk.left <= 0) { win(); return 'done'; }
        break;
      }

      if (b.y - bk.r > BH) return 'out';
    }
    return 'ok';
  }

  function miss() {
    bk.lives--;
    led($('#lifeLed'), bk.lives);
    if (bk.lives <= 0) {
      bk.dead = true;
      $('#faceBtn').textContent = '😵';
      $('#sweepNote').innerHTML = '落としました。<b>顔のボタンでやり直してください。</b>（※ 全体のタイマーは止まっていません）';
      return;
    }
    resetBall();
  }

  function win() {
    bk.done = true;
    $('#faceBtn').textContent = '😎';
    draw();
    // 出てきた再生ボタンが、そのまま押せるようになる
    setTimeout(function () { $('#playBtn').hidden = false; }, 450);
  }

  /* ブロックの下に隠してある再生ボタン。崩れた穴からこれが見えていく */
  function drawReward(g) {
    var cx = FIELD.x + FIELD.w / 2;
    var cy = FIELD.y + FIELD.h / 2 - 12;

    g.fillStyle = '#0e0e12';
    g.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);

    // 光の輪。崩すほど「なにか出てくる」感じにする
    var grd = g.createRadialGradient(cx, cy, 8, cx, cy, 150);
    grd.addColorStop(0, 'rgba(224,48,30,.45)');
    grd.addColorStop(1, 'rgba(224,48,30,0)');
    g.fillStyle = grd;
    g.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);

    g.beginPath();
    g.arc(cx, cy, 46, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,.95)';
    g.fill();

    g.beginPath();
    g.moveTo(cx - 14, cy - 22);
    g.lineTo(cx + 24, cy);
    g.lineTo(cx - 14, cy + 22);
    g.closePath();
    g.fillStyle = '#e0301e';
    g.fill();

    g.textAlign = 'center';
    g.fillStyle = '#fff';
    g.font = '700 17px "Hiragino Kaku Gothic ProN","Yu Gothic","Noto Sans JP",sans-serif';
    g.fillText('お待たせしました', cx, cy + 82);
  }

  function draw() {
    var g = bk.ctx;
    if (!g) return;

    // 地。イラストの背景に寄せる
    g.fillStyle = '#eceae4';
    g.fillRect(0, 0, BW, BH);

    // 顔はブロックの上に出しておく。足はブロックの下に出る
    if (bk.picReady) {
      var iw = bk.pic.naturalWidth, ih = bk.pic.naturalHeight;
      // **帯より上しか描かない。** 絵の下半分（スカート）は最初から存在しない
      var dw = 262, dh = Math.round(dw * ih / iw);
      var dx = Math.round((BW - dw) / 2), dy = -22;
      g.save();
      g.beginPath(); g.rect(0, 0, BW, FIELD.y); g.clip();
      g.drawImage(bk.pic, dx, dy, dw, dh);
      g.restore();
    }

    // ブロックの下に隠してあるもの
    drawReward(g);

    for (var i = 0; i < bk.bricks.length; i++) {
      var k = bk.bricks[i];
      if (!k.alive) continue;
      g.fillStyle = k.c;
      g.fillRect(k.x, k.y, k.w, k.h);
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.fillRect(k.x, k.y, k.w, 2);
      g.fillStyle = 'rgba(0,0,0,.3)';
      g.fillRect(k.x, k.y + k.h - 2, k.w, 2);
      if (k.bonus) {                          // 増殖ブロックの目印
        g.beginPath();
        g.arc(k.x + k.w / 2, k.y + k.h / 2, 5, 0, Math.PI * 2);
        g.fillStyle = '#fff'; g.fill();
        g.beginPath();
        g.arc(k.x + k.w / 2, k.y + k.h / 2, 2.5, 0, Math.PI * 2);
        g.fillStyle = k.c; g.fill();
      }
    }

    g.fillStyle = '#101010';
    g.fillRect(bk.padX - bk.padW / 2, bk.padY, bk.padW, bk.padH);
    g.fillStyle = '#e0301e';
    g.fillRect(bk.padX - bk.padW / 2, bk.padY, bk.padW, 3);

    if (!bk.done) {
      for (var j = 0; j < bk.balls.length; j++) {
        g.beginPath();
        g.arc(bk.balls[j].x, bk.balls[j].y, bk.r + 1, 0, Math.PI * 2);
        g.fillStyle = '#fff'; g.fill();
        g.beginPath();
        g.arc(bk.balls[j].x, bk.balls[j].y, bk.r, 0, Math.PI * 2);
        g.fillStyle = '#e0301e'; g.fill();
      }
    }

    g.textAlign = 'center';
    if (bk.stuck && !bk.dead && !bk.done) {
      g.font = '700 13px "Helvetica Neue",Helvetica,Arial,sans-serif';
      var tw = g.measureText('CLICK / TAP / SPACE TO START').width + 24;
      g.fillStyle = 'rgba(16,16,18,.78)';
      g.fillRect(BW / 2 - tw / 2, BH - 48, tw, 22);
      g.fillStyle = '#fff';
      g.fillText('CLICK / TAP / SPACE TO START', BW / 2, BH - 33);
    }
    if (bk.balls.length > 1 && !bk.done) {
      g.fillStyle = 'rgba(16,16,16,.55)';
      g.font = '700 12px "Helvetica Neue",Helvetica,Arial,sans-serif';
      g.fillText('BALLS ' + bk.balls.length, BW / 2, 16);
    }
    if (bk.dead) {
      g.fillStyle = 'rgba(0,0,0,.62)';
      g.fillRect(0, 0, BW, BH);
      g.fillStyle = '#e0301e';
      g.font = '700 34px "Helvetica Neue",Helvetica,Arial,sans-serif';
      g.fillText('GAME OVER', BW / 2, BH / 2 + 10);
    }
  }

  function movePad(clientX) {
    var c = $('#bcanvas');
    var rect = c.getBoundingClientRect();
    var x = (clientX - rect.left) / rect.width * BW;
    bk.padX = Math.max(bk.padW / 2, Math.min(BW - bk.padW / 2, x));
  }

  var BREAK_NOTE = 'マウス（スマホは指）でバーを動かす。クリック／タップ／スペースで発射。' +
    '<b>手前の一列は当てるとボールが増えます。</b>ボールが全部落ちたときだけ残機が減ります。';

  function wireSweeper() {
    var c = $('#bcanvas');

    c.addEventListener('pointermove', function (e) { movePad(e.clientX); });
    c.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      movePad(e.clientX);
      launch();
    });
    window.addEventListener('keydown', function (e) {
      if (!$('#scr-break').classList.contains('on')) return;
      if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); launch(); }
      var d = e.key === 'ArrowLeft' ? -22 : e.key === 'ArrowRight' ? 22 : 0;
      if (d) {
        e.preventDefault();
        bk.padX = Math.max(bk.padW / 2, Math.min(BW - bk.padW / 2, bk.padX + d));
      }
    });

    $('#faceBtn').addEventListener('click', function () {
      buildBoard();
      $('#sweepNote').innerHTML = BREAK_NOTE;
    });
  }

  /* ---------------- YouTube ---------------- */
  var yt = { api: false, player: null, failed: false, ready: false };

  function loadYT() {
    if (window.YT && window.YT.Player) { yt.api = true; return; }
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = function () { yt.failed = true; };
    document.head.appendChild(s);
    setTimeout(function () { if (!yt.api) yt.failed = true; }, 6000);
  }
  window.onYouTubeIframeAPIReady = function () { yt.api = true; yt.failed = false; };

  // API が来るまで最大 6 秒待つ。来なければ ok=false で返す。
  function whenYT(cb) {
    var t0 = Date.now();
    (function poll() {
      if (window.YT && window.YT.Player) { yt.api = true; cb(true); return; }
      if (yt.failed || Date.now() - t0 > 6000) { yt.failed = true; cb(false); return; }
      setTimeout(poll, 120);
    })();
  }

  function makePlayer(videoId, onReady) {
    if (!yt.api || yt.player) { if (onReady) onReady(); return; }
    try {
      yt.player = new YT.Player('player', {
        host: 'https://www.youtube-nocookie.com',
        videoId: videoId,
        playerVars: {
          autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1,
          controls: 1, fs: 0, iv_load_policy: 3, disablekb: 1
        },
        events: {
          onReady: function (e) {
            yt.ready = true;
            try { e.target.playVideo(); } catch (err) {}
            watchAutoplay();
            if (onReady) onReady();
          },
          onError: function () { $('#playOverlay').classList.remove('on'); }
        }
      });
    } catch (err) { yt.failed = true; if (onReady) onReady(); }
  }
  // 自動再生が弾かれたら、押せる再生ボタンを重ねる。1回だけでなく少しあとにも見る
  function watchAutoplay() {
    [1200, 3000].forEach(function (ms) {
      setTimeout(function () {
        if (!yt.player || !yt.player.getPlayerState) return;
        var st = yt.player.getPlayerState();
        $('#playOverlay').classList.toggle('on', st !== 1 && st !== 3);
      }, ms);
    });
  }

  /* 止まっているなら鳴らす。デスクを触ったときの保険 */
  function nudgePlay() {
    if (!yt.player || !yt.player.getPlayerState) return;
    var st = yt.player.getPlayerState();
    if (st === 1 || st === 3) return;
    try { yt.player.playVideo(); } catch (e) {}
    watchAutoplay();
  }
  function playVideo(id) {
    if (!yt.player || !yt.ready) return;
    try { yt.player.loadVideoById(id); } catch (e) {}
    watchAutoplay();
  }

  /* ---------------- TRAP デスク ----------------
     背景に全身の絵を置き、**ウィンドウの山がちょうどボードを覆う**大きさにしてある。
     だから最初は顔と足しか見えない。30枚目をどかすとボードが出て、そこに時間が乗る。 */
  var IMG_W = 1086, IMG_H = 1129;                          // デスク用（スカートから下を切った版）
  var BOARD = { x: 0.2422, y: 0.6003, w: 0.5424, h: 0.2806 };  // 切った版でのボードの内側
  // ウィンドウの山が「あごから膝まで」を覆う大きさに絵を縮める。
  // こうすると顔と足だけが出て、はじめて釣り動画として成立する（本人の指示・2026-09-02）。
  // あごの下から画像の下端まで、ウィンドウの山が全部覆う。
  // 絵はスカートの手前で切ってあるので、これで**顔だけ**が出る。
  var COVER = 0.60;
  var WIN_MIN = 300, WIN_MAX = 560;

  var desk = {
    W: 480, VH: 270, BAR: 30, bx: 0, by: 0,
    imgX: 0, imgY: 0, imgW: 0, imgH: 0,
    wins: [], hintTimer: 0, big: false
  };

  /* 絵の置き場所を決める。big=true は最後の「大きくなる」ほう */
  function shotBox(vw, vh, big) {
    var ih;
    if (big) {
      // ⚠️ **高さだけで合わせると、細い画面で横にはみ出してボードが切れる。**
      //    横幅と、下のボタン列のぶんも見る。
      var availH = Math.max(240, vh - 184);
      var availW = vw * 0.96;
      ih = Math.round(Math.min(availH, availW * IMG_H / IMG_W));
    } else {
      // ウィンドウの大きさが先。そこから絵の大きさが決まる
      var W = Math.round(Math.max(WIN_MIN, Math.min(WIN_MAX, vw * 0.34, vh * 0.62)));
      var total = Math.round(W * 9 / 16) + desk.BAR;
      ih = Math.round(total / COVER);
      // 絵が画面より高いと足が切れる。そのときは画面に収める
      if (ih > vh * 0.98) ih = Math.round(vh * 0.98);
    }
    var iw = Math.round(ih * IMG_W / IMG_H);
    // 大きいほうは、下のボタン列を避けた範囲の真ん中に置く
    var top = big
      ? Math.max(4, Math.round((vh - 184 - ih) / 2))
      : Math.round((vh - ih) / 2);
    return { w: iw, h: ih, x: Math.round((vw - iw) / 2), y: top };
  }

  function metrics() {
    // 裏のタブなどで 0 が返ることがある。0 のまま計算すると座標が全部マイナスになる
    var vw = Math.max(320, window.innerWidth || 0);
    var vh = Math.max(480, window.innerHeight || 0);
    desk.BAR = 30;

    var b = shotBox(vw, vh, false);
    desk.imgW = b.w; desk.imgH = b.h; desk.imgX = b.x; desk.imgY = b.y;

    // 動画ウィンドウ。絵の高さの COVER 割を覆う大きさ
    var total = Math.round(b.h * COVER);
    desk.VH = Math.max(120, total - desk.BAR);
    desk.W = Math.round(desk.VH * 16 / 9);
    // ボードの幅より狭いと、ボードが左右にはみ出して先に見えてしまう
    var boardW = BOARD.w * b.w;
    if (desk.W < boardW + 8) {
      desk.W = Math.round(boardW + 8);
      desk.VH = Math.round(desk.W * 9 / 16);
    }

    // ボードの中心にウィンドウの中心を合わせる
    var bcx = b.x + (BOARD.x + BOARD.w / 2) * b.w;
    var bcy = b.y + (BOARD.y + BOARD.h / 2) * b.h;
    desk.bx = Math.round(bcx - desk.W / 2);
    desk.by = Math.round(bcy - desk.VH / 2 - desk.BAR);
  }

  /* 最後だけ絵を画面いっぱいに戻す。ボードの数字を読ませるため */
  function growShot() {
    var vw = Math.max(320, window.innerWidth || 0);
    var vh = Math.max(480, window.innerHeight || 0);
    var b = shotBox(vw, vh, true);
    desk.big = true;
    var s = $('#deskShot');
    s.style.left = b.x + 'px'; s.style.top = b.y + 'px';
    s.style.width = b.w + 'px'; s.style.height = b.h + 'px';
  }

  function layoutShot() {
    var s = $('#deskShot');
    s.style.left = desk.imgX + 'px';
    s.style.top = desk.imgY + 'px';
    s.style.width = desk.imgW + 'px';
    s.style.height = desk.imgH + 'px';
  }

  function place(el, x, y) {
    el.dataset.x = String(x); el.dataset.y = String(y);
    el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }
  function placePlayer(x, y) {
    var p = $('#playerHost');
    p.style.width = desk.W + 'px';
    p.style.height = desk.VH + 'px';
    p.style.transform = 'translate(' + x + 'px,' + (y + desk.BAR) + 'px)';
  }

  function buildWindows() {
    var layer = $('#winLayer');
    layer.textContent = '';
    desk.wins = [];
    metrics();
    layoutShot();
    for (var i = 0; i < TOTAL; i++) {
      var w = document.createElement('div');
      w.className = 'tw';
      w.style.width = desk.W + 'px';
      w.style.zIndex = String(200 - i);
      var jitter = i === 0 ? 0 : ((i % 5) - 2) * 3;
      w.innerHTML =
        '<div class="bar"><span class="t">TRAP ' + ('0' + (i + 1)).slice(-2) + ' / ' + TOTAL + '</span>' +
        '<button type="button" class="x" tabindex="-1" aria-hidden="true">×</button></div>' +
        '<div class="body" style="height:' + desk.VH + 'px"><div class="thumb"></div></div>';
      place(w, desk.bx + jitter, desk.by + jitter);
      layer.appendChild(w);
      desk.wins.push(w);
    }
    placePlayer(desk.bx, desk.by);
  }

  function setThumb(i) {
    var t = desk.wins[i] && desk.wins[i].querySelector('.thumb');
    if (t && !t.style.backgroundImage) {
      t.style.backgroundImage = 'url(https://i.ytimg.com/vi/' + TRAPS[i].id + '/hqdefault.jpg)';
    }
  }

  function updateHud() {
    $('#hudLeft').innerHTML = 'TRAP <b>' + ('0' + Math.min(state.idx + 1, TOTAL)).slice(-2) + '</b> / ' + TOTAL;
  }

  function enterDesk() {
    state.idx = 0; state.moved = 0;
    desk.big = false;
    $('#desk').classList.remove('done');
    $('#deskBoard').classList.remove('on');
    $('#deskEnd').classList.remove('on');
    $('#deskEnd').hidden = true;
    $('#deskHud').style.display = '';
    buildWindows();
    setThumb(0); setThumb(1);
    updateHud();
    $('#desk').classList.add('on');
    document.body.style.overflow = 'hidden';
    // ⚠️ **ここはボタンを押したハンドラの中。** ブラウザが「音つき自動再生」を許すのは
    //    この操作の続きだけなので、API が来ているなら**待たずにその場で作る**。
    //    以前は 120ms ごとのポーリングを挟んでいて、1本目が鳴らないことがあった。
    if (window.YT && window.YT.Player) {
      $('#playerHost').style.display = '';
      placePlayer(desk.bx, desk.by);
      makePlayer(TRAPS[0].id);
    } else {
      $('#playerHost').style.display = 'none';
      whenYT(function (ok) {
        if (!ok) return;
        $('#playerHost').style.display = '';
        placePlayer(+desk.wins[state.idx].dataset.x, +desk.wins[state.idx].dataset.y);
        makePlayer(TRAPS[state.idx].id);
      });
    }
    wireDrag(0);
    if (state.mode !== 'rta') {
      desk.hintTimer = setTimeout(function () {
        if (state.moved === 0) $('#dragHint').classList.add('on');
      }, 20000);
    }
  }

  function wireDrag(i) {
    var w = desk.wins[i];
    if (!w) return;
    var bar = w.querySelector('.bar');
    var drag = null;

    // ⚠️ iOS（Xのアプリ内ブラウザ含む）は touchmove を止めないと
    //    スクロールやダブルタップ拡大が走って、掴んでも動かせない。
    //    pointer events だけでは足りないので、touch も直接止める。
    bar.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
    bar.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    var thresh = Math.max(48, Math.min(96, Math.round(desk.W * 0.2)));

    bar.addEventListener('pointerdown', function (e) {
      if (e.target.classList.contains('x')) return;
      e.preventDefault();
      clearTimeout(desk.hintTimer);
      $('#dragHint').classList.remove('on');
      nudgePlay();                       // 自動再生が弾かれていたらここで鳴る
      try { bar.setPointerCapture(e.pointerId); } catch (err) {}
      drag = { px: e.clientX, py: e.clientY, ox: +w.dataset.x, oy: +w.dataset.y };
      w.classList.add('dragging');
    });

    bar.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var x = drag.ox + (e.clientX - drag.px);
      var y = drag.oy + (e.clientY - drag.py);
      place(w, x, y);
      placePlayer(x, y);
    });

    function end() {
      if (!drag) return;
      w.classList.remove('dragging');
      var dx = +w.dataset.x - drag.ox, dy = +w.dataset.y - drag.oy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      drag = null;
      if (dist >= thresh) { commit(i); }
      else { place(w, desk.bx, desk.by); placePlayer(desk.bx, desk.by); }
    }
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);

    // × は閉じない（閉じられたら成立しない）
    var x = w.querySelector('.x');
    x.addEventListener('click', function (ev) {
      ev.stopPropagation();
      w.animate(
        [{ transform: w.style.transform + ' translateX(-6px)' },
         { transform: w.style.transform + ' translateX(6px)' },
         { transform: w.style.transform }],
        { duration: 220 }
      );
    });
  }

  function clampLitter(w) {
    var x = +w.dataset.x, y = +w.dataset.y;
    var maxX = window.innerWidth - 60, maxY = window.innerHeight - 30;
    x = Math.max(-desk.W + 70, Math.min(maxX, x));
    y = Math.max(0, Math.min(maxY, y));
    place(w, x, y);
  }

  function commit(i) {
    var w = desk.wins[i];
    w.classList.add('used');
    setThumb(i);
    clampLitter(w);
    w.style.zIndex = String(10 + state.moved);
    state.moved++;

    if (state.moved >= TOTAL) { finish(); return; }

    state.idx = i + 1;
    var nxt = desk.wins[state.idx];
    setThumb(state.idx); setThumb(state.idx + 1);
    place(nxt, desk.bx, desk.by);
    placePlayer(desk.bx, desk.by);
    playVideo(TRAPS[state.idx].id);
    updateHud();
    wireDrag(state.idx);
  }

  /* ---------------- リザルト ---------------- */
  function finish() {
    state.total = performance.now() - state.t0;
    stopClock();
    if (yt.player && yt.player.stopVideo) { try { yt.player.stopVideo(); } catch (e) {} }

    var kind = state.mode;
    if (kind === 'first') { REC.first = state.total; }
    else if (kind === 'rta') { if (REC.rtaBest == null || state.total < REC.rtaBest) REC.rtaBest = state.total; }
    REC.clears++;
    save(REC);
    pushTotal(state.total);

    // **画面を切り替えない。** その場でボードが出る。
    // 30枚目が退いた下に、ずっとあったボードが見えるだけ、という形にする。
    state.lastKind = kind; state.lastMs = state.total;
    $('#dbKind').textContent = kindLabel(kind);
    $('#dbTime').textContent = fmtJp(state.total);
    $('#desk').classList.add('done');
    $('#deskBoard').classList.add('on');
    $('#deskHud').style.display = 'none';
    growShot();                    // 小さかった絵が起き上がって、ボードを読ませる
    setTimeout(function () {
      $('#deskEnd').hidden = false;
      $('#deskEnd').classList.add('on');
    }, 900);

    // ページ側も裏で仕上げておく。「サイトに戻る」で見える
    killAds();
    renderEndCredit();
    renderResult(kind, state.total);
    show('scr-result');
  }

  // デスクを畳んでページ側の結果へ
  function closeDesk() {
    $('#desk').classList.remove('on');
    $('#deskEnd').classList.remove('on');
    document.body.style.overflow = '';
    show('scr-result');
    window.scrollTo(0, 0);
  }

  function kindLabel(kind) {
    return kind === 'first' ? '初見' : 'RTA';
  }

  /* 到達したあとの文。**本人の言葉そのまま。書き換えない** */
  var TAUNT = [
    'あなたがこのサイトで費やした時間です。',
    'まだyoutubeのショート見てるほうがマシでしたねw',
    'お疲れさまでしたw'
  ];

  function renderResult(kind, ms_) {
    $('#resultKindJp').textContent = kindLabel(kind);
    $('#resultTime').textContent = fmtJp(ms_);

    // 絵のボードにも同じ数字を出す
    $('#bKind').textContent = kindLabel(kind);
    $('#bTime').textContent = fmtJp(ms_);

    var t = $('#taunt');
    t.textContent = '';
    TAUNT.forEach(function (line) {
      var p = document.createElement('p');
      p.textContent = line;
      t.appendChild(p);
    });

    var rows = [['初見記録', fmtJp(REC.first)]];
    if (REC.rtaUnlocked) rows.push(['RTA自己ベスト', fmtJp(REC.rtaBest)]);
    rows.push(['到達回数', REC.clears + ' 回']);
    var box = $('#records');
    box.textContent = '';
    rows.forEach(function (r) {
      var d = document.createElement('div');
      var a = document.createElement('span'); a.textContent = r[0];
      var b = document.createElement('span'); b.textContent = r[1];
      d.appendChild(a); d.appendChild(b); box.appendChild(d);
    });

    renderRtaHint();
    renderShareRow();
    $('#rtaBadge').classList.toggle('on', REC.rtaUnlocked);
    state.lastKind = kind; state.lastMs = ms_;
  }

  /* 2回目以降だけ、隠しスイッチの場所を教える */
  function renderRtaHint() {
    var el = $('#rtaHint');
    if (!el) return;
    if (REC.rtaUnlocked) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML =
      '<b class="sw">MUGEN GAME ZONE</b> を <span class="k">5回クリック</span> すると' +
      '<b>RTAモード</b>になるよ♡<br>' +
      'タイマーが出て、2周目からはタイムアタックになります。';
    // 結果画面ではサイトのロゴを隠しているので、ここの文字も同じスイッチにする
    el.querySelector('.sw').addEventListener('click', tapRta);
  }

  /* ロゴ（またはヒントの文字）を5回。1回も到達していないうちは効かない */
  var rtaTaps = 0, rtaLast = 0;
  function tapRta() {
    // 初見でも解放できる（本人の指示・2026-09-02）。
    // 解放しても decideMode() は「初見記録が無いうちは first」を返すので、
    // **初見の記録を先に取り損ねることはない。**
    if (REC.rtaUnlocked) return;
    var now = Date.now();
    if (now - rtaLast > 1500) rtaTaps = 0;
    rtaLast = now; rtaTaps++;
    if (rtaTaps < 5) return;
    REC.rtaUnlocked = true; save(REC);
    state.mode = decideMode();
    renderRtaHint();
    var b = $('#rtaBadge');
    b.classList.add('on');
    b.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (state.mode === 'rta') previewClock();   // 0秒のタイマーをその場で出す
    $('#shareOut').textContent = REC.first == null
      ? 'RTAモードになりました。ただし初見の記録がまだなので、次の1回は初見として残ります。'
      : 'RTAモードになりました。上のタイマーが0から動き出します。';
    renderShareRow();
  }

  /* 共有文。**どの記録を出すかを引数で選べる。**
     いま走った分だけでなく、初見記録・RTAベストも別々に出せる（本人の指示・2026-09-02）。
     改行は NL でつなぐ。ここに '\n' を直接書くと編集時に実改行へ化ける事故があった。 */
  var NL = String.fromCharCode(10);
  function shareText(kind, ms) {
    // ⚠️ **1行目に作品名を置く。** タイムとURLとタグだけだと、
    //    共有された側から見て「乗っ取られた投稿」に見える（本人の指摘・2026-09-02）。
    //    人がスコアを報告している形にしておく。
    // index.html を落として、共有されるURLをきれいにする
    var url = (location.origin + location.pathname).replace(/index\.html$/, '');
    return ['30 TRAPS｜' + kindLabel(kind) + ' ' + fmtJp(ms),
            '革新的なサイトでした',
            '#怒られたら消えるサイト',
            url].join(NL);
  }

  /* 選べる共有先を並べる。**いま走った分は大きいボタンのほう。**
     それとは別に、記録として残っている初見／RTAベストを個別に出せるようにする。 */
  function renderShareRow() {
    ['#sharePick', '#dSharePick'].forEach(function (sel) {
      var row = $(sel);
      if (!row) return;
      row.textContent = '';
      var items = [];
      if (REC.first != null && !(state.lastKind === 'first' && state.lastMs === REC.first)) {
        items.push(['first', REC.first, '初見の記録（' + fmtJp(REC.first) + '）を共有']);
      }
      if (REC.rtaBest != null && !(state.lastKind === 'rta' && state.lastMs === REC.rtaBest)) {
        items.push(['rta', REC.rtaBest, 'RTAベスト（' + fmtJp(REC.rtaBest) + '）を共有']);
      }
      row.hidden = items.length === 0;
      items.forEach(function (it) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = it[2];
        b.addEventListener('click', function () { doShare(it[0], it[1]); });
        row.appendChild(b);
      });
    });
  }



  /* 共有は X だけ。デスク側とページ側の両方から呼ぶ。
     ⚠️ navigator.share を先に見ないこと。**PCのChromeにも存在する**ので、
        Windowsの共有シートが開いてXに飛ばなくなる（2026-09-02 実際に起きた）。
     ⚠️ window.open(url,'_blank','noopener') は**仕様上 null を返す**ので、
        戻り値でブロック判定をしてはいけない。a要素を作って押すほうが確実。 */
  function doShare(kind, ms) {
    if (kind == null) { kind = state.lastKind; ms = state.lastMs; }
    var url = 'https://x.com/intent/tweet?text=' + encodeURIComponent(shareText(kind, ms));
    var a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function wireResult() {
    var out = $('#shareOut');
    var dOut = $('#dOut');

    $('#btnShare').addEventListener('click', function () { doShare(); });
    $('#btnAgain').addEventListener('click', function () { restart(); });

    // デスクの上に出るほう
    $('#dShare').addEventListener('click', function () { doShare(); });
    $('#dClose').addEventListener('click', function () { closeDesk(); });
    $('#dAgain').addEventListener('click', function () { closeDesk(); restart(); });

    // 隠しスイッチはサイトのロゴ。5回で RTA モード
    $('#siteHead .logo').addEventListener('click', tapRta);
  }

  /* ---- RTAモードのタイマー。釣り画像を押した瞬間から画面上部に出る ----
     **初見では出さない**（本人の指示・2026-09-02「RTAモードにしない限りは出さないで」）。
     初回は最後まで時間を見せない。それがこの作品のオチだから。 */
  var clockRaf = 0;
  function startClock() {
    var el = $('#clock');
    // **初見では出さない。** 最後まで時間を見せないのが初回の作り
    // （本人の指示・2026-09-02「RTAモードにしない限りは出さないで」）
    if (state.mode !== 'rta') { el.hidden = true; return; }
    el.hidden = false;
    el.classList.remove('stopped', 'ready');
    el.classList.toggle('rta', state.mode === 'rta');
    $('#clockLabel').textContent = 'RTA';
    (function tick() {
      $('#clockTime').textContent = fmtJp(performance.now() - state.t0);
      clockRaf = requestAnimationFrame(tick);
    })();
  }
  function stopClock() {
    cancelAnimationFrame(clockRaf);
    if ($('#clock').hidden || !state.total) return;
    $('#clockTime').textContent = fmtJp(state.total);
    $('#clock').classList.add('stopped');
  }
  function hideClock() {
    cancelAnimationFrame(clockRaf);
    var el = $('#clock');
    el.hidden = true;
    el.classList.remove('stopped', 'rta');
  }

  /* RTAモードになった瞬間に、0秒のタイマーを出しておく。
     **切り替わったことが見て分かるようにするため**（本人の指示・2026-09-02）。
     まだ動かない。釣り画像を押した瞬間から動き出す。 */
  function previewClock() {
    cancelAnimationFrame(clockRaf);
    var el = $('#clock');
    el.hidden = false;
    el.classList.remove('stopped');
    el.classList.add('rta', 'ready');
    $('#clockLabel').textContent = 'RTA';
    $('#clockTime').textContent = '0.0秒';
  }

  /* ---------------- 進行 ---------------- */
  function restart() {
    REC = load();
    state.mode = decideMode();
    state.started = false;
    state.t0 = 0; state.total = 0; state.idx = 0; state.moved = 0;
    ['#adPop', '#marquee', '#navbar', '#siteHead'].forEach(function (s) {
      var e = $(s); if (e) e.style.display = '';
    });
    $('#chrome').classList.remove('bare');
    $('#endCredit').hidden = true;
    if (state.mode === 'rta') previewClock(); else hideClock();
    renderAds(0);
    buildBoard();
    show('scr-bait');
    window.scrollTo(0, 0);
  }

  function startRun() {
    if (state.started) return;
    state.started = true;
    state.t0 = performance.now();
    countPlay();
    startClock();
    loadYT();
    show('scr-break');
    // ?skip=1 のときだけ崩し終わった状態にする。TRAP側の確認用
    if (/[?&]skip=1/.test(location.search)) {
      bk.bricks.forEach(function (b) { b.alive = false; });
      bk.left = 0; bk.done = true;
      $('#playBtn').hidden = false;
      return;
    }
    $('#bcanvas').scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ---------------- 釣られた時間の合計 ----------------
     到達するたびに自分のタイムをサーバーへ足して、積み上がった合計を出す。
     **自己申告なので正確な統計ではない**（送る側で水増しできる）。
     サーバー側で1回の上限と1日の回数を絞ってあるが、そこまで。そういう数字として出す。
     D1 が繋がっていないと 204 が返るので、そのときは**何も出さない**。 */
  function showTotal(d) {
    var el = $('#totalTime');
    // **サーバーの返り値をそのまま組み立てに使わない。** 数であることを確かめてから使う
    if (!el || !d || typeof d.ms !== 'number' || !isFinite(d.ms) || d.ms <= 0) return;
    var runs = (typeof d.runs === 'number' && isFinite(d.runs)) ? Math.max(0, Math.floor(d.runs)) : 0;
    el.hidden = false;
    el.textContent = '';
    el.appendChild(document.createTextNode('このサイトがこれまでに奪った時間の合計'));
    el.appendChild(document.createElement('br'));
    var b = document.createElement('b');
    b.textContent = fmtTotal(d.ms);
    el.appendChild(b);
    if (runs) {
      var sp = document.createElement('span');
      sp.textContent = '（' + runs.toLocaleString('ja-JP') + '人ぶん）';
      el.appendChild(sp);
    }
  }
  function pushTotal(ms) {
    fetch('/api/traptime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ms: Math.round(ms) }),
      keepalive: true
    }).then(function (r) { return r.status === 200 ? r.json() : null; })
      .then(showTotal).catch(function () {});
  }

  /* ---------------- 再生数 ----------------
     釣り画像を実際に押した数。サイト共通の /api/plays を使う。
     D1 が繋がっていないと 204 が返るので、そのときは**何も出さない**（無い数字を作らない）。 */
  var PLAY_SLUG = 'okoraretarakesu';
  function showPlays(n) {
    var el = $('#playCount');
    if (!el || typeof n !== 'number') return;
    el.hidden = false;
    el.textContent = '再生数 ' + n.toLocaleString('ja-JP') + ' 回';
  }
  function fetchPlays() {
    fetch('/api/plays?g=' + PLAY_SLUG).then(function (r) {
      return r.status === 200 ? r.json() : null;
    }).then(function (d) { if (d) showPlays(d.count); }).catch(function () {});
  }
  function countPlay() {
    fetch('/api/plays?g=' + PLAY_SLUG, { method: 'POST', keepalive: true })
      .then(function (r) { return r.status === 200 ? r.json() : null; })
      .then(function (d) { if (d) showPlays(d.count); }).catch(function () {});
  }

  /* ---------------- 起動 ---------------- */
  function boot() {
    state.mode = decideMode();
    // RTAモードで来た人には、開いた時点で0秒のタイマーを見せておく
    if (state.mode === 'rta') previewClock();
    renderAds();
    buildBoard();
    wireSweeper();
    wireResult();
    fetchPlays();

    $('#bait').addEventListener('click', startRun);
    $('#playBtn').addEventListener('click', enterDesk);
    $('#popX').addEventListener('click', function () {
      var p = $('#adPop');
      p.style.transform = 'translateX(6px)';
      setTimeout(function () { p.style.transform = ''; }, 140);
    });
    $('#playOverlay').addEventListener('click', function () {
      if (yt.player && yt.player.playVideo) { try { yt.player.playVideo(); } catch (e) {} }
      $('#playOverlay').classList.remove('on');
    });

    // ?dev=1 のときだけ中身を覗けるようにする（動作確認用）
    if (/[?&]dev=1/.test(location.search)) {
      window.__bk = bk;
      window.__bkField = FIELD;
      window.__bkTick = function (n) {
        for (var i = 0; i < (n || 1); i++) if (!bk.dead && !bk.done) update();
        draw();
      };
    }

    var n = 100000 + Math.floor(Math.random() * 800000);
    $('#counter').textContent = 'あなたは ' + ('000000' + n).slice(-6) + ' 人目の訪問者です';

    window.addEventListener('resize', function () {
      if (!$('#desk').classList.contains('on')) return;
      metrics();
      if (desk.big) { growShot(); return; }
      layoutShot();
      desk.wins.forEach(function (w, i) {
        w.style.width = desk.W + 'px';
        w.querySelector('.body').style.height = desk.VH + 'px';
        if (i >= state.idx) place(w, desk.bx, desk.by);
        else clampLitter(w);
      });
      placePlayer(desk.bx, desk.by);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
