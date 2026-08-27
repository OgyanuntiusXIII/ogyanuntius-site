# CLAUDE.md — オギャヌンティウス十三世 公式サイト

このリポジトリで作業するときのルール。**推測で構造を決めないこと。ここに書いてある通りにやる。**

正本の仕様書：[`docs/仕様書.md`](docs/仕様書.md)
企画の経緯：Vault の `企画書/公式サイト_Web作品企画.md`（決断は ⑦ #118）

---

## 0. このサイトが何なのか

**一冊の雑誌。** ポートフォリオではない。現在は **VOL.01 / 創刊号**、テーマは
**「やりたいこと、全部やる」**。デザインは **遠目はファッション誌70% / 近づくとコロコロ30%**。

> [!IMPORTANT] 絶対に守るルール
> | 対象 | 方針 |
> |---|---|
> | **表紙（`src/pages/index.astro`）とその演出** | **インパクト最優先。** 可読性より「何これ？」を優先してよい |
> | **それ以外すべて** | **演出より可読性を優先。** 読みやすい・探しやすい・操作しやすい |
>
> 迷ったら一般的なポートフォリオテンプレートへ寄せず、**「一冊の雑誌である」**で判断する。

---

## 1. 情報の流れ（二層構造。直結させない）

```
MyBrain（Vault）        ← 情報源。実測値・失敗・プロンプト全文が入る私的メモ
    ↓ Claude が mybrain MCP で読んで「翻訳」する
src/content/*.md        ← 公開版。frontmatter付きの読ませる文章
    ↓ git push
Cloudflare Pages
```

> [!WARNING] Vault の文章をそのまま貼らない
> 開発記録には失敗・愚痴・プロンプト全文が入っている。**公開文とは粒度が別物。**
> 必ず読み直して、公開用に書き直すこと。

Vault の絶対パス：`C:\Users\owner\Documents\Obsidian\MyBrain`
`mybrain` MCP（`search_notes` / `read_note`）がこのリポジトリからも使える。

---

## 2. 更新レシピ（自然言語の指示 → 実際の手順）

### 「新しい作品を Works に追加して」

1. `mybrain` MCP で該当の開発記録を探して読む（`開発/開発済み記録/…`）
2. 画像を `public/images/works/<slug>-thumb.svg` と `-hero.svg` に置く
   （まだ無ければプレースホルダーでよい。**ファイルが無いとビルドが落ちる**）
3. `src/content/works/<slug>.md` を作る（必須項目は §3）
4. **表紙に出すなら** `src/content/issues/vol01.md` の `headlines` へ追記する
   → ここを飛ばすと表紙に出ない。**表紙のコードは触らない**
5. `npm run build` を通す（**通らないものを報告しない**）
6. 差分を見せてから commit

### 「今月の制作物を更新して」

`src/content/news/YYYY-MM-DD-<slug>.md` を1件足す。`kind` は
`release` / `update` / `video` / `blog` / `other` から選ぶ。

### 「この作品を NOW MAKING から公開済みに移して」

1. `src/content/nowmaking/<slug>.md` を削除
2. `src/content/works/<slug>.md` の `status` を `published` に、`date` を公開日に
3. `src/content/news/` に `kind: release` を1件足す
4. 表紙に出すなら `issues/vol01.md` の `headlines` へ

### 「表紙の画像を差し替えて」／画像を1枚渡されたとき

**縦横比は気にしなくていい。** 誌面の枠が縦長で、`object-fit: cover` が合わせる。

1. 画像を `public/images/cover/<vol>-main.<拡張子>` へ置く
2. `src/content/issues/<vol>.md` の `mainVisual` をそのパスに書き換える
3. `mainVisualAlt` を書き直す（**altは必須**。無いとビルドが落ちる）
4. `mainVisualFocus` で「どこを見せるか」を決める（例 `50% 30%` で上寄り）
   → 人物の顔が枠から切れるのを防ぐ。**渡された画像の構図を見てから決める**
5. `npm run build`

損しにくいのは**縦長〜正方形**の画像。極端な横長は左右が大きく切られる。

### 「VOL.02 を作って」

1. `src/content/issues/vol01.md` の `current` を `false` に
2. `src/content/issues/vol02.md` を新規作成（`current: true`）
3. **表紙のコードは触らない。** 号はデータなので、これだけで切り替わる

---

## 3. コンテンツの決まり

### `src/content/works/*.md` ・ `src/content/scenarios/*.md`

```yaml
title:        # 作品名
catch:        # 表紙・目次に出る煽り。40字まで（超えると誌面が壊れる）
category:     # app | game | scenario | video | blog | other
date:         # YYYY-MM-DD（公開日）
status:       # published | making | ended
priceType:    # free | paid | donation | unknown
thumbnail:    # /images/... （public/ 配下に実在すること）
heroImage:    # /images/...
description:  # 10〜160字。OGPとmeta descriptionに使う
links:        # [{ label, url }]  url は http(s) の完全なURL
tags:         # [文字列]
ogImage:      # 任意。無ければ thumbnail が使われる
```

ファイル名がそのまま URL の slug になる（`desk-takko.md` → `/works/desk-takko`）。

### `src/content/issues/*.md` — **表紙はここで組む**

`headlines[]` の `slot` が誌面の置き場所：

| slot | 位置 |
|---|---|
| `lead` | 左・大きい主役の見出し |
| `upper` / `side` | 右カラム |
| `lower` | 左下の小さい導線 |
| `strip` | 最下部の帯 |

`ref` は works / scenarios の slug。`collection: page` にすると `/about` のような
任意パスも書ける。**`ref` が解決できないとビルドが落ちる**（意図的な安全弁）。

---

## 4. 安全弁

`src/content.config.ts` の zod スキーマが、次を**ビルド時に落とす**：

- 必須項目の欠落・型違い
- `catch` が40字超
- **`thumbnail` / `heroImage` が `public/` に実在しない**
- `issues` の `headlines.ref` が存在しない作品を指している

> [!WARNING] CLAUDE.md（ユーザーメモリ）5節
> **「保存した」「動いた」と報告する前に、ツールの実行結果を確認する。**
> このリポジトリでは `npm run build` の成功がその確認にあたる。**通してから報告する。**

ルールを緩めたくなったら、緩める前に理由を本人へ言うこと。

---

## 4.5 表紙の調整つまみ

`src/styles/global.css` の変数を触るだけで誌面の見え方が変わる。**表紙のコードは触らない。**

| 変数 | 意味 |
|---|---|
| `--page-ratio` | 誌面の判型。既定 `1 / 1.3`（A4は `1 / 1.414`） |
| `--ground` | 誌面が置かれている地の色 |

表紙の中の寸法はすべて **`cqw`（誌面の幅基準）**。ビューポート基準ではないので、
画面サイズが変わっても構図の比率は崩れない。`vw` を持ち込まないこと。

## 5. やらないこと

- 表紙以外に派手な演出を足す（**メリハリが死ぬ**）
- 日本語ウェブフォントの読み込み（数MB級。決定パターン4「軽さ＝継続可能性」）
- 巨大JSライブラリ・3Dページめくり（仕様書10章・21章）
- 会員登録 / コメント / CMS / 独自バックエンド / 管理画面（仕様書24章）
- 表紙の見出しをコンポーネントへベタ書きする（「作品追加＝md1件」が壊れる）
- URLやアカウント名を**推測で埋める**（`src/data/site.ts` の TODO は空のまま置く）

---

## 6. コマンド

```bash
npm run dev      # ローカル確認 http://localhost:4321
npm run build    # astro check + build。ここが通らないものは出さない
npm run preview  # ビルド結果の確認
```

---

## 7. 未確定（本人に聞かないと埋められない）

- **X / GitHub / YouTube の URL** → `src/data/site.ts` の `LINKS`
- **BOOTH の各商品URL**（分かっているのは『雨降る最後の時間に』のみ）
- **CONTACT の手段** → `src/pages/about.astro`
- **メインビジュアル**（キャラクター集合写真）→ `public/images/cover/vol01-main.svg` を差し替え
- **ドメイン `ogyanuntiusxiii.com`** → **今は買わない。** 無料サブドメインで公開してから判断
