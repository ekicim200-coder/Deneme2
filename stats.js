/* =============================================================
   stats.js — Stat mimarisi
   Final stat = taban(sınıf) + level büyümesi + dağıtılan puan
                + ekipman + ırk çarpanı  → soft-cap
   ============================================================= */

const StatSystem = {

  KEYS: ['maxHp', 'hpRegen', 'attack', 'magic', 'defense', 'attackSpeed', 'moveSpeed',
         'critChance', 'critDamage', 'penetration', 'range', 'elementDamage', 'elementRes',
         'resSu', 'resAtes', 'dmgBoss', 'dmgMonster', 'dmgPlayer', 'dmgStone'],

  empty() {
    const s = {};
    for (const k of this.KEYS) s[k] = 0;
    return s;
  },

  softCap(key, value) {
    const c = GameData.SOFTCAP[key];
    if (!c) return value;
    let v = value;
    if (v > c.soft) v = c.soft + (v - c.soft) * c.rate;
    return Math.min(v, c.hard);
  },

  /* Ekipmandan gelen toplam statlar */
  fromEquipment(equipment) {
    const s = this.empty();
    for (const slot of GameData.SLOTS) {
      const item = equipment[slot.key];
      if (!item) continue;
      for (const [k, v] of Object.entries(item.stats)) {
        if (s[k] === undefined) s[k] = 0;
        s[k] += v;
      }
    }
    return s;
  },

  /* Dağıtılan stat puanlarından gelen katkı */
  fromAlloc(alloc) {
    const s = this.empty();
    for (const a of GameData.ALLOC) {
      const pts = alloc[a.key] || 0;
      s[a.key] += pts * a.per;
    }
    return s;
  },

  /* Bir karakterin nihai statlarını hesaplar */
  compute(ch) {
    const cls = GameData.CLASSES[ch.cls];
    const race = GameData.RACES[ch.race];
    const s = this.empty();

    // 1) taban + level büyümesi
    const lv = ch.level - 1;
    for (const [k, v] of Object.entries(cls.base)) s[k] = v;
    for (const [k, v] of Object.entries(cls.growth)) s[k] += v * lv;
    s.hpRegen += 2 + lv * 0.22;

    // 2) dağıtılan puanlar
    const al = this.fromAlloc(ch.alloc || {});
    for (const k of this.KEYS) s[k] += al[k] || 0;

    // 3) ekipman
    const eq = this.fromEquipment(ch.equipment || {});
    for (const k of this.KEYS) s[k] += eq[k] || 0;

    // 4) ırk çarpanları
    const b = race.bonus;
    if (b.attack) s.attack *= (1 + b.attack), s.magic *= (1 + b.attack);
    if (b.defense) s.defense *= (1 + b.defense);
    if (b.hpRegen) s.hpRegen *= (1 + b.hpRegen);
    if (b.moveSpeed) s.moveSpeed *= (1 + b.moveSpeed);
    if (b.critChance) s.critChance += b.critChance;
    if (b.critDamage) s.critDamage += b.critDamage;
    if (b.elementDamage) s.elementDamage += b.elementDamage;
    if (b.elementRes) s.elementRes += b.elementRes;
    if (b.maxHp) s.maxHp *= (1 + b.maxHp);
    if (b.attackSpeed) s.attackSpeed *= (1 + b.attackSpeed);
    if (b.resSu) s.resSu += b.resSu;             // ırkın doğal element dayanıklılığı
    if (b.resAtes) s.resAtes += b.resAtes;

    // 5) soft-cap
    for (const k of this.KEYS) s[k] = this.softCap(k, s[k]);

    // 6) yuvarlama
    s.maxHp = Math.round(s.maxHp);
    s.attack = Math.round(s.attack);
    s.magic = Math.round(s.magic);
    s.defense = Math.round(s.defense);
    return s;
  },

  /* Ekipman gücü — matchmaking ve öneri için tek sayı */
  powerOf(s) {
    return Math.round(
      s.maxHp * 0.35 + s.attack * 4 + s.magic * 4 + s.defense * 3 +
      s.critChance * 900 + s.critDamage * 260 + s.penetration * 700 +
      s.attackSpeed * 220 + s.moveSpeed * 40
    );
  },

  power(ch) { return this.powerOf(this.compute(ch)); },

  /* Level için gereken XP */
  xpNeed(level) { return GameData.BALANCE.xpCurve(level); }
};
