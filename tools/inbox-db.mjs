/**
 * お問い合わせの読み書き。**CLI（inbox.mjs）とアプリ（inbox-app.mjs）の共通部分。**
 *
 * D1 へは wrangler 経由でしか触らない。**本人のPCからしか読めない**状態を保つため
 * （管理画面を作らない理由は CLAUDE.md 4.8 / 5節）。
 *
 * ⚠️ **`npx` を呼ばない。** Windows では `npx.cmd` を spawn するのに shell:true が要り、
 *    shell:true だと**空白を含む引数（＝SQL文）がバラバラに分解される。**
 *    2026-09-02 に実際に踏んだ（`Unknown arguments: id,, at,, topic,...`）。
 *    wrangler の実体を node で直に叩けば、シェルを挟まないのでこの問題は起きない。
 *
 * ⚠️ **SQLへ外から来た文字列を入れない。** ここが受けるのは id（整数）だけ。
 *    本文や名前を条件に入れたくなったら、その時点で設計を考え直すこと。
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createRequire } from 'node:module';

/** ESMなので require は自前で作る。node:sqlite を**使うときだけ**読むために要る */
const require = createRequire(import.meta.url);

/** リポジトリのルート。**どこから起動されても効くように**、このファイルの位置から求める */
export const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** `functions/api/contact.js` と `schema.sql` にある DDL と同じもの */
const DDL =
  'CREATE TABLE IF NOT EXISTS contacts (' +
  'id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, topic TEXT NOT NULL, ' +
  'name TEXT, email TEXT, work TEXT, device TEXT, body TEXT NOT NULL, ' +
  'done INTEGER NOT NULL DEFAULT 0); ' +
  'CREATE TABLE IF NOT EXISTS contact_rate (' +
  'k TEXT PRIMARY KEY, at INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 0);';

export const TOPIC = {
  feedback: '感想・応援',
  bug: '不具合報告',
  rights: '権利関係について',
  work: 'お仕事・コラボの相談',
  other: 'その他',
};

/** wrangler.toml の database_name。**正本はあちら**（ここへ二重に書かない） */
function dbName() {
  const m = readFileSync(join(ROOT, 'wrangler.toml'), 'utf8').match(/database_name\s*=\s*"([^"]+)"/);
  if (!m) throw new Error('wrangler.toml に database_name が無い');
  return m[1];
}

function wranglerBin() {
  const p = join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  if (!existsSync(p)) throw new Error('wrangler が入っていない。npm install を先に');
  return p;
}

/** wrangler の --json 出力から結果配列を取り出す。前後に案内文が混ざることがある */
function pick(stdout) {
  const a = stdout.indexOf('[');
  const b = stdout.lastIndexOf(']');
  if (a < 0 || b < 0) return [];
  const out = JSON.parse(stdout.slice(a, b + 1));
  // 複数文を投げたときは最後の結果集合を使う（DDL のぶんを読まないため）
  for (let i = out.length - 1; i >= 0; i--) if (out[i] && Array.isArray(out[i].results)) return out[i].results;
  return [];
}

/**
 * D1（wrangler）を叩く。
 * `--remote` が本番、`--local` は wrangler dev のローカルDB。
 */
function d1(sql, { local }) {
  const r = spawnSync(
    process.execPath,
    [wranglerBin(), 'd1', 'execute', dbName(), local ? '--local' : '--remote', '--json', '--command', sql],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true }
  );
  if (r.status !== 0) {
    const err = (r.stderr || '') + (r.stdout || '');
    const e = new Error(err.trim() || 'wrangler が失敗した');
    e.raw = err;
    throw e;
  }
  return pick(r.stdout);
}

/** 手元のSQLiteファイルを直接見る（開発・控えの確認用）。D1には触らない */
function sqliteStore(path) {
  return {
    kind: 'sqlite',
    label: path,
    query(sql) {
      // 遅延読み込み。SQLiteを使わない普通の経路で experimental 警告を出さないため
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(path);
      try {
        for (const s of DDL.split(';')) if (s.trim()) db.exec(s);
        return /^\s*select/i.test(sql) ? db.prepare(sql).all() : (db.prepare(sql).run(), []);
      } finally {
        db.close();
      }
    },
  };
}

/**
 * 読み書きの入口を作る。
 * @param {{local?: boolean, sqlite?: string|null}} opt
 */
export function openStore(opt = {}) {
  if (opt.sqlite) return sqliteStore(opt.sqlite);
  const local = !!opt.local;
  return {
    kind: local ? 'd1-local' : 'd1-remote',
    label: dbName() + (local ? '（ローカル）' : '（本番）'),
    query(sql) {
      try {
        return d1(sql, { local });
      } catch (e) {
        // 誰もまだ送っていないと表そのものが無い（関数側が受信時に作るため）。
        // **エラーで止めずに、作ってから読み直す。** 0件は0件として出したい
        if (/no such table/i.test(e.raw || e.message || '')) {
          d1(DDL, { local });
          return d1(sql, { local });
        }
        throw e;
      }
    },
  };
}

/** 一覧。`all` が false なら未対応だけ */
export function listContacts(store, { all = false, limit = 50 } = {}) {
  const n = Math.max(1, Math.min(500, Number.parseInt(limit, 10) || 50));
  return store.query(
    'SELECT id, at, topic, name, email, work, device, body, done FROM contacts' +
      (all ? '' : ' WHERE done = 0') +
      ' ORDER BY id DESC LIMIT ' + n
  );
}

/** 対応済みの印を立てる／降ろす。**id は必ず整数へ丸めてから SQL に入れる** */
export function setDone(store, id, done = true) {
  const n = Number.parseInt(id, 10);
  if (!Number.isInteger(n) || n <= 0) throw new Error('id が不正');
  store.query('UPDATE contacts SET done = ' + (done ? 1 : 0) + ' WHERE id = ' + n);
  return n;
}

/** 未対応の件数。アプリの見出しに出す */
export function countPending(store) {
  const r = store.query('SELECT COUNT(*) AS n FROM contacts WHERE done = 0');
  return (r[0] && Number(r[0].n)) || 0;
}

/** ISO(UTC) → 「2026-09-02 15:42 JST」 */
export function jst(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const s = new Date(d.getTime() + 9 * 3600 * 1000).toISOString();
  return s.slice(0, 10) + ' ' + s.slice(11, 16) + ' JST';
}
