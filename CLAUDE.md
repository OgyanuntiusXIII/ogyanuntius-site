# CLAUDE.md — オギャヌンティウス十三世 公式サイト

このリポジトリで作業するときのルール。**推測で構造を決めないこと。ここに書いてある通りにやる。**

正本の仕様書：[`docs/仕様書.md`](docs/仕様書.md)
企画の経緯：Vault の `企画書/公式サイト_Web作品企画.md`（決断は ⑦ #118）

---

## 0. このサイトが何なのか

> [!IMPORTANT] 表紙の構成は **`v1.0-base` で確定した**（本人・2026-08-27「これを基本の形にしよう」）
> 誌面の3カラム、中央の一冊、誌名の組み、情報ブロックの配置は**完成形**。
> **頼まれていないのに作り直さない。** 変えるのは中身（`src/content/`）のほうだけ。
> どうしても構成を触る必要が出たら、先に理由を言って確認を取る。
> 戻したくなったら `git diff v1.0-base` で差分が見える。


**一冊の雑誌。** ポートフォリオではない。現在は **VOL.01 / 創刊号**、テーマは
**「やりたいこと、全部やる」**。デザインは **遠目はファッション誌70% / 近づくとコロコロ30%**。

> [!IMPORTANT] 見た目を触る前に `DESIGN.md` を読む
> 色・組み・版面の**契約**はリポジトリ直下の **`DESIGN.md`** にある（`public/games/*` も対象）。
> **値の正本は `src/styles/global.css`。** DESIGN.md はその写しなので、
> 食い違ったらCSSが勝つ。ズレは `npm run check:design` が落とす。
> ここ（CLAUDE.md）に残しているのは**このサイト固有の罠と手順**であって、設計言語ではない。

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

Vault へは **`mybrain` MCP**（`search_notes` / `read_note` / `get_bearings`）で読む。
**絶対パスはこのファイルに書かない**（public なので誰でも読める）。

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

1. **画像を webp へ変換して** `public/images/cover/<YYYY-MM>-main.webp` へ置く
   ```bash
   node -e "require('sharp')('元画像.png').resize({width:1200,withoutEnlargement:true}).webp({quality:86}).toFile('public/images/cover/2026-09-main.webp')"
   ```
   → 実測で **2.0MB の PNG が 151KB になった（92%減）**。仕様書21章「表紙のために
   サイト全体を重くしない」。`sharp` は Astro が持っているので追加インストールは要らない
2. `src/content/issues/<vol>.md` の `mainVisual` をそのパスに書き換える
3. `mainVisualAlt` を書き直す（**altは必須**。無いとビルドが落ちる）
4. `mainVisualFocus` で「どこを見せるか」を決める（例 `50% 30%` で上寄り）
   → 人物の顔が切れるのを防ぐ。**渡された画像の構図を見てから決める**
5. `coverInk` を決める — 明るい画像なら `dark`、暗い画像なら `light`
   → 一冊の上に重なる題字・VOL表記・バーコードの色。**推測せず、実際に測る**：
   ```bash
   node -e "const s=require('sharp');const f='public/images/cover/2026-09-main.webp';(async()=>{const m=await s(f).metadata();const w=Math.round(m.height/1.32),l=Math.round((m.width-w)/2);for(const[n,a,b]of[['上',.045,.095],['題字',.10,.225],['下',.87,.96]]){const t=Math.round(m.height*a),h=Math.round(m.height*(b-a));const buf=await s(f).extract({left:l,top:t,width:w,height:h}).greyscale().toBuffer();console.log(n,(await s(buf).stats()).channels[0].mean.toFixed(0))}})()"
   ```
   → 各帯の平均輝度が出る。**目安：170超なら `dark`、110未満なら `light`**
   ⚠️ `extract().stats()` と繋ぐと **stats は入力画像全体を見てしまう**。
   必ず `toBuffer()` を挟むこと（一度これで誤った測定を報告した）
6. `npm run build`

損しにくいのは**縦長〜正方形**の画像。極端な横長は左右が大きく切られる。

### 「ブログ更新して」「愚痴書いて」 → **愚痴板モードに入る**

> [!IMPORTANT] `/blog` は「クロウちゃんの愚痴」（2026-08-31 転換）
> **語り手はクロウちゃん（AI）自身。** 本人の代筆ではない。一人称は「私」。
> 結論先行のまま、作業中に実際にあったことを愚痴る。既定は `by: クロウちゃん`。
> **本人が自分で書くときだけ `by: 本人`。**
>
> **唯一のルールは「嘘を書かないこと」。** 失敗談を盛らない。確かめていないことを書かない。
> 面白くするために事故を創作したら、この欄の建て付けごと壊れる。
> コミットハッシュ・実測値・本人の発言は、**必ず現物を確認してから**引用する。

> [!IMPORTANT] いきなり書き始めない
> 本人の指示（2026-08-27）：「**ブログ更新モードになって、接続してどう更新するか聞くモード**」。
> **まず素材を集めて、選択肢を出して、聞く。** 書くのはそのあと。

**手順（この順を飛ばさない）**

1. **接続して素材を集める**（この時点では何も書かない）
   - `mybrain` MCP の `get_bearings` で現在地
   - `search_notes` / `read_note` で直近の開発記録・日記・決断ログ
   - `git log --oneline -20` でこのリポジトリの直近の動き
   - `src/content/blog/` の既存記事（**同じ話を二度書かない**）
2. **候補を3つ前後に絞って提示する。** 1件ごとに：
   - 仮タイトル ／ 何を書くか一行 ／ **元ネタのVaultパスまたはコミット**
   - 出せない情報（未公開の作品・失敗の生ログ・プロンプト全文）が混ざるなら**そう言う**
3. **聞く**（この4つ。勝手に決めない）
   | 聞くこと | 例 |
   |---|---|
   | どれを書くか | 候補1〜3 ／ 別のこと |
   | 長さ | 短め（〜800字）／ 普通（〜1500字）／ 長め |
   | 文体 | **愚痴（既定・クロウちゃん名義）** ／ 淡々と技術記事 ／ 本人名義（`by: 本人`） |
   | 不満度 | 1〜5（誌面に ●●●○○ で出る） |
   | 出し方 | すぐ公開 ／ **`draft: true` で下書き** |
4. **書く。** 文体を寄せるなら `anthropic-skills:sentimental-nihilism` スキルを使う
5. `src/content/blog/YYYY-MM-DD-<slug>.md` を作る（項目は §3）
6. `npm run build` を通し、**本文を見せてから** commit する

**Vault の文章をそのまま貼らない。** 開発記録には失敗・愚痴・プロンプト全文が入っている。
必ず読み直して公開用に書き直す（§1 の二層構造）。

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

### 紹介ムービー（`youtubeId`）

works / scenarios の frontmatter に `youtubeId`（`watch?v=` のあとの11文字）を書くと、
作品ページのメインビジュアルが**再生ボタン付きになる**。

> [!IMPORTANT] 押されるまでYouTubeを読み込まない
> ページを開いた時点では**手元の画像だけ**。`<iframe>` は存在しない（実測: 0個）。
> 押して初めて `youtube-nocookie.com` の iframe を作る。
> **重さは 546 バイトのインラインスクリプトだけ。**
> 普通に `<iframe>` を貼ると、再生しなくても1MB前後を読み込むことになる。
> 決定パターン4（軽さ＝継続可能性）に反するので、**普通の埋め込みに戻さない。**

X（Twitter）の埋め込みは**入れない**（2026-08-28 判断）。スクリプトが重く、
ポストを消すとページが壊れ、NEWS が既に同じ役割を果たしているため。

### `src/content/blog/*.md`

```yaml
title:
date:          # YYYY-MM-DD
description:   # 10〜160字。一覧と meta description に出る
relatedTo:     # 任意。works / scenarios の slug
tags:          # [文字列]
draft:         # true の間は一覧にもURLにも出ない（既定 false）
heroImage:     # 任意。/images/... （public/ に実在すること）
by:            # クロウちゃん | 本人（既定 クロウちゃん）
mood:          # 1〜5。不満度。既定 3。`by: 本人` のときは表示されない
```

`by: クロウちゃん` の記事には、末尾に定型文
**「※この記事もクロウちゃんが書かされています。発行の責任は〜にあります」** が自動で付く
（`src/pages/blog/[slug].astro`）。本文の最後に自分で書かないこと。**二重に出る。**

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

## 4.4 中央の一冊（`.mag`）

表紙の中央にあるのは**画像ではなく一冊の雑誌**。

> [!IMPORTANT] 誌名とサイト名は別物
> | | 名前 | どこに出るか |
> |---|---|---|
> | サイト | **オギャヌンティウス十三世** | 誌面の題字（`.cover__title`） |
> | 雑誌 | **月刊 OGYANUN** | 一冊の上（`magTitleJp` / `magTitleEn`） |
>
> 一冊の上にサイト名を刷ると**中途半端に本っぽいだけ**になる（2026-08-27 実際にそうなった）。

> [!WARNING] 全面スクリムを広げない
> 一時、下から74%まで白いグラデを乗せていて、**被写体の顔にモヤがかかった**
> （2026-08-27・本人「二人の顔がもうもやはいってる！！もったいない！」）。
> スクリムは **88%以下だけ**。見出しの可読性は全面を白ませるのではなく、
> **見出し自身の白帯（`.mag__lines li` の `--mag-plate`）**で取る。
> 白帯は文字の幅ぶんしか出ないので、顔を隠さない（実測：幅は誌面の38〜52%）。

「本らしさ」を作っているのは次の4つ。**減らすと途端に画像に戻る。**

1. **誌名がサイト名と別**（上の表）
2. **表紙に刷られた見出し**（`coverLines`）— これが無いと雑誌に見えない
3. **背表紙の陰**（`.mag__spine`）— 左端の縦グラデ。物体らしさの大半はここ
4. **影を右下だけに落とす** — 左は綴じられているので影を出さない

- 判型は `--mag-ratio`（既定 `1 / 1.32`）。`src/styles/global.css`
- `coverLines` は**最大4本・1本24字まで**（超えるとビルドが落ちる）。
  **本数は画像しだい。** 白帯が顔に乗る（2026-08-27 に3本で乗った）。画像を替えたら測る：
  ```bash
  node -e "const s=require('sharp');const f='public/images/cover/2026-09-main.webp';(async()=>{const m=await s(f).metadata();const V=Math.round(m.width*1.32),x=Math.round(m.width*.08);for(let p=.6;p<.95;p+=.03){const t=Math.round(V*p),h=Math.round(V*.03);const b=await s(f).extract({left:x,top:t,width:Math.round(m.width*.5)-x,height:h}).greyscale().toBuffer();const c=(await s(b).stats()).channels[0];console.log((p*100).toFixed(0)+'% mean='+c.mean.toFixed(0)+' sd='+c.stdev.toFixed(0)+(c.mean>190&&c.stdev<52?' ✓置ける':''))}})()"
  ```
  **sd が高い帯＝顔や模様。そこに白帯を置かない。** この画像では顔66-75% / 置ける78-90%
- 一冊の上と誌面で**同じ文言を出さない**。`theme` は誌面に巨大に出ているので
  `coverLines` へ重ねて入れない（2026-08-27 に重複していた）
- `magTitleEn` を長くすると誌名が枠を超えて**黙って切れる**。
  変えたら `.mag__masthead-en` の `font-size`（既定 `13cqw`）で詰めること
- バーコードは背景の縞（`repeating-linear-gradient`）。**画像ファイルではない**
- 中の寸法は `cqw`（**一冊の幅基準**）。誌面側の `vw` とは独立しているので、
  ここを触っても表紙のレイアウトは動かない。**逆も同じ**
- 重ねた文字は誌面側に同じ情報があるので `aria-hidden="true"`（仕様書20章）

**画像を1枚渡されたら、ここが更新される。** 手順は §2「表紙の画像を差し替えて」。

## 4.5 表紙について

表紙はビューポート全体を誌面として使う（`.cover` が `min-height:100svh` のグリッド）。
**この横長のまま使うのが本人の判断**（2026-08-27「さっきみたいなサイトのテイストは唯一無二」）。
縦長の判型へ収める案は一度実装して**却下された**。戻さないこと。

雑誌らしさは**中央のメインビジュアル側**で作る。表紙の骨格レイアウトは触らない。

## 4.6 昼と夜（ダークモード）

**2026-08-30 追加。** 柱（rail）の右端のボタン1つで切り替わる。

| どこ | 何が入っているか |
|---|---|
| `src/styles/global.css` | **色の正本。** 昼の `:root` と、夜の2ブロック |
| `src/components/ThemeToggle.astro` | ボタン。**JSは無い。**今どちらかはCSSで出し分ける |
| `src/layouts/Base.astro` の head | 付け外しするスクリプト。**head から動かさない** |

> [!WARNING] 色をベタ書きしない
> 新しい色が要るときは **`global.css` のトークンへ足す。**
> ページ側の `.foo { color: #333 }` は、夜にしたとき**そこだけ昼のまま取り残される。**
> 実際、細い罫が `#ddd` / `#e2e2e2` / `#e6e6e6` と3か所に散っていた（→ `--hair-rule`）。
>
> **色を変えたら `npm run check:design`。** `DESIGN.md` のスナップショットとのズレ、および
> **夜の2ブロックの片側だけ直した事故**を機械が落とす（下の「2か所に書いてある」の門番）。

- **夜の値は同じものを2か所に書いてある。片方だけ直さない**
  （`:root[data-theme="dark"]` と `@media (prefers-color-scheme: dark)`）。
  `light-dark()` なら1か所で済むが、非対応ブラウザで色が全部無効値になって読めなくなる
- **中央の一冊（`.mag`）は刷り色を固定してある。** 印刷された物体なので昼夜で色が動くと嘘になる。
  `.mag--dark` / `.mag--light` は**画像の明るさに対する刷り色**の話で、こことは無関係（4.4節）
- 何も押していない人は **OSの設定に従う。** 押すと `localStorage` の `ogyanun.theme` に残る
- ClientRouter は遷移のたびに `<html>` の属性を上書きするので、`astro:after-swap` で塗り直している。
  **これを外すと、目次へ移った瞬間に昼へ戻る**

## 4.7 P.000（目次に無いページ）

**2026-08-31 追加。誌面の機能ではない。** 表紙・目次・NEWS・`sitemap.xml` のどこからも
リンクしていない。**告知もしない。** 誰かが偶然見つけるまで置いておく、それ自体が中身。

| どこ | 何が入っているか |
|---|---|
| `src/layouts/Base.astro` の head | 入口。**昼夜のボタンを10回続けて切り替える**と黒い幕が出て `/000` へ飛ぶ |
| `src/pages/000/index.astro` | 問題1問・解答欄・クリア記録・認定証（canvas 1200x630） |
| `src/pages/000/verify.astro` | 認定証の照合（`/000/verify`） |
| `functions/api/nazo.js` | **採番と判定。** D1 は plays / views と同じ `DB` |
| `src/data/site.ts` の `WISHLIST` | 突破した人にだけ出る最後のオチ |

> [!WARNING] 触るときに壊してはいけないもの
> - **正解を平文で置かない。** `functions/api/nazo.js` が持っているのは SHA-256 だけ。
>   ページ側は正解を知らない。**ここに答えを書いた瞬間、CLEAR No.000001 の価値が消える**
> - **判定をブラウザ側へ移さない。** 番号を配るのはサーバの仕事
> - **`noindex` を外さない／`sitemap.xml` へ足さない**（`src/pages/sitemap.xml.ts` は許可制。
>   足さなければ出ない）
> - **入口の10回を「連打」にしない。** 3秒あくと数え直す作りにしてあるのは、
>   白と黒が高速で入れ替わるのを避けるため。間隔を詰めない
> - `nazo_clears.no` の **`AUTOINCREMENT` を外さない。** 外すと行を消したとき rowid が
>   再利用され、**同じ CLEAR No. が二人に出る**

- 問題は **デスク_タッコ の ARG「黒潮の壁波」CORE03 と同一のもの**（本人・2026-08-31）。
  作者の控えは Vault ではなく Unity プロジェクト側にある。**このリポジトリには答えを書かない**
- 重複対策は「善意ベース＋軽い重複防止」。同じ端末は解き直しても番号が増えない。
  同一回線からの連発は5分だけ止める。**シークレットウィンドウや別端末までは追わない**
  （追うにはログインが要る。隠し謎解きの軽さが死ぬ）
- **IPは保存していない。** 連発を止める鍵は「日付＋IP」のハッシュで、日をまたげば無意味になる
- 認定証は**印刷された物体**なので、刷り色は昼夜で動かさない（4.4節と同じ理由）

---

## 5. やらないこと

- 表紙以外に派手な演出を足す（**メリハリが死ぬ**）
- 日本語ウェブフォントの読み込み（数MB級。決定パターン4「軽さ＝継続可能性」）
  → **欧文だけは例外。** 誌名に Bodoni Moda（ラテン部分集合・数十KB）を1本だけ入れている。
  これ以上増やさない。日本語は今後もシステムフォントで組む
- **画像をそのまま置く。** 必ず webp へ変換する（元のPNGは1枚2MB級だった）
- **平文のメールアドレスを載せる**（スパムに拾われる。連絡はXのみ・本人判断 2026-08-27）
- 巨大JSライブラリ・3Dページめくり（仕様書10章・21章）
- 会員登録 / コメント / CMS / 独自バックエンド / 管理画面（仕様書24章）
- 表紙の見出しをコンポーネントへベタ書きする（「作品追加＝md1件」が壊れる）
- **ページ側のCSSへ色をベタ書きする**（4.6節。夜にしたとき1か所だけ昼のまま残る）
- **`DESIGN.md` へ値を書き足して二重管理する。** 正本は `global.css`。
  DESIGN.md が持つのは**役割・規則・スナップショット**だけ（`npm run check:design`）
- URLやアカウント名を**推測で埋める**（`src/data/site.ts` の TODO は空のまま置く）

---

## 6. コマンド

```bash
npm run dev      # ローカル確認 http://localhost:4321
npm run build    # astro check + build。ここが通らないものは出さない
npm run preview  # ビルド結果の確認
npm run check:design  # DESIGN.md と global.css のズレ／夜の2ブロックのズレを見る
```

`check:design` は **`npm run build` には組み込んでいない**（デプロイを止めないため）。
色を触ったときだけ手で回す。常に落としたくなったら `build` の先頭へ足す。

---

## 6.5 制作クレジット

「このサイトの制作には AI支援・SDXL・GPT Image-2 を使用し、加筆しています。」

`src/data/site.ts` の `CREDITS` が正本。**奥付（目次）と About の2か所**に小さく出している。
号ごとではなくサイト全体の事実なので `issues` 側には置かない。
使った道具が変わったら、ここを1か所直せば両方に反映される。

## 7. 未確定（本人に聞かないと埋められない）

- **BOOTH の各商品URL**（分かっているのは『雨降る最後の時間に』のみ。
  デスクタッコとしなりメイクはショップURLを暫定で入れてある）

確定済み（2026-08-27〜28 本人）：
- YouTube `https://www.youtube.com/@ogyanuntiusxiii`
  → 各作品の紹介ムービーは `content` 側の `links` に個別に入れてある。
  **URLはチャンネルを実際に開いて確認した。推測で埋めない**
- Twitch `https://www.twitch.tv/ogyanuntiusxiii` は**まだ載せていない**（本人未指示）
- 連絡は **X のみ**（`https://x.com/ogyanuntiusxiii`）。
  → `src/data/site.ts` の `CONTACT` が正本。About・目次・奥付はここを参照している。
  **メールアドレスはこのリポジトリに書かない**（public なので履歴からも読める）
- **メインビジュアル**（キャラクター集合写真）→ `public/images/cover/vol01-main.svg` を差し替え
- **ドメイン `ogyanuntiusxiii.com`** → **今は買わない。** 無料サブドメインで公開してから判断
