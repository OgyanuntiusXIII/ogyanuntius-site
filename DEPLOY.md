# 公開手順

構成：**GitHub（public） → Cloudflare Pages → ogyanuntiusxiii.com**

`main` に push すると Cloudflare Pages が自動でビルドして公開する。
つまり公開後は「Claude、ブログ更新して」→ 私が push → 反映、が成立する。

---

## Cloudflare Pages のビルド設定

ダッシュボードで **Workers & Pages → Create → Pages → Connect to Git** から
リポジトリを選び、次を入れる。

| 項目 | 値 |
|---|---|
| Framework preset | **Astro** |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | （空のまま） |
| 環境変数 | `NODE_VERSION` = `22` |

> [!IMPORTANT] `NODE_VERSION` を入れ忘れると失敗する
> Cloudflare Pages の既定 Node は古く、Astro 5 が動かない。
> ローカルは Node 24 で動作確認済み。

`npm run build` は `astro check` を先に走らせるので、**型が壊れているとデプロイが止まる**。
これは事故防止として意図的にそうしてある。

---

## 独自ドメイン

1. ドメインを取得する（**購入は本人が行う**）
2. Cloudflare Pages のプロジェクト → **Custom domains** → `ogyanuntiusxiii.com` を追加
3. 案内どおりにネームサーバーまたは CNAME を設定する
4. 証明書が発行されるまで数分〜数十分待つ
5. **`astro.config.mjs` の `site` と `src/data/site.ts` の `origin` を実URLに合わせる**
   → ここがズレると canonical と OGP のURLが間違ったまま出る

無料サブドメイン（`*.pages.dev`）のまま運用する場合も、上の2ファイルを書き換える。

---

## 公開後に確認すること

- [ ] 表紙が一画面で収まっているか（PC）
- [ ] 一冊にカーソルを置くと帯が出て、クリックで `/about` に飛ぶか
- [ ] 作品ページ3つ・`/blog`・`/contents` が開くか
- [ ] OGP：`https://cards-dev.twitter.com/validator` などでXの見え方を確認
- [ ] `robots.txt` と `sitemap` は未設定（必要になったら足す）
