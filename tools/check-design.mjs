// DESIGN.md と global.css がズレていないかを機械で見る。
//   1) DESIGN.md の昼スナップショット == global.css の :root
//   2) DESIGN.md の夜スナップショット == global.css の :root[data-theme="dark"]
//   3) 夜の2ブロックが互いに一致（CLAUDE.md 4.6「片方だけ直さない」の門番）
// 実行: npm run check:design
import { readFileSync } from 'node:fs';

const CSS = 'src/styles/global.css';
const MD = 'DESIGN.md';
const KEYS = ['--paper', '--paper-2', '--ink', '--ink-mid', '--rule', '--hair-rule', '--accent', '--accent-ink'];

// コメントは先に落とす。/* … */ が宣言の区切りに紛れると名前が汚れる
const stripComments = (s) => {
  let out = '', i = 0;
  while (i < s.length) {
    const a = s.indexOf('/*', i);
    if (a < 0) { out += s.slice(i); break; }
    out += s.slice(i, a);
    const b = s.indexOf('*/', a + 2);
    if (b < 0) break;
    i = b + 2;
  }
  return out;
};

const css = stripComments(readFileSync(CSS, 'utf8'));
const md = readFileSync(MD, 'utf8');

// 宣言を素直に切る。--paper-2 が --paper に食われないよう完全一致で見る。
const vars = (body) => {
  const out = {};
  for (const decl of body.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const name = decl.slice(0, i).trim();
    if (KEYS.includes(name)) out[name] = decl.slice(i + 1).trim().toLowerCase();
  }
  return out;
};

// 開き波括弧から対応する閉じ括弧までを取る
const blockAfter = (src, startIdx, label) => {
  if (startIdx < 0) throw new Error(label + ' が見つからない');
  const open = src.indexOf('{', startIdx);
  if (open < 0) throw new Error(label + ' の { が無い');
  let depth = 1, i = open + 1;
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  return src.slice(open + 1, i - 1);
};

const cssBlock = (needle, label) => blockAfter(css, css.indexOf(needle), label);

const mdBlock = (marker) => {
  const label = '<!-- design-tokens:' + marker + ' -->';
  const at = md.indexOf(label);
  if (at < 0) throw new Error('DESIGN.md に ' + label + ' が無い');
  const fence = md.indexOf('```', at);
  if (fence < 0) throw new Error(label + ' の後にコードブロックが無い');
  const bodyStart = md.indexOf('\n', fence) + 1;
  const end = md.indexOf('```', bodyStart);
  return vars(md.slice(bodyStart, end));
};

const problems = [];
const cmp = (a, b, an, bn) => {
  for (const k of KEYS) {
    if (a[k] === undefined) problems.push(an + ' に ' + k + ' が無い');
    else if (b[k] === undefined) problems.push(bn + ' に ' + k + ' が無い');
    else if (a[k] !== b[k]) problems.push(k + ': ' + an + '=' + a[k] + '  ≠  ' + bn + '=' + b[k]);
  }
};

const light = vars(cssBlock(':root {', 'global.css の :root（昼）'));
const darkA = vars(cssBlock(':root[data-theme="dark"]', 'global.css の :root[data-theme="dark"]（夜A）'));
const darkB = vars(cssBlock(':root:not([data-theme="light"])', 'global.css の prefers-color-scheme 側（夜B）'));

cmp(mdBlock('light'), light, 'DESIGN.md(昼)', 'global.css(昼)');
cmp(mdBlock('dark'), darkA, 'DESIGN.md(夜)', 'global.css(夜A)');
cmp(darkA, darkB, 'global.css(夜A)', 'global.css(夜B=prefers)');

if (problems.length) {
  console.error('✗ DESIGN.md と global.css がズレている\n');
  for (const p of problems) console.error('  - ' + p);
  console.error('\n値の正本は global.css。CSSを直したなら DESIGN.md のスナップショットを合わせる。');
  process.exit(1);
}
console.log('✓ DESIGN.md と global.css は一致（' + KEYS.length + 'トークン × 昼/夜、夜の2ブロックも一致）');
