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

### 「ブログ更新して」 → **ブログ更新モードに入る**

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
   | 文体 | いつもの（感傷的ニヒリズム寄り）／ 淡々と技術記事 |
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

### `src/content/blog/*.md`

```yaml
title:
date:          # YYYY-MM-DD
description:   # 10〜160字。一覧と meta description に出る
relatedTo:     # 任意。works / scenarios の slug
tags:          # [文字列]
draft:         # true の間は一覧にもURLにも出ない（既定 false）
heroImage:     # 任意。/images/... （public/ に実在すること）
```

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
- URLやアカウント名を**推測で埋める**（`src/data/site.ts` の TODO は空のまま置く）

---

## 6. コマンド

```bash
npm run dev      # ローカル確認 http://localhost:4321
npm run build    # astro check + build。ここが通らないものは出さない
npm run preview  # ビルド結果の確認
```

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
