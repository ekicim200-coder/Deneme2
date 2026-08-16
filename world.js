/* ============================================================
   world.js — Haritalar, moblar, bosslar, NPC'ler.
   Mob statları elle yazılmaz; balance.mobBase(level) eğrisinden
   arketip çarpanlarıyla türetilir. Yeni harita eklemek için
   MAPS dizisine tek nesne eklemek yeterli.
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(
    typeof require === 'function' ? require('./balance.js') : root.Balance);
  else root.WorldData = factory(root.Balance);
})(typeof self !== 'undefined' ? self : this, function (B) {
  'use strict';

  /* ---------- MOB ARKETİPLERİ ----------
     Aynı seviyede farklı his veren mob çeşitliliği sağlar.           */
  const ARCHETYPES = {
    weak: { hp: 0.72, atk: 0.80, def: 0.75, exp: 0.80, yang: 0.85, spd: 1.0, aspd: 1.0 },
    normal: { hp: 1.00, atk: 1.00, def: 1.00, exp: 1.00, yang: 1.00, spd: 1.0, aspd: 1.0 },
    swift: { hp: 0.82, atk: 0.92, def: 0.80, exp: 1.05, yang: 1.00, spd: 1.5, aspd: 1.45 },
    brute: { hp: 1.75, atk: 1.25, def: 1.35, exp: 1.55, yang: 1.45, spd: 0.8, aspd: 0.8 },
    caster: { hp: 0.85, atk: 1.30, def: 0.70, exp: 1.25, yang: 1.20, spd: 0.95, aspd: 0.9, magic: true },
    elite: { hp: 3.20, atk: 1.55, def: 1.60, exp: 3.20, yang: 3.00, spd: 1.0, aspd: 1.1 },
    boss: { hp: 14.0, atk: 2.10, def: 2.10, exp: 16.0, yang: 14.0, spd: 0.9, aspd: 1.0, boss: true }
  };

  function mobStats(level, archKey) {
    const a = ARCHETYPES[archKey] || ARCHETYPES.normal;
    const b = B.mobBase(level);
    return {
      hp: Math.round(b.hp * a.hp),
      atk: Math.round(b.atk * a.atk),
      def: Math.round(b.def * a.def),
      exp: Math.round(b.exp * a.exp),
      yang: Math.round(b.yang * a.yang),
      attackInterval: 2.0 / a.aspd,
      isBoss: !!a.boss,
      isMagic: !!a.magic
    };
  }

  /* ---------- DROP TABLOSU YARDIMCISI ----------
     chance = 0..1 (level farkı cezası ayrıca uygulanır)               */
  function D(id, chance, min, max) { return { id, chance, min: min || 1, max: max || (min || 1) }; }

  /* ---------- HARİTALAR ----------
     tier      : rarity tablosu kademesi
     equipTier : bu haritadan düşebilecek ekipman kademeleri [min,max]
     Düşük seviye harita asla yüksek kademe ekipman düşürmez.          */
  const MAPS = [
    {
      id: 'town', name: 'Akçay Kasabası', type: 'town', tier: 0, minLevel: 1, maxLevel: 100,
      desc: 'Taş surlarla çevrili sakin bir liman kasabası. Burada savaş yok.',
      theme: 'town', mobs: [], drops: [], equipTier: [0, 0]
    },
    {
      id: 'meadow', name: 'Sisli Çayır', type: 'field', tier: 1, minLevel: 1, maxLevel: 15, levelRange: [1, 12],
      desc: 'Kasabanın hemen dışında, sabah sisi hiç dağılmayan otlaklar.',
      theme: 'meadow', equipTier: [1, 2],
      mobs: [
        { id: 'burr_hound', name: 'Dikenli Tazı', arch: 'weak', lvl: [1, 4] },
        { id: 'mud_crawler', name: 'Balçık Sürüngeni', arch: 'normal', lvl: [3, 8] },
        { id: 'fen_stalker', name: 'Bataklık Avcısı', arch: 'swift', lvl: [7, 12] },
        { id: 'stone_toad', name: 'Taş Kurbağa', arch: 'brute', lvl: [10, 14] }
      ],
      boss: { id: 'greatwart', name: 'Ulu Siğilkurbağa', arch: 'boss', lvl: 15, respawn: 240 },
      drops: [D('iron_shard', 0.09, 1, 2), D('pot_hp_s', 0.07), D('pot_mp_s', 0.05)]
    },
    {
      id: 'darkwood', name: 'Karanlık Koru', type: 'field', tier: 2, minLevel: 15, maxLevel: 30, levelRange: [15, 28],
      desc: 'Güneşin dibine hiç inmediği, kökleri birbirine dolanmış yaşlı orman.',
      theme: 'forest', equipTier: [2, 3],
      mobs: [
        { id: 'thorn_wisp', name: 'Diken Cini', arch: 'swift', lvl: [15, 19] },
        { id: 'bark_golem', name: 'Kabuk Golemi', arch: 'brute', lvl: [18, 24] },
        { id: 'moss_shaman', name: 'Yosun Şamanı', arch: 'caster', lvl: [21, 27] },
        { id: 'wolf_kin', name: 'Koru Kurdu', arch: 'normal', lvl: [16, 28] }
      ],
      boss: { id: 'rootfather', name: 'Kök Ata', arch: 'boss', lvl: 30, respawn: 300 },
      drops: [D('iron_shard', 0.11, 1, 3), D('steel_shard', 0.05), D('pot_hp_m', 0.06), D('pot_mp_m', 0.05)]
    },
    {
      id: 'dunes', name: 'Kavrulmuş Kumul', type: 'field', tier: 3, minLevel: 30, maxLevel: 45, levelRange: [30, 43],
      desc: 'Rüzgârın her gece haritayı yeniden çizdiği, gölgesiz bir çöl.',
      theme: 'desert', equipTier: [3, 4],
      mobs: [
        { id: 'sand_lurker', name: 'Kum Pususu', arch: 'swift', lvl: [30, 34] },
        { id: 'bone_raider', name: 'Kemik Akıncı', arch: 'normal', lvl: [32, 38] },
        { id: 'glass_scorpion', name: 'Cam Akrep', arch: 'brute', lvl: [36, 42] },
        { id: 'dune_seer', name: 'Kumul Kâhini', arch: 'caster', lvl: [38, 43] }
      ],
      boss: { id: 'sirocco', name: 'Kumfırtınası Hanı', arch: 'boss', lvl: 45, respawn: 360 },
      drops: [D('steel_shard', 0.10, 1, 2), D('power_stone', 0.035), D('pot_hp_m', 0.07), D('scroll_upgrade', 0.012)]
    },
    {
      id: 'frostvale', name: 'Buz Vadisi', type: 'field', tier: 4, minLevel: 45, maxLevel: 60, levelRange: [45, 58],
      desc: 'Nefesin havada donduğu, buzun altında bir şeylerin kıpırdadığı vadi.',
      theme: 'ice', equipTier: [4, 5],
      mobs: [
        { id: 'rime_wight', name: 'Kırağı Hortlağı', arch: 'normal', lvl: [45, 50] },
        { id: 'ice_maw', name: 'Buz Ağzı', arch: 'brute', lvl: [48, 54] },
        { id: 'frost_witch', name: 'Ayaz Cadısı', arch: 'caster', lvl: [51, 57] },
        { id: 'glacier_kin', name: 'Buzul Muhafızı', arch: 'elite', lvl: [55, 58] }
      ],
      boss: { id: 'hoarking', name: 'Kırağı Kralı', arch: 'boss', lvl: 60, respawn: 420 },
      drops: [D('power_stone', 0.055, 1, 2), D('soul_stone', 0.022), D('pot_hp_l', 0.06), D('scroll_upgrade', 0.02), D('protect_stone', 0.006)]
    },
    {
      id: 'emberreach', name: 'Köz Yamacı', type: 'field', tier: 5, minLevel: 60, maxLevel: 75, levelRange: [60, 73],
      desc: 'Yanardağın kabuk bağlamış sırtı. Zemin hâlâ sıcak.',
      theme: 'volcano', equipTier: [5, 6],
      mobs: [
        { id: 'cinder_hound', name: 'Köz Tazısı', arch: 'swift', lvl: [60, 65] },
        { id: 'magma_brute', name: 'Magma Zorbası', arch: 'brute', lvl: [63, 69] },
        { id: 'ash_conjurer', name: 'Kül Büyücüsü', arch: 'caster', lvl: [66, 72] },
        { id: 'forge_sentinel', name: 'Ocak Muhafızı', arch: 'elite', lvl: [70, 73] }
      ],
      boss: { id: 'pyrelord', name: 'Ateş Efendisi', arch: 'boss', lvl: 75, respawn: 480 },
      drops: [D('soul_stone', 0.05, 1, 2), D('magic_stone', 0.018), D('pot_hp_l', 0.07), D('protect_stone', 0.012), D('scroll_upgrade', 0.03)]
    },
    {
      id: 'gravemarch', name: 'Ölüm Geçidi', type: 'field', tier: 6, minLevel: 75, maxLevel: 90, levelRange: [75, 88],
      desc: 'Eski bir ordunun yürüyüşte donup kaldığı geçit. Hâlâ yürüyorlar.',
      theme: 'grave', equipTier: [6, 6],
      mobs: [
        { id: 'pale_lancer', name: 'Solgun Mızrakçı', arch: 'normal', lvl: [75, 80] },
        { id: 'grave_titan', name: 'Mezar Devi', arch: 'brute', lvl: [78, 84] },
        { id: 'wail_binder', name: 'Feryat Bağlayıcı', arch: 'caster', lvl: [81, 87] },
        { id: 'dread_knight', name: 'Dehşet Şövalyesi', arch: 'elite', lvl: [85, 88] }
      ],
      boss: { id: 'marshal_null', name: 'Sessiz Mareşal', arch: 'boss', lvl: 90, respawn: 600 },
      drops: [D('magic_stone', 0.04, 1, 2), D('soul_stone', 0.08, 1, 2), D('protect_stone', 0.02), D('scroll_upgrade', 0.04)]
    },
    {
      id: 'starfall', name: 'Yıldızdüşü Krateri', type: 'field', tier: 7, minLevel: 90, maxLevel: 100, levelRange: [90, 99],
      desc: 'Gökten düşen şeyin açtığı çukur. Kenarındaki taşlar hâlâ ışıyor.',
      theme: 'star', equipTier: [7, 7],
      mobs: [
        { id: 'void_shard', name: 'Boşluk Kırığı', arch: 'swift', lvl: [90, 93] },
        { id: 'star_husk', name: 'Yıldız Kabuğu', arch: 'brute', lvl: [92, 96] },
        { id: 'null_seer', name: 'Hiçlik Kâhini', arch: 'caster', lvl: [94, 98] },
        { id: 'crater_warden', name: 'Krater Bekçisi', arch: 'elite', lvl: [96, 99] }
      ],
      boss: { id: 'the_fallen', name: 'Düşen', arch: 'boss', lvl: 100, respawn: 900 },
      drops: [D('magic_stone', 0.09, 1, 3), D('protect_stone', 0.035), D('scroll_upgrade', 0.06)]
    }
  ];

  /* ---------- BOSS EK DROPLARI ----------
     Boss'lar ek olarak garanti materyal ve yüksek item şansı verir.   */
  const BOSS_BONUS = {
    guaranteedItems: 1,       // en az 1 ekipman düşer
    extraItemChance: 0.45,    // ikinci ekipman şansı
    matBundle: 3,             // materyal drop'ları 3 katı adet
    bookChance: 0.30          // skill kitabı şansı
  };

  /* Normal moblardan ekipman düşme temel şansı (harita kademesine göre) */
  const ITEM_DROP_BASE = { 1: 0.055, 2: 0.050, 3: 0.046, 4: 0.042, 5: 0.038, 6: 0.035, 7: 0.032 };
  const BOOK_DROP_BASE = { 1: 0.000, 2: 0.004, 3: 0.006, 4: 0.008, 5: 0.010, 6: 0.012, 7: 0.014 };

  /* ---------- ŞEHİR NPC'LERİ ---------- */
  const NPCS = [
    { id: 'blacksmith', name: 'Demirci Vardan', role: 'shop_weapon', icon: '⚒', line: 'Keskin çelik pahalıdır, ama ucuz çelik daha pahalıya patlar.' },
    { id: 'armorer', name: 'Zırhçı Nesrin', role: 'shop_armor', icon: '🛡', line: 'Sırtını koruyan şey, cesaretinden daha uzun ömürlüdür.' },
    { id: 'alchemist', name: 'Şifacı Doruk', role: 'shop_potion', icon: '⚗', line: 'İki şişe al. Birini içmeyi unutacaksın.' },
    { id: 'refiner', name: 'Usta Kayra', role: 'upgrade', icon: '🔨', line: 'Demiri zorlarsan kırılır. Ama zorlamazsan da öylece kalır.' },
    { id: 'trainer', name: 'Eğitmen Sarp', role: 'skill', icon: '📜', line: 'Bir tekniği bin kez tekrar et, bin tekniği bir kez değil.' },
    { id: 'porter', name: 'Kervancı Ilgaz', role: 'teleport', icon: '🧭', line: 'Yolun uzunluğu, cebinin derinliğiyle ters orantılıdır.' }
  ];

  function mapById(id) { return MAPS.find(m => m.id === id); }
  function mobDef(mapId, mobId) {
    const m = mapById(mapId); if (!m) return null;
    if (m.boss && m.boss.id === mobId) return m.boss;
    return m.mobs.find(x => x.id === mobId);
  }

  return { ARCHETYPES, mobStats, MAPS, NPCS, BOSS_BONUS, ITEM_DROP_BASE, BOOK_DROP_BASE, mapById, mobDef };
});
