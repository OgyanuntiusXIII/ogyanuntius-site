---
vol: VOL.01
label: 創刊号
theme: |-
  やりたいこと、
  全部やる
published: 2026-09-01
current: true
mainVisual: /images/cover/2026-09-main.webp
mainVisualAlt: 白衣の男性とサメのぬいぐるみを囲む4人の少女たちの集合写真
mainVisualFocus: 50% 0%
coverInk: dark
coverNote: 今月プレイしたCoCのキャラ達。全員生きているが、年代が違う人間もいる。（医者が1920s。名前はオギャーヌ・ドクターカモン）
magTitleJp: 月刊
magTitleEn: OGYANUN
coverLines:
  - 777を、揃え続けろ。
  - デスクトップに、タコがいる。
headlines:
  # ⚠️ **表紙に出す作品は3本まで**（本人・2026-09-04「トップに出すのは3つくらいに」）。
  #    選び方は**ジャンルの代表を1本ずつ**。残りは目次のジャンル欄（/contents）で拾う。
  #    足したくなったら、まずどれかを外す。増やすと表紙がまた埋まる。
  #
  # ⚠️ **`no:` は書かない。** 省くと目次の通し番号が自動で入る（src/lib/features.ts）。
  #    作品を1本足すたびに 1〜8 を手で振り直す作業は要らない。
  #    どうしても別の数字にしたいときだけ `no:` を書く。

  # ツール・アプリの代表
  - ref: desk-takko
    collection: works
    slot: lead

  # ゲームの代表。いま出したばかりのもの
  - ref: 777-combo
    collection: works
    slot: upper
    badge: NEW

  # TRPGシナリオの代表
  - ref: amefuru-saigo-no-jikan-ni
    collection: scenarios
    slot: side

  # --- ここから下は作品ではなく、誌面の外への導線 ---
  - ref: /about
    collection: page
    catch: WHO IS OGYANUNTIUS XIII?
    slot: lower
  # ⚠️ 「今月の制作物 → /contents」は 2026-09-04 に外した。
  #    フットの CONTENTS と飛び先が同じで、右カラムの NEWS 欄とも名前が重なっていた
  - ref: /blog
    collection: page
    catch: クロウちゃんの愚痴
    slot: strip
  - ref: /contact
    collection: page
    catch: お問い合わせ・ご感想
    slot: strip
strips:
  - 定価 ¥0（なんでも見ていってください）
colophon:
  - オギャヌンティウス十三世
  - VOL.01 / 創刊号 / 2026年9月号
  - 発行：オギャヌンティウス十三世
  - Web：ogyanuntiusxiii.com
  - X：@ogyanuntiusxiii
---

創刊号。2026年9月号。ひと月で8本になった。
表紙に出すのはジャンルの代表3本だけで、残りは目次のジャンル欄に並べてある。
