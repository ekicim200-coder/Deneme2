/* =============================================================
   loot.js — Item üretimi, nadirlik, fiyatlama, market ve craft
   ============================================================= */

const Loot = {

  rarityById(id) { return GameData.RARITY.find(r => r.id === id); },

  /* ---- Kuşam kademesi (level aralığına göre ayrı kıyafet setleri) ---- */
  tierOf(level) {
    const T = GameData.GEAR_TIERS;
    for (const t of T) if (level >= t.min && level <= t.max) return t;
    return level < T[0].min ? T[0] : T[T.length - 1];
  },
  tierById(id) { return GameData.GEAR_TIERS.find(t => t.id === id) || GameData.GEAR_TIERS[0]; },

  rollRarity(bonus = 0) {
    // bonus: elite/boss için nadirlik ağırlığını kaydırır
    const list = GameData.RARITY.map(r => ({
      ...r,
      w: r.weight * (r.mult > 1.2 ? (1 + bonus * (r.mult - 1)) : 1)
    }));
    return U.weightedPick(list, 'w');
  },

  /* Ana item üretici */
  generate(opts = {}) {
    const ilvl = U.clamp(Math.round(opts.ilvl || 1), 1, 100);
    const slot = opts.slot || U.pick(GameData.SLOTS).key;
    const rarity = opts.rarity ? this.rarityById(opts.rarity) : this.rollRarity(opts.rarityBonus || 0);
    const race = opts.race || U.pick(['su', 'ates']);
    const cls = opts.cls || null;

    const tier = opts.tier ? this.tierById(opts.tier) : this.tierOf(ilvl);
    const tMul = tier.statMul;

    const stats = {};
    const main = GameData.SLOT_MAIN[slot];

    /* Silahın ana statı sınıfa göre ölçeklenir (güç mantığı):
       savaşçının ağır silahı en yüksek, büyücünün asası en düşük ham saldırı verir —
       büyücü hasarını asa yerine büyü gücü statından alır. */
    let classMul = 1;
    let mainStat = main.stat;
    if (slot === 'weapon') {
      const role = GameData.POWER_MODEL.roles[cls];
      classMul = role ? role.weaponMul : 1;
      if (cls === 'buyucu') mainStat = 'magic';       // asa büyü gücü verir
    }
    stats[mainStat] = Math.round((main.base + main.per * ilvl) * rarity.mult * tMul * classMul * U.rand(0.9, 1.12));

    // Asa aynı zamanda az miktarda fiziksel saldırı verir
    if (slot === 'weapon' && cls === 'buyucu') {
      stats.attack = Math.round(stats.magic * 0.30);
    }

    /* --- EFSUN ---
       Efsunsuz item yalnızca ana statını taşır. Efsunlu item ek stat alır.
       opts.enchant: true/false verilirse zorlanır, verilmezse şansa bağlı. */
    const E = GameData.ENCHANT;
    const enchanted = opts.enchant !== undefined
      ? !!opts.enchant
      : U.chance(opts.enchantChance != null ? opts.enchantChance : E.baseChance);

    const pool = GameData.AFFIXES.filter(a => a.key !== mainStat);
    const used = new Set();
    const affixCount = enchanted ? rarity.affixes : 0;
    for (let i = 0; i < affixCount; i++) {
      let a = U.pick(pool);
      let guard = 0;
      while (used.has(a.key) && guard++ < 12) a = U.pick(pool);
      used.add(a.key);
      const val = (a.base + a.per * ilvl) * rarity.mult * tMul * U.rand(0.85, 1.15);
      stats[a.key] = (stats[a.key] || 0) + (a.fmt === 'flat' ? Math.round(val) : Math.round(val * 1000) / 1000);
    }

    /* --- NADİR EFSUNLAR (delici, dayanıklılık, türe karşı güç) ---
       Aynı taban eşya markette de satılır; farkı buradaki efsun havuzudur. */
    let rareCount = enchanted ? (GameData.RARE_AFFIX_COUNT[rarity.id] || 0) : 0;
    if (opts.rareAffixes != null) rareCount = opts.rareAffixes;
    const rareUsed = [];
    for (let i = 0; i < rareCount; i++) {
      const pool = GameData.RARE_AFFIXES.filter(a => !rareUsed.includes(a.key));
      if (!pool.length) break;
      const a = U.weightedPick(pool, 'weight');
      rareUsed.push(a.key);
      const val = (a.base + a.per * ilvl) * (0.85 + rarity.mult * 0.35) * tMul * U.rand(0.9, 1.15);
      stats[a.key] = (stats[a.key] || 0) + Math.round(val * 1000) / 1000;
    }

    let name = this.makeName(slot, rarity, race, cls, tier);
    if (enchanted) name = GameData.ENCHANT.prefix + ' ' + name;
    const item = {
      uid: U.uid(),
      name, slot, ilvl,
      enchanted,
      gift: !!opts.gift,
      tier: tier.id,
      tierName: tier.name,
      rareAffixes: rareUsed,
      rarity: rarity.id,
      reqLevel: tier.min,                 // kuşam kademesinin alt sınırı
      age: this.ageOfLevel(ilvl),
      stats,
      price: 0
    };
    item.price = Math.round(this.price(item) * tier.priceMul *
      (enchanted ? GameData.ENCHANT.priceMul : 1) * (1 + rareUsed.length * 0.35));
    return item;
  },

  ageOfLevel(lv) {
    let a = 1;
    for (const age of GameData.AGES) if (lv >= age.reqLevel) a = age.id;
    return a;
  },

  makeName(slot, rarity, race, cls, tier) {
    const set = (tier || this.tierOf(1)).sets[race];       // kademe seti: her level aralığı ayrı kıyafet
    if (slot === 'weapon') {
      const base = cls ? U.pick(GameData.WEAPON_NAMES[cls]) : U.pick(GameData.WEAPON_NAMES.savasci);
      return `${set} ${base}`;
    }
    const slotName = GameData.SLOTS.find(s => s.key === slot).name;
    if (rarity.mult >= 1.85) return `${set} ${U.pick(GameData.ARMOR_SUFFIX)} ${slotName}`;
    return `${set} ${slotName}`;
  },

  price(item) {
    const r = this.rarityById(item.rarity);
    return Math.round((26 + item.ilvl * 14) * r.mult * r.mult * U.rand(0.95, 1.08));
  },

  sellValue(item) { return Math.max(1, Math.round(item.price * GameData.BALANCE.goldSellRate)); },

  /* Bir itemin toplam gücü — "daha iyi mi?" karşılaştırması için */
  score(item, cls) {
    const w = {
      maxHp: 0.35, attack: cls === 'buyucu' ? 1.2 : 4, magic: cls === 'buyucu' ? 4 : 1.2,
      defense: 3, critChance: 900, critDamage: 260, penetration: 700,
      attackSpeed: 220, moveSpeed: 40, hpRegen: 12, elementDamage: 500, elementRes: 400
    };
    let s = 0;
    for (const [k, v] of Object.entries(item.stats)) s += (w[k] || 1) * v;
    return Math.round(s);
  },

  /* Market stoğu üretir */
  /* Market stoğu — bir KADEME için üretir (10-20, 20-40, ... ayrı raflar).
     Her rafta hem efsunsuz hem efsunlu eşya bulunur. */
  makeStock(tierId, race, cls, count = 9) {
    const tier = this.tierById(tierId);
    const stock = [];
    for (let i = 0; i < count; i++) {
      const ilvl = U.clamp(U.randInt(tier.min, Math.min(tier.max, tier.min + 12)), 1, 100);
      const slot = GameData.SLOTS[i % GameData.SLOTS.length].key;
      const rarity = U.weightedPick(GameData.RARITY.slice(0, 4).map(r => ({ ...r, w: r.weight })), 'w').id;
      stock.push(this.generate({
        ilvl, slot, rarity, race, cls, tier: tier.id,
        enchant: i % 2 === 0                 // bir efsunsuz, bir efsunlu
      }));
    }
    return stock;
  },

  /* Yaratık ölünce düşen ganimet */
  rollDrop(monster, monsterLevel, player) {
    const out = { items: [], mats: {} };
    const tier = monster.tier;
    const chanceItem = tier === 'boss' ? 1 : tier === 'stone' ? 1 : tier === 'elite' ? 0.35 : 0.11;
    const rarityBonus = tier === 'boss' ? 3.5 : tier === 'stone' ? 2.4 : tier === 'elite' ? 1.2 : 0;
    const gearTier = this.tierOf(player.level).id;          // ganimet oyuncunun kademesinden

    if (U.chance(chanceItem)) {
      out.items.push(this.generate({
        ilvl: U.clamp(player.level + U.randInt(-1, 2), 1, 100), tier: gearTier,
        race: player.race, cls: player.cls, rarityBonus,
        enchantChance: tier === 'stone' ? 0.75 : tier === 'elite' ? 0.60 : GameData.ENCHANT.baseChance
      }));
    }

    /* --- MADEN TAŞI ganimeti --- */
    if (tier === 'stone') {
      // taşın içinden çıkan efsunlu eşya: nadir efsun havuzundan 1-2 özellik
      out.items.push(this.generate({
        ilvl: U.clamp(player.level + U.randInt(0, 3), 1, 100), tier: gearTier,
        race: player.race, cls: player.cls, rarity: U.chance(0.25) ? 'epic' : 'rare',
        enchant: true, rareAffixes: U.chance(0.35) ? 2 : 1
      }));
      out.mats.maden = (out.mats.maden || 0) + U.randInt(2, 5);
      out.potions = { kucuk: U.randInt(2, 4) };
    }
    if (tier === 'boss') {
      // 1) Garantili boss hediyesi — daima efsunlu, bossa/canavara karşı statlı
      const gift = this.generate({
        ilvl: U.clamp(player.level + U.randInt(1, 3), 1, 100), tier: gearTier,
        race: player.race, cls: player.cls,
        rarity: U.chance(0.35) ? 'legendary' : 'epic', enchant: true, gift: true,
        rareAffixes: U.chance(0.4) ? 3 : 2      // hediyeler daima nadir efsunlu
      });
      // bossun elementine karşı dayanıklılık garantisi
      const bonusKey = monster.element === 'su' ? 'resSu' : 'resAtes';
      const aff = GameData.RARE_AFFIXES.find(a => a.key === bonusKey);
      gift.stats[bonusKey] = Math.round(((gift.stats[bonusKey] || 0) +
        (aff.base + aff.per * gift.ilvl) * 0.8) * 1000) / 1000;
      if (!gift.rareAffixes.includes(bonusKey)) gift.rareAffixes.push(bonusKey);
      gift.name = `${monster.name || 'Boss'} Hediyesi · ${gift.name}`;
      gift.price = Math.round(gift.price * 1.35);
      out.items.push(gift);

      // 2) Ek ganimet: efsunsuz olabilir (satılık / craft malzemesi)
      if (U.chance(0.65)) {
        out.items.push(this.generate({
          ilvl: U.clamp(player.level + U.randInt(0, 3), 1, 100), tier: gearTier,
          race: player.race, cls: player.cls, rarityBonus: 2.2, enchantChance: 0.45
        }));
      }
      // 3) İksir hediyesi
      out.potions = { kucuk: U.randInt(3, 6), buyuk: U.randInt(1, 2) };
    }

    // Materyal
    const addMat = (id, n) => { out.mats[id] = (out.mats[id] || 0) + n; };
    if (U.chance(0.45)) addMat('demir', U.randInt(1, 2));
    if (U.chance(0.35)) addMat('deri', U.randInt(1, 2));
    if (monster.element === 'su' && U.chance(0.30)) addMat('buzKristali', 1);
    if (monster.element === 'ates' && U.chance(0.30)) addMat('atesTasi', 1);
    if (tier === 'boss') {
      if (monster.element === 'su') addMat('krakenMuru', U.randInt(1, 2));
      else addMat('ejderPulu', U.randInt(1, 2));
      addMat('demir', U.randInt(4, 8));
    }
    return out;
  },

  /* Craft — tarif kontrolü ve üretim */
  canCraft(recipe, player) {
    if (player.gold < recipe.cost.gold) return 'Altın yetersiz';
    for (const [m, n] of Object.entries(recipe.mats)) {
      if ((player.mats[m] || 0) < n) return `${GameData.MATERIALS[m].name} yetersiz`;
    }
    return null;
  },

  craft(recipe, player) {
    player.gold -= recipe.cost.gold;
    for (const [m, n] of Object.entries(recipe.mats)) player.mats[m] -= n;
    return this.generate({
      ilvl: U.clamp(player.level + 2, 1, 100), tier: this.tierOf(player.level).id,
      slot: recipe.slot, rarity: recipe.rarity,
      race: player.race, cls: player.cls
    });
  }
};
