// neObjects.js
// -----------------------------------------------------------------------------
// North-Eastern India cultural object bank for the Object Recognition game.
//
// Each object carries:
//   id          unique slug (also used as the image filename: `${id}.jpg`)
//   name        canonical display name (shown on reveal / in results)
//   accepted    accepted answers: canonical + local spellings + plain-English
//               descriptors. Matching is fuzzy (typo tolerant) on top of this.
//   region      state / region the object belongs to (accurate, not random)
//   category    cultural category
//   difficulty  'easy' | 'medium' | 'hard'
//   emoji       fallback glyph shown when no photo is available yet
//   hint1       gentle, mostly-visual hint (after the 1st wrong attempt)
//   hint2       stronger contextual hint (after the 2nd wrong attempt)
//   fact        one-line cultural note, revealed once the question ends
//
// Add real photos at /public/images/ne-objects/<id>.jpg (see IMAGE_BASE in
// PictureRecallGame.jsx). Until then the emoji fallback card is shown.
// -----------------------------------------------------------------------------

export function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const NE_OBJECTS = [
  // ---- EASY -----------------------------------------------------------------
  {
    id: 'gamosa', name: 'Gamosa', region: 'Assam', category: 'Traditional textile', difficulty: 'easy', emoji: '🧣',
    accepted: ['gamosa', 'gamusa', 'gamocha', 'gamsa', 'bihuwan'],
    hint1: 'It is a white handwoven cloth with bright red woven borders and motifs.',
    hint2: 'In Assam it is given to guests and elders as a mark of respect, and is a symbol of Bihu.',
    fact: 'The Gamosa is a proud emblem of Assamese identity, gifted as a token of honour.'
  },

  {
    id: 'japi', name: 'Japi', region: 'Assam', category: 'Traditional headgear', difficulty: 'easy', emoji: '👒',
    accepted: ['japi', 'jaapi', 'japee', 'bamboo hat', 'conical hat'],
    hint1: 'It is a wide, cone-shaped hat woven from bamboo and palm (tokou) leaves.',
    hint2: 'Farmers wear it against sun and rain; decorated ones hang in Assamese homes as a welcome.',
    fact: 'The colourful phulam japi is a decorative symbol of Assam, once a mark of status.'
  },

  {
    id: 'prayer-flags', name: 'Prayer flags', region: 'Sikkim', category: 'Buddhist ritual object', difficulty: 'easy', emoji: '🎏',
    accepted: ['prayer flags', 'prayer flag', 'lungta', 'dar cho', 'darcho', 'buddhist flags'],
    hint1: 'Strings of small square cloth flags in five colours, strung across hills and bridges.',
    hint2: 'Printed with mantras; the wind is believed to carry the prayers across the land.',
    fact: 'Common across Buddhist Sikkim, the five colours stand for the elements: sky, air, fire, water, earth.'
  },

  {
    id: 'prayer-wheel', name: 'Prayer wheel', region: 'Sikkim', category: 'Buddhist ritual object', difficulty: 'easy', emoji: '🛞',
    accepted: ['prayer wheel', 'mani wheel', 'mani', 'buddhist wheel', 'spinning wheel'],
    hint1: 'A cylinder on a spindle that a person spins with the hand.',
    hint2: 'Found in monasteries; spinning it is believed to send out the prayers rolled inside.',
    fact: 'Prayer wheels line the monasteries of Sikkim; devotees spin them clockwise while walking.'
  },

  {
    id: 'pitha', name: 'Pitha', region: 'Assam', category: 'Traditional food', difficulty: 'easy', emoji: '🥮',
    accepted: ['pitha', 'pithe', 'til pitha', 'rice cake', 'rice cakes'],
    hint1: 'A rolled or folded rice cake, often filled with sesame or coconut and jaggery.',
    hint2: 'Made from rice flour, it is a must-have sweet during the Bihu harvest festival.',
    fact: 'Til pitha and ghila pitha are prepared in Assamese homes during Magh Bihu.'
  },

  {
    id: 'khada', name: 'Khada', region: 'Sikkim', category: 'Ceremonial cloth', difficulty: 'easy', emoji: '🧣',
    accepted: ['khada', 'khata', 'khatag', 'ceremonial scarf', 'silk scarf', 'greeting scarf'],
    hint1: 'A long, light silk scarf, usually white or pale, offered with both hands.',
    hint2: 'In Buddhist Sikkim it is draped around a guest or elder as a warm greeting and blessing.',
    fact: 'Offering a khada is a gesture of goodwill, respect and welcome in the Himalayan communities.'
  },

  // ---- MEDIUM ---------------------------------------------------------------
  {
    id: 'xorai', name: 'Xorai', region: 'Assam', category: 'Bell-metal craft', difficulty: 'medium', emoji: '🏆',
    accepted: ['xorai', 'sorai', 'xoraai', 'bell metal tray', 'offering tray'],
    hint1: 'A shining bell-metal tray that stands on a base and often has a matching cover.',
    hint2: 'Made in Sarthebari, it is used to offer betel nut and gifts, and to honour guests.',
    fact: 'The Xorai is both a household article and a respected symbol of Assamese culture.'
  },

  {
    id: 'phanek', name: 'Phanek', region: 'Manipur', category: 'Traditional clothing', difficulty: 'medium', emoji: '👗',
    accepted: ['phanek', 'faanek', 'fanek', 'wrap skirt', 'wraparound skirt'],
    hint1: 'A wrap-around lower garment worn by women, often with horizontal stripes or borders.',
    hint2: 'Handwoven in Manipur, it is worn with an upper shawl called the innaphi.',
    fact: 'The phanek is everyday and ceremonial wear for Manipuri women; some are embroidered by hand.'
  },

  {
    id: 'jainsem', name: 'Jainsem', region: 'Meghalaya', category: 'Traditional clothing', difficulty: 'medium', emoji: '👘',
    accepted: ['jainsem', 'jainsen', 'khasi dress', 'dhara'],
    hint1: 'A dress made of several pieces of cloth pinned at the shoulders, giving a flowing shape.',
    hint2: 'It is the traditional attire of Khasi women in Meghalaya.',
    fact: 'The jainsem drapes the body in soft folds and is worn at Khasi festivals like Ka Shad Suk Mynsiem.'
  },

  {
    id: 'living-root-bridge', name: 'Living root bridge', region: 'Meghalaya', category: 'Heritage structure', difficulty: 'medium', emoji: '🌉',
    accepted: ['living root bridge', 'living root bridges', 'root bridge', 'jingkieng jri', 'double decker bridge'],
    hint1: 'A footbridge that is alive — grown, not built — from the roots of a tree across a stream.',
    hint2: 'Khasi and Jaintia people train rubber-fig roots for years to form these bridges in Meghalaya.',
    fact: 'The double-decker root bridge of Nongriat is a famous example, strengthening with age.'
  },

  {
    id: 'naga-shawl', name: 'Naga shawl', region: 'Nagaland', category: 'Traditional textile', difficulty: 'medium', emoji: '🧶',
    accepted: ['naga shawl', 'naga shawls', 'tsungkotepsu', 'shawl', 'warrior shawl'],
    hint1: 'A bold woven shawl with black, red and white bands and striking tribal motifs.',
    hint2: 'Among the Ao Nagas, patterns like the tsüngkotepsü were once earned by warriors and feast-givers.',
    fact: 'Each Naga tribe has its own shawl design; the motifs signal status, valour and clan.'
  },

  {
    id: 'khuang', name: 'Khuang', region: 'Mizoram', category: 'Musical instrument', difficulty: 'medium', emoji: '🥁',
    accepted: ['khuang', 'mizo drum', 'drum'],
    hint1: 'A hollow wooden drum with skin on both ends, played with the hands.',
    hint2: 'It sets the beat for Mizo dances and festivals such as Chapchar Kut.',
    fact: 'The khuang is considered the most important traditional instrument of the Mizo people.'
  },

  {
    id: 'puanchei', name: 'Puanchei', region: 'Mizoram', category: 'Traditional textile', difficulty: 'medium', emoji: '🧵',
    accepted: ['puanchei', 'puan chei', 'mizo cloth', 'dance cloth'],
    hint1: 'A colourful woven cloth with dense bands of red, black, yellow and white patterns.',
    hint2: 'Mizo women wear it for dances like Cheraw (the bamboo dance) and at weddings.',
    fact: 'The puanchei is the most treasured festive cloth of a Mizo woman.'
  },

  {
    id: 'risa', name: 'Risa', region: 'Tripura', category: 'Traditional textile', difficulty: 'medium', emoji: '🧵',
    accepted: ['risa', 'risha', 'tripuri cloth'],
    hint1: 'A narrow handwoven cloth used as an upper wrap, headgear or sash.',
    hint2: 'It is part of the Tripuri women’s three-piece attire, with the rignai and rikutu.',
    fact: 'A risa is gifted at ceremonies in Tripura and given to youths in a coming-of-age ritual.'
  },

  {
    id: 'kauna-mat', name: 'Kauna mat', region: 'Manipur', category: 'Handicraft', difficulty: 'medium', emoji: '🟫',
    accepted: ['kauna mat', 'kauna', 'reed mat', 'water reed mat', 'mat'],
    hint1: 'A smooth mat or cushion woven from soft, dried water-reed stems.',
    hint2: 'Kauna reed grows in the wetlands of Manipur and is crafted into mats, cushions and bags.',
    fact: 'Kauna craft is an eco-friendly cottage industry centred in Manipur’s marshlands.'
  },

  {
    id: 'jakoi', name: 'Jakoi', region: 'Assam', category: 'Fishing tool', difficulty: 'medium', emoji: '🎣',
    accepted: ['jakoi', 'jekoi', 'fishing scoop', 'bamboo fishing trap', 'fish trap'],
    hint1: 'A triangular bamboo-and-cane scoop pushed through shallow water to catch small fish.',
    hint2: 'Assamese villagers use it in paddy fields and ponds, often together with a basket called khaloi.',
    fact: 'The jakoi is traditional community fishing gear seen across rural Assam.'
  },

  {
    id: 'bamboo-shoot', name: 'Bamboo shoot', region: 'North-East India', category: 'Traditional food', difficulty: 'medium', emoji: '🎍',
    accepted: ['bamboo shoot', 'bamboo shoots', 'khorisa', 'bastenga', 'bamboo'],
    hint1: 'The tender young cone-shaped sprout of a bamboo plant, eaten as a vegetable.',
    hint2: 'Fermented or fresh, it flavours curries across Assam, Nagaland, Manipur and Mizoram.',
    fact: 'Fermented bamboo shoot (khorisa) is a beloved tangy ingredient in North-Eastern kitchens.'
  },

  // ---- HARD -----------------------------------------------------------------
  {
    id: 'pena', name: 'Pena', region: 'Manipur', category: 'Musical instrument', difficulty: 'hard', emoji: '🎻',
    accepted: ['pena', 'penna', 'manipuri fiddle', 'one string fiddle'],
    hint1: 'A one-stringed fiddle: a rounded sound-cup joined to a rod, played with a curved bow.',
    hint2: 'This Manipuri instrument accompanies the singing of old ballads and ritual songs.',
    fact: 'The pena is central to Manipuri Lai Haraoba festivals; players are working to revive the art.'
  },

  {
    id: 'knup', name: 'Knup', region: 'Meghalaya', category: 'Handicraft', difficulty: 'hard', emoji: '⛑️',
    accepted: ['knup', 'khasi rain shield', 'rain shield', 'rain cover'],
    hint1: 'A large curved shield of bamboo and leaves that a person wears over the back like a shell.',
    hint2: 'Khasi farmers in Meghalaya wear it in the fields as a full-body cover against heavy rain.',
    fact: 'The knup keeps both hands free for work in one of the rainiest regions on earth.'
  },

  {
    id: 'log-drum', name: 'Log drum', region: 'Nagaland', category: 'Musical instrument', difficulty: 'hard', emoji: '🪘',
    accepted: ['log drum', 'wooden drum', 'naga log drum', 'dram'],
    hint1: 'A huge drum hollowed from a single tree trunk, beaten by many people with wooden sticks.',
    hint2: 'Kept in the Naga village, its deep sound once carried news, warnings and calls to gather.',
    fact: 'The log drum is often carved with buffalo (mithun) heads and is a symbol of village unity.'
  },

  {
    id: 'monpa-mask', name: 'Monpa mask', region: 'Arunachal Pradesh', category: 'Ritual craft', difficulty: 'hard', emoji: '🎭',
    accepted: ['monpa mask', 'mask', 'cham mask', 'dance mask', 'yak dance mask'],
    hint1: 'A bold carved-and-painted wooden face-mask, sometimes of an animal or a fierce deity.',
    hint2: 'The Monpa people of Tawang wear such masks in Buddhist Cham (mask) dances.',
    fact: 'Monpa mask-making is a hereditary craft tied to the monasteries of western Arunachal.'
  },

  {
    id: 'thangka', name: 'Thangka', region: 'Sikkim', category: 'Buddhist painting', difficulty: 'hard', emoji: '🖼️',
    accepted: ['thangka', 'tangka', 'thanka', 'scroll painting', 'buddhist painting'],
    hint1: 'A detailed religious painting on cloth, framed in silk brocade so it can be rolled up.',
    hint2: 'It usually shows the Buddha or a deity and hangs in monasteries of Sikkim and Tawang.',
    fact: 'Thangkas are used for teaching and meditation, painted with fine mineral colours.'
  },

  {
    id: 'pepa', name: 'Pepa', region: 'Assam', category: 'Musical instrument', difficulty: 'hard', emoji: '📯',
    accepted: ['pepa', 'buffalo horn pipe', 'horn pipe', 'hornpipe'],
    hint1: 'A wind instrument ending in a curved buffalo horn, giving a bright, reedy blast.',
    hint2: 'Its sound opens the Bihu dance in Assam and is tied to the joy of spring.',
    fact: 'The pepa is made from a buffalo horn fitted to a pipe, iconic to Rongali Bihu.'
  },

  {
    id: 'axone', name: 'Axone', region: 'Nagaland', category: 'Traditional food', difficulty: 'hard', emoji: '🫘',
    accepted: ['axone', 'akhuni', 'fermented soybean', 'fermented soya bean'],
    hint1: 'A strong-smelling paste or cake made from fermented soybeans.',
    hint2: 'The Sumi Naga of Nagaland cook it with pork and chillies as a prized flavouring.',
    fact: 'Axone (akhuni) is a signature fermented food of Naga cuisine, valued for its deep umami.'
  },
];

// -----------------------------------------------------------------------------
// Difficulty pools. Each session draws `count` objects for the chosen level.
//   easy   -> only easy objects (most familiar, visually distinct)
//   medium -> only medium objects
//   hard   -> hard objects first, topped up with medium ones
// If a pool is smaller than the requested count it widens to the whole bank.
// -----------------------------------------------------------------------------
const DIFFICULTY_POOLS = {
  easy: ['easy'],
  medium: ['medium'],
  hard: ['hard', 'medium'],
};

export function selectObjects(difficulty, count) {
  const allowed = DIFFICULTY_POOLS[difficulty] || ['easy'];
  // Preserve tier priority (e.g. hard before medium) then shuffle within.
  let pool = allowed.flatMap((tier) =>
    shuffle(NE_OBJECTS.filter((o) => o.difficulty === tier))
  );
  if (pool.length < count) {
    const extra = shuffle(NE_OBJECTS.filter((o) => !pool.includes(o)));
    pool = [...pool, ...extra];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

export function getObjectById(id) {
  return NE_OBJECTS.find((o) => o.id === id) || null;
}