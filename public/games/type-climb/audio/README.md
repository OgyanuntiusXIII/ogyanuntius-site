# audio/ — 音の受け口

ここにファイルを置くと、そのまま鳴る。無ければ index.html 内の合成音のまま。
名前は index.html 冒頭の `AUDIO` ブロックと対応している（そこで変えられる）。

| ファイル | 鳴る場面 |
|---|---|
| bgm.mp3 | ループBGM。置くと合成のパッドとポツンは止まる |
| key.wav | 打鍵 |
| miss.wav | 打ち間違え |
| jump.wav | 跳ぶ |
| land.wav | 着地「コトッ」 |
| bump.wav | 壁に当たる／打ち損じ |
| gust.wav | 向かい風 |
| reroll.wav | 手札を引き直す |
| splash.wav | 着水 |
| climb.wav | ケーブルを手繰る |

音量は `AUDIO.BGM_VOL` / `AUDIO.SE_VOL`。
file:// で直接開いても鳴る（`<audio>` で読んでいるので fetch の制限を受けない）。
