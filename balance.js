/* ============================================================
   balance.js — Tüm progression eğrileri tek dosyada.
   Buradaki sayıları değiştirerek oyunun tamamını dengeleyebilirsin.
   Hiçbir sistem kendi içinde sabit sayı tutmaz, hepsi buradan okur.
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Balance = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- 1. EXP EĞRİSİ ----------
     Çapa noktaları tasarım dokümanındaki değerler.
     Aradaki seviyeler logaritmik interpolasyonla üretilir; böylece
     eğri her yerde pürüzsüz ve geometrik olarak artar.               */
  const EXP_ANCHORS = [
    [1, 100], [2, 150], [10, 2500], [20, 10000], [30, 30000],
    [40, 80000], [50, 200000], [60, 520000], [70, 1400000],
    [80, 3600000], [90, 9000000], [100, 22000000]
  ];
  const MAX_LEVEL = 100;

  function expToNext(level) {
    if (level >= MAX_LEVEL) return Infinity;
    let a = EXP_ANCHORS[0], b = EXP_ANCHORS[EXP_ANCHORS.length - 1];
    for (let i = 0; i < EXP_ANCHORS.length - 1; i++) {
      if (level >= EXP_ANCHORS[i][0] && level <= EXP_ANCHORS[i + 1][0]) {
        a = EXP_ANCHORS[i]; b = EXP_ANCHORS[i + 1]; break;
      }
    }
    if (a[0] === b[0]) return a[1];
    const t = (level - a[0]) / (b[0] - a[0]);
    const val = a[1] * Math.pow(b[1] / a[1], t);
    return Math.round(val / 10) * 10;
  }

  /* ---------- 2. LEVEL FARKI CEZASI ----------
     Oyuncunun kendinden düşük seviyeli mobları kesip kolay EXP
     toplamasını engeller. Aynı tablo drop şansını da kısar, yoksa
     oyuncu düşük haritada item farmlayarak sistemi delerdi.          */
  const DIFF_EXP = { '-1': 0.90, '-2': 0.72, '-3': 0.52, '-4': 0.34, '-5': 0.20, '-6': 0.11, '-7': 0.06, '-8': 0.03, '-9': 0.015 };
  const DIFF_MIN = 0.01;

  function expMultiplier(playerLv, mobLv) {
    const d = mobLv - playerLv;
    if (d >= 0) return Math.min(1.5, 1 + d * 0.055);   // üst seviye mob primi, tavanlı
    return DIFF_EXP[String(d)] !== undefined ? DIFF_EXP[String(d)] : DIFF_MIN;
  }

  function dropMultiplier(playerLv, mobLv) {
    const d = mobLv - playerLv;
    if (d >= 0) return 1;
    if (d >= -4) return 1 + d * 0.12;                  // -4'e kadar hafif düşüş
    return Math.max(0.05, 0.52 + (d + 4) * 0.09);      // sonrası sert düşüş
  }

  /* ---------- 3. STAT TANIMLARI ---------- */
  const STATS = [
    { k: 'hp', label: 'Can', suffix: '' },
    { k: 'mp', label: 'Mana', suffix: '' },
    { k: 'atk', label: 'Saldırı', suffix: '' },
    { k: 'def', label: 'Savunma', suffix: '' },
    { k: 'magicAtk', label: 'Büyü Saldırısı', suffix: '' },
    { k: 'magicDef', label: 'Büyü Savunması', suffix: '' },
    { k: 'atkSpeed', label: 'Saldırı Hızı', suffix: '%' },
    { k: 'moveSpeed', label: 'Hareket Hızı', suffix: '%' },
    { k: 'crit', label: 'Kritik Vuruş', suffix: '%' },
    { k: 'pierce', label: 'Delici Vuruş', suffix: '%' },
    { k: 'block', label: 'Bloklama', suffix: '%' },
    { k: 'dodge', label: 'Kaçınma', suffix: '%' },
    { k: 'vsHuman', label: 'Yarı İnsan', suffix: '%' },
    { k: 'vsMonster', label: 'Canavarlara Karşı Güç', suffix: '%' },
    { k: 'poison', label: 'Zehirleme', suffix: '%' },
    { k: 'stun', label: 'Sersemletme', suffix: '%' },
    { k: 'hpRegen', label: 'HP Yenileme', suffix: '/sn' },
    { k: 'mpRegen', label: 'MP Yenileme', suffix: '/sn' }
  ];
  const STAT_KEYS = STATS.map(s => s.k);
  const STAT_LABEL = {}; const STAT_SUFFIX = {};
  STATS.forEach(s => { STAT_LABEL[s.k] = s.label; STAT_SUFFIX[s.k] = s.suffix; });

  /* ---------- 4. SINIFLAR ----------
     base = Lv1 değerleri, growth = her level eklenen miktar.         */
  const CLASSES = {
    warrior: {
      name: 'Savaşçı', weapon: 'sword', desc: 'Yakın dövüş. Yüksek can ve fiziksel savunma.',
      base: { hp: 240, mp: 60, atk: 24, def: 20, magicAtk: 4, magicDef: 10, atkSpeed: 100, moveSpeed: 100, crit: 2, pierce: 2, block: 5, dodge: 2, hpRegen: 1.2, mpRegen: 0.4 },
      growth: { hp: 36, mp: 6, atk: 3.6, def: 2.8, magicAtk: 0.5, magicDef: 1.2, hpRegen: 0.06, mpRegen: 0.02 },
      dmgCoef: 1.00, magicCoef: 0.25
    },
    archer: {
      name: 'Okçu', weapon: 'bow', desc: 'Uzak menzil. Yüksek saldırı hızı ve kritik.',
      base: { hp: 180, mp: 95, atk: 22, def: 13, magicAtk: 8, magicDef: 12, atkSpeed: 118, moveSpeed: 110, crit: 7, pierce: 9, block: 2, dodge: 7, hpRegen: 0.9, mpRegen: 0.7 },
      growth: { hp: 25, mp: 9, atk: 3.4, def: 1.8, magicAtk: 0.8, magicDef: 1.1, atkSpeed: 0.12, crit: 0.06, hpRegen: 0.04, mpRegen: 0.04 },
      dmgCoef: 0.92, magicCoef: 0.35
    },
    mage: {
      name: 'Büyücü', weapon: 'staff', desc: 'Alan büyüleri. Düşük savunma, yüksek büyü hasarı.',
      base: { hp: 155, mp: 150, atk: 13, def: 11, magicAtk: 28, magicDef: 18, atkSpeed: 96, moveSpeed: 100, crit: 3, pierce: 3, block: 2, dodge: 4, hpRegen: 0.8, mpRegen: 1.4 },
      growth: { hp: 21, mp: 15, atk: 1.5, def: 1.6, magicAtk: 4.2, magicDef: 1.9, hpRegen: 0.03, mpRegen: 0.09 },
      dmgCoef: 0.45, magicCoef: 1.00
    }
  };
  const SKILL_POINT_PER_LEVEL = 1;

  function statsForLevel(classKey, level) {
    const c = CLASSES[classKey];
    const out = {};
    STAT_KEYS.forEach(k => { out[k] = c.base[k] || 0; });
    const n = level - 1;
    for (const k in c.growth) out[k] = (out[k] || 0) + c.growth[k] * n;
    STAT_KEYS.forEach(k => { out[k] = Math.round(out[k] * 100) / 100; });
    return out;
  }

  /* ---------- 5. + BASMA ----------
     Çarpanlar dokümandaki 100→270 eğrisiyle birebir aynı.            */
  const UPGRADE_MAX = 9;
  const UPGRADE_MULT = [1.00, 1.08, 1.17, 1.28, 1.40, 1.55, 1.75, 2.00, 2.30, 2.70];
  const UPGRADE_RATE = [100, 100, 95, 85, 75, 65, 50, 35, 20];   // +0→1 ... +8→9
  /* Başarısızlık politikası: oyuncuyu ezmeden risk hissi ver.
     'mats'  = sadece materyal gider
     'down'  = bir seviye düşer (Koruyucu Taş bunu engeller)        */
  const UPGRADE_FAIL = ['mats', 'mats', 'mats', 'mats', 'mats', 'down', 'down', 'down', 'down'];
  const UPGRADE_YANG = [500, 1200, 2600, 5200, 9800, 18000, 34000, 62000, 110000];

  /* Her + seviyesi için gereken materyaller. mat anahtarları items.js'te tanımlı. */
  const UPGRADE_MATS = [
    { iron_shard: 2 },
    { iron_shard: 3 },
    { iron_shard: 4, steel_shard: 1 },
    { steel_shard: 2 },
    { steel_shard: 3, power_stone: 1 },
    { power_stone: 2 },
    { power_stone: 3, soul_stone: 1 },
    { soul_stone: 2, magic_stone: 1 },
    { soul_stone: 3, magic_stone: 2 }
  ];

  /* Yardımcı taşların etkisi */
  const UPGRADE_HELPERS = {
    scroll_upgrade: { label: 'Geliştirme Parşömeni', rateBonus: 10, desc: 'Başarı şansını 10 puan artırır.' },
    protect_stone: { label: 'Koruyucu Taş', protect: true, desc: 'Başarısızlıkta + seviyesinin düşmesini engeller.' }
  };

  /* ---------- 6. RARITY ---------- */
  const RARITY = {
    common: { key: 'common', label: 'Sıradan', color: '#b9c2c9', order: 0, affixMin: 0, affixMax: 1, statMult: 1.00 },
    uncommon: { key: 'uncommon', label: 'Nadir Değil', color: '#5fd35f', order: 1, affixMin: 1, affixMax: 2, statMult: 1.06 },
    rare: { key: 'rare', label: 'Nadir', color: '#4ea8ff', order: 2, affixMin: 2, affixMax: 3, statMult: 1.14 },
    epic: { key: 'epic', label: 'Destansı', color: '#c06bff', order: 3, affixMin: 3, affixMax: 4, statMult: 1.26 },
    legendary: { key: 'legendary', label: 'Efsanevi', color: '#ffab2e', order: 4, affixMin: 4, affixMax: 5, statMult: 1.45 }
  };
  const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

  /* Rarity ağırlıkları harita kademesine göre. Legendary erken oyunda
     tamamen kapalı (0 ağırlık) — doküman §11 gereği.                */
  const RARITY_WEIGHTS = {
    1: { common: 800, uncommon: 180, rare: 19, epic: 1, legendary: 0 },
    2: { common: 700, uncommon: 250, rare: 46, epic: 4, legendary: 0 },
    3: { common: 620, uncommon: 290, rare: 80, epic: 10, legendary: 0 },
    4: { common: 540, uncommon: 320, rare: 118, epic: 21, legendary: 1 },
    5: { common: 460, uncommon: 340, rare: 165, epic: 33, legendary: 2 },
    6: { common: 380, uncommon: 350, rare: 220, epic: 46, legendary: 4 },
    7: { common: 300, uncommon: 340, rare: 285, epic: 68, legendary: 7 }
  };
  /* Boss'lar rarity tablosunu bir kademe yukarı çeker. */
  const BOSS_RARITY_TIER_BONUS = 1;
  /* Efsanevi item için ek koşullar: sadece boss ve minimum karakter seviyesi. */
  const LEGENDARY_MIN_LEVEL = 40;
  const LEGENDARY_BOSS_ONLY = true;

  /* ---------- 7. MOB EĞRİSİ ----------
     Mob gücü de oyuncu gücüyle aynı hızda artar; hiçbir seviyede
     "duvara toslama" ya da "hiç gelişmiyorum" hissi olmasın diye
     oyuncunun DPS artışıyla aynı kuvvet mertebesinde tutuldu.        */
  function mobBase(level) {
    return {
      hp: 60 + 18 * level + 1.30 * level * level,
      atk: 9 + 2.4 * level + 0.055 * level * level,
      def: 4 + 1.45 * level,
      exp: 12 + 3.2 * level + 0.35 * level * level,
      yang: 9 + 2.6 * level + 0.08 * level * level
    };
  }

  /* ---------- 8. SAVAŞ FORMÜLLERİ ---------- */
  const CRIT_MULT = 2.0;

  function mitigation(def, attackerLevel) {
    /* Savunma hiçbir zaman hasarı sıfırlamaz, azalan getiri uygular. */
    return def / (def + 45 + 11 * attackerLevel);
  }

  function clampDamage(v) { return Math.max(1, Math.round(v)); }

  /* ---------- 9. EKONOMİ ---------- */
  const ECONOMY = {
    sellRatio: 0.22,          // NPC'ye satışta taban fiyatın oranı
    teleportBase: 250,        // her harita kademesi başına ışınlanma ücreti
    potionPriceMult: 1.0,
    repairless: true          // tamir sistemi yok, ekonomi baskısı upgrade'te
  };

  /* ---------- 10. SKILL MALİYET EĞRİSİ ---------- */
  const SKILL = {
    maxLevel: 10,
    pointCost: (lv) => (lv <= 4 ? 1 : lv <= 7 ? 2 : 3),
    yangCost: (lv) => Math.round(1500 * Math.pow(1.62, lv - 1)),
    bookFrom: 5,              // 5. seviyeden sonra kitap gerekir
    bookCount: (lv) => (lv <= 5 ? 0 : lv <= 8 ? 1 : 2),
    successFrom: 7,           // 7. seviyeden sonra başarı şansı devreye girer
    successRate: (lv) => (lv < 7 ? 100 : lv === 7 ? 80 : lv === 8 ? 65 : 50),
    failRefund: 0.5           // başarısızlıkta yang'ın yarısı iade, point iade
  };

  return {
    MAX_LEVEL, EXP_ANCHORS, expToNext, expMultiplier, dropMultiplier,
    STATS, STAT_KEYS, STAT_LABEL, STAT_SUFFIX,
    CLASSES, statsForLevel, SKILL_POINT_PER_LEVEL,
    UPGRADE_MAX, UPGRADE_MULT, UPGRADE_RATE, UPGRADE_FAIL, UPGRADE_YANG,
    UPGRADE_MATS, UPGRADE_HELPERS,
    RARITY, RARITY_ORDER, RARITY_WEIGHTS, BOSS_RARITY_TIER_BONUS,
    LEGENDARY_MIN_LEVEL, LEGENDARY_BOSS_ONLY,
    mobBase, CRIT_MULT, mitigation, clampDamage, ECONOMY, SKILL
  };
});
