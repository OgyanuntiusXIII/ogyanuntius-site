-- プレイ回数の置き場。1ゲーム1行だけ。
-- 流すのは1回でいい（IF NOT EXISTS なので二度流しても壊れない）
CREATE TABLE IF NOT EXISTS plays (
  g TEXT PRIMARY KEY,
  n INTEGER NOT NULL DEFAULT 0
);
