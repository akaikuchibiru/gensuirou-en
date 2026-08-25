// ════════════════════════════════════════════════════════════════════
//  客室 12 室
//
//  数字・構成・お風呂・日本語の紹介文は、すべて本番 gensuirou.com の
//  各客室ページに掲載されている内容をそのまま持ってきたもの。
//  作った数字は 1 つも無い (docs/rooms-from-live-site.json が抽出の記録)。
//
//  ⚠ 英語と中国語の紹介文は、紫 Shiori 以外は **こちらで日本語から訳したもの**。
//    高級旅館のブランド文なので、公開前に旅館側の確認が要る。
//    `node scripts/dump-translations.mjs` で確認用の一覧を出せる。
//    確認が済んだ室は reviewed: true にする。
//
//  碧 Midori と 凛 Rin は 2 階建てで、本番も階別に面積を出している。
//  勝手に合算しない (掲載どおりが正)。
// ════════════════════════════════════════════════════════════════════

import { ROOM_PHOTOS } from './room-photos.js';

export const ROOM_ORDER = [
  'shiori', 'aoi', 'hana', 'midori', 'ei', 'yui',
  'rin', 'sora', 'zui', 'sumeragi', 'zen', 'sou',
];

export const ROOMS = {
  shiori: {
    kanji: '紫', roman: 'Shiori',
    area: { ja: '77.02 m²', en: '77.02 m²', zh: '77.02 m²' },
    capacity: 2,
    reviewed: true,   // もともとサイトに載っていた訳
    desc: {
      ja: '小国杉を使った数寄屋造りの中、柾割竹で作られた扉により異彩を放つ美しさと共に開放感を感じられます。離れの囲炉裏の間もあり、プライベート感のあるお部屋です。',
      en: 'Within sukiya-style walls of Oguni cedar, split-bamboo doors bring an unusual beauty and quiet openness. A detached irori (hearth) room gives Shiori its private, contemplative air.',
      zh: '以小国杉建造的数寄屋建筑中，柾割竹门带来独特之美与开阔之感。别设围炉间，尽显私密氛围。',
    },
    composition: {
      ja: '9.7帖の和室、9帖の和室、化粧の間、洗面室、3帖の囲炉裏座敷、デッキスペース',
      en: '9.7-mat washitsu, 9-mat washitsu, powder room, wash area, 3-mat irori-zashiki (hearth room), deck',
      zh: '9.7 帖和室、9 帖和室、化妆间、洗面室、3 帖围炉座敷、木质露台',
    },
    bath: {
      ja: '内湯、露天岩風呂＋寝湯',
      en: 'Indoor bath, open-air rock bath + reclining bath',
      zh: '室内浴、露天岩浴 + 卧浴',
    },
  },

  aoi: {
    kanji: '葵', roman: 'Aoi',
    area: { ja: '69.56 m²', en: '69.56 m²', zh: '69.56 m²' },
    capacity: 2,
    desc: {
      ja: '内湯から外湯へ流れるように繋がるお風呂が特別な空間を演出しています。デッキスペースやアウトドアリビングでゆっくりとお過ごしいただけるお部屋です。',
      en: 'The indoor bath flows outward into the open air as one continuous space. A deck and an outdoor living area invite long, unhurried hours.',
      zh: '内汤如水流般延伸至外汤，营造出独特的空间。木质露台与户外起居空间，让人得以久坐慢度。',
    },
    composition: {
      ja: '8帖のベッドルーム、9帖の和室、化粧の間、洗面室、アウトドアリビング、デッキスペース',
      en: '8-mat bedroom, 9-mat washitsu, powder room, wash area, outdoor living area, deck',
      zh: '8 帖卧室、9 帖和室、化妆间、洗面室、户外起居空间、木质露台',
    },
    bath: {
      ja: '内湯、露天風呂＋寝湯',
      en: 'Indoor bath, open-air bath + reclining bath',
      zh: '室内浴、露天浴 + 卧浴',
    },
  },

  hana: {
    kanji: '華', roman: 'Hana',
    area: { ja: '61.28 m²', en: '61.28 m²', zh: '61.28 m²' },
    capacity: 2,
    desc: {
      ja: 'ガラス張りの開放感のある内湯や屋根のある広々としたデッキスペースと半露天風呂は、雨の日でも屋外で情緒あるゆっくりとした時間を過ごすことができます。',
      en: 'A glass-walled indoor bath, a broad roofed deck and a semi-open-air bath let you stay outdoors even in rain, and take your time there.',
      zh: '玻璃环绕、开阔通透的内汤，与带顶宽敞露台上的半露天风吕，即便雨天亦可在户外从容度过。',
    },
    composition: {
      ja: '8帖のベッドルーム、8帖の和室、洗面室、デッキスペース',
      en: '8-mat bedroom, 8-mat washitsu, wash area, deck',
      zh: '8 帖卧室、8 帖和室、洗面室、木质露台',
    },
    bath: {
      ja: '内湯、露天風呂＋寝湯',
      en: 'Indoor bath, open-air bath + reclining bath',
      zh: '室内浴、露天浴 + 卧浴',
    },
  },

  midori: {
    kanji: '碧', roman: 'Midori',
    // 2 階建て。本番の表記どおり階別に出す。
    area: { ja: '1階 63.76 m² ／ 2階 28.15 m²', en: '1F 63.76 m² / 2F 28.15 m²', zh: '一层 63.76 m² / 二层 28.15 m²' },
    capacity: 4,
    desc: {
      ja: 'リビングルーム以外にも広々としたリクライニングルームが併設されている他、二階には眺望の良い和室もあり、夏季にはプールでリゾート気分を味わうこともできるラグジュアリーなお部屋です。',
      en: 'Beyond the living room there is a generous reclining room, and upstairs a washitsu with a view. In summer the pool brings a resort ease to the stay.',
      zh: '除起居室外另设宽敞的休憩室，二层还有视野开阔的和室。夏季可享泳池，度假感十足的奢华客房。',
    },
    composition: {
      ja: '5.8帖のリビングルーム、11.7帖のリビングルーム、9.2帖のベッドルーム＋パウダールーム、洗面室、デッキスペース',
      en: '5.8-mat living room, 11.7-mat living room, 9.2-mat bedroom + powder room, wash area, deck',
      zh: '5.8 帖起居室、11.7 帖起居室、9.2 帖卧室 + 化妆间、洗面室、木质露台',
    },
    bath: {
      ja: '内湯、露天風呂＋プール（夏季のみ）',
      en: 'Indoor bath, open-air bath + pool (summer only)',
      zh: '室内浴、露天浴 + 泳池（仅夏季）',
    },
    note: {
      ja: '※ プールご利用の際は水着をご持参下さいませ。',
      en: 'Please bring your own swimwear for the pool.',
      zh: '※ 使用泳池时请自备泳衣。',
    },
  },

  ei: {
    kanji: '瑩', roman: 'Ei',
    area: { ja: '82.20 m²', en: '82.20 m²', zh: '82.20 m²' },
    capacity: 3,
    desc: {
      ja: '遠くの木々を見渡せる開放的なリビングや露天風呂など非日常な空間と時間をお過ごし頂けます。バーカウンターや洗濯機などもありロングステイにもお勧めのお部屋です。',
      en: 'An open living room looking out over distant trees, and an open-air bath — hours set apart from the everyday. A bar counter and a washing machine make it suited to longer stays.',
      zh: '可远眺林木的开阔起居室与露天浴，让人度过远离日常的时光。设有吧台与洗衣机，亦适合长期停留。',
    },
    composition: {
      ja: '10.2帖のベッドルーム、8.1帖の和室、7.3帖のリビングルーム、洗面室',
      en: '10.2-mat bedroom, 8.1-mat washitsu, 7.3-mat living room, wash area',
      zh: '10.2 帖卧室、8.1 帖和室、7.3 帖起居室、洗面室',
    },
    bath: { ja: '内湯、露天風呂', en: 'Indoor bath, open-air bath', zh: '室内浴、露天浴' },
  },

  yui: {
    kanji: '結', roman: 'Yui',
    area: { ja: '86.39 m²', en: '86.39 m²', zh: '86.39 m²' },
    capacity: 2,
    desc: {
      ja: '広々とした露天風呂や隠れ家のようなサウナ、小国杉を使った空間や格天井はラグジュアリー感とともに温もりを感じさせてくれます。',
      en: 'A wide open-air bath, a sauna like a hideaway, Oguni cedar and a coffered ceiling — luxury here carries warmth with it.',
      zh: '宽阔的露天浴与如隐所般的桑拿，小国杉的空间与格天井，在奢华之中透出温度。',
    },
    composition: {
      ja: '8帖のベッドルーム、10.2帖の和室、6帖の洋室、洗面室、デッキスペース',
      en: '8-mat bedroom, 10.2-mat washitsu, 6-mat western-style room, wash area, deck',
      zh: '8 帖卧室、10.2 帖和室、6 帖洋室、洗面室、木质露台',
    },
    bath: {
      ja: '内湯＋シャワールーム、露天岩風呂＋サウナ付き露天風呂（水風呂）',
      en: 'Indoor bath + shower room, open-air rock bath + open-air bath with sauna (cold plunge)',
      zh: '室内浴 + 淋浴间、露天岩浴 + 附桑拿的露天浴（冷水浴）',
    },
  },

  rin: {
    kanji: '凛', roman: 'Rin',
    area: { ja: '1階 103.20 m² ／ 2階 24.49 m²', en: '1F 103.20 m² / 2F 24.49 m²', zh: '一层 103.20 m² / 二层 24.49 m²' },
    capacity: 2,
    desc: {
      ja: '柾割竹の扉を開け放てばまるで阿蘇そのものを表現した庭園が広がります。開放的な庭と5mの天井高のリビングは阿蘇を独り占めするような贅沢な空間を演出しています。二階には展望露天風呂もあり眺望を楽しむことも。',
      en: 'Throw open the split-bamboo doors and a garden unfolds that reads as Aso itself. The open garden and a living room five metres to the ceiling give the sense of having Aso to yourself. Upstairs, an open-air bath with a view.',
      zh: '推开柾割竹门，宛如阿苏本身的庭园便在眼前展开。开阔的庭院与 5 米挑高的起居室，仿佛将阿苏独享。二层另设观景露天浴。',
    },
    composition: {
      ja: '11帖のベッドルーム、9帖のリビングルーム、6帖の和室、洗面室、デッキスペース',
      en: '11-mat bedroom, 9-mat living room, 6-mat washitsu, wash area, deck',
      zh: '11 帖卧室、9 帖起居室、6 帖和室、洗面室、木质露台',
    },
    bath: {
      ja: '足湯、半露天風呂＋シャワールーム、2階：展望露天風呂',
      en: 'Foot bath, semi-open-air bath + shower room, 2F: open-air bath with a view',
      zh: '足汤、半露天浴 + 淋浴间、二层：观景露天浴',
    },
  },

  sora: {
    kanji: '宙', roman: 'Sora',
    area: { ja: '127.57 m²', en: '127.57 m²', zh: '127.57 m²' },
    capacity: 2,
    desc: {
      ja: '広々とした開放的な和モダンリビングの目の前には屋外プールやバーカウンターが広がるリゾート感あふれるお部屋です。畳の間や坪庭などもあり長期滞在中に自分時間を作ることもできます。',
      en: 'A wide, open living room in a modern Japanese idiom, with an outdoor pool and bar counter directly before it. A tatami room and a tsuboniwa (courtyard garden) leave room for time to yourself on a longer stay.',
      zh: '宽敞开阔的和风现代起居室之前，是户外泳池与吧台，度假气息浓厚。另设榻榻米间与坪庭，长住时也能拥有独处的时间。',
    },
    composition: {
      ja: '8帖のベッドルーム、8帖のリビングルーム、8帖の和室、3帖の畳の間＋坪庭、洗面室、テラスリビング',
      en: '8-mat bedroom, 8-mat living room, 8-mat washitsu, 3-mat tatami room + tsuboniwa, wash area, terrace living',
      zh: '8 帖卧室、8 帖起居室、8 帖和室、3 帖榻榻米间 + 坪庭、洗面室、露台起居空间',
    },
    bath: {
      ja: '桧風呂、半露天風呂、シャワールーム、プール（夏季のみ）',
      en: 'Hinoki bath, semi-open-air bath, shower room, pool (summer only)',
      zh: '桧木浴、半露天浴、淋浴间、泳池（仅夏季）',
    },
    note: {
      ja: '※ プールをご利用の際は水着をご持参下さいませ。',
      en: 'Please bring your own swimwear for the pool.',
      zh: '※ 使用泳池时请自备泳衣。',
    },
  },

  zui: {
    kanji: '瑞', roman: 'Zui',
    area: { ja: '69.37 m²', en: '69.37 m²', zh: '69.37 m²' },
    capacity: 2,
    desc: {
      ja: '専用アプローチがプライベート感を演出。掘りごたつのリビングの目の前には遠くの木々が見渡せる開放的なロケーションが広がります。テラスには足湯もあり、様々な過ごし方ができるお部屋です。',
      en: 'A private approach sets the tone. Before the sunken-hearth living room the view opens out across distant trees, and a foot bath on the terrace leaves the day open to be spent as you like.',
      zh: '专用通道营造私密感。掘炬燵起居室之前，是可远眺林木的开阔景致。露台设有足汤，度过方式随心。',
    },
    composition: {
      ja: '11.5帖のベッドルーム、9.7帖の和室、洗面室、水盤の見えるデッキスペース',
      en: '11.5-mat bedroom, 9.7-mat washitsu, wash area, deck overlooking the water basin',
      zh: '11.5 帖卧室、9.7 帖和室、洗面室、可望水盘的木质露台',
    },
    bath: {
      ja: '足湯、内湯＋シャワールーム、露天風呂',
      en: 'Foot bath, indoor bath + shower room, open-air bath',
      zh: '足汤、室内浴 + 淋浴间、露天浴',
    },
  },

  sumeragi: {
    kanji: '皇', roman: 'Sumeragi',
    area: { ja: '134.77 m²', en: '134.77 m²', zh: '134.77 m²' },
    capacity: 4,
    desc: {
      ja: '和と洋が融合したアンティークなリビングに広々とした和室、縁側の向こうには雄大な庭園が広がり、桧の露天風呂に入りながら自然そのものを体感できます。',
      en: 'An antique living room where Japanese and Western meet, a generous washitsu, and beyond the engawa a broad garden. From the open-air hinoki bath, nature is close at hand.',
      zh: '和洋交融的古典起居室与宽敞和室，缘侧之外是雄伟的庭园。浸于桧木露天浴中，可切身感受自然。',
    },
    composition: {
      ja: '10.2帖のベッドルーム、9.1帖の和室＋縁側、10.2帖のリビングルーム、7.6帖の和室、洗面室',
      en: '10.2-mat bedroom, 9.1-mat washitsu + engawa (veranda), 10.2-mat living room, 7.6-mat washitsu, wash area',
      zh: '10.2 帖卧室、9.1 帖和室 + 缘侧、10.2 帖起居室、7.6 帖和室、洗面室',
    },
    bath: { ja: '内湯、露天桧風呂', en: 'Indoor bath, open-air hinoki bath', zh: '室内浴、露天桧木浴' },
  },

  zen: {
    kanji: '禅', roman: 'Zen',
    area: { ja: '77.01 m²', en: '77.01 m²', zh: '77.01 m²' },
    capacity: 3,
    desc: {
      ja: '箱庭を眺めながらの半露天風呂や、寝室のすぐ横には足湯もあり、朝一のお風呂代わりも。古民家風数寄屋作りの温かみのあるお部屋です。',
      en: 'A semi-open-air bath looking onto a miniature garden, and a foot bath just beside the bedroom that can stand in for a first bath of the morning. Sukiya carpentry in an old-farmhouse register, and warm with it.',
      zh: '可眺望箱庭的半露天浴，卧室旁另设足汤，亦可作晨间小浴。古民居风数寄屋建造，温润宜人。',
    },
    composition: {
      ja: '8.2帖のベッドルーム、8.1帖の和室、6.8帖のトレーニングルーム、洗面室',
      en: '8.2-mat bedroom, 8.1-mat washitsu, 6.8-mat training room, wash area',
      zh: '8.2 帖卧室、8.1 帖和室、6.8 帖健身房、洗面室',
    },
    bath: { ja: 'シャワールーム、露天風呂', en: 'Shower room, open-air bath', zh: '淋浴间、露天浴' },
  },

  sou: {
    kanji: '想', roman: 'Sou',
    area: { ja: '76.18 m²', en: '76.18 m²', zh: '76.18 m²' },
    capacity: 2,
    desc: {
      ja: '回廊を歩いて行くと、そこは大正ロマン漂う古民家のような玄関アプローチ。要所に朱色を基調にした装飾を施したお部屋です。内湯のアコーディオンドアをフルオープンすると広々としたリビングデッキスペースとつながり、半露天風呂気分が味わえます。',
      en: 'Down the corridor, an entrance approach like an old house in the Taisho romantic manner, with vermilion detailing placed where it counts. Open the accordion doors of the indoor bath fully and it joins the broad living deck, becoming half open-air.',
      zh: '沿回廊而行，是漂着大正浪漫气息的古民居式玄关。要处施以朱色为基调的装饰。将内汤的折叠门完全敞开，便与宽敞的起居露台相连，可享半露天之趣。',
    },
    composition: {
      ja: '8.1帖のベッドルーム＋縁側、8.1帖の和室、洗面室',
      en: '8.1-mat bedroom + engawa (veranda), 8.1-mat washitsu, wash area',
      zh: '8.1 帖卧室 + 缘侧、8.1 帖和室、洗面室',
    },
    bath: {
      ja: '半露天風呂＋大デッキスペース、シャワールーム',
      en: 'Semi-open-air bath + large deck, shower room',
      zh: '半露天浴 + 大露台、淋浴间',
    },
  },
};

// 全室に共通する事項。本番の各室ページにも同じ内容が繰り返し書かれている。
export const COMMON = {
  spring: {
    ja: 'アルカリ性単純温泉。肌触りが柔らかく、肌への刺激が少ないのが特徴です。',
    en: 'An alkaline simple spring — soft on the skin, and gentle.',
    zh: '碱性单纯泉。触感柔和，对肌肤刺激较小。',
  },
  checkin: { ja: '15:30（最終 18:00）', en: '15:30 (latest 18:00)', zh: '15:30（最迟 18:00）' },
  checkout: { ja: '11:00', en: '11:00', zh: '11:00' },
};

/**
 * 客室写真。本番から取り込んだ 600x460 を室ごとに 7〜12 枚。
 *
 * 以前は各室 2 枚 350x350 しか無く、325px 幅の枠に入れていたので
 * 2 倍ディスプレイでは輪郭が溶けていた。旅館の売り物は写真なので、
 * ここを小さいままにしない。
 */
export function roomImages(slug) {
  const photos = ROOM_PHOTOS[slug];
  if (photos && photos.length) return photos;
  // 取り込み漏れがあっても真っ白にはしない。
  return [`/assets/imgs_rooms/${slug}_a.jpg`, `/assets/imgs_rooms/${slug}_b.jpg`];
}
