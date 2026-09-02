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

-- お問い合わせ（/contact）。**管理画面は作らない。** 読むのは `npm run inbox`。
-- name / email / work / device は任意なので空文字が入りうる。
-- done は対応済みの印（`npm run inbox -- --done <id>` で立てる）。
CREATE TABLE IF NOT EXISTS contacts (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     TEXT NOT NULL,                    -- 受信日時（ISO8601 / UTC）
  topic  TEXT NOT NULL,                    -- feedback | bug | rights | work | other
  name   TEXT,
  email  TEXT,
  work   TEXT,
  device TEXT,
  body   TEXT NOT NULL,
  done   INTEGER NOT NULL DEFAULT 0
);

-- 連投を止める鍵。nazo_rate と同じで**IPは保存しない**（日付を混ぜたハッシュ）。
-- n はその日の受信数。上限を超えたぶんは静かに捨てる
CREATE TABLE IF NOT EXISTS contact_rate (
  k  TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  n  INTEGER NOT NULL DEFAULT 0
);

-- 30 TRAPS に釣られた人の合計時間。行は '30-traps' の1つだけ。
-- ⚠️ **自己申告の数字。** タイムはブラウザが測って送ってくるので水増ししうる。
--    1回の上限（3時間）と1日の回数（20回）は functions/api/traptime.js 側で絞っている。
CREATE TABLE IF NOT EXISTS trap_time (
  k    TEXT PRIMARY KEY,
  ms   INTEGER NOT NULL DEFAULT 0,   -- 合計ミリ秒
  runs INTEGER NOT NULL DEFAULT 0    -- 到達した回数
);

-- 連投を止める鍵。**IPは保存しない**（日付を混ぜたハッシュ）
CREATE TABLE IF NOT EXISTS trap_rate (
  k  TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  n  INTEGER NOT NULL DEFAULT 0
);
