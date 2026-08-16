/* =============================================================
   combat.js — Hasar hesaplama (modüler, tek noktadan değiştirilebilir)

   Final = Güç × Skill Çarpanı
           → Savunma Azaltma (delici sonrası)
           → Element Modifikatörü (avantaj − direnç)
           → Kritik
           → Sapma
   Bu fonksiyon saf (pure) yazıldı: ileride Node sunucusuna
   aynen taşınabilir. Client asla hasar "kararı" vermez.
   ============================================================= */

const Combat = {

  /* attacker/defender: { stats, level, element } */
  calc(attacker, defender, opts = {}) {
    const B = GameData.BALANCE;
    const A = attacker.stats, D = defender.stats;

    const mult = opts.mult != null ? opts.mult : 1;
    const useMagic = opts.magic === true;
    const power = useMagic ? A.magic : A.attack;

    let dmg = power * mult;

    // --- Savunma azaltma (delici vuruş savunmanın bir kısmını yok sayar)
    const pen = U.clamp((A.penetration || 0) + (opts.bonusPen || 0), 0, 0.85);
    const effDef = Math.max(0, (D.defense || 0) * (1 - pen));
    const k = B.defenseK + B.defensePerLevel * (attacker.level || 1);
    const mitigation = effDef / (effDef + k);
    dmg *= (1 - mitigation);

    // --- Element modifikatörü
    let elemMod = 1 + (A.elementDamage || 0);
    if (attacker.element && defender.element && attacker.element !== defender.element) {
      elemMod += B.elementAdvantage;
    }
    elemMod -= (D.elementRes || 0);
    // Elemente ÖZEL dayanıklılık: saldıranın elementine göre ayrı direnç
    if (attacker.element === 'su')   elemMod -= (D.resSu || 0);
    if (attacker.element === 'ates') elemMod -= (D.resAtes || 0);
    dmg *= Math.max(0.15, elemMod);

    // --- Hedef türüne karşı güç (boss / canavar / oyuncu)
    const kind = defender.kind || 'monster';
    const kindKey = kind === 'boss' ? 'dmgBoss' : kind === 'player' ? 'dmgPlayer' : kind === 'stone' ? 'dmgStone' : 'dmgMonster';
    dmg *= (1 + (A[kindKey] || 0));

    // --- Kritik
    let crit = false;
    let critChance = U.clamp(A.critChance || 0, 0, 1);
    // Ateş ırkı pasifi: yanan hedefe karşı ek kritik şansı
    if (attacker.element === 'ates' && defender.burning) {
      critChance = U.clamp(critChance + (GameData.RACES.ates.passive.critVsBurning || 0), 0, 1);
    }
    if (opts.forceCrit) crit = true;
    else crit = Math.random() < critChance;
    if (crit) dmg *= (A.critDamage || 1.5);

    // --- Delici görsel bildirimi (savunmanın %20+'ını yok saydıysa)
    const penetrated = pen >= 0.20 && (D.defense || 0) > 0;

    // --- Sapma
    dmg *= U.rand(1 - B.variance, 1 + B.variance);

    return {
      damage: Math.max(1, Math.round(dmg)),
      crit,
      penetrated,
      element: attacker.element || null
    };
  },

  /* Yaratıklar için basitleştirilmiş saldırı (aynı formül, monster statları) */
  monsterStats(m, level, ageMul) {
    const g = 1 + (level - 1) * 0.11;
    const am = GameData.BALANCE.monsterAtkMul;
    return {
      maxHp: Math.round(m.hp * g * ageMul),
      attack: Math.round(m.atk * g * ageMul * am),
      magic: Math.round(m.atk * g * ageMul * am),
      defense: Math.round(m.def * g * ageMul),
      attackSpeed: m.aspd,
      moveSpeed: m.spd,
      critChance: 0.05,
      critDamage: 1.5,
      penetration: 0.05,
      range: m.range,
      elementDamage: 0,
      elementRes: 0.05,
      hpRegen: 0
    };
  }
};
