/* 『Bの意地』のモジュールURLに版を付ける（キャッシュの混在事故を防ぐ）。
 *
 *   node tools/b-no-iji-importmap.mjs <版>      例: node tools/b-no-iji-importmap.mjs 20260912-rivals-2
 *
 * 何をするか：
 *   public/games/b-no-iji/{index,model,scenery}.html の import map を書き直し、
 *   直下の *.js を「./x.js → ./x.js?v=<版>」に写像する。入口の <script src> と style.css の ?v= も同じ版にする。
 *
 * なぜ要るか（2026-09-12 に踏んだ）：
 *   Cloudflare Pages は JS を max-age=14400 で配る。入口の game.js だけ ?v= を変えても、
 *   そこから import される world.js / flight.js は**4時間は古いまま**使われ、新旧のモジュールが混ざって
 *   出撃直後に例外で止まった（「飛び立った瞬間に止まる」）。import map なら各モジュールは相対パスのまま、
 *   ページ側の1か所で全モジュールのURLを一斉に変えられる。vendor/ は変えない（three.js を二重に読み込ませないため）。
 *
 * ゲームのJSを直したら、必ずこのスクリプトで版を上げてからコミットする。
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIR=path.join(ROOT,'public/games/b-no-iji');
const version=process.argv[2];
if(!version||!/^[\w.-]+$/.test(version)){console.error('版を指定する（英数字・ハイフン）。例: 20260912-rivals-2');process.exit(1);}

const modules=fs.readdirSync(DIR).filter(f=>f.endsWith('.js')).sort();
const map={imports:Object.fromEntries(modules.map(f=>[`./${f}`,`./${f}?v=${version}`]))};
const tag=`<script type="importmap">${JSON.stringify(map)}</script>`;

for(const page of ['index.html','model.html','scenery.html']){
 const file=path.join(DIR,page);
 let html=fs.readFileSync(file,'utf8');
 html=html.replace(/<script type="importmap">[\s\S]*?<\/script>/,'');
 const at=html.indexOf('<script type="module"');
 if(at<0){console.error(`${page}: <script type="module"> が無い`);process.exit(1);}
 html=html.slice(0,at)+tag+html.slice(at);
 html=html.replace(/src="([\w-]+\.js)(\?v=[^"]*)?"/g,(m,name)=>`src="${name}?v=${version}"`);
 html=html.replace(/href="style\.css(\?v=[^"]*)?"/g,`href="style.css?v=${version}"`);
 fs.writeFileSync(file,html);
 console.log(`${page}: import map ${modules.length} modules, v=${version}`);
}
