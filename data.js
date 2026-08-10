/* =============================================================
   data.js — TÜM OYUN VERİSİ (data-driven tasarım)
   Kod içine sabit değer gömülmez; denge buradan ayarlanır.
   ============================================================= */

const GameData = {

  /* ---------------- IRKLAR ---------------- */
  RACES: {
    su: {
      id: 'su', name: 'Su Irkı', element: 'su',
      colors: { primary: '#4fd6ff', dark: '#0f4c6b', light: '#d7f6ff', aura: '#7ce9ff' },
      desc: 'Savunma, kontrol ve iyileştirme. Yavaşlatır, dondurur, ayakta kalır.',
      bonus: { defense: 0.15, hpRegen: 0.45, moveSpeed: 0.05, elementRes: 0.12, resAtes: 0.12, maxHp: 0.06 },
      bonusText: '+%15 Savunma · +%45 HP Yenilenmesi · +%6 Can · +%5 Koşu Hızı · +%12 Element Direnci · +%12 Ateşe Dayanıklılık',
      /* Pasif: hasar almayınca hızlı toparlanır, iksirler daha çok iyileştirir */
      passive: {
        name: 'Derinlerin Nefesi',
        text: 'Hasar almadığın her 5 saniyede canın hızla dolar · iksir iyileştirmesi +%20 · yavaşlatma etkilerin +%15 daha uzun',
        regenMul: 1.9, potionMul: 1.20, slowDurMul: 1.15
      }
    },
    ates: {
      id: 'ates', name: 'Ateş Irkı', element: 'ates',
      colors: { primary: '#ff7a2f', dark: '#6b1f0f', light: '#ffd9a8', aura: '#ffb347' },
      desc: 'Saldırı, kritik ve yanma hasarı. Hızlı öldürür, geç savunur.',
      bonus: { attack: 0.15, critChance: 0.06, critDamage: 0.20, elementDamage: 0.12, resSu: 0.12, attackSpeed: 0.05 },
      bonusText: '+%15 Saldırı · +%6 Kritik Şans · +%20 Kritik Hasar · +%5 Saldırı Hızı · +%12 Element Hasarı · +%12 Suya Dayanıklılık',
      /* Pasif: kombo bitiricisi ve yanma hasarı güçlenir */
      passive: {
        name: 'Sönmeyen Kor',
        text: 'Kombo bitiricin +%25 hasar · yanma etkin +%30 hasar · düşman kanıyorken kritik şansın +%5',
        finisherMul: 1.25, burnMul: 1.30, critVsBurning: 0.05
      }
    }
  },

  /* ---------------- SINIFLAR ---------------- */
  CLASSES: {
    savasci: {
      id: 'savasci', name: 'Savaşçı', role: 'Yakın Dövüş / Tank',
      desc: 'Ağır silah, yüksek can ve savunma. Yaklaşabilirse tek hedefi en hızlı eriten sınıf.',
      base: { maxHp: 600, attack: 52, magic: 12, defense: 34, attackSpeed: 1.02,
              moveSpeed: 4.2, critChance: 0.06, critDamage: 1.65, penetration: 0.12, range: 1.6 },
      growth: { maxHp: 46, attack: 5.7, magic: 1.0, defense: 2.8 },
      damageStat: 'attack',
      skills: ['gucluVurus', 'donerSaldiri', 'kalkanDarbesi', 'ofke']
    },
    okcu: {
      id: 'okcu', name: 'Okçu', role: 'Menzilli Fiziksel',
      desc: 'Yüksek saldırı hızı ve kritik. Kısa menzil ve düşük savunma — konum tutmayı bilmek şart.',
      base: { maxHp: 430, attack: 20, magic: 14, defense: 15, attackSpeed: 1,
              moveSpeed: 3.0, critChance: 0.10, critDamage: 1.6, penetration: 0.10, range: 4.0 },
      growth: { maxHp: 34, attack: 5.2, magic: 1.2, defense: 1.35 },
      damageStat: 'attack',
      skills: ['cokluOk', 'deliciOk', 'kritikOk', 'okYagmuru']
    },
    buyucu: {
      id: 'buyucu', name: 'Büyücü', role: 'Alan Hasarı / Kontrol',
      desc: 'Element ve alan hasarı. Kalabalığı siler ama en yavaş yürüyen ve kırılgan sınıftır.',
      base: { maxHp: 510, attack: 22, magic: 44, defense: 26, attackSpeed: 1.05,
              moveSpeed: 3.45, critChance: 0.07, critDamage: 1.55, penetration: 0.06, range: 5.0 },
      growth: { maxHp: 39, attack: 1.4, magic: 4.2, defense: 2.4 },
      damageStat: 'magic',
      skills: ['elementTopu', 'alanBuyusu', 'kontrolBuyusu', 'ultimate']
    }
  },

  /* ---------------- YETENEKLER ----------------
     type: melee | projectile | area | dash | buff
     Su/Ateş varyantı isim ve efekt olarak ayrışır.        */
  SKILLS: {
    gucluVurus: {
      name: { su: 'Buz Balyozu', ates: 'Alev Balyozu' }, type: 'melee',
      mult: 2.60, cd: 4.5, mana: 18, radius: 2.6, arc: 1.6,
      effect: { su: { slow: 0.35, dur: 2 }, ates: { burn: 0.35, dur: 3 } },
      desc: 'Önündeki dar alana ağır tek vuruş.'
    },
    donerSaldiri: {
      name: { su: 'Girdap Savurma', ates: 'Alev Kasırgası' }, type: 'area',
      mult: 1.25, cd: 8, mana: 26, radius: 3.2, hits: 3, tick: 0.35, self: true,
      effect: { su: { slow: 0.25, dur: 1.5 }, ates: { burn: 0.25, dur: 3 } },
      desc: 'Çevrende 3 vuruşluk dönen alan saldırısı.'
    },
    kalkanDarbesi: {
      name: { su: 'Buz Hamlesi', ates: 'Kor Hamlesi' }, type: 'dash',
      mult: 1.85, cd: 11, mana: 24, radius: 2.1, dashDist: 4.5,
      /* Savaşçının kontrol yeteneği: Sv1'de 2 sn sersemletme,
         her seviyede +0.1 sn (Sv10 → 2.9 sn). */
      effect: { su: { stun: 2.0 }, ates: { stun: 2.0, burn: 0.3, dur: 3 } },
      desc: 'İleri atılır, çarptığı düşmanları 2 saniye sersemletir. Seviye arttıkça süre uzar.'
    },
    ofke: {
      name: { su: 'Buz Zırhı', ates: 'Öfke' }, type: 'buff',
      cd: 22, mana: 30, dur: 8,
      buff: { su: { defense: 0.55, hpRegen: 8 }, ates: { attack: 0.40, attackSpeed: 0.30 } },
      desc: 'Kısa süreli güçlü kişisel takviye.'
    },

    cokluOk: {
      name: { su: 'Buz Yaylımı', ates: 'Kor Yaylımı' }, type: 'projectile',
      mult: 0.68, cd: 5.5, mana: 18, count: 5, spread: 0.55, speed: 15, life: 0.8,
      effect: { su: { slow: 0.25, dur: 1.5 }, ates: { burn: 0.2, dur: 3 } },
      desc: 'Yelpaze şeklinde 5 ok.'
    },
    deliciOk: {
      name: { su: 'Buz Mızrağı', ates: 'Lav Mızrağı' }, type: 'projectile',
      mult: 2.2, cd: 7, mana: 22, count: 1, speed: 22, life: 1.1, pierce: 5, bonusPen: 0.35,
      desc: 'Düşmanları delip geçer, savunmayı yok sayar.'
    },
    kritikOk: {
      name: { su: 'Kristal Ok', ates: 'Patlayıcı Ok' }, type: 'projectile',
      mult: 2.1, cd: 9, mana: 24, count: 1, speed: 18, life: 1.2, forceCrit: true, splash: 2.2,
      effect: { su: { slow: 0.4, dur: 2 }, ates: { burn: 0.5, dur: 4 } },
      desc: 'Garantili kritik, isabet yerinde patlar.'
    },
    okYagmuru: {
      name: { su: 'Dolu Yağmuru', ates: 'Ateş Yağmuru' }, type: 'area',
      mult: 0.82, cd: 16, mana: 38, radius: 3.6, hits: 5, tick: 0.4, castRange: 8,
      effect: { su: { slow: 0.3, dur: 1.5 }, ates: { burn: 0.35, dur: 3 } },
      desc: 'İmleçteki bölgeye 5 dalga ok yağdırır.'
    },

    elementTopu: {
      name: { su: 'Su Küresi', ates: 'Ateş Topu' }, type: 'projectile',
      mult: 1.95, cd: 4, mana: 20, count: 1, speed: 12, life: 1.4, splash: 2.6,
      effect: { su: { slow: 0.3, dur: 2 }, ates: { burn: 0.4, dur: 3 } },
      desc: 'İsabet yerinde patlayan element küresi.'
    },
    alanBuyusu: {
      name: { su: 'Buz Fırtınası', ates: 'Meteor' }, type: 'area',
      mult: 1.60, cd: 11, mana: 34, radius: 4.2, hits: 4, tick: 0.5, castRange: 7.5,
      effect: { su: { slow: 0.45, dur: 2 }, ates: { burn: 0.45, dur: 4 } },
      desc: 'Hedef bölgeye uzun süreli alan hasarı.'
    },
    kontrolBuyusu: {
      name: { su: 'Donma', ates: 'Alev Duvarı' }, type: 'area',
      mult: 0.75, cd: 14, mana: 30, radius: 3.4, hits: 2, tick: 0.5, castRange: 6,
      effect: { su: { stun: 1.6 }, ates: { burn: 0.6, dur: 5, slow: 0.3, dur2: 2 } },
      heal: { su: 0.18, ates: 0 },
      desc: 'Kontrol büyüsü. Su ırkı ayrıca kendini iyileştirir.'
    },
    ultimate: {
      name: { su: 'Kraken Dalgası', ates: 'Ejderha Nefesi' }, type: 'area',
      mult: 3.5, cd: 30, mana: 60, radius: 5.6, hits: 1, self: true,
      effect: { su: { slow: 0.5, dur: 3 }, ates: { burn: 0.8, dur: 5 } },
      desc: 'Çevrendeki her şeyi süpüren ultimate.'
    }
  },

  /* ---------------- STAT DAĞITIMI ----------------
     Level başına 5 puan. Her puanın etkisi + soft-cap. */
  ALLOC: [
    { key: 'maxHp',       name: 'Can (HP)',        per: 34,    fmt: 'flat' },
    { key: 'attack',      name: 'Saldırı Gücü',    per: 5.2,   fmt: 'flat' },
    { key: 'magic',       name: 'Büyü Gücü',       per: 5.2,   fmt: 'flat' },
    { key: 'defense',     name: 'Savunma',         per: 3.4,   fmt: 'flat' },
    { key: 'critChance',  name: 'Kritik Şans',     per: 0.006, fmt: 'pct' },
    { key: 'critDamage',  name: 'Kritik Hasar',    per: 0.03,  fmt: 'pct' },
    { key: 'penetration', name: 'Delici Vuruş',    per: 0.005, fmt: 'pct' },
    { key: 'attackSpeed', name: 'Saldırı Hızı',    per: 0.012, fmt: 'x' },
    { key: 'moveSpeed',   name: 'Koşu Hızı',       per: 0.03,  fmt: 'flat1' }
  ],

  /* Soft-cap: eşiği aşan kısım %35 verim. Sert tavan: hard. */
  SOFTCAP: {
    critChance:  { soft: 0.50, rate: 0.35, hard: 0.75 },
    penetration: { soft: 0.40, rate: 0.35, hard: 0.65 },
    attackSpeed: { soft: 1.80, rate: 0.35, hard: 2.50 },
    moveSpeed:   { soft: 6.00, rate: 0.30, hard: 7.50 },
    critDamage:  { soft: 3.00, rate: 0.40, hard: 4.50 },
    elementRes:  { soft: 0.50, rate: 0.30, hard: 0.75 },
    resSu:       { soft: 0.40, rate: 0.30, hard: 0.65 },
    resAtes:     { soft: 0.40, rate: 0.30, hard: 0.65 },
    dmgBoss:     { soft: 0.45, rate: 0.30, hard: 0.80 },
    dmgMonster:  { soft: 0.45, rate: 0.30, hard: 0.80 },
    dmgPlayer:   { soft: 0.35, rate: 0.30, hard: 0.60 },
    dmgStone:    { soft: 0.55, rate: 0.30, hard: 0.95 }
  },

  /* ---------------- DENGE / FORMÜL SABİTLERİ ---------------- */
  BALANCE: {
    statPointsPerLevel: 5,
    maxLevel: 100,
    defenseK: 110,             // savunma azaltma sabiti
    defensePerLevel: 16,
    elementAdvantage: 0.20,    // karşıt elemente +%20
    variance: 0.05,            // ±%5 hasar sapması
    manaMax: 100,
    manaRegen: 6.5,            // saniyede
    potionHeal: 0.35,          // max HP yüzdesi
    potionCd: 8,
    dashCd: 3.2,
    monsterAtkMul: 1.6,        // yaratık saldırısı çarpanı (tek noktadan denge)
    dashDist: 3.6,
    respawnTime: 3,
    xpCurve: (lv) => Math.floor(55 * Math.pow(lv, 1.62) + 70 * lv),
    goldSellRate: 0.30,
    pvpMatchTime: 120,

    /* --- Kombo (saldırıya basılı tut) ---
       Ardışık vuruşlar zincirlenir; 3. vuruş bitirici (daha geniş + sert). */
    combo: {
      window: 1.15,                 // zincirin kopmadan önceki bekleme süresi (sn)
      mults: [1.00, 1.20, 1.60],    // vuruş çarpanları
      speed: [1.00, 0.80, 0.70],    // sonraki vuruş bekleme çarpanı (hızlanır)
      radiusBonus: [0, 0.15, 0.55], // bitiricinin menzili genişler
      arcBonus:    [0, 0.15, 0.85],
      finisherEffect: { su: { slow: 0.35, dur: 2 }, ates: { burn: 0.4, dur: 3 } }
    },

    /* --- Can yenilenmesi (Metin2 mantığı) --- */
    regen: {
      monsterCombat: 0.005,   // savaşırken saniyede max HP oranı
      monsterIdle:   0.075,   // aggro düşünce hızlı toparlanır
      bossCombat:    0.011,
      bossIdle:      0.10,
      playerIdle:    0.020,   // 5 sn hasar almadıysan
      idleDelay:     5
    },

    /* --- İksirler (markette satılır, basılı tutunca da içilir) --- */
    autoPotionAt: 0.45        // otomatik iksir eşiği (max HP oranı)
  },

  /* ---------------- YETENEK SEVİYELERİ ----------------
     Her yetenek 1-10 arası yükseltilir: hasar artar, bekleme kısalır. */
  SKILL_LEVEL: {
    max: 10,
    pointsPerLevel: 1,        // karakter levelinde kazanılan yetenek puanı
    firstPointAt: 2,          // Lv2'den itibaren
    damagePerLevel: 0.14,     // seviye başına +%14 hasar
    cdPerLevel: 0.045,        // seviye başına -%4.5 bekleme
    cdFloor: 0.60,            // bekleme en fazla %40 kısalır
    manaPerLevel: 0.03,       // seviye başına +%3 mana maliyeti
    effectPerLevel: 0.06,     // yavaşlatma/yanma etkisi +%6
    stunFlatPerLevel: 0.10,   // sersemletme: seviye başına +0.10 sn (düz artış)
    stunCap: 3.2,             // sersemletme üst sınırı (sn)
    unlockAt: [1, 4, 8, 14]   // yetenekler bu karakter levellerinde açılır
  },

  /* ---------------- İKSİRLER ---------------- */
  POTIONS: {
    kucuk: { id: 'kucuk', name: 'Küçük Can İksiri', heal: 0.22, cd: 1.1, price: 45,  bundle: 10, color: '#ff6b7d', key: 'Q' },
    buyuk: { id: 'buyuk', name: 'Büyük Can İksiri', heal: 0.55, cd: 5.0, price: 170, bundle: 5,  color: '#ff3d5a', key: 'R' },
    mana:  { id: 'mana',  name: 'Mana İksiri',      mana: 55,   cd: 6.0, price: 120, bundle: 5,  color: '#6ba8ff', key: 'F' }
  },

  /* ---------------- ÇAĞLAR ---------------- */
  AGES: [
    { id: 1, name: 'İlk Çağ',        reqLevel: 1,  reqBoss: 0, monLv: 1,  itemTier: 1, ground: '#2c3b30', accent: '#6f8f5f' },
    { id: 2, name: 'Kabileler Çağı', reqLevel: 8,  reqBoss: 1, monLv: 8,  itemTier: 2, ground: '#31402f', accent: '#8aa05a' },
    { id: 3, name: 'Antik Çağ',      reqLevel: 18, reqBoss: 2, monLv: 18, itemTier: 3, ground: '#3a3a2c', accent: '#b09a5c' },
    { id: 4, name: 'Orta Çağ',       reqLevel: 30, reqBoss: 3, monLv: 30, itemTier: 4, ground: '#33323f', accent: '#8f8fb0' },
    { id: 5, name: 'Krallıklar Çağı',reqLevel: 45, reqBoss: 4, monLv: 45, itemTier: 5, ground: '#2f3346', accent: '#7f9fd0' },
    { id: 6, name: 'Büyü Çağı',      reqLevel: 62, reqBoss: 5, monLv: 62, itemTier: 6, ground: '#33294a', accent: '#a97fd8' },
    { id: 7, name: 'Efsane Çağı',    reqLevel: 80, reqBoss: 6, monLv: 80, itemTier: 7, ground: '#42283a', accent: '#e0a04f' }
  ],

  /* ---------------- YARATIKLAR ---------------- */
  MONSTERS: {
    su: [
      { id: 'suGoblin', name: 'Su Goblini', tier: 'normal', hp: 105, atk: 15, def: 6, spd: 3.1, range: 1.2, aspd: 1.0, xp: 22, gold: 11, size: 0.55, color: '#57b6c9' },
      { id: 'buzKurdu', name: 'Buz Kurdu',  tier: 'normal', hp: 135, atk: 19, def: 8, spd: 4.3, range: 1.2, aspd: 1.2, xp: 30, gold: 14, size: 0.6,  color: '#8fd8ea' },
      { id: 'denizCanavari', name: 'Deniz Canavarı', tier: 'elite', hp: 300, atk: 27, def: 16, spd: 2.9, range: 5.5, aspd: 0.8, xp: 62, gold: 32, size: 0.8, color: '#2f7fa8', ranged: true },
      { id: 'buzGolemi', name: 'Buz Golemi', tier: 'elite', hp: 480, atk: 33, def: 28, spd: 2.3, range: 1.6, aspd: 0.7, xp: 84, gold: 45, size: 0.95, color: '#c9ecff' }
    ],
    ates: [
      { id: 'atesGoblin', name: 'Ateş Goblini', tier: 'normal', hp: 100, atk: 18, def: 5, spd: 3.3, range: 1.2, aspd: 1.1, xp: 23, gold: 12, size: 0.55, color: '#e07a3c' },
      { id: 'lavKurdu', name: 'Lav Kurdu', tier: 'normal', hp: 128, atk: 22, def: 7, spd: 4.5, range: 1.2, aspd: 1.25, xp: 31, gold: 15, size: 0.6, color: '#ff9a4a' },
      { id: 'alevSovalyesi', name: 'Alev Şövalyesi', tier: 'elite', hp: 360, atk: 34, def: 22, spd: 3.4, range: 1.7, aspd: 1.0, xp: 74, gold: 38, size: 0.8, color: '#c94f2a' },
      { id: 'lavGolemi', name: 'Lav Golemi', tier: 'elite', hp: 455, atk: 38, def: 24, spd: 2.4, range: 4.8, aspd: 0.75, xp: 86, gold: 46, size: 0.95, color: '#ff6a2a', ranged: true }
    ]
  },

  BOSSES: {
    su: {
      id: 'kraken', name: 'Kraken', element: 'su', color: '#1f6f9a', size: 1.6,
      hp: 2600, atk: 52, def: 34, spd: 2.6, range: 2.4, aspd: 0.8, xp: 900, gold: 700,
      phases: [
        { at: 1.00, name: 'Faz 1 — Derinlik', atkMul: 1.0, spdMul: 1.0, special: 'nova', specialCd: 9 },
        { at: 0.65, name: 'Faz 2 — Girdap',   atkMul: 1.2, spdMul: 1.15, special: 'volley', specialCd: 6 },
        { at: 0.30, name: 'Faz 3 — Kraken Öfkesi', atkMul: 1.45, spdMul: 1.3, special: 'both', specialCd: 4.5 }
      ]
    },
    ates: {
      id: 'ejderha', name: 'Ateş Ejderhası', element: 'ates', color: '#b83a1a', size: 1.7,
      hp: 2450, atk: 60, def: 30, spd: 2.7, range: 2.6, aspd: 0.85, xp: 950, gold: 730,
      phases: [
        { at: 1.00, name: 'Faz 1 — Pençe', atkMul: 1.0, spdMul: 1.0, special: 'volley', specialCd: 8 },
        { at: 0.65, name: 'Faz 2 — Alev Yağmuru', atkMul: 1.25, spdMul: 1.15, special: 'nova', specialCd: 6 },
        { at: 0.30, name: 'Faz 3 — Ejderha Nefesi', atkMul: 1.5, spdMul: 1.3, special: 'both', specialCd: 4 }
      ]
    }
  },

  /* ---------------- EKİPMAN ---------------- */
  SLOTS: [
    { key: 'weapon', name: 'Silah' },
    { key: 'helmet', name: 'Kask' },
    { key: 'chest',  name: 'Göğüslük' },
    { key: 'gloves', name: 'Eldiven' },
    { key: 'legs',   name: 'Pantolon' },
    { key: 'boots',  name: 'Ayakkabı' },
    { key: 'amulet', name: 'Kolye' },
    { key: 'ring',   name: 'Yüzük' },
    { key: 'shield', name: 'Kalkan' }
  ],

  WEAPON_NAMES: {
    savasci: ['Kılıç', 'Balta', 'Çift Elli Kılıç', 'Savaş Çekici'],
    okcu: ['Yay', 'Uzun Yay', 'Element Yayı', 'Avcı Yayı'],
    buyucu: ['Asa', 'Değnek', 'Element Asası', 'Kristal Asa']
  },

  ARMOR_PREFIX: {
    su: ['Buz', 'Kristal', 'Derin', 'Kar', 'Med', 'Girdap'],
    ates: ['Kor', 'Alev', 'Lav', 'Kül', 'Ejder', 'Volkan']
  },
  ARMOR_SUFFIX: ['Muhafızı', 'Avcısı', 'Ustası', 'Efendisi', 'Yıldızı', 'Kalıntısı'],

  /* ---------------- GÜÇ MANTIĞI (denge modeli) ----------------
     Her sınıf farklı hissettirir ama "savaş puanı" olarak eşittir.

       etkiliCan (eHP) = maxHp / (1 - savunmaKesintisi)
       savaşPuanı      = DPS × eHP

     Hedef: aynı level ve kademede savaş puanları birbirinden en fazla
     %12 sapsın. Sınıflar bu puanı FARKLI dağıtır:

       Savaşçı : yüksek eHP + yüksek tekli hasar, menzil ve mobilite yok
       Okçu    : en yüksek sürekli hasar + menzil, en düşük eHP
       Büyücü  : en yüksek alan hasarı + kontrol, en yavaş, orta eHP

     weaponMul  : sınıfın kuşandığı silahın ana stat çarpanı
     aoeFactor  : kalabalıkta beklenen hasar çarpanı (denge ölçümü için)  */
  POWER_MODEL: {
    scoreTolerance: 0.12,
    defenseK: 110,
    roles: {
      savasci: { weaponMul: 1.80, aoeFactor: 1.9, note: 'Tek hedefte sert, kalabalıkta orta, dayanıklı' },
      okcu:    { weaponMul: 1.15, aoeFactor: 1.5, note: 'Sürekli hasar ve menzil, çok kırılgan' },
      buyucu:  { weaponMul: 0.90, aoeFactor: 3.0, note: 'Alan hasarı ve kontrol, yavaş' }
    }
  },

  /* ---------------- KUŞAM KADEMELERİ ----------------
     Her level aralığının kendi seti, kendi görünüm adı ve kendi güç çarpanı var.
     Markette yalnızca leveline uyan kademe satın alınabilir. */
  GEAR_TIERS: [
    { id: 1, name: 'Çırak Kuşamı', min: 1,  max: 9,   statMul: 1.00, priceMul: 1.0, color: '#9aa0a6',
      sets: { su: 'Çırak Buz',      ates: 'Çırak Kor' } },
    { id: 2, name: 'Bronz Kuşam',  min: 10, max: 19,  statMul: 1.10, priceMul: 1.4, color: '#c08a4a',
      sets: { su: 'Buzul Pulu',     ates: 'Kor Pulu' } },
    { id: 3, name: 'Gümüş Kuşam',  min: 20, max: 39,  statMul: 1.22, priceMul: 2.1, color: '#cbd5e2',
      sets: { su: 'Derin Akıntı',   ates: 'Alev Dili' } },
    { id: 4, name: 'Altın Kuşam',  min: 40, max: 59,  statMul: 1.36, priceMul: 3.2, color: '#ffcc55',
      sets: { su: 'Girdap Muhafızı', ates: 'Volkan Muhafızı' } },
    { id: 5, name: 'Ejder Kuşamı', min: 60, max: 79,  statMul: 1.52, priceMul: 4.8, color: '#b06cff',
      sets: { su: 'Kraken Zırhı',   ates: 'Ejder Zırhı' } },
    { id: 6, name: 'Kadim Kuşam',  min: 80, max: 100, statMul: 1.70, priceMul: 7.0, color: '#ff4d6d',
      sets: { su: 'Kadim Derinlik', ates: 'Kadim Alev' } }
  ],

  RARITY: [
    { id: 'common',    name: 'Common',    color: '#b8b8b8', mult: 1.00, affixes: 1, weight: 58 },
    { id: 'uncommon',  name: 'Uncommon',  color: '#69c76a', mult: 1.22, affixes: 2, weight: 25 },
    { id: 'rare',      name: 'Rare',      color: '#4aa3ff', mult: 1.50, affixes: 3, weight: 11 },
    { id: 'epic',      name: 'Epic',      color: '#b06cff', mult: 1.85, affixes: 4, weight: 4.4 },
    { id: 'legendary', name: 'Legendary', color: '#ffa93a', mult: 2.30, affixes: 5, weight: 1.4 },
    { id: 'mythic',    name: 'Mythic',    color: '#ff4d6d', mult: 3.00, affixes: 6, weight: 0.2 }
  ],

  /* Slot başına ana stat + roll aralığı (item level başına) */
  SLOT_MAIN: {
    weapon: { stat: 'attack',  base: 8,  per: 2.10 },
    helmet: { stat: 'defense', base: 5,  per: 0.85 },
    chest:  { stat: 'defense', base: 8,  per: 1.30 },
    gloves: { stat: 'defense', base: 3,  per: 0.55 },
    legs:   { stat: 'defense', base: 6,  per: 0.95 },
    boots:  { stat: 'defense', base: 3,  per: 0.50 },
    amulet: { stat: 'magic',   base: 5,  per: 1.15 },
    ring:   { stat: 'magic',   base: 4,  per: 0.95 },
    shield: { stat: 'defense', base: 9,  per: 1.45 }
  },

  AFFIXES: [
    { key: 'maxHp',       name: 'Can',            base: 22,   per: 6.5,  fmt: 'flat' },
    { key: 'attack',      name: 'Saldırı',        base: 4,    per: 1.05, fmt: 'flat' },
    { key: 'magic',       name: 'Büyü Gücü',      base: 4,    per: 1.05, fmt: 'flat' },
    { key: 'defense',     name: 'Savunma',        base: 3,    per: 0.70, fmt: 'flat' },
    { key: 'critChance',  name: 'Kritik Şans',    base: 0.012,per: 0.0012, fmt: 'pct' },
    { key: 'critDamage',  name: 'Kritik Hasar',   base: 0.05, per: 0.006,  fmt: 'pct' },
    { key: 'penetration', name: 'Delici Vuruş',   base: 0.010,per: 0.0010, fmt: 'pct' },
    { key: 'attackSpeed', name: 'Saldırı Hızı',   base: 0.02, per: 0.0022, fmt: 'x' },
    { key: 'moveSpeed',   name: 'Koşu Hızı',      base: 0.05, per: 0.006,  fmt: 'flat1' },
    { key: 'hpRegen',     name: 'HP Yenilenmesi', base: 1.2,  per: 0.25, fmt: 'flat1' },
    { key: 'elementDamage', name: 'Element Hasarı', base: 0.02, per: 0.0022, fmt: 'pct' },
    { key: 'elementRes',  name: 'Element Direnci',base: 0.02, per: 0.0020, fmt: 'pct' },
    { key: 'resSu',       name: 'Suya Karşı Dayanıklılık',   base: 0.025, per: 0.0026, fmt: 'pct' },
    { key: 'resAtes',     name: 'Ateşe Karşı Dayanıklılık',  base: 0.025, per: 0.0026, fmt: 'pct' },
    { key: 'dmgBoss',     name: "Boss'a Karşı Güçlü",        base: 0.030, per: 0.0030, fmt: 'pct' },
    { key: 'dmgMonster',  name: 'Canavara Karşı Güçlü',      base: 0.030, per: 0.0030, fmt: 'pct' },
    { key: 'dmgPlayer',   name: 'Oyuncuya Karşı Güçlü',      base: 0.022, per: 0.0022, fmt: 'pct' },
    { key: 'dmgStone',    name: 'Maden Taşına Karşı Güçlü',   base: 0.035, per: 0.0032, fmt: 'pct' }
  ],

  /* ---------------- NADİR EFSUNLAR ----------------
     Normal efsunlardan ayrı, daha değerli havuz. Boss hediyelerinde ve
     epic+ eşyalarda çıkar; markette satılan aynı eşyanın "farklı efsunlusu" budur. */
  RARE_AFFIXES: [
    { key: 'penetration', name: 'Delici Vuruş',                base: 0.030, per: 0.0022, fmt: 'pct', weight: 16 },
    { key: 'resSu',       name: 'Suya Karşı Dayanıklılık',     base: 0.045, per: 0.0030, fmt: 'pct', weight: 15 },
    { key: 'resAtes',     name: 'Ateşe Karşı Dayanıklılık',    base: 0.045, per: 0.0030, fmt: 'pct', weight: 15 },
    { key: 'dmgStone',    name: 'Maden Taşına Karşı Güçlü',    base: 0.060, per: 0.0042, fmt: 'pct', weight: 14 },
    { key: 'dmgMonster',  name: 'Canavara Karşı Güçlü',        base: 0.050, per: 0.0036, fmt: 'pct', weight: 14 },
    { key: 'dmgBoss',     name: "Boss'a Karşı Güçlü",          base: 0.045, per: 0.0034, fmt: 'pct', weight: 10 },
    { key: 'dmgPlayer',   name: 'Oyuncuya Karşı Güçlü',        base: 0.035, per: 0.0026, fmt: 'pct', weight: 8  },
    { key: 'critDamage',  name: 'Kritik Hasar',                base: 0.12,  per: 0.0090, fmt: 'pct', weight: 5  },
    { key: 'attackSpeed', name: 'Saldırı Hızı',                base: 0.05,  per: 0.0035, fmt: 'x',   weight: 3  }
  ],

  /* Nadir efsun sayısı: eşya nadirliğine göre */
  RARE_AFFIX_COUNT: { common: 0, uncommon: 0, rare: 1, epic: 1, legendary: 2, mythic: 3 },

  /* ---------------- EFSUN (enchant) ----------------
     Efsunsuz item = sadece ana stat. Efsunlu item = ana stat + ek efsunlar.
     Boss ganimetleri yüksek ihtimalle efsunludur. */
  ENCHANT: {
    baseChance: 0.42,        // normal ganimette efsunlu çıkma şansı
    bossChance: 0.90,        // boss ganimetinde
    marketChance: 0.55,
    prefix: 'Efsunlu',
    priceMul: 1.6
  },

  MATERIALS: {
    demir:      { name: 'Demir',          color: '#9aa0a6', zone: 'both' },
    deri:       { name: 'Deri',           color: '#a97a4a', zone: 'both' },
    buzKristali:{ name: 'Buz Kristali',   color: '#8fe6ff', zone: 'su' },
    atesTasi:   { name: 'Ateş Taşı',      color: '#ff8a4a', zone: 'ates' },
    krakenMuru: { name: 'Kraken Mürekkebi', color: '#3f6f9f', zone: 'boss_su' },
    ejderPulu:  { name: 'Ejderha Pulu',   color: '#e05a2a', zone: 'boss_ates' },
    maden:      { name: 'Maden Cevheri',  color: '#b98af0', zone: 'maden' }
  },

  /* Craft tarifleri — markete bağımsız çalışır */
  RECIPES: [
    { id: 'r_weapon', slot: 'weapon', name: 'Silah Dövümü', rarity: 'rare',
      cost: { gold: 400 }, mats: { demir: 8, deri: 4 } },
    { id: 'r_chest', slot: 'chest', name: 'Göğüslük Dövümü', rarity: 'rare',
      cost: { gold: 350 }, mats: { demir: 10, deri: 6 } },
    { id: 'r_elem', slot: 'amulet', name: 'Element Kolyesi', rarity: 'epic',
      cost: { gold: 900 }, mats: { buzKristali: 6, atesTasi: 6, demir: 6 } },
    { id: 'r_boss', slot: 'ring', name: 'Boss Yüzüğü', rarity: 'legendary',
      cost: { gold: 2500 }, mats: { krakenMuru: 3, ejderPulu: 3, demir: 15 } }
  ],

  /* ---------------- PVP RANK ---------------- */
  RANKS: [
    { name: 'Bronze', min: 0,    color: '#b87333' },
    { name: 'Silver', min: 300,  color: '#c0c0c0' },
    { name: 'Gold', min: 600,    color: '#e8c04a' },
    { name: 'Platinum', min: 900,color: '#7fe3d0' },
    { name: 'Diamond', min: 1250,color: '#7fc4ff' },
    { name: 'Master', min: 1600, color: '#c07fff' },
    { name: 'Grandmaster', min: 2000, color: '#ff7f9f' },
    { name: 'Legend', min: 2400, color: '#ffd15c' }
  ],

  /* ---------------- GÖREVLER ---------------- */
  QUEST_TEMPLATES: [
    { id: 'kill', text: (n) => `${n} yaratık öldür`, target: [8, 25], xp: 220, gold: 160 },
    { id: 'boss', text: (n) => `${n} boss öldür`, target: [1, 2], xp: 900, gold: 600 },
    { id: 'pvp',  text: (n) => `${n} PvP kazan`, target: [1, 3], xp: 500, gold: 380 },
    { id: 'gold', text: (n) => `${n} altın kazan`, target: [500, 2000], xp: 260, gold: 0 },
    { id: 'mat',  text: (n) => `${n} craft materyali topla`, target: [6, 18], xp: 300, gold: 200 },
    { id: 'stone', text: (n) => `${n} maden taşı kır`, target: [2, 5], xp: 700, gold: 480 }
  ],

  /* ---------------- HARİTALAR ---------------- */
  /* ---------------- MADEN TAŞLARI (Metin2 mantığı) ----------------
     Kazdıkça (vurdukça) içinden düşman dalgaları çıkar, kırılınca ganimet verir.
     Taşın elementi HER ZAMAN oyuncunun karşıtıdır. */
  ORES: [/* hp: taban değer · seconds: hedeflenen kazma süresi (oyuncunun gücüne göre ölçeklenir) */
    { id: 'cirak',  name: 'Çatlak Maden Taşı',  minLv: 1,  hp: 900,   def: 10, xp: 90,   gold: 60,   seconds: 18, waves: 2, perWave: 2, size: 1.15 },
    { id: 'bronz',  name: 'Bronz Damarı',       minLv: 10, hp: 2200,  def: 22, xp: 260,  gold: 150,  seconds: 22, waves: 3, perWave: 2, size: 1.25 },
    { id: 'gumus',  name: 'Gümüş Damarı',       minLv: 20, hp: 5200,  def: 40, xp: 700,  gold: 380,  seconds: 26, waves: 3, perWave: 3, size: 1.35 },
    { id: 'altin',  name: 'Altın Damarı',       minLv: 40, hp: 11000, def: 70, xp: 1800, gold: 950,  seconds: 30, waves: 4, perWave: 3, size: 1.45 },
    { id: 'ejder',  name: 'Ejder Damarı',       minLv: 60, hp: 21000, def: 105,xp: 4200, gold: 2100, seconds: 34, waves: 4, perWave: 4, size: 1.55 },
    { id: 'kadim',  name: 'Kadim Damar',        minLv: 80, hp: 38000, def: 150,xp: 9000, gold: 4500, seconds: 40, waves: 5, perWave: 4, size: 1.7  }
  ],

  MAPS: {
    city:     { name: 'Kadim Şehir', w: 30, h: 30, safe: true, ground: '#3a3f4d', accent: '#5c6478' },
    farm_su:  { name: 'Buz Vadisi',  w: 46, h: 46, safe: false, ground: '#1f3a4a', accent: '#3f7f9a', element: 'su', spawn: 16 },
    farm_ates:{ name: 'Lav Çölü',    w: 46, h: 46, safe: false, ground: '#3a2320', accent: '#8a4a2a', element: 'ates', spawn: 16 },
    boss_su:  { name: 'Kraken İni',  w: 26, h: 26, safe: false, ground: '#152b3a', accent: '#2f6f9a', element: 'su', boss: 'su' },
    boss_ates:{ name: 'Ejderha Yuvası', w: 26, h: 26, safe: false, ground: '#2b1a18', accent: '#9a3f2a', element: 'ates', boss: 'ates' },
    arena:    { name: 'Savaş Arenası', w: 28, h: 28, safe: false, ground: '#2a2c3a', accent: '#6a6f8a', pvp: true },
    /* Maden: elementi oyuncunun karşıtı olarak dinamik belirlenir */
    maden:    { name: 'Element Madenleri', w: 44, h: 44, safe: false, ground: '#241f2e', accent: '#5b4a7a', mine: true, spawn: 6, ore: 7 }
  }
};
