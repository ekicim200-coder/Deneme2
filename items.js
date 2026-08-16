/* ============================================================
   items.js — Item kataloğu, efsun havuzu, materyaller.
   Katalog elle tek tek yazılmaz: kademe (tier) tablosu ile slot
   tablosu çarpılarak üretilir. Yeni bir kademe eklemek için
   TIERS dizisine tek satır eklemek yeterlidir.
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(
    typeof require === 'function' ? require('./balance.js') : root.Balance);
  else root.ItemData = factory(root.Balance);
})(typeof self !== 'undefined' ? self : this, function (B) {
  'use strict';

  /* ---------- KADEMELER ----------
     power = o kademedeki tüm itemlerin güç katsayısı.
     Silah hasarı 15*power .. 22*power formülüyle üretilir:
     Lv1 "Acemi" 15–22, Lv20 "Çelik" 45–66, Lv40 "Kara Çelik" 102–150 */
  const TIERS = [
    { t: 1, lvl: 1, power: 1.00, wName: 'Acemi', aName: 'Yamalı', pal: 'wood' },
    { t: 2, lvl: 10, power: 2.00, wName: 'Demir', aName: 'Demir', pal: 'iron' },
    { t: 3, lvl: 20, power: 3.00, wName: 'Çelik', aName: 'Çelik', pal: 'steel' },
    { t: 4, lvl: 30, power: 4.60, wName: 'Kum Yeşimi', aName: 'Kum Yeşimi', pal: 'jade' },
    { t: 5, lvl: 40, power: 6.80, wName: 'Kara Çelik', aName: 'Kara Çelik', pal: 'dark' },
    { t: 6, lvl: 55, power: 10.0, wName: 'Ejder Kemiği', aName: 'Ejder Kemiği', pal: 'bone' },
    { t: 7, lvl: 70, power: 14.5, wName: 'Yıldız Demiri', aName: 'Yıldız Demiri', pal: 'star' }
  ];

  /* ---------- SLOT TANIMLARI ----------
     mult: kademe gücünün bu slotta kaça çarpılacağı.
     stats: taban stat üretici fonksiyonlar (p = tier power)          */
  const SLOTS = {
    weapon: {
      label: 'Silah', equipSlot: 'weapon', icon: 'weapon',
      variants: {
        sword: { cls: 'warrior', label: 'Kılıç', dmg: 1.00, spd: 0, extra: { block: 1 } },
        bow: { cls: 'archer', label: 'Yay', dmg: 0.84, spd: 14, extra: { crit: 2, pierce: 2 } },
        staff: { cls: 'mage', label: 'Asa', dmg: 0.55, spd: -4, extra: { magicAtk: 9 } }
      },
      make: (p, v) => ({
        minDamage: Math.round(15 * p * v.dmg),
        maxDamage: Math.round(22 * p * v.dmg),
        atkSpeed: v.spd,
        magicAtk: v.extra.magicAtk ? Math.round(v.extra.magicAtk * p) : 0,
        crit: v.extra.crit || 0, pierce: v.extra.pierce || 0, block: v.extra.block || 0
      })
    },
    helmet: { label: 'Başlık', equipSlot: 'head', icon: 'helmet', make: p => ({ def: Math.round(4.5 * p), hp: Math.round(16 * p), magicDef: Math.round(2 * p) }) },
    armor: { label: 'Zırh', equipSlot: 'body', icon: 'armor', make: p => ({ def: Math.round(9.5 * p), hp: Math.round(38 * p), magicDef: Math.round(3.5 * p) }) },
    gloves: { label: 'Eldiven', equipSlot: 'gloves', icon: 'gloves', make: p => ({ def: Math.round(3 * p), atkSpeed: Math.min(9, Math.round(1.2 * p)), atk: Math.round(1.6 * p) }) },
    boots: { label: 'Ayakkabı', equipSlot: 'boots', icon: 'boots', make: p => ({ def: Math.round(3 * p), moveSpeed: Math.min(14, Math.round(1.5 * p)), dodge: Math.min(8, Math.round(0.8 * p)) }) },
    shield: { label: 'Kalkan', equipSlot: 'shield', icon: 'shield', make: p => ({ def: Math.round(6.5 * p), block: Math.min(18, Math.round(2.2 * p)), hp: Math.round(14 * p) }) },
    necklace: { label: 'Kolye', equipSlot: 'necklace', icon: 'necklace', make: p => ({ magicDef: Math.round(5 * p), hp: Math.round(18 * p), mp: Math.round(10 * p) }) },
    earring: { label: 'Küpe', equipSlot: 'earring', icon: 'earring', make: p => ({ magicAtk: Math.round(4 * p), crit: Math.min(9, Math.round(0.9 * p)), mp: Math.round(8 * p) }) },
    bracelet: { label: 'Bilezik', equipSlot: 'bracelet', icon: 'bracelet', make: p => ({ atk: Math.round(3.2 * p), pierce: Math.min(9, Math.round(0.9 * p)), hp: Math.round(10 * p) }) }
  };

  const EQUIP_SLOTS = ['weapon', 'head', 'body', 'shield', 'gloves', 'boots', 'necklace', 'earring', 'bracelet'];
  const EQUIP_LABEL = { weapon: 'Silah', head: 'Baş', body: 'Gövde', shield: 'Kalkan', gloves: 'Eldiven', boots: 'Ayakkabı', necklace: 'Kolye', earring: 'Küpe', bracelet: 'Bilezik' };

  /* ---------- KATALOG ÜRETİMİ ---------- */
  const CATALOG = {};   // id -> template

  function add(tpl) { CATALOG[tpl.id] = tpl; return tpl; }

  TIERS.forEach(tier => {
    // silahlar (sınıfa özel)
    for (const vk in SLOTS.weapon.variants) {
      const v = SLOTS.weapon.variants[vk];
      add({
        id: `w_${vk}_t${tier.t}`, kind: 'weapon', variant: vk, classReq: v.cls,
        name: `${tier.wName} ${v.label}`, slot: 'weapon', icon: 'weapon',
        tier: tier.t, levelReq: tier.lvl, pal: tier.pal,
        base: SLOTS.weapon.make(tier.power, v),
        price: Math.round(120 * Math.pow(tier.power, 1.8))
      });
    }
    // zırh ve aksesuar
    ['helmet', 'armor', 'gloves', 'boots', 'shield', 'necklace', 'earring', 'bracelet'].forEach(sk => {
      const s = SLOTS[sk];
      add({
        id: `a_${sk}_t${tier.t}`, kind: sk === 'necklace' || sk === 'earring' || sk === 'bracelet' ? 'accessory' : 'armor',
        name: `${tier.aName} ${s.label}`, slot: s.equipSlot, icon: s.icon,
        tier: tier.t, levelReq: tier.lvl, pal: tier.pal,
        base: s.make(tier.power),
        price: Math.round(80 * Math.pow(tier.power, 1.8))
      });
    });
  });

  /* ---------- MATERYAL VE SARF ---------- */
  const MATERIALS = {
    iron_shard: { id: 'iron_shard', name: 'Demir Parçası', stack: true, icon: 'mat_iron', tier: 1, price: 180 },
    steel_shard: { id: 'steel_shard', name: 'Çelik Parçası', stack: true, icon: 'mat_steel', tier: 3, price: 620 },
    power_stone: { id: 'power_stone', name: 'Güç Taşı', stack: true, icon: 'mat_power', tier: 4, price: 2400 },
    soul_stone: { id: 'soul_stone', name: 'Ruh Taşı', stack: true, icon: 'mat_soul', tier: 5, price: 7800 },
    magic_stone: { id: 'magic_stone', name: 'Büyülü Taş', stack: true, icon: 'mat_magic', tier: 6, price: 21000 },
    scroll_upgrade: { id: 'scroll_upgrade', name: 'Geliştirme Parşömeni', stack: true, icon: 'mat_scroll', tier: 4, price: 9000, helper: true },
    protect_stone: { id: 'protect_stone', name: 'Koruyucu Taş', stack: true, icon: 'mat_protect', tier: 5, price: 26000, helper: true }
  };

  const CONSUMABLES = {
    pot_hp_s: { id: 'pot_hp_s', name: 'Küçük Can İksiri', stack: true, icon: 'pot_hp', heal: 150, price: 120, levelReq: 1 },
    pot_hp_m: { id: 'pot_hp_m', name: 'Orta Can İksiri', stack: true, icon: 'pot_hp', heal: 520, price: 460, levelReq: 20 },
    pot_hp_l: { id: 'pot_hp_l', name: 'Büyük Can İksiri', stack: true, icon: 'pot_hp', heal: 1800, price: 1600, levelReq: 40 },
    pot_mp_s: { id: 'pot_mp_s', name: 'Küçük Mana İksiri', stack: true, icon: 'pot_mp', mana: 90, price: 140, levelReq: 1 },
    pot_mp_m: { id: 'pot_mp_m', name: 'Orta Mana İksiri', stack: true, icon: 'pot_mp', mana: 320, price: 520, levelReq: 20 },
    pot_mp_l: { id: 'pot_mp_l', name: 'Büyük Mana İksiri', stack: true, icon: 'pot_mp', mana: 1100, price: 1800, levelReq: 40 }
  };

  /* Skill kitapları skills.js'te tanımlı skill id'lerine göre üretilir. */
  function bookId(skillId) { return 'book_' + skillId; }

  /* ---------- EFSUN (BONUS) HAVUZU ----------
     weight  : çıkma ağırlığı (yüksek = sık)
     min/max : kademe 1'deki değer aralığı; tier ile ölçeklenir
     slots   : hangi ekipmanlarda çıkabilir                            */
  const AFFIXES = [
    { k: 'hp', weight: 120, min: 8, max: 40, scale: 1.0, slots: '*' },
    { k: 'mp', weight: 90, min: 6, max: 30, scale: 1.0, slots: '*' },
    { k: 'def', weight: 90, min: 1, max: 5, scale: 0.55, slots: 'armor' },
    { k: 'atk', weight: 90, min: 1, max: 6, scale: 0.55, slots: 'weapon,accessory' },
    { k: 'magicAtk', weight: 70, min: 1, max: 6, scale: 0.55, slots: 'weapon,accessory' },
    { k: 'magicDef', weight: 70, min: 1, max: 5, scale: 0.5, slots: 'armor,accessory' },
    { k: 'vsMonster', weight: 40, min: 2, max: 12, scale: 0, slots: '*' },
    { k: 'vsHuman', weight: 30, min: 2, max: 10, scale: 0, slots: '*' },
    { k: 'crit', weight: 26, min: 1, max: 8, scale: 0, slots: 'weapon,accessory' },
    { k: 'pierce', weight: 26, min: 1, max: 8, scale: 0, slots: 'weapon,accessory' },
    { k: 'block', weight: 22, min: 1, max: 7, scale: 0, slots: 'armor' },
    { k: 'dodge', weight: 22, min: 1, max: 7, scale: 0, slots: 'armor' },
    { k: 'atkSpeed', weight: 14, min: 1, max: 6, scale: 0, slots: 'weapon,gloves' },
    { k: 'moveSpeed', weight: 14, min: 1, max: 8, scale: 0, slots: 'boots,accessory' },
    { k: 'poison', weight: 10, min: 1, max: 5, scale: 0, slots: 'weapon' },
    { k: 'stun', weight: 8, min: 1, max: 4, scale: 0, slots: 'weapon' },
    { k: 'hpRegen', weight: 18, min: 1, max: 5, scale: 0.4, slots: 'armor,accessory' },
    { k: 'mpRegen', weight: 18, min: 1, max: 5, scale: 0.4, slots: 'armor,accessory' }
  ];

  /* Efsun değeri düz rastgele değil: kaliteli roll üstel olarak nadir.
     quality = rand^EXPONENT  →  mükemmel efsun aramak gerçekten uzun sürer. */
  const AFFIX_QUALITY_EXPONENT = 2.6;

  function affixAllowed(af, tpl) {
    if (af.slots === '*') return true;
    const list = af.slots.split(',');
    return list.indexOf(tpl.kind) >= 0 || list.indexOf(tpl.slot) >= 0;
  }

  function template(id) { return CATALOG[id] || null; }
  function all() { return CATALOG; }
  function tiersUpTo(level) { return TIERS.filter(t => t.lvl <= level); }
  function tierByIndex(t) { return TIERS.find(x => x.t === t); }

  /* Belirli kademe ve slot listesine uyan şablonları getirir. */
  function pool(tierMin, tierMax, slots, classKey) {
    const out = [];
    for (const id in CATALOG) {
      const tpl = CATALOG[id];
      if (tpl.tier < tierMin || tpl.tier > tierMax) continue;
      if (slots && slots.indexOf(tpl.slot) < 0) continue;
      if (tpl.classReq && classKey && tpl.classReq !== classKey) continue;
      out.push(tpl);
    }
    return out;
  }

  return {
    TIERS, SLOTS, EQUIP_SLOTS, EQUIP_LABEL, CATALOG,
    MATERIALS, CONSUMABLES, AFFIXES, AFFIX_QUALITY_EXPONENT,
    affixAllowed, template, all, pool, tiersUpTo, tierByIndex, bookId
  };
});
