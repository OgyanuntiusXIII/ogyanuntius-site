// 30 TRAPS — 動画データ
// 本人が組んだ日本人向けのラインナップ（2026-09-02）。
// 動画IDは同日に YouTube 検索 → oEmbed → playableInEmbed=true を実測して確定した。推測で書いていない。
//
// ⚠️ 3枠（11 / 12 / 26）は保留中。ガチムチパンツレスリング・野獣先輩・やらないか は
//    元がアダルト作品なので、判断が要る。いまは代わりのニコニコ古典を入れてある。
//    入れると決まったら、この3行だけ差し替える。
//
// ⚠️ 転載アップロードが多いので、消えたら差し替える前提。
//    公式チャンネルなのは HIKAKIN / SeikinTV / 伯方塩業 / Eurovision くらい。

const TRAPS = [
  { id: 'dQw4w9WgXcQ', label: 'Rickroll（Rick Astley）' },
  { id: 'L4J5pxu48v8', label: 'ヒカル - 仮面武闘会 / カルxピン' },
  { id: 'kjyKUIx3Ou8', label: 'HIKAKIN Beatbox' },
  { id: 'wDbaDrndNVM', label: 'SEIKIN TV' },
  { id: 'beep4qI1-NQ', label: 'syamu_game 名場面集' },
  { id: '90OBTV2f238', label: '野々村竜太郎 号泣会見' },
  { id: 'vc_UVpFayaw', label: '松岡修造 - あきらめんなよ' },
  { id: 'v75p6TYapIg', label: 'ドナルド - ランランルー' },
  { id: 'yI3VcZkwgqA', label: 'キーボードクラッシャー' },
  { id: 'Ixn-6GZi_-g', label: 'エア本さんのグルメレース' },
  { id: 'aR-kTGD5VZc', label: '組曲『ニコニコ動画』' },          // ← 11枠目（保留の代わり）
  { id: '-pr-WUa8eEs', label: '葉っぱ隊 - YATTA!' },             // ← 12枠目（保留の代わり）
  { id: 'h8h_UFGp7yM', label: 'デデドン！（絶望）' },
  { id: 'kEzqmHMG2ng', label: '災害時にそなえるゆうさく' },
  { id: 'OQNrNH0TEXk', label: 'フタエノキワミ、アッー！' },
  { id: '4Yi9_uCw2NY', label: 'ヴェルタースオリジナル' },
  { id: '3RlYJzqk7to', label: 'チャージマン研！ 第20話' },
  { id: 'qsdYNMpNEAo', label: 'ブロリー - 伝説の超合コン' },
  { id: 'yZNr7hEDtP8', label: 'バトルドーム CM' },
  { id: 'RC9Xu6QMTZ8', label: '伯方の塩 サウンドロゴ' },
  { id: 't7egj0jQPfM', label: 'ねるねるねるね CM' },
  { id: 'yxxyjDFnbb0', label: 'Windows XP エラー' },
  { id: '8lzrmsSnvak', label: '粉バナナ' },
  { id: 'wuj3BeEgHQE', label: '次回「城之内死す」' },
  { id: 'U_g4IVn0leI', label: 'ニコニコ時報' },
  { id: 'XazyhnymUQo', label: '松平健 - マツケンサンバII' },    // ← 26枠目（保留の代わり）
  { id: 'ez8m4PXksQs', label: 'Epic Sax Guy 10 hours' },
  { id: 'j9V78UbdzWI', label: 'Coffin Dance' },
  { id: 'dMZ7_yTILS8', label: '猫ミーム - ハッピーハッピー' },
  { id: 'PumFnlu9EIY', label: 'レッツゴー！陰陽師' },
];

// 差し替え候補（同じ手順で実測済み・埋め込み可）
const SPARES = [
  { id: 'sBm5YpyGODw', label: '少年隊 - 仮面舞踏会（本家）' },
  { id: 'FtutLA63Cp8', label: '東方 - Bad Apple!! PV' },
  { id: 'KLbFctG3tw0', label: 'エアーマンが倒せない' },
  { id: 'gBWx_XdfEqU', label: '初音ミク「Ievan Polkka」' },
  { id: 'zvq9r6R6QAY', label: 'Caramelldansen' },
  { id: 'NfuiB52K7X8', label: 'PIKOTARO - PPAP' },
  { id: 'erb4n8PW2qw', label: 'Darude - Sandstorm' },
  { id: 'jIQ6UV2onyI', label: 'Nyan Cat 10 hours' },
  { id: 'Slz5H5ziQM4', label: 'Trololo - Eduard Khil' },
];
