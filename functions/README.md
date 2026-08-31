# プレイ回数カウンター（Cloudflare Pages Functions + D1）

`functions/` は Cloudflare Pages が自動で拾う。Astro 側の設定は不要で、サイトは静的のまま。

## 繋ぐまでにやること（一度きり・ダッシュボードで2分）

1. Cloudflare ダッシュボード → **Workers & Pages → D1** → データベースを作る（名前は何でもよい）
2. そのデータベースの **Console** で次を1回流す

   ```sql
   CREATE TABLE IF NOT EXISTS plays (g TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0);
   ```

3. **Pages プロジェクト → Settings → Bindings → D1 database binding** を追加
   - Variable name: `DB`
   - D1 database: さっき作ったもの
4. 再デプロイ（次の push でよい）

繋ぐまでは API が 204 を返すので、**作品ページにプレイ数の欄は出ない**。繋いだ瞬間から数え始める。

## 無料枠（2026-08-30 時点で確認）

| | D1 無料枠 |
|---|---|
| 書き込み | 100,000 行/日 |
| 読み取り | 5,000,000 行/日 |
| 保存 | 5 GB |

1プレイ＝1書き込みなので、**1日10万プレイまで無料**。
（KVは書き込み1,000/日しかなく、同時アクセスで数え落とすので採用しなかった）

## 数える対象を増やすとき

`functions/api/plays.js` の `GAMES` に slug を足す。ここに無い名前は 400 で弾く。

---

## P.000（隠しページ）の採番と照合 — `functions/api/nazo.js`

同じ D1（`DB`）を使う。**表は自動で作られる**ので、手で SQL を流す必要はない
（`schema.sql` にも同じ DDL を書いてあるが、関数側が `CREATE TABLE IF NOT EXISTS` を撃つ）。

| | |
|---|---|
| `POST /api/nazo` | body `{a: 解答, id: 端末の匿名ID}` → 正解なら `{ok:true, no, code, at}` |
| `GET /api/nazo?no=&code=` | → `{valid:true, no, at}` / `{valid:false}` |

- **正解の平文はここに無い。** 持っているのは SHA-256 だけ
- `nazo_clears.no` が CLEAR No.。**`AUTOINCREMENT` を外さない**（外すと番号が再利用される）
- `nazo_rate` は同一回線からの連発を5分だけ止めるための表。**IPは保存していない**
  （「日付＋IP」のハッシュなので、日をまたげば元の回線とは結びつかない）
- 1突破あたりの書き込みは2行。無料枠（10万行/日）から見て無視できる

中身の方針は リポジトリの `CLAUDE.md` 4.7節。
