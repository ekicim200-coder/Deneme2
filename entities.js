/* =============================================================
   entities.js — Aktörler, yaratıklar, boss, mermiler, alan etkileri
   ============================================================= */

/* ---------------- Temel aktör ---------------- */
class Actor {
  constructor(cfg) {
    Object.assign(this, {
      id: U.uid(), x: 0, y: 0, r: 0.42, facing: 0, team: 'enemy',
      level: 1, element: 'su', name: '', size: 0.7, color: '#fff',
      dead: false, hp: 100, atkCd: 0, busy: 0, animTime: 0, hitFlash: 0,
      effects: [], vx: 0, vy: 0, knock: 0, deathTimer: 0,
      kind: 'monster', noHitTime: 0,
      swingT: 0, swingDur: 0, swingStep: 0, swingSpin: false,
      /* --- animasyon durumu --- */
      moveAmt: 0,        // 0 dururken, ~1 tam koşuda (yumuşatılmış)
      gait: 0,           // adım fazı — bacak salınımı
      lean: 0,           // hareket yönüne gövde eğilmesi
      squash: 0,         // darbe/iniş ezilmesi
      deathT: 0,         // ölüm animasyonu ilerlemesi
      lastX: 0, lastY: 0, _lastStep: 0,
      breathe: Math.random() * 6.28
    }, cfg);
    this.lastX = this.x; this.lastY = this.y;
    this.stats = cfg.stats || StatSystem.empty();
    this.maxHp = this.stats.maxHp;
    if (cfg.hp === undefined) this.hp = this.maxHp;
  }

  /* Buff/debuff sonrası anlık statlar */
  eff() {
    const s = Object.assign({}, this.stats);
    for (const e of this.effects) {
      if (e.type === 'buff' && e.mods) {
        for (const [k, v] of Object.entries(e.mods)) {
          if (k === 'hpRegen') s[k] += v; else s[k] *= (1 + v);
        }
      }
      if (e.type === 'slow') s.moveSpeed *= (1 - e.val);
    }
    return s;
  }

  get stunned() { return this.effects.some(e => e.type === 'stun'); }
  get burning() { return this.effects.some(e => e.type === 'burn'); }
  get slowRatio() {
    let m = 1;
    for (const e of this.effects) if (e.type === 'slow') m *= (1 - e.val);
    return m;
  }

  addEffect(e) {
    if (e.type === 'stun' || e.type === 'slow' || e.type === 'burn') {
      const ex = this.effects.find(x => x.type === e.type);
      if (ex) { ex.dur = Math.max(ex.dur, e.dur); ex.val = Math.max(ex.val || 0, e.val || 0); return; }
    }
    this.effects.push(e);
  }

  update(dt, game) {
    this.animTime += dt;
    if (this.atkCd > 0) this.atkCd -= dt;
    if (this.busy > 0) this.busy -= dt;
    if (this.swingT > 0) this.swingT -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;

    /* --- Animasyon: gerçek yer değiştirmeden hız türet ---
       Joystick, klavye, AI ve atılma dahil her hareket türü aynı yürüyüşü besler. */
    const moved = U.dist(this.lastX, this.lastY, this.x, this.y);
    this.lastX = this.x; this.lastY = this.y;
    const spd = dt > 0 ? moved / dt : 0;
    this.moveAmt = U.lerp(this.moveAmt, U.clamp(spd / 3.2, 0, 1.35), Math.min(1, dt * 11));
    this.gait += dt * (4.5 + this.moveAmt * 7.5) * (this.moveAmt > 0.05 ? 1 : 0.22);
    this.lean = U.lerp(this.lean, this.moveAmt * 0.16, Math.min(1, dt * 8));
    if (this.squash > 0) this.squash = Math.max(0, this.squash - dt * 2.2);
    if (this.dead) this.deathT = Math.min(1, this.deathT + dt * 2.6);

    // her adımda ayaktan toz kalkar
    if (this.moveAmt > 0.45 && game && game.fx) {
      const step = Math.floor(this.gait / Math.PI);
      if (step !== this._lastStep) {
        this._lastStep = step;
        const gc = (game.world && (game.world.accent || game.world.def.accent)) || '#8892a6';
        game.fx.dust(this.x, this.y, gc);
      }
    }

    // efekt süreleri + yanma hasarı
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.dur -= dt;
      if (e.type === 'burn') {
        e.acc = (e.acc || 0) + dt;
        if (e.acc >= 0.5) {
          e.acc -= 0.5;
          const d = Math.max(1, Math.round(e.dps * 0.5));
          this.hp -= d;
          game.fx.damageNumber(this.x, this.y, d, { burn: true });
          if (this.hp <= 0) game.onDeath(this, e.source || null);
        }
      }
      if (e.dur <= 0) this.effects.splice(i, 1);
    }

    // HP yenilenmesi
    this.noHitTime += dt;
    if (!this.dead && this.hp > 0) {
      const s = this.eff();
      const R = GameData.BALANCE.regen;
      let heal = (s.hpRegen || 0) * dt;               // ekipmandan gelen düz yenilenme

      // Oransal yenilenme (Metin2 mantığı): savaş dışında hızlı, savaşta düşük
      let rate = 0;
      if (this.kind === 'boss')        rate = this.inCombat ? R.bossCombat : R.bossIdle;
      else if (this.kind === 'monster') rate = this.inCombat ? R.monsterCombat : R.monsterIdle;
      else if (this.kind === 'player' && this.noHitTime >= R.idleDelay) {
        rate = R.playerIdle * (this.race === 'su' ? GameData.RACES.su.passive.regenMul : 1);
      }
      if (rate > 0 && !this.burning) heal += this.maxHp * rate * dt;
      if (heal > 0) this.hp = Math.min(this.maxHp, this.hp + heal);
    }

    // geri tepme
    if (this.knock > 0) {
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.knock -= dt;
      game.world.clampPos(this);
    }
  }

  moveTowards(tx, ty, dt, game, speedMul = 1) {
    const s = this.eff();
    const spd = s.moveSpeed * speedMul;
    const d = U.dist(this.x, this.y, tx, ty);
    if (d < 0.02) return;
    const nx = (tx - this.x) / d, ny = (ty - this.y) / d;
    this.tryMove(nx * spd * dt, ny * spd * dt, game);
    this.facing = Math.atan2(ny, nx);
  }

  tryMove(dx, dy, game) {
    const w = game.world;
    const okX = !w.blocked(this.x + dx, this.y, this.r);
    const okY = !w.blocked(this.x, this.y + dy, this.r);
    if (okX) this.x += dx;
    if (okY) this.y += dy;

    // Her iki eksen de kapalıysa engelin etrafından teğet yönde kay.
    // (Aksi halde aktör engele dayanıp sonsuza dek takılı kalır.)
    if (!okX && !okY && (dx || dy)) {
      const len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len;
      if (this.slideSide === undefined) this.slideSide = 1;
      for (const s of [this.slideSide, -this.slideSide]) {
        // önce 45°, sonra tam 90° kayma dene
        const cands = [
          [(ux - uy * s) * 0.7071 * len, (uy + ux * s) * 0.7071 * len],
          [-uy * s * len, ux * s * len]
        ];
        let moved = false;
        for (const [cx, cy] of cands) {
          if (!w.blocked(this.x + cx, this.y + cy, this.r)) {
            this.x += cx; this.y += cy; this.slideSide = s; moved = true; break;
          }
        }
        if (moved) break;
      }
    }
    w.clampPos(this);
  }

  distTo(o) { return U.dist(this.x, this.y, o.x, o.y); }
}

/* ---------------- Oyuncu ---------------- */
class PlayerActor extends Actor {
  constructor(save, game) {
    const stats = StatSystem.compute(save);
    super({
      x: 15, y: 15, team: 'player', name: save.name,
      element: save.race, level: save.level, stats,
      color: GameData.RACES[save.race].colors.primary,
      size: 0.8, r: 0.4, kind: 'player'
    });
    this.save = save;
    this.cls = save.cls;
    this.race = save.race;
    this.mana = GameData.BALANCE.manaMax;
    this.skillCd = [0, 0, 0, 0];
    this.dashCd = 0;
    this.potionCd = 0;
    this.dashTime = 0;
    this.dashDir = { x: 0, y: 0 };
    this.combo = 0;          // 0,1,2 → üçüncü vuruş bitirici
    this.comboTimer = 0;
    this.potionCds = { kucuk: 0, buyuk: 0, mana: 0 };
    this.skillLv = save.skillLv || [1, 1, 1, 1];
    this.hp = this.maxHp;
  }

  refreshStats() {
    this.stats = StatSystem.compute(this.save);
    const ratio = this.maxHp > 0 ? this.hp / this.maxHp : 1;
    this.maxHp = this.stats.maxHp;
    this.hp = Math.min(this.maxHp, this.maxHp * ratio);
    this.level = this.save.level;
    this.element = this.save.race;
    this.skillLv = this.save.skillLv;         // yetenek seviyeleri
  }

  update(dt, game) {
    super.update(dt, game);
    const B = GameData.BALANCE;
    this.mana = Math.min(B.manaMax, this.mana + B.manaRegen * dt);
    for (let i = 0; i < 4; i++) if (this.skillCd[i] > 0) this.skillCd[i] -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.potionCd > 0) this.potionCd -= dt;

    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0; }
    for (const k in this.potionCds) if (this.potionCds[k] > 0) this.potionCds[k] -= dt;

    if (this.dashTime > 0) {
      this.dashTime -= dt;
      const spd = 14;
      this.tryMove(this.dashDir.x * spd * dt, this.dashDir.y * spd * dt, game);
      game.fx.trail(this.x, this.y, GameData.RACES[this.race].colors.aura);
    }
  }
}

/* ---------------- MADEN TAŞI (Metin2 mantığı) ----------------
   Hareket etmez, saldırmaz. Vurdukça can barı iner ve belirli eşiklerde
   içinden düşman dalgası çıkar. Kırılınca ganimet + XP verir. */
class OreNode extends Actor {
  /* hpOverride: oyuncunun anlık gücüne göre hesaplanan can (kazma süresi sabit kalsın diye) */
  constructor(def, level, game, pos, element, hpOverride) {
    const mul = 1 + (level - 1) * 0.09;
    super({
      x: pos.x, y: pos.y, team: 'enemy', name: def.name, level,
      element, kind: 'stone', size: def.size, r: def.size * 0.8,
      color: element === 'ates' ? '#ff7a2f' : '#4fd6ff',
      stats: Object.assign(StatSystem.empty(), {
        maxHp: Math.max(Math.round(def.hp * mul), Math.round(hpOverride || 0)),
        defense: Math.round(def.def * mul),
        attack: 0, magic: 0, moveSpeed: 0, attackSpeed: 0, range: 0
      })
    });
    this.def = def;
    this.tier = 'stone';
    this.wavesLeft = def.waves;
    this.nextWaveAt = 1 - 1 / (def.waves + 1);   // ilk dalga eşiği (HP oranı)
    this.spawned = 0;
    this.pulse = U.rand(0, 6.28);
  }

  /* Taş yerinde durur; yalnızca dalga kontrolü yapar */
  update(dt, game) {
    this.animTime += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.dead) return;

    const ratio = this.hp / this.maxHp;
    while (this.wavesLeft > 0 && ratio <= this.nextWaveAt) {
      this.releaseWave(game);
      this.wavesLeft--;
      this.nextWaveAt -= 1 / (this.def.waves + 1);
    }
  }

  /* İçinden düşman dalgası çıkar */
  releaseWave(game) {
    const n = this.def.perWave;
    for (let i = 0; i < n; i++) {
      const a = U.rand(0, Math.PI * 2);
      const pos = game.world.openNear(
        this.x + Math.cos(a) * (this.r + 1.6),
        this.y + Math.sin(a) * (this.r + 1.6), 0.5);
      const m = game.spawnMonster(pos, this.element, this.level);
      if (m) { m.state = 'chase'; m.aggroRange = 22; m.leash = 26; this.spawned++; }
    }
    game.fx.ring(this.x, this.y, this.r * 2.2, this.color);
    UI.toast(`${this.name} sarsıldı — ${n} düşman çıktı!`, 'warn');
  }
}

/* ---------------- Yaratık ---------------- */
class Monster extends Actor {
  constructor(def, level, game, pos, ageMul = 1) {
    const stats = Combat.monsterStats(def, level, ageMul);
    super({
      x: pos.x, y: pos.y, team: 'enemy', name: def.name, level,
      element: def.element, stats, color: def.color, size: def.size,
      r: def.size * 0.55, kind: def.tier === 'boss' ? 'boss' : 'monster'
    });
    this.def = def;
    this.tier = def.tier;
    this.ranged = !!def.ranged;
    this.spawn = { x: pos.x, y: pos.y };
    this.state = 'idle';
    this.wanderT = U.rand(0, 2);
    this.wanderTo = { x: pos.x, y: pos.y };
    this.aggroRange = def.tier === 'boss' ? 99 : 8.5;
    this.leash = 16;
  }

  update(dt, game) {
    super.update(dt, game);
    if (this.dead || this.stunned) return;
    const p = game.player;
    if (!p || p.dead) { this.state = 'idle'; }

    const s = this.eff();
    const d = p ? this.distTo(p) : 999;

    if (p && !p.dead && d < this.aggroRange) this.state = 'chase';
    else if (this.state === 'chase' && (d > this.leash || !p || p.dead)) this.state = 'idle';
    this.inCombat = (this.state === 'chase');

    if (this.state === 'chase' && p) {
      const wantRange = this.ranged ? s.range * 0.8 : s.range * 0.75;
      if (d > wantRange) this.moveTowards(p.x, p.y, dt, game);
      else if (d < wantRange * 0.55 && this.ranged) {
        this.moveTowards(p.x * 2 - this.x, p.y * 2 - this.y, dt, game, -0.7);
      } else {
        this.facing = U.angle(this.x, this.y, p.x, p.y);
      }
      if (d <= s.range + p.r && this.atkCd <= 0) this.attack(game, p);
    } else {
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = U.rand(2.5, 5);
        this.wanderTo = {
          x: this.spawn.x + U.rand(-3, 3),
          y: this.spawn.y + U.rand(-3, 3)
        };
      }
      if (U.dist(this.x, this.y, this.wanderTo.x, this.wanderTo.y) > 0.4) {
        this.moveTowards(this.wanderTo.x, this.wanderTo.y, dt, game, 0.45);
      }
    }
  }

  attack(game, target) {
    const s = this.eff();
    this.atkCd = 1 / Math.max(0.2, s.attackSpeed);
    this.busy = 0.28;
    this.facing = U.angle(this.x, this.y, target.x, target.y);
    if (this.ranged) {
      game.spawnProjectile({
        owner: this, x: this.x, y: this.y, angle: this.facing,
        speed: 9, life: 1.4, mult: 1, color: this.color, size: 0.22
      });
    } else {
      game.dealDamage(this, target, { mult: 1 });
      game.fx.hit(target.x, target.y, this.color);
    }
  }
}

/* ---------------- Boss ---------------- */
class Boss extends Monster {
  constructor(def, level, game, pos, ageMul = 1) {
    super({ ...def, tier: 'boss' }, level, game, pos, ageMul);
    this.bossDef = def;
    this.phaseIdx = 0;
    this.specialCd = 4;
    this.phaseFlash = 0;
  }

  get phase() { return this.bossDef.phases[this.phaseIdx]; }

  update(dt, game) {
    // faz geçişi
    const ratio = this.hp / this.maxHp;
    for (let i = this.bossDef.phases.length - 1; i >= 0; i--) {
      if (ratio <= this.bossDef.phases[i].at && i > this.phaseIdx) {
        this.phaseIdx = i;
        this.phaseFlash = 1.2;
        this.specialCd = 1.5;
        game.fx.ring(this.x, this.y, this.color, 5);
        UI.toast(`${this.name} — ${this.phase.name}`, 'warn');
        break;
      }
    }
    if (this.phaseFlash > 0) this.phaseFlash -= dt;

    super.update(dt, game);
    if (this.dead || this.stunned) return;

    this.specialCd -= dt;
    const p = game.player;
    if (p && !p.dead && this.specialCd <= 0 && this.distTo(p) < 14) {
      this.specialCd = this.phase.specialCd;
      const kind = this.phase.special;
      if (kind === 'nova' || (kind === 'both' && U.chance(0.5))) this.nova(game);
      else this.volley(game, p);
    }
  }

  nova(game) {
    this.busy = 0.5;
    game.fx.ring(this.x, this.y, this.color, 6);
    const n = 14;
    for (let i = 0; i < n; i++) {
      game.spawnProjectile({
        owner: this, x: this.x, y: this.y, angle: (i / n) * Math.PI * 2,
        speed: 7.5, life: 2.0, mult: 0.85 * this.phase.atkMul,
        color: this.color, size: 0.3
      });
    }
  }

  volley(game, target) {
    this.busy = 0.5;
    const base = U.angle(this.x, this.y, target.x, target.y);
    for (let i = -2; i <= 2; i++) {
      game.spawnProjectile({
        owner: this, x: this.x, y: this.y, angle: base + i * 0.22,
        speed: 11, life: 1.6, mult: 0.9 * this.phase.atkMul,
        color: this.color, size: 0.28
      });
    }
  }

  attack(game, target) {
    const s = this.eff();
    this.atkCd = 1 / Math.max(0.2, s.attackSpeed * this.phase.spdMul);
    this.busy = 0.35;
    this.facing = U.angle(this.x, this.y, target.x, target.y);
    game.dealDamage(this, target, { mult: 1.1 * this.phase.atkMul });
    game.fx.hit(target.x, target.y, this.color);
  }
}

/* ---------------- PvP Rakip Botu ---------------- */
class BotActor extends Actor {
  constructor(profile, game) {
    super({
      x: profile.x, y: profile.y, team: 'enemy', name: profile.name,
      level: profile.level, element: profile.race, stats: profile.stats,
      color: GameData.RACES[profile.race].colors.primary, size: 0.8, r: 0.4, kind: 'player'
    });
    this.cls = profile.cls;
    this.race = profile.race;
    this.skillCd = [U.rand(1, 3), U.rand(2, 4), U.rand(3, 6), U.rand(5, 9)];
    this.think = 0;
    this.strafe = U.chance(0.5) ? 1 : -1;
    this.mana = GameData.BALANCE.manaMax;
  }

  update(dt, game) {
    super.update(dt, game);
    if (this.dead || this.stunned) return;
    const p = game.player;
    if (!p || p.dead) return;

    const s = this.eff();
    this.mana = Math.min(100, this.mana + GameData.BALANCE.manaRegen * dt);
    for (let i = 0; i < 4; i++) if (this.skillCd[i] > 0) this.skillCd[i] -= dt;

    const d = this.distTo(p);
    const want = s.range * 0.8;

    this.think -= dt;
    if (this.think <= 0) { this.think = U.rand(0.8, 1.8); this.strafe *= U.chance(0.4) ? -1 : 1; }

    if (d > want) {
      this.moveTowards(p.x, p.y, dt, game, 1);
    } else if (d < want * 0.55 && s.range > 3) {
      this.moveTowards(p.x * 2 - this.x, p.y * 2 - this.y, dt, game, -0.85);
    } else {
      // yan hareket
      const a = U.angle(this.x, this.y, p.x, p.y) + Math.PI / 2 * this.strafe;
      this.tryMove(Math.cos(a) * s.moveSpeed * 0.6 * dt, Math.sin(a) * s.moveSpeed * 0.6 * dt, game);
      this.facing = U.angle(this.x, this.y, p.x, p.y);
    }

    // yetenek kullan
    const skills = GameData.CLASSES[this.cls].skills;
    for (let i = 3; i >= 0; i--) {
      const sk = GameData.SKILLS[skills[i]];
      if (this.skillCd[i] <= 0 && this.mana >= sk.mana) {
        const reach = sk.castRange || (sk.type === 'melee' || sk.type === 'area' ? sk.radius || 3 : 9);
        if (sk.type === 'buff' || d <= reach + 1) {
          this.mana -= sk.mana;
          this.skillCd[i] = sk.cd;
          Skills.cast(this, i, game, { x: p.x, y: p.y });
          this.busy = 0.35;
          return;
        }
      }
    }

    if (d <= s.range + p.r && this.atkCd <= 0) {
      this.atkCd = 1 / Math.max(0.2, s.attackSpeed);
      this.busy = 0.25;
      this.facing = U.angle(this.x, this.y, p.x, p.y);
      if (s.range > 3) {
        game.spawnProjectile({
          owner: this, x: this.x, y: this.y, angle: this.facing,
          speed: 14, life: 1.1, mult: 1, color: this.color, size: 0.2,
          magic: this.cls === 'buyucu'
        });
      } else {
        game.meleeSwing(this, { mult: 1, radius: s.range + 0.6, arc: 1.4 });
      }
    }
  }
}

/* ---------------- Mermi ---------------- */
class Projectile {
  constructor(cfg) {
    Object.assign(this, {
      id: U.uid(), x: 0, y: 0, angle: 0, speed: 10, life: 1.2,
      mult: 1, color: '#fff', size: 0.22, pierce: 0, splash: 0,
      magic: false, bonusPen: 0, forceCrit: false, effect: null, hitIds: []
    }, cfg);
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;
    this.dead = false;
  }

  update(dt, game) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }

    // ÖNCE hedef kontrolü: aksi halde maden taşı gibi engel oluşturan hedeflere
    // mermi, aktöre değmeden engelde patlıyordu.
    const targets = game.actors.filter(a => !a.dead && a.team !== this.owner.team);
    for (const t of targets) {
      if (this.hitIds.includes(t.id)) continue;
      if (U.dist(this.x, this.y, t.x, t.y) <= t.r + this.size) {
        this.hitIds.push(t.id);
        game.dealDamage(this.owner, t, {
          mult: this.mult, magic: this.magic, bonusPen: this.bonusPen,
          forceCrit: this.forceCrit, effect: this.effect
        });
        game.fx.hit(t.x, t.y, this.color);
        if (this.splash > 0) { this.onImpact(game); return; }
        if (this.pierce > 0) this.pierce--;
        else { this.dead = true; return; }
      }
    }

    // duvar/kaya çarpışması (maden taşı engeli mermiyi durdurmaz — hedefi taşın kendisi)
    if (game.world.blocked(this.x, this.y, 0.1, 'ore')) { this.onImpact(game); return; }
  }

  onImpact(game) {
    this.dead = true;
    if (this.splash > 0) {
      game.fx.ring(this.x, this.y, this.color, this.splash);
      const targets = game.actors.filter(a => !a.dead && a.team !== this.owner.team);
      for (const t of targets) {
        if (this.hitIds.includes(t.id)) continue;
        if (U.dist(this.x, this.y, t.x, t.y) <= this.splash + t.r) {
          game.dealDamage(this.owner, t, {
            mult: this.mult * 0.7, magic: this.magic, effect: this.effect
          });
        }
      }
    }
  }
}

/* ---------------- Alan etkisi ---------------- */
class AreaEffect {
  constructor(cfg) {
    Object.assign(this, {
      id: U.uid(), x: 0, y: 0, radius: 3, hits: 1, tick: 0.4,
      mult: 1, magic: false, color: '#fff', effect: null, follow: null,
      elapsed: 0, done: 0, dead: false, life: 0
    }, cfg);
    this.life = this.tick * this.hits + 0.25;
  }

  update(dt, game) {
    if (this.follow && !this.follow.dead) { this.x = this.follow.x; this.y = this.follow.y; }
    this.elapsed += dt;
    this.life -= dt;
    if (this.done < this.hits && this.elapsed >= this.done * this.tick) {
      this.done++;
      game.fx.ring(this.x, this.y, this.color, this.radius);
      const targets = game.actors.filter(a => !a.dead && a.team !== this.owner.team);
      for (const t of targets) {
        if (U.dist(this.x, this.y, t.x, t.y) <= this.radius + t.r) {
          game.dealDamage(this.owner, t, { mult: this.mult, magic: this.magic, effect: this.effect });
        }
      }
    }
    if (this.life <= 0) this.dead = true;
  }
}
