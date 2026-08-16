/* =============================================================
   skills.js — Yetenek kullanımı (ırka göre element varyantı)
   ============================================================= */

const Skills = {

  listFor(cls) { return GameData.CLASSES[cls].skills.map(id => GameData.SKILLS[id]); },

  nameOf(skillId, race) { return GameData.SKILLS[skillId].name[race]; },

  /* Yeteneğin ırka göre yan etkisini normalize eder */
  effectFor(sk, race) {
    const raw = sk.effect ? sk.effect[race] : null;
    if (!raw) return null;
    const out = {};
    if (raw.slow) { out.slow = raw.slow; out.slowDur = raw.dur2 || raw.dur || 2; }
    if (raw.burn) { out.burn = raw.burn; out.burnDur = raw.dur || 3; }
    if (raw.stun) { out.stun = raw.stun; }
    return out;
  },

  /* ---- YETENEK SEVİYESİ ----
     Seviye arttıkça hasar artar, bekleme kısalır, yan etkiler güçlenir. */
  levelOf(actor, idx) {
    const max = GameData.SKILL_LEVEL.max;
    if (actor && actor.skillLv) return U.clamp(actor.skillLv[idx] || 1, 1, max);
    // botlar/yaratıklar: karakter leveline göre otomatik
    return U.clamp(1 + Math.floor((actor && actor.level || 1) / 9), 1, max);
  },

  /* Seviyeye göre ölçeklenmiş yetenek kopyası döner (orijinali bozmaz) */
  scaled(skillId, lv) {
    const sk = GameData.SKILLS[skillId];
    const L = GameData.SKILL_LEVEL;
    const n = U.clamp(lv || 1, 1, L.max) - 1;
    const out = Object.assign({}, sk);
    out.lv = n + 1;
    out.dmgBonus = L.damagePerLevel * n;
    if (sk.mult) out.mult = sk.mult * (1 + L.damagePerLevel * n);
    out.cd = Math.round(sk.cd * Math.max(L.cdFloor, 1 - L.cdPerLevel * n) * 10) / 10;
    out.mana = Math.round(sk.mana * (1 + L.manaPerLevel * n));
    const em = 1 + L.effectPerLevel * n;
    if (sk.effect) {
      out.effect = {};
      for (const r in sk.effect) {
        const c = Object.assign({}, sk.effect[r]);
        for (const k of ['slow', 'burn', 'dur', 'dur2']) if (c[k]) c[k] = Math.round(c[k] * em * 1000) / 1000;
        // sersemletme düz artar ve üst sınırı vardır (PvP'de kilitlenme olmasın)
        if (c.stun) c.stun = Math.min(L.stunCap, Math.round((c.stun + L.stunFlatPerLevel * n) * 100) / 100);
        out.effect[r] = c;
      }
    }
    if (sk.heal) { out.heal = {}; for (const r in sk.heal) out.heal[r] = sk.heal[r] * em; }
    if (sk.buff) {
      out.buff = {};
      for (const r in sk.buff) {
        const b = Object.assign({}, sk.buff[r]);
        for (const k in b) b[k] = Math.round(b[k] * em * 1000) / 1000;
        out.buff[r] = b;
      }
    }
    return out;
  },

  /* Yeteneğin ne işe yaradığını insan diliyle + sayılarla anlatır.
     stats verilirse tahmini hasar da hesaplanır. */
  info(skillId, race, cls, stats, lv = 1) {
    const base = GameData.SKILLS[skillId];
    if (!base) return null;
    const sk = this.scaled(skillId, lv);
    const magic = cls === 'buyucu';
    const power = stats ? (magic ? stats.magic : stats.attack) : 0;

    const TYPE = {
      melee:      { name: 'Yakın vuruş', how: 'Baktığın yöndeki dar alana tek sert vuruş yapar.' },
      area:       { name: 'Alan hasarı', how: sk.self ? 'Çevrende dönen bir alan açar.' : 'İmlecin olduğu bölgeye alan hasarı bırakır.' },
      projectile: { name: 'Mermi',       how: sk.count > 1 ? `${sk.count} mermiyi yelpaze şeklinde fırlatır.` : 'Baktığın yöne mermi fırlatır.' },
      dash:       { name: 'Atılma',      how: 'İleri fırlar, çarptığın düşmanı vurur.' },
      buff:       { name: 'Takviye',     how: 'Kendine süreli güçlendirme uygular.' }
    }[sk.type] || { name: sk.type, how: '' };

    const rows = [];
    if (sk.mult) {
      const per = sk.hits ? `${sk.hits} vuruş × %${Math.round(sk.mult * 100)}` : `%${Math.round(sk.mult * 100)}`;
      rows.push(['Hasar', `${magic ? 'Büyü gücünün' : 'Saldırının'} ${per}`]);
      if (power) {
        const total = power * sk.mult * (sk.hits || 1) * (sk.count || 1);
        rows.push(['Tahmini toplam', `~${U.fmt(Math.round(total))} (savunma öncesi)`]);
      }
    }
    rows.push(['Bekleme', sk.cd + ' sn']);
    rows.push(['Mana', sk.mana + '']);
    if (sk.radius) rows.push(['Etki alanı', sk.radius.toFixed(1) + ' birim']);
    if (sk.castRange) rows.push(['Atış menzili', sk.castRange.toFixed(1) + ' birim']);
    if (sk.dashDist) rows.push(['Atılma mesafesi', sk.dashDist.toFixed(1) + ' birim']);
    if (sk.pierce) rows.push(['Delme', `${sk.pierce} düşmanı delip geçer`]);
    if (sk.bonusPen) rows.push(['Ek delici', `savunmanın +%${Math.round(sk.bonusPen * 100)}'ini yok sayar`]);
    if (sk.forceCrit) rows.push(['Kritik', 'her zaman kritik vurur']);
    if (sk.splash) rows.push(['Patlama', `isabet yerinde ${sk.splash.toFixed(1)} birim patlar`]);
    if (sk.dur) rows.push(['Süre', sk.dur + ' sn']);

    // yan etkiler ırka göre
    const e = sk.effect ? sk.effect[race] : null;
    const eff = [];
    if (e) {
      if (e.slow) eff.push(`Yavaşlatır (−%${Math.round(e.slow * 100)} hız, ${e.dur2 || e.dur || 2} sn)`);
      if (e.burn) eff.push(`Yakar (saniyede saldırının %${Math.round(e.burn * 50)}'i, ${e.dur || 3} sn)`);
      if (e.stun) eff.push(`Sersemletir (${e.stun} sn)`);
    }
    if (sk.heal && sk.heal[race]) eff.push(`Seni max canının %${Math.round(sk.heal[race] * 100)}'i kadar iyileştirir`);
    if (sk.buff && sk.buff[race]) {
      for (const [k, v] of Object.entries(sk.buff[race])) {
        eff.push(`${U.statName(k)} ${k === 'hpRegen' ? '+' + v : '+%' + Math.round(v * 100)} (${sk.dur} sn)`);
      }
    }

    return {
      id: skillId,
      lv: sk.lv,
      name: sk.name[race],
      typeName: TYPE.name,
      how: TYPE.how,
      desc: sk.desc,
      rows, effects: eff,
      cd: sk.cd, mana: sk.mana
    };
  },

  /* actor: PlayerActor veya BotActor · idx: 0-3 · aim: {x,y} dünya koordinatı */
  cast(actor, idx, game, aim) {
    const race = actor.race;
    const cls = actor.cls;
    const skillId = GameData.CLASSES[cls].skills[idx];
    const sk = this.scaled(skillId, this.levelOf(actor, idx));
    const s = actor.eff();
    const magic = cls === 'buyucu';
    const colors = GameData.RACES[race].colors;
    const fx = Skills.effectFor(sk, race);
    const ang = U.angle(actor.x, actor.y, aim.x, aim.y);
    actor.facing = ang;

    switch (sk.type) {

      case 'melee': {
        game.meleeSwing(actor, {
          mult: sk.mult, radius: sk.radius, arc: sk.arc, magic, effect: fx, color: colors.aura
        });
        game.fx.arc(actor.x, actor.y, ang, sk.radius, colors.aura);
        break;
      }

      case 'projectile': {
        const n = sk.count || 1;
        for (let i = 0; i < n; i++) {
          const off = n === 1 ? 0 : (i - (n - 1) / 2) * (sk.spread || 0.3);
          game.spawnProjectile({
            owner: actor, x: actor.x, y: actor.y, angle: ang + off,
            speed: sk.speed, life: sk.life, mult: sk.mult, magic,
            color: colors.primary, size: 0.24, pierce: sk.pierce || 0,
            splash: sk.splash || 0, bonusPen: sk.bonusPen || 0,
            forceCrit: !!sk.forceCrit, effect: fx
          });
        }
        break;
      }

      case 'area': {
        let cx = aim.x, cy = aim.y;
        if (sk.self) { cx = actor.x; cy = actor.y; }
        else if (sk.castRange) {
          const d = U.dist(actor.x, actor.y, aim.x, aim.y);
          if (d > sk.castRange) {
            cx = actor.x + Math.cos(ang) * sk.castRange;
            cy = actor.y + Math.sin(ang) * sk.castRange;
          }
        }
        game.spawnArea({
          owner: actor, x: cx, y: cy, radius: sk.radius, hits: sk.hits || 1,
          tick: sk.tick || 0.4, mult: sk.mult, magic, color: colors.primary,
          effect: fx, follow: sk.self ? actor : null
        });
        if (sk.heal && sk.heal[race]) {
          const heal = actor.maxHp * sk.heal[race];
          actor.hp = Math.min(actor.maxHp, actor.hp + heal);
          game.fx.damageNumber(actor.x, actor.y, Math.round(heal), { heal: true });
        }
        break;
      }

      case 'dash': {
        const dist = sk.dashDist;
        const tx = actor.x + Math.cos(ang) * dist;
        const ty = actor.y + Math.sin(ang) * dist;
        if (!game.world.blocked(tx, ty, actor.r)) { actor.x = tx; actor.y = ty; }
        game.world.clampPos(actor);
        game.fx.trail(actor.x, actor.y, colors.aura);
        game.meleeSwing(actor, {
          mult: sk.mult, radius: sk.radius + 1, arc: Math.PI * 2, magic, effect: fx, color: colors.aura
        });
        break;
      }

      case 'buff': {
        const mods = sk.buff[race];
        actor.addEffect({ type: 'buff', dur: sk.dur, mods, color: colors.aura });
        game.fx.ring(actor.x, actor.y, colors.aura, 2.2);
        break;
      }
    }
  },

  /* Oyuncu için kullanım denetimi */
  tryCast(player, idx, game, aim) {
    if (player.dead || player.stunned || player.busy > 0.15) return false;
    const skillId = GameData.CLASSES[player.cls].skills[idx];
    const sk = this.scaled(skillId, this.levelOf(player, idx));
    // kilitli yetenek
    const need = GameData.SKILL_LEVEL.unlockAt[idx] || 1;
    if ((player.level || 1) < need) { UI.toast(`Bu yetenek Level ${need}'te açılır`, 'warn'); return false; }
    if (player.skillCd[idx] > 0) return false;
    if (player.mana < sk.mana) { UI.toast('Enerji yetersiz', 'warn'); return false; }
    player.mana -= sk.mana;
    player.skillCd[idx] = sk.cd;
    player.busy = 0.3;
    Skills.cast(player, idx, game, aim);
    return true;
  }
};
