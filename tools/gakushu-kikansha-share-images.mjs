/**
 * 学習機関車の共有カード（1200×630 JPG）を作る。
 *   node tools/gakushu-kikansha-share-images.mjs
 *
 * 出力（public/games/gakushu-kikansha/）
 *   assets/share/<政策思想>-<守った軸>-<犠牲にした軸>.jpg … 診断の組み合わせごとに1枚（129枚）
 *   assets/share/base.jpg                               … ゲームのページ自体のカード
 *   share-cards.js                                      … 共有ページ（functions/games/gakushu-kikansha/share/[k].js）が読む一覧
 *
 * グラフの形は人それぞれで1万5千通りを超えるので、全部は作らない（本人・2026-09-13「129通りにしよう」）。
 * カードのグラフは、同じ組み合わせになるレバー状態のうち、その平均に一番近い形（代表例）。本人の形そのものではない。
 * 依存は sharp だけ（Astro が持っている）。ゲームの model-N.js を変えたら、これを回し直す。
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME = path.join(ROOT, 'public/games/gakushu-kikansha');
const OUT = path.join(GAME, 'assets/share');

// model-N.js は UMD（ブラウザでも node でも同じ計算）。いちばん新しい版を読む
const modelFile = fs.readdirSync(GAME).filter(f => /^model-\d+\.js$/.test(f)).sort((a, b) => parseInt(b.slice(6)) - parseInt(a.slice(6)))[0];
const mod = {exports: {}};
new Function('module', 'exports', fs.readFileSync(path.join(GAME, modelFile), 'utf8'))(mod, mod.exports);
const M = mod.exports;

/* ---------- 組み合わせを数える ---------- */
const BOOLS = ['permit', 'humanException', 'medical', 'transparency', 'targeting', 'replication', 'levy', 'oss', 'research', 'bigtech', 'styleProtect', 'userLiability'];
const groups = new Map();
for (let mask = 0; mask < 1 << BOOLS.length; mask++) for (const foreignBan of [false, true]) for (const optout of [0, 1, 2]) {
  const s = {foreignBan, optout};
  BOOLS.forEach((b, i) => { s[b] = !!(mask & (1 << i)); });
  if (foreignBan && !s.permit) continue;
  const r = M.radar(s), a = M.archetype(s), key = `${a.id}-${r.top.id}-${r.bottom.id}`;
  if (!groups.has(key)) groups.set(key, {a, top: r.top, bottom: r.bottom, shapes: []});
  groups.get(key).shapes.push(r.axes.map(x => x.value));
}
const representative = shapes => {
  const mean = shapes[0].map((_, i) => shapes.reduce((t, s) => t + s[i], 0) / shapes.length);
  let best = shapes[0], bd = Infinity;
  for (const s of shapes) { const d = s.reduce((t, v, i) => t + (v - mean[i]) ** 2, 0); if (d < bd) { bd = d; best = s; } }
  return best;
};

/* ---------- 絵 ---------- */
const W = 1200, H = 630;
const JP = "'Yu Gothic UI','Yu Gothic','Meiryo','Hiragino Kaku Gothic ProN',sans-serif";
const MIN = "'Yu Mincho','YuMincho','Hiragino Mincho ProN','MS Mincho',serif";
const C = {ground: '#1b1a17', panel: '#26251f', grid: '#3f3c34', ink: '#ece6d6', ink2: '#c0b9a6', muted: '#8e8878', red: '#e8564a', redDeep: '#b8261c', yellow: '#e5b400'};
const esc = t => String(t).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const text = (x, y, size, fill, body, extra = '', font = JP) => `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" fill="${fill}" ${extra}>${esc(body)}</text>`;

function radar(vals, cx, cy, R) {
  const axes = M.AXES, n = axes.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + R * v / 100 * Math.cos(a), cy + R * v / 100 * Math.sin(a)]; };
  const poly = vs => vs.map((v, i) => pt(i, v).map(x => x.toFixed(1)).join(',')).join(' ');
  const out = [];
  [100, 75, 50, 25].forEach(lv => out.push(`<polygon points="${poly(axes.map(() => lv))}" fill="${lv === 100 ? C.panel : 'none'}" stroke="${C.grid}" stroke-width="${lv === 100 ? 2 : 1}"/>`));
  axes.forEach((a, i) => { const [x, y] = pt(i, 100); out.push(`<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${C.grid}" stroke-width="1"/>`); });
  out.push(`<polygon points="${poly(axes.map(a => a.base))}" fill="none" stroke="${C.muted}" stroke-width="2.5" stroke-dasharray="7 7"/>`);
  if (vals) {
    out.push(`<polygon points="${poly(vals)}" fill="${C.red}" fill-opacity=".22" stroke="${C.red}" stroke-width="3.5" stroke-linejoin="round"/>`);
    vals.forEach((v, i) => { const [x, y] = pt(i, v); out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${C.red}" stroke="${C.ground}" stroke-width="2.5"/>`); });
  }
  axes.forEach((a, i) => {
    const [lx, ly] = pt(i, 121), ang = -Math.PI / 2 + i * 2 * Math.PI / n, cos = Math.cos(ang), sin = Math.sin(ang);
    const anchor = cos > 0.15 ? 'start' : cos < -0.15 ? 'end' : 'middle';
    const y0 = sin < -0.5 ? ly - 26 : sin > 0.5 ? ly + 14 : ly - 6;
    a.short.forEach((line, k) => out.push(text(lx.toFixed(1), (y0 + k * 21).toFixed(1), 18, C.ink, line, `font-weight="700" text-anchor="${anchor}"`)));
  });
  return out.join('\n');
}
// 名前は「。」でだけ折る。折れない名前は1行のまま、文字を小さくして収める（「許／可」のように語の途中で折らない）
const nameLines = name => {
  const i = name.indexOf('。');
  return [...name].length > 11 && i > 0 && i < name.length - 1 ? [name.slice(0, i + 1), name.slice(i + 1)] : [name];
};
function frame(inner, vals, legend) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${C.ground}"/><rect width="${W}" height="10" fill="${C.redDeep}"/>
${radar(vals, 300, 322, 158)}
${legend}
${inner}
<rect y="${H - 54}" width="${W}" height="54" fill="${C.yellow}"/>
${text(36, H - 19, 21, C.ground, '#学習機関車　　ogyanuntiusxiii.com/games/gakushu-kikansha', 'font-weight="700"')}
</svg>`;
}
function resultCard(g, vals) {
  const x0 = 600, ls = nameLines(g.a.name), size = Math.min(56, Math.floor(560 / Math.max(...ls.map(l => [...l].length))));
  let y = 158;
  const parts = [text(x0, 86, 22, C.muted, '学習機関車　あなたはこんな総理大臣でした', 'font-weight="700"')];
  ls.forEach(l => { parts.push(text(x0, y, size, C.ink, l, 'font-weight="700"', MIN)); y += Math.round(size * 1.18); });
  y += 18;
  parts.push(text(x0, y, 20, C.muted, '守ったもの', 'font-weight="700"')); y += 40;
  parts.push(text(x0, y, 34, C.ink, g.top.name, 'font-weight="700"')); y += 50;
  parts.push(text(x0, y, 20, C.muted, '犠牲にしたもの', 'font-weight="700"')); y += 40;
  parts.push(text(x0, y, 34, C.red, g.bottom.name, 'font-weight="700"'));
  parts.push(text(x0, H - 72, 16, C.muted, 'グラフは同じ診断になった形の代表例。数値は出典つきの試算です。'));
  const legend = `<line x1="40" y1="44" x2="70" y2="44" stroke="${C.red}" stroke-width="3.5"/>${text(78, 50, 16, C.ink2, 'この診断の代表的な形')}<line x1="250" y1="44" x2="280" y2="44" stroke="${C.muted}" stroke-width="2.5" stroke-dasharray="6 5"/>${text(288, 50, 16, C.ink2, '何もしない場合')}`;
  return frame(parts.join('\n'), vals, legend);
}
function baseCard() {
  const x0 = 600;
  const parts = [
    text(x0, 86, 22, C.muted, '人口100万人の国の3Dトロッコ問題', 'font-weight="700"'),
    text(x0, 186, 88, C.ink, '学習機関車', 'font-weight="700" letter-spacing="4"', MIN),
    text(x0 + 4, 236, 26, C.red, 'TRAINING DATA', 'font-weight="700" letter-spacing="10"'),
    text(x0, 312, 24, C.ink, 'あなたは総理大臣です。', 'font-weight="700"'),
    text(x0, 350, 24, C.ink, '生成AIと創作をめぐる政策を、', 'font-weight="700"'),
    text(x0, 388, 24, C.ink, '30秒ずつ決めてください。', 'font-weight="700"'),
    text(x0, 446, 20, C.ink2, 'どちらを選んでも、誰かが何かを払います。'),
    text(x0, H - 72, 16, C.muted, '数値は出典つきの試算です。'),
  ];
  const legend = `<line x1="40" y1="44" x2="70" y2="44" stroke="${C.muted}" stroke-width="2.5" stroke-dasharray="6 5"/>${text(78, 50, 16, C.ink2, '何もしない場合の形')}`;
  return frame(parts.join('\n'), null, legend);
}

/* ---------- 書き出し ---------- */
fs.mkdirSync(OUT, {recursive: true});
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.jpg')) fs.unlinkSync(path.join(OUT, f));
const jpg = svg => sharp(Buffer.from(svg)).jpeg({quality: 86, mozjpeg: true});
const cards = {};
for (const [key, g] of [...groups.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)) {
  await jpg(resultCard(g, representative(g.shapes))).toFile(path.join(OUT, key + '.jpg'));
  cards[key] = {a: g.a.name, top: g.top.name, bottom: g.bottom.name, n: g.shapes.length};
}
await jpg(baseCard()).toFile(path.join(OUT, 'base.jpg'));
fs.writeFileSync(path.join(GAME, 'share-cards.js'),
  `// tools/gakushu-kikansha-share-images.mjs が書き出す。手で直さない（${modelFile} から ${Object.keys(cards).length} 通り）\nexport const CARDS = ${JSON.stringify(cards, null, 1)};\n`);
const bytes = fs.readdirSync(OUT).reduce((t, f) => t + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`${Object.keys(cards).length} 枚 + base.jpg を書き出しました（計 ${(bytes / 1048576).toFixed(1)} MB）: ${path.relative(ROOT, OUT)}`);
