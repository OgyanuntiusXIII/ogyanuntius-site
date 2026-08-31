-- プレイ回数の置き場。1ゲーム1行だけ。
-- 流すのは1回でいい（IF NOT EXISTS なので二度流しても壊れない）
CREATE TABLE IF NOT EXISTS plays (
  g TEXT PRIMARY KEY,
  n INTEGER NOT NULL DEFAULT 0
);

-- サイト全体の閲覧数。行は 'site' の1つだけ
CREATE TABLE IF NOT EXISTS views (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL DEFAULT 0
);

-- 隠しページ（P.000）の突破記録。CLEAR No. はここの no がそのまま出る。
-- ⚠️ AUTOINCREMENT を外さないこと。外すと行を消したとき rowid が再利用され、
--    同じ CLEAR No. が二人に出る。
-- aid は端末の匿名IDのSHA-256。**元のIDは保存しない**
CREATE TABLE IF NOT EXISTS nazo_clears (
  no   INTEGER PRIMARY KEY AUTOINCREMENT,
  aid  TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL,
  at   TEXT NOT NULL
);

-- 同一回線からの連発だけを止める鍵。IPは保存しない（日付を混ぜたハッシュ）
CREATE TABLE IF NOT EXISTS nazo_rate (
  k  TEXT PRIMARY KEY,
  at INTEGER NOT NULL
);
