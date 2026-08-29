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
