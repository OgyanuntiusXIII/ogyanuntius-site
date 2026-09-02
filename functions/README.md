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

---

## お問い合わせ — `functions/api/contact.js`

同じ D1（`DB`）を使う。**表は自動で作られる**ので、手で SQL を流す必要はない
（`schema.sql` にも同じ DDL がある）。

| | |
|---|---|
| `POST /api/contact` | body `{topic, body, name?, email?, work?, device?, t?, fax?}` → `{ok:true}` |

- **溜めるだけ。返信もメール送信もしない。** 読むのは **`npm run inbox`**（`tools/inbox.mjs`）
- **管理画面は作らない**（`CLAUDE.md` 5節）。読み書きは wrangler 経由で本人のPCからだけ
- **IPは保存していない。** 連投を止める鍵は nazo と同じ「日付＋IP」のハッシュ
- 迷惑メール対策は**静かに捨てる**で統一（蜜壺 `fax` ／ 3秒未満の送信 ／ 1日12件超）。
  **捨てたことを相手に教えない**（教えると条件を1つずつ外して通るまで試せる）
- **D1が無いときは `{ok:true, offline:true}`。** 画面はこれを「送信しました」と出さず、
  Xへ誘導する。**受け取れていないものを受け取ったことにしない**
- 1件あたりの書き込みは2行（本体＋レート）。無料枠（10万行/日）から見て無視できる

### 読む

**普段はデスクトップの「お問い合わせ受信箱」を押す。** 端末から読むなら：

```bash
npm run inbox                 # 未対応のものを新しい順に
npm run inbox -- --all        # 対応済みも
npm run inbox -- --done 12    # id=12 を対応済みにする
npm run inbox -- --undone 12  # 取り消す
npm run inbox:app             # 画面版を起動して既定のブラウザを開く
```

初回は `npx wrangler login` が要る。

| ファイル | 役目 |
|---|---|
| `tools/inbox-db.mjs` | **読み書きの共通部分。** wrangler を叩くのはここだけ |
| `tools/inbox.mjs` | 端末版 |
| `tools/inbox-app.mjs` | 画面版。`127.0.0.1` にだけ口を開く |
| `tools/inbox-app.cmd` | 起動用。**ASCIIだけで書く**（cmd が日本語を壊すため） |
| `tools/make-inbox-icon.mjs` | アイコン生成（`npm run inbox:icon`）。一度作れば要らない |
| `tools/make-inbox-shortcut.ps1` | デスクトップへショートカット（`npm run inbox:shortcut`） |

> [!WARNING] `npx` を spawn しない（2026-09-02 に踏んだ）
> Windows では `npx.cmd` を起動するのに `shell:true` が要り、**そうすると空白を含む引数
> （＝SQL文）がシェルに分解される。** `Unknown arguments: id,, at,, topic,...` で落ちた。
> `node node_modules/wrangler/bin/wrangler.js …` と実体を直に叩けば、シェルを挟まない。

> [!WARNING] 画面版は「管理画面」ではない
> 5節で禁じているのは**サイト上に置く**読み取り口のこと。こちらは `127.0.0.1` にしか
> 待ち受けず、公開サイトには1バイトも足していない。**`0.0.0.0` に変えないこと。**
> 起動ごとの合言葉（token）も外さない。**外すと、本人が見ている別のWebページから
> `127.0.0.1` 経由で中身を読めてしまう。**

### 届いたことの通知（Discord Webhook）— **2026-09-02 に繋がった**

`CONTACT_WEBHOOK`（Pages のシークレット）があると、1件受けるたびに
「届いた」とだけ投げる。**本文は送らない**（`/privacy` の「第三者へ渡さない」を守るため）。
未設定なら何も起きない。飛んだかどうかは `npm run inbox -- --ops`。

```bash
npx wrangler pages secret put CONTACT_WEBHOOK --project-name ogyanuntius-site
```

> [!WARNING] ここで半日溶かした。**同じ轍を踏まないための3つ**
> 1. **シークレットを変えたら必ずデプロイし直す。** 既存のデプロイには反映されない
>    （ビルド時に焼き込まれる）。入れ直しても古い値のまま動き続ける。空コミットでよい
> 2. **プロンプトへ `Ctrl+V` で貼らない。** 貼り付けではなくキー入力そのもの（U+0016）が
>    1文字だけ保存され、`Invalid URL` で静かに落ちる。**右クリック**か `Ctrl+Shift+V`。
>    Enter前に **`*` の数**を見る。1個なら失敗している
> 3. **通知を `waitUntil` に載せない。** 載せたら Discord にも届かず、
>    **D1 の `ops` にも1行も残らなかった**（応答後の処理が走っていない）。`await` して返す
>
> - **例外メッセージをそのまま `ops` に残さない。** `Invalid URL: <値>` の形で
>   シークレットの中身がD1に残った（削除済み）。残すのは種類と「形」だけ
> - `wrangler pages deployment tail` は**このプロジェクトでは使えない**
>   （「このデプロイには Function が無い」と拒む。実際には動いている）。
>   **だから `ops` 表に書いて読む。**

なお `wrangler.toml` があるとダッシュボード側の環境変数は無視されるが、
**`wrangler pages secret put` のシークレットは効く**（2026-09-02 実測）。
