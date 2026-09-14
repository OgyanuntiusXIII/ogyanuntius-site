/* 学習機関車 / TRAINING DATA — 政策試算モデル（100万人の国）
 * 日本の統計を 1/123.3（1億2,330万人 → 100万人）に縮小した土台の上に、
 * 出典つきの「実測値」と、明示した「仮定」を重ねて結果を出す。予測ではない。
 * UMD: ブラウザでは window.KikanshaModel、node では module.exports。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KikanshaModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SCALE = 1 / 123.3; // 総務省 人口推計 2025年8月 概算値 1億2,330万人

  /* ---------- 出典 ---------- */
  const SOURCES = {
    pop:     { label: '総務省統計局 人口推計 2025年8月1日 概算値（総人口1億2,330万人）', url: 'https://www.stat.go.jp/data/jinsui/pdf/202508.pdf' },
    census:  { label: '国勢調査2015 抽出詳細集計（勝浦正樹「国勢調査にみる芸術家の動向」付表1：彫刻家・画家・工芸美術家 37,820人、写真家・映像撮影者 63,970人、著述家 25,290人、就業者 5,889万人）', url: 'https://www1.meijo-u.ac.jp/~katsuura/culstat/14%201-%E2%85%A2-1%20%E5%9B%BD%E8%AA%BF.pdf' },
    jsoc:    { label: '日本標準職業分類 222「画家，書家」— 漫画家・挿絵画家・イラストレーターを含む（アニメーターは含まない）', url: 'https://www.e-stat.go.jp/classifications/terms/20/02/222' },
    design:  { label: '国勢調査2020 抽出詳細集計：デザイナー 約9万人弱（STUDIO K の集計記事）', url: 'https://studiok-co.jp/report/15614.html' },
    anime:   { label: '2019年のTVアニメ114作品の集計：原画アニメーター 5,247名（アニメーションビジネス・ジャーナル）', url: 'http://animationbusiness.info/archives/10076' },
    manga:   { label: '年に新刊単行本を出す漫画家 約6,000人（情報メディア白書、CLIP STUDIO コラム）', url: 'https://www.clipstudio.net/oekaki/archives/151844' },
    pixiv:   { label: 'pixiv 18周年：総登録1億1,900万、累計作品1億6,000万（2025-09）', url: 'https://www.pixiv.co.jp/2025/09/10/120000' },
    shakai:  { label: '社会生活基本調査2021：マンガを読む 36.8%、写真の撮影・プリント 21.9%（全国値・茨城県統計課の掲載表）', url: 'https://www.pref.ibaraki.jp/kikaku/tokei/fukyu/tokei/betsu/syakai/syakaichor3/kodo.html' },
    values:  { label: 'ヴァリューズ：画像生成AIの利用者 約650万人（2025年9月・行動ログ）', url: 'https://manamina.valuesccg.com/articles/2043' },
    lawyers: { label: '日弁連 基礎的な統計情報2025：弁護士 47,103人', url: 'https://www.nichibenren.or.jp/document/statistics/fundamental_statistics2025.html' },
    ipcourt: { label: '知財高裁 統計：全国地裁 知的財産権関係民事事件 新受 H28〜R7（年505〜700件）', url: 'https://www.courts.go.jp/ip/vc-files/ip/R8_j-zenkokuchisai.pdf' },
    ipshare: { label: '知財民事事件のうち著作権の構成比 25.4%（2016）→46.4%（2017）', url: 'https://www.saegusa-pat.co.jp/topics/4719/' },
    idc:     { label: 'IDC Japan：国内生成AI市場 2024年 1,016億円、5年で8,000億円規模へ', url: 'https://my.idc.com/getdoc.jsp?containerId=prJPJ52722724' },
    shutter: { label: 'Shutterstock：AI向けライセンス収入 1.04億ドル（2023）、Contributor Fund の中央値 1枚 0.0069ドル', url: 'https://petapixel.com/2023/07/12/shutterstock-may-have-paid-out-over-4-million-from-its-ai-contributor-fund/' },
    flux:    { label: 'FLUX schnell の生成単価 1枚 0.003ドル（Replicate ほか）', url: 'https://pricepertoken.com/flux-pricing' },
    lora:    { label: 'LoRA学習に要る枚数：15〜25枚で成立、20〜50枚が定石', url: 'https://techtactician.com/how-to-train-stable-diffusion-lora-models/' },
    demirci: { label: 'Demirci, Hannane & Zhu (Management Science 2025)：画像生成AI登場後、画像関連の求人 −17%、文章・コード −21%', url: 'https://pubsonline.informs.org/doi/10.1287/mnsc.2024.05420' },
    soa:     { label: 'Society of Authors 2024（英・n=787）：イラストレーターの26%が生成AIで仕事を失った、翻訳者は36%', url: 'https://europeanwriterscouncil.eu/soa-survey-uk-ai-2024/' },
    aoi:     { label: 'Association of Illustrators 2025（英）：32%が仕事を失い、被害者の平均損失 £9,262', url: 'https://www.designweek.co.uk/how-the-illustration-industry-is-grappling-with-ai-a-special-report/' },
    jilla:   { label: '日本イラストレーション協会 意識調査 2025年12月（n=386）：否定的46.4%、イラストレーター59%・漫画家76%が否定的', url: 'https://jilla.or.jp/2026/04/14762' },
    gdpr:    { label: 'Janßen ほか NBER w30028：GDPRでGoogle Playのアプリの約3分の1が退出、新規参入は半減', url: 'https://www.nber.org/papers/w30028' },
    krueger: { label: 'Krueger『Rockonomics』：上位1%の演者が興行収入の60%、上位5%で85%', url: 'https://conversableeconomist.com/2013/06/18/rock-music-technology-and-the-top-1/' },
    ftc:     { label: 'FTC 2019 Consumers and Class Actions：申請率の中央値9%、加重平均4%', url: 'https://www.ftc.gov/system/files/documents/reports/consumers-class-actions-retrospective-analysis-settlement-campaigns/class_action_fairness_report_0.pdf' },
    aylo:    { label: 'Aylo：ルイジアナ州の身分証による年齢確認で Pornhub の訪問が約80%減', url: 'https://www.biometricupdate.com/202504/talk-turns-dirty-as-aylo-rep-tells-age-assurance-summit-online-age-assurance-doesnt-work' },
    korea:   { label: '韓国インターネット実名制：悪質コメント 13.9%→13.0%（KCC）。2012年に違憲判決', url: 'https://www.koreatimes.co.kr/southkorea/20120823/online-real-name-system-unconstitutional' },
    proton:  { label: 'Proton VPN：英国オンライン安全法の年齢確認開始で登録 +1,400%、その後 +1,800% で持続', url: 'https://www.uktech.news/cybersecurity/proton-vpn-uk-online-safety-act-20250806' },
    masai:   { label: 'MASAI試験（Lancet Oncology 2023 中間）：AI併用でがん検出 1,000人あたり 6.1 vs 5.1、読影作業 −44%', url: 'https://www.eurekalert.org/news-releases/997332' },
    masai2:  { label: 'MASAI（Lancet Digital Health 2024）：がん検出率 +29%、偽陽性は増えず', url: 'https://www.thelancet.com/journals/landig/article/PIIS2589-7500(24)00267-X/fulltext' },
    kenshin: { label: '国民生活基礎調査2022：乳がん検診受診率 47.4%（40〜69歳女性・過去2年）', url: 'https://ganjoho.jp/reg_stat/statistics/stat/screening/screening.html' },
    jisedai: { label: '次世代医療基盤法：通知して拒否がなければ提供できるオプトアウト方式', url: 'https://www.mhlw.go.jp/content/10808000/001166476.pdf' },
    laion:   { label: 'Webster ほか 2023：LAION-2B の約30%（約7億枚）が重複画像', url: 'https://arxiv.org/abs/2303.12733' },
    jasrac:  { label: 'JASRAC：使用料分配額に対する運営経費の割合 9.2%（2024年度）', url: 'https://www.jasrac.or.jp/information/release/26/260305.html' },
  };

  /* ---------- 100万人の国の土台 ---------- */
  const BASE = {
    pop: 1000000,
    workers:      { v: Math.round(58890810 * SCALE), basis: '実測', src: ['census'], note: '就業者 5,889万人（2015）' },
    artists:      { v: Math.round(37820 * SCALE),    basis: '実測', src: ['census', 'jsoc'], note: '彫刻家・画家・工芸美術家 37,820人（漫画家・イラストレーター・挿絵画家を含む）' },
    animators:    { v: Math.round(6000 * SCALE),     basis: '推定', src: ['anime'], note: 'アニメ制作者 約6,000人（原画5,247名の集計から丸めた）' },
    designers:    { v: Math.round(90000 * SCALE),    basis: '実測', src: ['design'], note: 'デザイナー 約9万人（2020）。影響は半分だけ受けると仮定' },
    photographers:{ v: Math.round(63970 * SCALE),    basis: '実測', src: ['census'], note: '写真家・映像撮影者 63,970人（2015）。今回の計算では使わない' },
    mangaka:      { v: Math.round(6000 * SCALE),     basis: '推定', src: ['manga'], note: '年に新刊を出す漫画家 約6,000人（artists の内数）' },
    hobbyDrawers: { v: 32000,                        basis: '推定', src: ['shakai'], note: '「絵画・彫刻の制作」の行動者率 約3〜4%（10歳以上）。3.5%×92万人で概算' },
    posters:      { v: 10000,                        basis: '仮定', src: ['shakai', 'pixiv'], note: '描く人の3人に1人が投稿する、と置いた' },
    mangaReaders: { v: 368000,                       basis: '実測', src: ['shakai'], note: 'マンガを読む 36.8%' },
    imageAIUsers: { v: Math.round(6500000 * SCALE),  basis: '実測', src: ['values'], note: '画像生成AI利用者 約650万人（2025-09）' },
    lawyers:      { v: Math.round(47103 * SCALE),    basis: '実測', src: ['lawyers'], note: '弁護士 47,103人（2025）' },
    ipSuits:      { v: +(570 * SCALE).toFixed(1),    basis: '実測', src: ['ipcourt'], note: '地裁の知財民事 新受 年約570件（H28〜R7平均）' },
    copyrightSuits:{ v: +(570 * 0.3 * SCALE).toFixed(1), basis: '推定', src: ['ipcourt', 'ipshare'], note: 'うち著作権を約3割と置く（25〜46%の幅）' },
    genAIMarket:  { v: Math.round(101600000000 * SCALE / 1e6) * 1e6, basis: '実測', src: ['idc'], note: '国内生成AI市場 1,016億円（2024）。百万円で丸めた' },
    genAIMarket2029:{ v: Math.round(800000000000 * SCALE / 1e6) * 1e6, basis: '推定', src: ['idc'], note: '2029年 約8,000億円（IDC予測）。百万円で丸めた' },
    imagesToClear:{ v: 650000,                       basis: '推定', src: ['pixiv'], note: 'pixiv累計1.6億作品の約半分を日本語圏とみて縮小（=学習対象になりうる国内の絵）' },
    firms:        { v: 10,                           basis: '架空', src: [], note: '国内で画像生成モデルを自前で作る会社。現実の日本でも10前後で、100万人に縮小すると0.1社になるため、演出として10社を置く' },
    women40to69:  { v: 194000,                       basis: '推定', src: ['pop'], note: '人口推計の年齢構成から概算（女性40〜69歳 約2,390万人）' },
    screenedPerYear:{ v: 46000,                      basis: '実測', src: ['kenshin'], note: '受診率47.4%（2年）→ 年23.7%' },
  };

  /* ---------- 実測のアンカー（係数） ---------- */
  const ANCHORS = {
    lostWorkRate:   { v: 0.26,  basis: '実測', src: ['soa', 'aoi'], note: 'イラストレーターの26%が「仕事を失った」（英2024）。2025年の別調査では32%' },
    jobPostDrop:    { v: 0.17,  basis: '実測', src: ['demirci'], note: '画像関連の求人が17%減（米・フリーランス基盤）' },
    avgLossYen:     { v: 1850000, basis: '実測', src: ['aoi'], note: '被害者の平均損失 £9,262 ≒ 185万円（1£=200円）' },
    closureShare:   { v: 1/3,   basis: '仮定', src: [], note: '仕事を失った人の3人に1人が廃業する、と置いた' },
    gdprExit:       { v: 0.33,  basis: '実測', src: ['gdpr'], note: '規制で事業者の3分の1が退出、新規参入は半減（GDPRの実測を許可制にあてはめる）' },
    top1Share:      { v: 0.60,  basis: '実測', src: ['krueger'], note: '上位1%が60%を取る（音楽興行）' },
    claimRate:      { v: 0.09,  basis: '実測', src: ['ftc'], note: '申請制の申請率 中央値9%' },
    idExodus:       { v: 0.80,  basis: '実測', src: ['aylo', 'korea'], note: '身分証確認で訪問80%減（別分野の実測）。韓国の実名制は効果0.9ptで違憲に' },
    vpnSurge:       { v: 14,    basis: '実測', src: ['proton'], note: 'VPN登録が14倍（+1,400%）' },
    vpnUserShare:   { v: 0.5,   basis: '仮定', src: [], note: '画像AI利用者の半分がVPNで使い続ける、と置いた' },
    dupShare:       { v: 0.30,  basis: '実測', src: ['laion'], note: '学習データの30%が重複（転載）画像' },
    detectGain:     { v: 0.001, basis: '実測', src: ['masai', 'masai2'], note: 'AI併用で1,000人あたり+1.0件のがんを検出' },
    licenseRevPerImage: { v: 25, basis: '実測', src: ['shutter'], note: 'AI向けライセンス収入 1枚あたり年 約0.17ドル ≒ 25円' },
    contributorPerImage:{ v: 1,  basis: '実測', src: ['shutter'], note: '作者に届く中央値 1枚 0.0069ドル ≒ 1円' },
    humanClearPerImage: { v: 750, basis: '仮定', src: [], note: '人力の権利処理：1枚15分×時給3,000円' },
    genCostYen:     { v: 0.45,  basis: '実測', src: ['flux'], note: '1枚 0.003ドル ≒ 0.45円' },
    jasracOverhead: { v: 0.092, basis: '実測', src: ['jasrac'], note: '分配に対する運営経費 9.2%' },
    foreignShare:   { v: 0.90,  basis: '推定', src: [], note: '主要な画像生成サービス（Midjourney・OpenAI・Google・Adobe・Stability・BFL・ByteDance）は全て海外。国産は少数' },
  };

  /* ---------- 8軸 ---------- */
  const AXES = [
    { id: 'veto',     name: '創作者の拒否権',   short: ['創作者の', '拒否権'],     base: 30, plain: '「私の絵は使わないで」と言える力' },
    { id: 'trust',    name: '信頼と透明性',     short: ['信頼と', '透明性'],       base: 35, plain: 'AIが何を読んで育ったか分かり、企業を信じられる度合い' },
    { id: 'domestic', name: '国内産業',         short: ['国内', '産業'],           base: 40, plain: '自国のAI企業が海外勢に負けずに残る力' },
    { id: 'simple',   name: '制度のシンプルさ', short: ['制度の', 'シンプルさ'],   base: 70, plain: '書類・審査・弁護士が少なくて済む度合い' },
    { id: 'tech',     name: '技術の発展',       short: ['技術の', '発展'],         base: 65, plain: '新しいAIが速く・安く生まれる力' },
    { id: 'small',    name: '小さな開発者',     short: ['小さな', '開発者'],       base: 60, plain: '個人や小さな会社でもAIを作れる度合い' },
    { id: 'expr',     name: '表現の自由',       short: ['表現の', '自由'],         base: 65, plain: '画風や技法を誰でも使え、道具を選べる自由' },
    { id: 'anon',     name: '匿名で描ける自由', short: ['匿名で', '描ける自由'],   base: 70, plain: '本人確認なしで絵を投稿できる自由' },
  ];
  const POINT = 6; // 効果1ポイント = 6

  /* ---------- 政策レバー（各レバーの軸への効き目は合計ゼロ） ---------- */
  const LEVERS = [
    { id: 'permit',      group: 'act', type: 'bool', name: '許可のない学習を禁止する',
      plain: 'AIに絵を読ませる前に、描いた本人の「いいよ」が要る仕組み',
      fx: { veto: 3, trust: 1, tech: -2, small: -2 } },
    { id: 'foreignBan',  group: 'act', type: 'bool', name: '海外のAIも国内で使えなくする', needs: 'permit',
      plain: '海外で合法的に作られたAIを、この国の人が使うのも止める',
      fx: { domestic: 2, veto: 1, tech: -1, expr: -1, simple: -1 } },
    { id: 'humanException', group: 'act', type: 'bool', name: '人間の学習は例外にする',
      plain: '人が数万枚の絵を見て学ぶのは、許可なしでよいことにする',
      fx: { expr: 2, veto: -1, trust: -1 } },
    { id: 'medical',     group: 'act', type: 'bool', name: '医療AIは例外にする',
      plain: '匿名化した医療画像なら、本人の同意なしでAIに学ばせてよい',
      fx: { tech: 1, domestic: 1, veto: -1, simple: -1 } },
    { id: 'transparency', group: 'lever', type: 'bool', name: '学習データの公開義務',
      plain: 'AIが何を読んで育ったか、一覧を公開させる',
      fx: { trust: 2, veto: 1, tech: -1, small: -1, simple: -1 } },
    { id: 'optout',      group: 'lever', type: 'tri', name: '「使わないで」宣言（オプトアウト）',
      plain: '描いた人が「学習お断り」と宣言したら、AI企業はその絵を使えない',
      options: ['なし', '宣言だけ', '本人確認つき'],
      fxByLevel: [ {}, { veto: 2, trust: 1, simple: -1, tech: -1, small: -1 }, { veto: 3, trust: 1, anon: -3, simple: -1 } ] },
    { id: 'targeting',   group: 'lever', type: 'bool', name: '特定の作家を狙った学習の規制',
      plain: '一人の作家の絵だけを集めて「その人そっくりAI」を作るのを禁じる',
      fx: { veto: 2, trust: 1, expr: -1, tech: -1, simple: -1 } },
    { id: 'replication', group: 'lever', type: 'bool', name: '元の絵をそのまま出させない',
      plain: '学習した絵とほぼ同じ絵を出力させない仕組みを義務にする',
      fx: { veto: 1, trust: 1, tech: -1, small: -1 } },
    { id: 'levy',        group: 'lever', type: 'bool', name: '売上の1%を創作者に還元',
      plain: 'AI企業の売上の1%を基金に集めて、絵を描く人に配る',
      fx: { veto: 1, trust: 1, small: -1, simple: -1 } },
    { id: 'oss',         group: 'lever', type: 'bool', name: 'オープンソースは例外',
      plain: '中身を公開して無料で配るAIには、規制をゆるめる',
      fx: { small: 2, tech: 1, expr: 1, veto: -2, trust: -1, simple: -1 } },
    { id: 'research',    group: 'lever', type: 'bool', name: '研究目的は例外',
      plain: '大学や研究所の実験なら、許可なしで学習してよい',
      fx: { tech: 2, domestic: 1, veto: -1, trust: -1, simple: -1 } },
    { id: 'bigtech',     group: 'lever', type: 'bool', name: '大企業だけに追加の義務',
      plain: '大きな会社にだけ、公開・還元・審査の義務を重くする',
      fx: { small: 2, trust: 1, veto: 1, tech: -1, domestic: -1, simple: -2 } },
    { id: 'styleProtect', group: 'hidden', type: 'bool', name: '画風を保護対象にする',
      plain: '太い線・淡い色・大きな目のような「絵のクセ」を、誰かのものとして保護する',
      fx: { veto: 2, trust: 1, expr: -2, simple: -1 } },
    { id: 'userLiability', group: 'hidden', type: 'bool', name: '生成して使った人の責任を問う',
      plain: '「そっくりAI」で生成した画像を使った人に責任を負わせ、生成の記録を残させる',
      fx: { veto: 1, trust: 1, anon: -2 } },
    { id: 'levyMode',    group: 'levy', type: 'select', name: '基金の配り方', needs: 'levy',
      options: [
        { v: 'A', label: 'A 学習された作品数に応じて' },
        { v: 'B', label: 'B 全員に均等' },
        { v: 'C', label: 'C AIへの貢献度に応じて' },
        { v: 'D', label: 'D 申請した人に' },
      ] },
  ];

  function defaultState() {
    return { permit: false, foreignBan: false, humanException: false, medical: false,
             transparency: false, optout: 0, targeting: false, replication: false,
             levy: false, oss: false, research: false, bigtech: false, levyMode: 'B',
             styleProtect: false, userLiability: false };
  }
  function normalize(s) {
    const n = Object.assign(defaultState(), s || {});
    if (!n.permit) n.foreignBan = false; // 許可制でなければ海外禁止は意味を持たない
    n.optout = Math.max(0, Math.min(2, +n.optout || 0));
    return n;
  }
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const active = s => LEVERS.filter(l => l.type === 'bool' && s[l.id] || l.type === 'tri' && s[l.id] > 0).map(l => l.id);

  /* ---------- 8角グラフ ---------- */
  function radar(state) {
    const s = normalize(state);
    const val = {};
    AXES.forEach(a => { val[a.id] = a.base; });
    const apply = fx => { Object.keys(fx).forEach(k => { val[k] += fx[k] * POINT; }); };
    LEVERS.forEach(l => {
      if (l.type === 'bool' && s[l.id]) apply(l.fx);
      if (l.type === 'tri' && s[l.id] > 0) apply(l.fxByLevel[s[l.id]]);
    });
    const out = AXES.map(a => ({ id: a.id, name: a.name, short: a.short, plain: a.plain, base: a.base, value: clamp(Math.round(val[a.id]), 5, 95) }));
    // 「守った／犠牲にした」は現状（何もしない場合）からの変化で決める。何も変えていなければ現状の形の最高・最低
    const changed = out.some(a => a.value !== a.base);
    const sorted = changed ? out.slice().sort((x, y) => (y.value - y.base) - (x.value - x.base)) : out.slice().sort((x, y) => y.value - x.value);
    return { axes: out, top: sorted[0], bottom: sorted[sorted.length - 1], total: out.reduce((t, a) => t + a.value, 0) };
  }

  /* ---------- 結果の数値 ---------- */
  function outcomes(state) {
    const s = normalize(state);
    const b = k => BASE[k].v, a = k => ANCHORS[k].v;
    const yen = n => Math.round(n);
    const items = [];
    const push = (id, label, value, unit, basis, note, src) => items.push({ id, label, value, unit, basis, note, src: src || [] });

    // 1) 仕事
    const exposed = b('artists') + b('animators') + Math.round(b('designers') * 0.5);
    let r = a('lostWorkRate');
    const mods = [];
    if (s.permit && !s.foreignBan) { r *= 0.9;  mods.push('許可制にしたが海外AIは使えるので、減り方は1割だけ（仮定）'); }
    if (s.permit && s.foreignBan)  { r *= 0.5;  mods.push('海外AIも禁止。VPNの抜け道を見込んで半減（仮定）'); }
    if (s.targeting)               { r *= 0.8;  mods.push('狙い撃ち規制で2割減（仮定）'); }
    if (s.optout === 1)            { r *= 0.9;  mods.push('宣言だけのオプトアウトで1割減（仮定）'); }
    if (s.optout === 2)            { r *= 0.85; mods.push('本人確認つきオプトアウトで15%減（仮定）'); }
    if (s.replication)             { r *= 0.95; mods.push('再現防止で5%減（仮定）'); }
    if (s.oss)                     { r *= 1.1;  mods.push('無料モデルが増えて1割増（仮定）'); }
    if (s.research)                { r *= 1.03; mods.push('研究例外の漏れで3%増（仮定）'); }
    if (s.bigtech)                 { r *= 0.95; mods.push('大企業の商用サービスが縛られて5%減（仮定）'); }
    r = clamp(r, 0.03, 0.35);
    const lostWork = Math.round(exposed * r);
    const baselineLost = Math.round(exposed * a('lostWorkRate'));
    const saved = Math.max(0, baselineLost - lostWork);
    const closed = Math.round(lostWork * a('closureShare'));
    push('saved', '仕事を守られた創作者', saved, '人', saved ? '仮定' : '—',
      `現状（${baselineLost}人が仕事を失う）との差。母数は絵で稼ぐ${exposed}人（画家・イラストレーター・漫画家${b('artists')}、アニメ${b('animators')}、デザイナーの半分${Math.round(b('designers')*0.5)}）`, ['soa', 'census', 'design']);
    push('lostWork', '仕事を失った創作者', lostWork, '人', mods.length ? '仮定' : '実測',
      `母数${exposed}人 × ${(r*100).toFixed(1)}%。基準は「26%が仕事を失った」（英2024）` + (mods.length ? '。' + mods.join('、') : ''), ['soa', 'aoi']);
    push('closed', 'うち廃業', closed, '人', '仮定', '仕事を失った人の3人に1人が廃業する、と置いた', []);
    push('lostIncome', '失われた収入（合計・年）', yen(lostWork * a('avgLossYen')), '円', '実測',
      `一人あたり平均損失 £9,262 ≒ 185万円（英2025） × ${lostWork}人`, ['aoi']);

    // 2) 企業
    let exitRate = 0, entryMult = 1;
    if (s.permit)       { exitRate += a('gdprExit'); entryMult *= 0.5; }
    if (s.transparency) { exitRate += 0.05; }
    if (s.levy)         { exitRate += 0.05; }
    if (s.replication)  { exitRate += 0.03; }
    if (s.optout > 0)   { exitRate += 0.03; }
    if (s.bigtech)      { exitRate -= 0.05; entryMult *= 1.2; }
    if (s.oss)          { exitRate -= 0.05; entryMult *= 1.3; }
    if (s.research)     { exitRate -= 0.03; entryMult *= 1.2; }
    if (s.foreignBan)   { exitRate -= 0.10; entryMult *= 1.3; }
    exitRate = clamp(exitRate, 0, 0.9);
    const exits = Math.round(b('firms') * exitRate);
    const newFirms = Math.round(5 * entryMult);
    push('exits', '撤退した国内AI企業', exits, '社', exits ? (s.permit ? '実測→架空' : '仮定') : '—',
      `国内${b('firms')}社（架空）× 退出率${Math.round(exitRate*100)}%。許可制の退出率33%はGDPR後のアプリ退出の実測`, ['gdpr']);
    push('newFirms', '新しく生まれたAI企業（5年）', newFirms, '社', '仮定', `基準5社（架空）に、許可制なら半減（実測）、例外規定で増える（仮定）を掛けた`, ['gdpr']);

    // 3) 海外シェア・VPN
    let foreignShare = a('foreignShare'), vpnUsers = 0;
    let shareNote = '主要サービスはほぼ海外製（推定）';
    if (s.permit && !s.foreignBan) { foreignShare = 0.97; shareNote = '国内企業だけが権利処理の費用を負担し、海外勢がその分を取る（推定）'; }
    if (s.permit && s.foreignBan)  { foreignShare = 0.10; vpnUsers = Math.round(b('imageAIUsers') * a('vpnUserShare')); shareNote = '表向きは1割。裏ではVPN（仮定）'; }
    push('foreignShare', '海外AIのシェア', Math.round(foreignShare * 100), '%', '推定', shareNote, []);
    push('vpn', 'VPNで海外AIを使い続ける人', vpnUsers, '人', vpnUsers ? '仮定' : '—',
      `画像AI利用者${b('imageAIUsers').toLocaleString()}人（実測）の半分（仮定）。英国では年齢確認の開始でVPN登録が14倍になった（実測）`, ['values', 'proton']);

    // 4) 匿名
    const leavers = s.optout === 2 ? Math.round(b('posters') * a('idExodus')) : 0;
    const dupMiss = s.optout === 1 ? Math.round(b('imagesToClear') * a('dupShare')) : 0;
    push('leavers', '描くのをやめた投稿者', leavers, '人', leavers ? '実測（別分野）' : '—',
      `投稿者${b('posters').toLocaleString()}人（仮定）× 80%。身分証確認で訪問が8割減った実測（成人サイト）を流用。分野が違うので幅はある`, ['aylo', 'korea']);
    push('dupMiss', '宣言が届かなかった転載画像', dupMiss, '枚', dupMiss ? '実測' : '—',
      `学習対象${b('imagesToClear').toLocaleString()}枚 × 30%。学習データの3割は重複（転載）だという実測`, ['laion']);

    // 5) 書類・裁判
    const docs = s.permit ? b('imagesToClear') : 0;
    const costAuto = docs * a('licenseRevPerImage');
    const costHuman = docs * a('humanClearPerImage');
    const toCreators = docs * a('contributorPerImage');
    let suitMult = s.permit ? 3 : 1;
    let suitsAdd = (s.transparency ? 1 : 0) + (s.targeting ? 1 : 0) + (s.levy ? 0.5 : 0) + (s.optout > 0 ? 0.5 : 0) + (s.bigtech ? 1 : 0) + (s.userLiability ? 1 : 0);
    const suits = +(b('copyrightSuits') * suitMult + suitsAdd).toFixed(1);
    push('docs', '権利処理の書類', docs, '件', docs ? '推定' : '—', `学習対象になりうる国内の絵 ${b('imagesToClear').toLocaleString()}枚ぶん`, ['pixiv']);
    push('costAuto', '権利処理の費用（自動）', yen(costAuto), '円', docs ? '実測' : '—', '1枚25円（AI向けライセンス収入の実測）', ['shutter']);
    push('costHuman', '権利処理の費用（人力なら）', yen(costHuman), '円', docs ? '仮定' : '—', '1枚15分×時給3,000円＝750円', []);
    push('toCreators', '創作者に届く金額（合計）', yen(toCreators), '円', docs ? '実測' : '—', '作者に届く中央値は1枚1円（Shutterstock）', ['shutter']);
    push('suits', '著作権の裁判（年）', suits, '件', '推定', `現状 年${b('copyrightSuits')}件（実測の縮小）に、許可制で3倍、条文が増えるごとに+0.5〜1件（仮定）。弁護士は${b('lawyers')}人。弁護士を雇えるかどうかは、そのケースの規模や経済状態にもよるでしょう`, ['ipcourt', 'ipshare', 'lawyers']);

    // 6) 医療
    const medicalOK = !s.permit || s.medical;
    const detect = Math.round(b('screenedPerYear') * a('detectGain'));
    push('cancer', medicalOK ? '早く見つかる乳がん（年）' : '見つかるのが遅れる乳がん（年）', detect, '件', '実測',
      `検診 年${b('screenedPerYear').toLocaleString()}人 × 1,000人あたり+1.0件（MASAI試験）` + (medicalOK ? '' : '。許可制で医療例外なし → 研究が止まる'), ['masai', 'masai2', 'kenshin']);

    // 7) 基金
    const fund = s.levy ? Math.round(b('genAIMarket') * 0.01) : 0;
    const overhead = Math.round(fund * a('jasracOverhead'));
    const recipients = b('artists') + b('animators') + b('posters');
    let perHead = 0, fundNote = '';
    if (s.levy) {
      if (s.levyMode === 'A') { const top = Math.max(1, Math.round(recipients * 0.01)); perHead = Math.round(fund * a('top1Share') / top); fundNote = `上位1%（${top}人）が60%を取る（実測・音楽興行）。残り${(recipients - top).toLocaleString()}人は一人 ${Math.round(fund * 0.4 / (recipients - top)).toLocaleString()}円`; }
      if (s.levyMode === 'B') { perHead = Math.round(fund / recipients); fundNote = `${recipients.toLocaleString()}人（プロ${b('artists')+b('animators')}人＋投稿者${b('posters').toLocaleString()}人）で均等`; }
      if (s.levyMode === 'C') { perHead = 0; fundNote = `貢献度を測るための追跡費用 ${costAutoAll().toLocaleString()}円 > 基金${fund.toLocaleString()}円。運営費が基金の${(costAutoAll()/fund).toFixed(1)}倍`; }
      if (s.levyMode === 'D') { const claimants = Math.round(recipients * a('claimRate')); perHead = Math.round(fund / claimants); fundNote = `申請率9%（実測）→ ${claimants}人が受け取り、${(recipients - claimants).toLocaleString()}人は対象外`; }
    }
    function costAutoAll() { return b('imagesToClear') * a('licenseRevPerImage'); }
    push('fund', '基金に集まる金額（年）', fund, '円', fund ? '実測' : '—', `生成AI市場 ${b('genAIMarket').toLocaleString()}円（2024・実測の縮小）の1%。運営費9.2%＝${overhead.toLocaleString()}円（JASRAC実績）`, ['idc', 'jasrac']);
    push('perHead', '一人が受け取る額（年）', perHead, '円', fund ? '実測' : '—', fundNote, ['krueger', 'ftc']);

    // 8) 倫理
    push('ethics', '解決した倫理問題', 0, '件', '架空', '定数', []);

    return { state: s, items, byId: Object.fromEntries(items.map(i => [i.id, i])), exposed, r, medicalOK };
  }

  /* ---------- 診断文言 ---------- */
  function archetype(state) {
    const s = normalize(state);
    const none = !s.permit && !s.transparency && !s.optout && !s.targeting && !s.replication && !s.levy && !s.oss && !s.research && !s.bigtech;
    if (none) return { id: 'wait', name: '「様子見派」', body: 'あなたはレバーに触れませんでした。それも一つの政策です。現状の形がそのまま残り、費用はこれまで通り、絵を描く人が静かに払い続けます。' };
    if (s.permit && s.foreignBan) return { id: 'sakoku', name: '「鎖国派」', body: '国内でも海外でも、許可のない学習は認めませんでした。国境の内側では拒否権が最も強くなります。国境の外側は、VPNの向こうにあります。' };
    if (s.permit && (s.research || s.medical || s.oss)) return { id: 'permitplus', name: '「全員から許可を取れ。なお研究は進めろ派」', body: '自己決定権を非常に重視しています。一方で研究・医療・オープンソースに例外を設けました。あなたの制度には、おそらく大量の弁護士が必要です。弁護士を雇えるかどうかは、そのケースの規模や経済状態にもよるでしょう。' };
    if (s.permit) return { id: 'permit', name: '「全員から許可を取れ派」', body: '学習には本人の許可が要る、と決めました。最も一貫した制度です。国内のAI企業は権利処理を始め、海外のAI企業はこれまで通り営業します。' };
    if (s.optout === 2) return { id: 'idcheck', name: '「本人確認で解決派」', body: '拒否の意思を確かめるために、投稿者の本人確認を義務にしました。誰の絵かは確実に分かるようになりました。匿名で描いていた人の多くは、描くのをやめました。' };
    if (s.targeting) return { id: 'notmine', name: '「便利さは欲しい。でも俺の絵は食うな派」', body: '汎用のAI学習には比較的寛容でした。一方、特定の作家だけを狙った学習には強い規制を求めました。技術そのものより「誰か個人を代替すること」を問題視しています。' };
    if (s.levy) return { id: 'pay', name: '「食っていい。金は払え派」', body: '学習は止めず、売上の一部を創作者へ回すことにしました。一人あたりの金額を見てください。' };
    if (s.transparency) return { id: 'clear', name: '「透明なら食っていい派」', body: '何を学習したかを公開させました。公開された一覧を最後まで読んだ人は、まだ現れていません。' };
    if (s.bigtech) return { id: 'bigtech', name: '「大企業だけ縛れ派」', body: '大きな会社にだけ義務を課しました。「大きい」の定義をめぐって、最初の裁判が始まりました。' };
    if (s.oss || s.research) return { id: 'free', name: '「合法なら自由派」', body: '学習の自由を守りました。あなたの生活が守られたかどうかは、別の統計に出ています。' };
    return { id: 'mixed', name: '「折衷派」', body: '守るものと諦めるものを少しずつ決めました。誰も満足していませんが、誰も致命傷を負っていません。' };
  }

  function exceptions(state) {
    const s = normalize(state), list = [];
    if (s.humanException) list.push('「人間による学習は例外とする」');
    if (s.medical) list.push('「医療目的なら同意なしの学習を認める」');
    if (s.research) list.push('「研究目的なら許可なしの学習を認める」');
    if (s.oss) list.push('「オープンソースには規制を課さない」');
    if (s.bigtech) list.push('「大企業だけに還元・公開の義務を課す」');
    return list;
  }
  function unresolved(state) {
    const s = normalize(state);
    if (s.humanException) return '人間とAIの学習は、どこから別物になるのでしょう？';
    if (s.medical) return '同意より公益を優先してよいのは、どの程度の公益からでしょう？';
    if (s.userLiability) return '道具を配った人と、それで描いた人。責任はどこで切れるのでしょう？';
    if (s.targeting) return '「太い線」と「あの人の画風」の境目は、誰が決めるのでしょう？';
    if (s.permit) return '許可を取れない7億枚の転載画像は、誰の意思で学習されるのでしょう？';
    return '学習の自由と、その人の生活は、同じレバーで守れるのでしょうか？';
  }

  /* ---------- ニュース（電光掲示板） ---------- */
  function news(state) {
    const s = normalize(state), o = outcomes(s), v = id => o.byId[id].value;
    const lines = [];
    if (s.permit) { lines.push(`【速報】国内AI企業、${v('docs').toLocaleString()}件の権利処理を開始`); lines.push(`【続報】権利処理費用 推定${v('costAuto').toLocaleString()}円（自動）〜${(v('costHuman')/1e8).toFixed(1)}億円（人力）`); lines.push(`創作者への支払い 合計${v('toCreators').toLocaleString()}円`); }
    if (v('exits') > 0) lines.push(`【速報】国内AI企業${v('exits')}社が画像生成事業から撤退`);
    if (s.permit && !s.foreignBan) lines.push(`【続報】海外大手の国内シェア ${v('foreignShare')}%`);
    if (s.foreignBan) { lines.push('【速報】海外AIサービスへのアクセスを制限'); lines.push(`【続報】VPNの新規登録が14倍に。${v('vpn').toLocaleString()}人が海外AIを使い続けています`); }
    if (s.optout === 2) { lines.push('【速報】画像投稿時の本人確認が義務化'); lines.push(`【続報】投稿者${v('leavers').toLocaleString()}人が離脱`); }
    if (s.optout === 1) lines.push(`「使わないで」宣言は、転載された${v('dupMiss').toLocaleString()}枚には届きませんでした`);
    if (s.targeting) lines.push('【速報】「特定の作家を狙った学習」の定義をめぐり、最初の裁判が始まる');
    if (s.transparency) lines.push('【速報】学習データ一覧（推定65万件）が公開。閲覧数 41');
    if (s.levy) { lines.push(`基金に${v('fund').toLocaleString()}円が集まりました`); lines.push(`一人あたり ${v('perHead').toLocaleString()}円`); }
    if (!o.medicalOK) lines.push(`【速報】がん検診AIの研究が中止。年${v('cancer')}件の乳がんが、見つかるのが遅れます`);
    else if (s.medical) lines.push(`乳がん 年${v('cancer')}件を、より早く発見`);
    if (v('lostWork') > 0) lines.push(`ご協力ありがとうございます。${v('lostWork')}名が仕事を失いました。次の問題へ進みます`);
    lines.push('解決した倫理問題 0件');
    return lines;
  }

  function shareText(state) {
    const r = radar(state);
    return `私が守ったもの：「${r.top.name}」\n私が犠牲にしたもの：「${r.bottom.name}」\n最後まで解決できなかったもの：「${unresolved(state)}」\n#学習機関車`;
  }

  return { SCALE, SOURCES, BASE, ANCHORS, AXES, LEVERS, POINT, defaultState, normalize, radar, outcomes, archetype, exceptions, unresolved, news, shareText, active };
});
