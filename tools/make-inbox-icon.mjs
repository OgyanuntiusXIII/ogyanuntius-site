/**
 * 受信箱アプリのアイコン（`tools/inbox.ico`）を作る。**一度作れば作り直さなくていい。**
 *
 *   node tools/make-inbox-icon.mjs
 *
 * サイトの favicon（白地に「13」）と同じ家の出だが、**受信箱だと分かるように赤い封を足した。**
 * デスクトップに並んだとき、サイトそのものと取り違えないため。
 *
 * ICO は「PNGをそのまま1枚くるむ」形式で書いている（Vista以降が読める）。
 * sharp は ICO を書き出せないので、ヘッダ22バイトを自分で組む。
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'tools', 'inbox.ico');
const SIZE = 256;

/* 白地・黒の「13」・右下に赤い封筒。誌面の3色（白・黒・赤）から出ない */
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect width="256" height="256" fill="#ffffff"/>
  <rect x="8" y="8" width="240" height="240" fill="none" stroke="#101010" stroke-width="10"/>
  <text x="118" y="150" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"
        font-size="132" font-weight="700" fill="#101010">13</text>
  <g transform="translate(150 150)">
    <rect x="0" y="0" width="92" height="66" fill="#e0301e"/>
    <path d="M0 0 L46 38 L92 0" fill="none" stroke="#ffffff" stroke-width="9"/>
  </g>
</svg>`;

const png = await sharp(Buffer.from(SVG)).resize(SIZE, SIZE).png().toBuffer();

/* ICONDIR(6) + ICONDIRENTRY(16) + PNG。幅と高さの 0 は「256」の意味 */
const head = Buffer.alloc(22);
head.writeUInt16LE(0, 0);        // reserved
head.writeUInt16LE(1, 2);        // 1 = アイコン
head.writeUInt16LE(1, 4);        // 枚数
head.writeUInt8(0, 6);           // 幅  256 → 0
head.writeUInt8(0, 7);           // 高さ 256 → 0
head.writeUInt8(0, 8);           // 色数（0 = 256色超）
head.writeUInt8(0, 9);           // reserved
head.writeUInt16LE(1, 10);       // プレーン数
head.writeUInt16LE(32, 12);      // ビット深度
head.writeUInt32LE(png.length, 14);
head.writeUInt32LE(22, 18);      // PNG の開始位置

writeFileSync(OUT, Buffer.concat([head, png]));
console.log('作った: ' + OUT + '  (' + (head.length + png.length) + " バイト)");
