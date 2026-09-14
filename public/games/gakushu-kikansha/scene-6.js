/* 学習機関車 / TRAINING DATA — 3Dの世界（Three.js r152 UMD）
 * 線路は「分岐して、また合流する」区間の連続。1区間＝1問。
 * 機関車は分岐の手前で止まり、選んだ側へ急加速して看板を跳ね飛ばし、合流して次の分岐へ流れ込む。
 */
(function (root) {
  'use strict';
  const THREE = root.THREE;
  const C = { sky: 0x1b1a17, ground: 0x2c2a24, rail: 0xc8bfa6, sleeper: 0x4a443a, body: 0x121210, red: 0xb8261c, cream: 0xede6d6, yellow: 0xe5b400, lamp: 0xfff1c2 };
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  const SEG_LEN = 66, LEAD_LEN = 46, STOP_D = 5, HALF = 6.5, SIGN_Z = 33, POLE_X = -12;
  const VRUN = 52, ACC_RUN = 110, VCRUISE = 34, ACC_CRUISE = 30, DECEL = 34;

  function routePts(z0, s, len) {
    if (s === 0) { const p = []; for (let d = 0; d <= len; d += 4) p.push(v(0, 0, z0 - d)); return p; }
    return [[0, 0], [0, 4], [0, 8], [0, 12], [0.8, 16], [3.0, 20.5], [5.6, 25], [HALF, 29], [HALF, 33], [HALF, 37], [5.6, 41], [3.0, 45.5], [0.8, 50], [0, 54], [0, 58], [0, 62], [0, 66]]
      .map(([x, dz]) => v(s * x, 0, z0 - dz));
  }
  function srgb(t) { if ('colorSpace' in t && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; else if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding; return t; }
  function curve(pts) { const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); c.arcLengthDivisions = 500; return c; }

  class World {
    constructor(canvas) {
      this.canvas = canvas;
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(C.sky);
      this.scene.fog = new THREE.Fog(C.sky, 60, 170);
      this.camera = new THREE.PerspectiveCamera(44, 1, 0.1, 600);
      this.camLook = v(0, 1, 0);
      this.scene.add(new THREE.HemisphereLight(0xede6d6, 0x1d1b17, 0.95));
      const sun = new THREE.DirectionalLight(0xffe3b0, 0.7); sun.position.set(18, 40, 14); this.scene.add(sun);

      this.mats = {
        rail: new THREE.MeshLambertMaterial({ color: C.rail }),
        sleeper: new THREE.MeshLambertMaterial({ color: C.sleeper }),
        cream: new THREE.MeshLambertMaterial({ color: C.cream }),
        pole: new THREE.MeshLambertMaterial({ color: 0x3a362e }),
        bldA: new THREE.MeshLambertMaterial({ color: 0x24221d }),
        bldB: new THREE.MeshLambertMaterial({ color: 0x3b3830 }),
        wire: new THREE.LineBasicMaterial({ color: 0x5b554a }),
      };
      this.sleeperGeo = new THREE.BoxGeometry(2.4, 0.14, 0.46);
      this.buildGround();

      this.segs = []; this.lastPole = null;
      this.addSegment({ lead: true });
      this.train = this.buildTrain(); this.scene.add(this.train);
      this.smoke = this.buildSmoke();
      this.flying = [];

      this.seg = 0; this.d = 0; this.speed = 0; this.mode = 'title';
      this.time = 0; this.shake = 0; this.hitStop = 0; this.wheelAngle = 0; this.cinematic = null; this.waiters = [];
      this.fast = /[?&]fast=1/.test(location.search) ? 3 : 1;
      this.placeTrain();
      this.clock = new THREE.Clock();
      this.resize(); window.addEventListener('resize', () => this.resize());
      this.loop = this.loop.bind(this); this.lastFrame = performance.now(); requestAnimationFrame(this.loop);
      this.lastTick = performance.now();
      setInterval(() => { const now = performance.now(); if (now - this.lastFrame > 400) { const dt = Math.min(1, (now - this.lastTick) / 1000) * this.fast, n = Math.ceil(dt / 0.04); this.lastTick = now; for (let i = 0; i < n; i++) this.update(dt / n); } }, 200);
    }

    /* ---------- 地面（格子はカメラに追従、格子単位でずらすので止まって見える） ---------- */
    buildGround() {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const g = cv.getContext('2d'); g.fillStyle = '#2a2823'; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#46423a'; g.lineWidth = 2; g.strokeRect(0, 0, 128, 128);
      const tex = srgb(new THREE.CanvasTexture(cv)); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(75, 75);
      tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      this.ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshLambertMaterial({ map: tex }));
      this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = -0.55; this.scene.add(this.ground);
    }

    /* ---------- 区間 ---------- */
    addSegment(opts) {
      opts = opts || {};
      const prev = this.segs[this.segs.length - 1];
      const z0 = prev ? prev.z0 - prev.len : LEAD_LEN;
      const group = new THREE.Group(); this.scene.add(group);
      const sg = { z0, group, lead: !!opts.lead, final: !!opts.final, side: null, def: opts.def == null ? 0 : opts.def, onHit: null, hit: false, signs: [], routes: {} };
      if (sg.lead) {
        sg.len = LEAD_LEN; sg.routes.c = curve(routePts(z0, 0, LEAD_LEN)); sg.side = 'c';
        this.buildTrack(group, sg.routes.c, () => true);
      } else {
        sg.len = SEG_LEN;
        sg.routes[0] = curve(routePts(z0, -1)); sg.routes[1] = curve(routePts(z0, 1));
        this.buildTrack(group, sg.routes[1], () => true);
        this.buildTrack(group, sg.routes[0], p => p.x < -0.45);
        [0, 1].forEach(i => { const s = this.buildSign(); s.position.set((i ? 1 : -1) * HALF, 0, z0 - SIGN_Z); group.add(s); sg.signs.push(s); });
        if (opts.signs) opts.signs.forEach((t, i) => this.drawSign(sg.signs[i], t.head, t.lines));
        sg.indicator = this.buildIndicator(group, z0); this.pointIndicator(sg, sg.def, false);
        if (sg.final) {
          sg.len = 230; sg.routes.c = curve(routePts(z0, 0, 230));
          sg.center = new THREE.Group(); this.buildTrack(sg.center, sg.routes.c, p => p.z < z0 - 12 && p.z > z0 - 54);
          sg.center.visible = false; sg.center.position.y = -1.4; group.add(sg.center);
          const tail = new THREE.Group(); this.buildTrack(tail, sg.routes.c, p => p.z <= z0 - 66); group.add(tail);
        }
      }
      this.scenery(group, z0, sg.len + (sg.lead ? 60 : 0));
      sg.routeLen = {}; Object.keys(sg.routes).forEach(k => { sg.routeLen[k] = sg.routes[k].getLength(); });
      this.segs.push(sg);
      this.prune();
      return this.segs.length - 1;
    }
    prepare(k, signs, opts) {
      while (this.segs.length <= k) this.addSegment(Object.assign({ signs }, opts || {}));
    }
    prune() {
      this.segs.forEach((sg, i) => { if (sg.group && i < this.seg - 1) { this.scene.remove(sg.group); sg.group.traverse(o => { if (o.geometry && o.geometry !== this.sleeperGeo) o.geometry.dispose(); }); sg.group = null; } });
    }

    buildTrack(group, crv, keep) {
      const L = crv.getLength(), N = Math.ceil(L / 0.5), pts = crv.getSpacedPoints(N);
      const left = [], right = [], sl = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N, p = pts[i], tg = crv.getTangentAt(t), n = v(tg.z, 0, -tg.x).normalize();
        left.push(p.clone().add(n.clone().multiplyScalar(0.72))); right.push(p.clone().add(n.clone().multiplyScalar(-0.72)));
        if (i % 2 === 0 && keep(p)) sl.push([p, Math.atan2(tg.x, tg.z)]);
      }
      [left, right].forEach(arr => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arr), N, 0.09, 6, false), this.mats.rail); m.position.y = -0.18; group.add(m); });
      if (sl.length) {
        const inst = new THREE.InstancedMesh(this.sleeperGeo, this.mats.sleeper, sl.length), o = new THREE.Object3D();
        sl.forEach(([p, ry], i) => { o.position.set(p.x, -0.32, p.z); o.rotation.set(0, ry, 0); o.updateMatrix(); inst.setMatrixAt(i, o.matrix); });
        group.add(inst);
      }
    }

    /* 電柱は全線 x=-12（線路の最大幅 ±8.7 の外）。建物は |x|≥24 */
    scenery(group, z0, len) {
      const top = 6.6;
      for (let z = z0 + (len > SEG_LEN ? 60 : 0); z > z0 - len; z -= 12) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 7.2, 6), this.mats.pole); p.position.set(POLE_X, 3.05, z); group.add(p);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.1), this.mats.pole); bar.position.set(POLE_X, top, z); group.add(bar);
        if (this.lastPole !== null && this.lastPole - z < 13) {
          const g = new THREE.BufferGeometry().setFromPoints([v(POLE_X - 0.8, top, this.lastPole), v(POLE_X - 0.8, top, z), v(POLE_X + 0.8, top, this.lastPole), v(POLE_X + 0.8, top, z)]);
          group.add(new THREE.LineSegments(g, this.mats.wire));
        }
        this.lastPole = z;
      }
      for (let z = z0; z > z0 - len; z -= 16) {
        [-1, 1].forEach(side => {
          if (Math.random() < 0.3) return;
          const w = 5 + Math.random() * 9, h = 3 + Math.random() * 16, dd = 5 + Math.random() * 9;
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), Math.random() < 0.6 ? this.mats.bldA : this.mats.bldB);
          b.position.set(side * (24 + w / 2 + Math.random() * 26), h / 2 - 0.5, z - Math.random() * 8); group.add(b);
        });
      }
    }

    buildSign() {
      const g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 0.2), this.mats.cream); post.position.y = 1.1; g.add(post);
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 440;
      const tex = srgb(new THREE.CanvasTexture(cv)); tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      const board = new THREE.Mesh(new THREE.PlaneGeometry(7, 3), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
      board.position.y = 3.6; g.add(board); g.userData = { cv, tex };
      return g;
    }
    drawSign(sign, head, lines) {
      const { cv, tex } = sign.userData, ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
      const F = '"BIZ UDPGothic", "Yu Gothic", "Meiryo", sans-serif';
      const fit = (t, size, max) => { let s = size; do { ctx.font = 'bold ' + s + 'px ' + F; s -= 4; } while (ctx.measureText(t).width > max && s > 20); };
      ctx.fillStyle = '#ede6d6'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#1b1a17'; ctx.lineWidth = 16; ctx.strokeRect(8, 8, W - 16, H - 16);
      ctx.fillStyle = '#b8261c'; ctx.fillRect(16, 16, W - 32, 96);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff7ec'; fit(head, 56, W - 80); ctx.fillText(head, W / 2, 66);
      ctx.fillStyle = '#1b1a17'; const ls = Array.isArray(lines) ? lines : [lines];
      ls.forEach((t, k) => { fit(t, 88, W - 90); ctx.fillText(t, W / 2, ls.length === 1 ? 280 : 212 + k * 124); });
      tex.needsUpdate = true;
    }
    setSigns(k, signs) { const sg = this.segs[k]; if (sg && sg.signs.length) signs.forEach((t, i) => this.drawSign(sg.signs[i], t.head, t.lines)); }

    /* 分岐の手前の転轍標識：何もしなければ進む側を指す */
    buildIndicator(group, z0) {
      const g = new THREE.Group(); g.position.set(2.8, 0, z0 - 8);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 8), this.mats.cream); post.position.y = 1.3; g.add(post);
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
      const tex = srgb(new THREE.CanvasTexture(cv));
      const board = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); board.position.y = 2.9; g.add(board);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 10), new THREE.MeshBasicMaterial({ color: 0xff3b2f })); lamp.position.y = 3.55; g.add(lamp);
      group.add(g); return { cv, tex, lamp };
    }
    pointIndicator(sg, side, chosen) {
      const ind = sg.indicator; if (!ind) return;
      const ctx = ind.cv.getContext('2d');
      ctx.fillStyle = chosen ? '#ede6d6' : '#e5b400'; ctx.fillRect(0, 0, 256, 128);
      ctx.fillStyle = '#1b1a17'; ctx.beginPath();
      const L = side === 0;
      if (L) { ctx.moveTo(30, 64); ctx.lineTo(100, 14); ctx.lineTo(100, 44); ctx.lineTo(226, 44); ctx.lineTo(226, 84); ctx.lineTo(100, 84); ctx.lineTo(100, 114); }
      else { ctx.moveTo(226, 64); ctx.lineTo(156, 14); ctx.lineTo(156, 44); ctx.lineTo(30, 44); ctx.lineTo(30, 84); ctx.lineTo(156, 84); ctx.lineTo(156, 114); }
      ctx.closePath(); ctx.fill(); ind.tex.needsUpdate = true;
      ind.lamp.material.color.set(chosen ? 0x35d06a : 0xff3b2f);
    }

    /* ---------- 機関車・煙 ---------- */
    buildTrain() {
      const g = new THREE.Group();
      const body = new THREE.MeshLambertMaterial({ color: C.body }), red = new THREE.MeshLambertMaterial({ color: C.red }), brass = new THREE.MeshLambertMaterial({ color: 0x8a7a4a });
      const add = (geo, mat, x, y, z, rx, rz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (rx) m.rotation.x = rx; if (rz) m.rotation.z = rz; g.add(m); return m; };
      add(new THREE.BoxGeometry(1.7, 0.5, 4.6), body, 0, 0.25, 0);
      add(new THREE.CylinderGeometry(0.72, 0.72, 2.9, 16), body, 0, 1.15, 0.65, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.76, 0.76, 0.3, 16), red, 0, 1.15, 2.05, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.2, 0.26, 0.9, 10), body, 0, 2.1, 1.5);
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 10), brass, 0, 1.95, 0.2);
      add(new THREE.BoxGeometry(1.8, 1.7, 1.5), body, 0, 1.35, -1.5);
      add(new THREE.BoxGeometry(2.0, 0.12, 1.8), red, 0, 2.28, -1.5);
      add(new THREE.BoxGeometry(1.2, 0.5, 0.06), new THREE.MeshBasicMaterial({ color: 0x3b4a5a }), 0, 1.55, -0.74);
      add(new THREE.BoxGeometry(1.9, 0.5, 0.5), red, 0, 0.05, 2.35, Math.PI / 5);
      add(new THREE.SphereGeometry(0.17, 10, 10), new THREE.MeshBasicMaterial({ color: C.lamp }), 0, 1.5, 2.15);
      const light = new THREE.PointLight(0xffe0a0, 0.9, 16); light.position.set(0, 1.5, 2.6); g.add(light);
      this.wheels = [];
      const wg = new THREE.CylinderGeometry(0.46, 0.46, 0.22, 14);
      [1.1, 0, -1.1, -1.9].forEach(z => [-0.95, 0.95].forEach(x => this.wheels.push(add(wg, red, x, 0.05, z, 0, Math.PI / 2))));
      this.chimney = v(0, 2.55, 1.5);
      return g;
    }
    buildSmoke() {
      const out = [], geo = new THREE.SphereGeometry(0.22, 8, 8);
      for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x8f897f, transparent: true, opacity: 0 })); m.userData.life = -1; this.scene.add(m); out.push(m); }
      return out;
    }
    puff() {
      const m = this.smoke.find(p => p.userData.life < 0); if (!m) return;
      m.position.copy(this.chimney.clone().applyMatrix4(this.train.matrixWorld)); m.scale.setScalar(0.5); m.material.opacity = 0.4; m.userData.life = 0;
      m.userData.drift = v((Math.random() - 0.5) * 0.5, 1.3 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4);
    }

    /* ---------- 操作（game.js から呼ぶ） ---------- */
    begin() { this.mode = 'go'; this.speed = 26; }
    choose(k, side, onHit) {
      const sg = this.segs[k]; if (!sg) return;
      sg.side = side; sg.onHit = onHit; this.pointIndicator(sg, side, true);
      if (this.seg === k && this.d <= 8) this.placeTrain();
    }
    revealCenter() { const sg = this.segs[this.segs.length - 1]; if (sg.center) { sg.center.visible = true; this.reveal = { g: sg.center, t: 0 }; } }
    runCenter() { const sg = this.segs[this.segs.length - 1]; sg.side = 'c'; this.cinematic = null; if (this.seg === this.segs.length - 1 && this.d <= 8) this.placeTrain(); }
    arrived(k) { return new Promise(res => { if (this.seg === k && this.speed === 0 && Math.abs(this.d - STOP_D) < 0.5) res(); else this.waiters.push({ k, res }); }); }
    kick(s) { this.shake = Math.max(this.shake, s || 1); }
    setCinematic(c) { this.cinematic = c; }

    route() { const sg = this.segs[this.seg]; const key = sg.side == null ? sg.def : sg.side; return { crv: sg.routes[key], len: sg.routeLen[key] }; }
    placeTrain() {
      const { crv, len } = this.route(), t = clamp(this.d / len, 0, 1), p = crv.getPointAt(t), tg = crv.getTangentAt(t);
      this.pos = p; this.tan = tg;
      this.train.position.set(p.x, p.y, p.z); this.train.lookAt(p.clone().add(tg));
    }
    distToStop() {
      let dist = 0;
      for (let k = this.seg; k < this.segs.length; k++) {
        const sg = this.segs[k];
        if (sg.side == null) return dist + (k === this.seg ? STOP_D - this.d : STOP_D);
        dist += k === this.seg ? this.route().len - this.d : sg.routeLen[sg.side];
      }
      return Infinity;
    }

    update(dt) {
      if (this.hitStop > 0) { this.hitStop -= dt; dt *= 0.14; }
      this.time += dt;
      if (this.mode !== 'title') {
        const running = this.segs[this.seg].side != null && !this.segs[this.seg].lead;
        const vStop = Math.sqrt(Math.max(0, 2 * DECEL * this.distToStop()));
        const vmax = running ? VRUN : VCRUISE, acc = running ? ACC_RUN : ACC_CRUISE;
        this.speed = Math.min(this.speed + acc * dt, vmax, vStop);
        const toStop = this.distToStop();
        if (toStop < 0.02) this.speed = 0;
        this.d += Math.min(this.speed * dt, Math.max(0, toStop));
        let r = this.route();
        while (this.d >= r.len) {
          if (this.seg + 1 >= this.segs.length) { this.d = r.len; this.speed = 0; break; }
          this.strike(this.segs[this.seg]);   // 1フレームで看板を通り過ぎても、結果は必ず出す
          this.d -= r.len; this.seg++; this.prune(); r = this.route();
        }
        const sg = this.segs[this.seg];
        if (sg.side != null && sg.side !== 'c' && !sg.hit && sg.signs.length && this.train.position.z <= sg.z0 - SIGN_Z + 2.6) this.strike(sg);
        if (this.speed === 0) this.waiters = this.waiters.filter(w => { if (w.k === this.seg) { w.res(); return false; } return true; });
      }
      this.placeTrain();
      this.wheelAngle += (this.speed * dt) / 0.46; this.wheels.forEach(w => { w.rotation.x = this.wheelAngle; });
      if (Math.random() < dt * (this.speed > 1 ? 6 : 1.4)) this.puff();
      this.smoke.forEach(m => { if (m.userData.life < 0) return; m.userData.life += dt; m.position.addScaledVector(m.userData.drift, dt); m.scale.addScalar(dt * 0.35); m.material.opacity = Math.max(0, 0.4 - m.userData.life * 0.22); if (m.userData.life > 1.8) m.userData.life = -1; });
      this.flying = this.flying.filter(f => { f.t += dt; f.vel.y -= 24 * dt; f.obj.position.addScaledVector(f.vel, dt); f.obj.rotation.x += f.spin.x * dt; f.obj.rotation.z += f.spin.z * dt; if (f.obj.position.y < -3 || f.t > 2.2) { f.obj.visible = false; return false; } return true; });
      if (this.reveal) { this.reveal.t = Math.min(1, this.reveal.t + dt * 1.4); const e = 1 - Math.pow(1 - this.reveal.t, 3); this.reveal.g.position.y = -1.4 * (1 - e); if (this.reveal.t >= 1) this.reveal = null; }
      this.updateCamera(dt);
      this.ground.position.set(Math.round(this.camera.position.x / 8) * 8, -0.55, Math.round(this.camera.position.z / 8) * 8);
    }
    strike(sg) {
      if (!sg || sg.hit || sg.side == null || sg.side === 'c' || !sg.signs.length) return;
      sg.hit = true; this.launch(sg.signs[sg.side], sg.side === 0 ? -1 : 1); this.hitStop = 0.2; this.shake = 1;
      if (sg.onHit) { const f = sg.onHit; sg.onHit = null; f(); }
    }
    launch(sign, dir) {
      const wp = new THREE.Vector3(); sign.getWorldPosition(wp);
      this.flying.push({ obj: sign, t: 0, vel: v(dir * (5 + Math.random() * 3), 9 + Math.random() * 3, -22), spin: v(-8 - Math.random() * 4, 0, dir * (3 + Math.random() * 3)) });
    }

    updateCamera(dt) {
      const p = this.pos, tg = this.tan;
      let cp, cl, fov = 42 + this.speed * 0.36;
      if (this.mode === 'title') {
        const a = this.time * 0.18; cp = v(p.x + Math.sin(a) * 15, 6, p.z + Math.cos(a) * 15); cl = v(p.x, 1.4, p.z);
      } else if (this.cinematic === 'final') {
        cp = v(p.x + Math.sin(this.time * 0.3) * 6, 8.5, p.z + 10); cl = v(0, 1.8, p.z - 24); fov = 46;
      } else {
        const k = clamp(this.speed / 28, 0, 1);
        const rest = v(p.x + 1.2, 6.8, p.z + 7.5), restL = v(0, 1.8, p.z - 26);
        const chase = p.clone().sub(tg.clone().multiplyScalar(8.5)).add(v(0, 4.4, 0)), chaseL = p.clone().add(tg.clone().multiplyScalar(16)).add(v(0, 1.2, 0));
        cp = rest.lerp(chase, k); cl = restL.lerp(chaseL, k);
      }
      if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 2.6); cp.add(v((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake * 0.6, 0)); }
      const s = 1 - Math.pow(0.004, dt);
      this.camera.position.lerp(cp, s); this.camLook.lerp(cl, s); this.camera.lookAt(this.camLook);
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 5); this.camera.updateProjectionMatrix();
    }

    resize() {
      const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
      this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    }
    loop() { const dt = Math.min(0.05, this.clock.getDelta()); this.lastFrame = this.lastTick = performance.now(); this.update(dt * this.fast); this.renderer.render(this.scene, this.camera); requestAnimationFrame(this.loop); }
  }
  World.STOP_D = STOP_D;
  root.TrainWorld = World;
})(window);
