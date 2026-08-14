/* =============================================================
   game.js — Oyun çekirdeği: döngü, hasar hattı, ilerleme, PvE/PvP, kayıt

   NOT: Bu prototipte tüm hesap tek makinede yapılır. Mimari,
   dealDamage / grantXp / onDeath gibi "otorite" fonksiyonlarını
   tek noktada topladığı için bunlar aynen bir Node sunucusuna
   taşınabilir; client yalnızca input + çizim gönderir.
   ============================================================= */

class Game {
  static SAVE_KEY = 'cagSavasi.save.v1';

  constructor() {
    this.canvas = document.getElementById('game');
    this.fx = new Fx();
    this.actors = [];
    this.projectiles = [];
    this.areas = [];
    this.paused = false;
    this.running = false;
    this.spawnTimer = 0;
    this.pvp = null;
    this.lastT = 0;
  }

  /* ---------------- Kayıt ---------------- */
  static emptySave(name, race, cls) {
    return {
      name, race, cls,
      level: 1, xp: 0, gold: 250, statPoints: 0,
      alloc: {}, equipment: {}, inventory: [], storage: [], mats: {},
      potions: { kucuk: 10, buyuk: 2, mana: 2 }, autoPotion: true,
      quests: [], age: 1, bossKills: 0, kills: 0, stonesBroken: 0,
      skillLv: [1, 1, 1, 1], skillPoints: 0,
      pvp: { mmr: 0, wins: 0, losses: 0 },
      code: name.toUpperCase().slice(0, 5).replace(/\s/g, '') + '-' + U.randInt(1000, 9999),
      created: Date.now()
    };
  }

  static hasSave() { return !!localStorage.getItem(Game.SAVE_KEY); }

  loadSave() {
    try {
      const raw = localStorage.getItem(Game.SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      // ileri sürüm uyumluluğu için eksik alanları doldur
      s.mats = s.mats || {}; s.storage = s.storage || []; s.quests = s.quests || [];
      s.pvp = s.pvp || { mmr: 0, wins: 0, losses: 0 };
      s.equipment = s.equipment || {}; s.inventory = s.inventory || []; s.alloc = s.alloc || {};
      // eski kayıtlar: sayı → çanta
      if (typeof s.potions === 'number') s.potions = { kucuk: s.potions * 3, buyuk: 1, mana: 1 };
      if (!s.potions || typeof s.potions !== 'object') s.potions = { kucuk: 10, buyuk: 2, mana: 2 };
      for (const k of ['kucuk', 'buyuk', 'mana']) if (s.potions[k] == null) s.potions[k] = 0;
      if (s.autoPotion === undefined) s.autoPotion = true;
      if (s.stonesBroken === undefined) s.stonesBroken = 0;
      if (!Array.isArray(s.skillLv) || s.skillLv.length !== 4) s.skillLv = [1, 1, 1, 1];
      if (s.skillPoints === undefined) {
        // eski kayıt: levelden hak edilen puanları geri ver
        const L = GameData.SKILL_LEVEL;
        const earned = Math.max(0, s.level - L.firstPointAt + 1) * L.pointsPerLevel;
        const spent = s.skillLv.reduce((a, b) => a + (b - 1), 0);
        s.skillPoints = Math.max(0, earned - spent);
      }
      if (!s.age) s.age = 1;
      if (!s.bossKills) s.bossKills = 0;
      if (!s.code) s.code = (s.name || 'OYUN').toUpperCase().slice(0, 5) + '-' + U.randInt(1000, 9999);
      return s;
    } catch (e) { console.warn('Kayıt okunamadı', e); return null; }
  }

  saveGame() {
    try { localStorage.setItem(Game.SAVE_KEY, JSON.stringify(this.save)); }
    catch (e) { console.warn('Kayıt yazılamadı', e); }
  }

  /* ---------------- Başlatma ---------------- */
  start(save) {
    this.save = save;
    this.world = new World('city', this);
    this.renderer = new Renderer(this.canvas, this);
    this.player = new PlayerActor(save, this);
    const e = this.world.entryPos();
    this.player.x = e.x; this.player.y = e.y;
    this.actors = [this.player];
    UI.init(this);
    Input.init(this);
    if (!save.quests.length) this.rollQuests();
    UI.refreshHud();
    UI.toast(`Hoş geldin ${save.name}. Portallardan farm haritalarına geçebilirsin.`, 'info');
    this.running = true;
    this.lastT = performance.now();
    requestAnimationFrame((t) => this.loop(t));

    // periyodik otomatik kayıt (her karede DB'ye yazmak yerine batch)
    setInterval(() => { if (this.running) this.saveGame(); }, 8000);
  }

  /* ---------------- Harita değiştirme ---------------- */
  changeMap(id) {
    this.world = new World(id, this);
    this.projectiles = []; this.areas = [];
    this.actors = [this.player];
    const e = this.world.entryPos();
    this.player.x = e.x; this.player.y = e.y;
    this.player.dead = false;
    this.player.effects = [];
    if (this.player.hp <= 0) this.player.hp = this.player.maxHp * 0.5;
    this.renderer.cam.x = e.x; this.renderer.cam.y = e.y;
    this.pvp = null;
    UI.setBossBar(null);
    UI.setPvpBar(null);

    const d = this.world.def;
    if (d.boss) this.spawnBoss(d.boss);
    else if (d.spawn) { for (let i = 0; i < d.spawn; i++) this.spawnMonster(); }
    if (d.mine) this.spawnOres();
    UI.refreshHud();
    UI.toast(this.world.name || d.name, 'info');
    if (d.mine) UI.toast('Maden taşlarına vur — içinden düşman çıkar!', 'info');
    this.saveGame();
  }

  ageInfo() { return GameData.AGES.find(a => a.id === this.save.age); }
  ageMul() { return 1 + (this.save.age - 1) * 0.18; }

  monsterLevel() {
    const a = this.ageInfo();
    return U.clamp(a.monLv + U.randInt(-1, 3), 1, 100);
  }

  spawnMonster(atPos, element, level) {
    const el = element || this.world.element || this.world.def.element;
    if (!el) return null;
    const defs = GameData.MONSTERS[el];
    const def = U.weightedPick(defs.map(d => ({ ...d, w: d.tier === 'elite' ? 1 : 3 })), 'w');
    const pos = atPos || this.world.randomOpenPos(this.player, 10);
    const m = new Monster({ ...def, element: el }, level || this.monsterLevel(), this, pos, this.ageMul());
    this.actors.push(m);
    return m;
  }

  /* --- MADEN TAŞLARI --- */
  spawnOres() {
    const w = this.world;
    const lv = this.save.level;
    // oyuncunun seviyesine uyan en büyük damar
    let def = GameData.ORES[0];
    for (const o of GameData.ORES) if (lv >= o.minLv) def = o;

    /* Taşın canı oyuncunun saldırı gücüne göre ölçeklenir: hedef, her kademede
       yaklaşık sabit bir "kazma süresi". Böylece zayıf da güçlü de kırabilir. */
    const st = this.player.eff();
    const dps = Math.max(st.attack, st.magic) *
                Math.max(0.4, st.attackSpeed) *
                (1 + U.clamp(st.critChance, 0, 1) * Math.max(0, st.critDamage - 1)) * 2.9;   // kombo, element avantajı ve efsun katkısı dahil
    const targetHp = dps * (def.seconds || 24);

    for (const spot of w.oreSpots) {
      const node = new OreNode(def, U.clamp(lv, 1, 100), this, spot, w.element, targetHp);
      // taş fiziksel engeldir; kırılınca engeli kaldırılır
      node.obs = { x: spot.x, y: spot.y, r: node.r * 0.85, color: node.color, height: 1.8, kind: 'ore' };
      w.obstacles.push(node.obs);
      this.actors.push(node);
    }
  }

  spawnBoss(el) {
    const def = GameData.BOSSES[el];
    const pos = { x: this.world.w / 2, y: this.world.h / 2 };
    const lv = U.clamp(this.ageInfo().monLv + 4, 1, 100);
    const b = new Boss(def, lv, this, pos, this.ageMul());
    this.actors.push(b);
    this.boss = b;
    UI.toast(`${def.name} uyanıyor · Lv ${lv}`, 'warn');
  }

  /* ---------------- Ana döngü ---------------- */
  loop(t) {
    const dt = Math.min(0.05, (t - this.lastT) / 1000);
    this.lastT = t;
    if (!this.paused) this.update(dt);
    this.renderer.draw();
    UI.refreshSkillCooldowns();
    requestAnimationFrame((tt) => this.loop(tt));
  }

  update(dt) {
    const p = this.player;

    // --- oyuncu girdisi
    if (!p.dead) {
      const mv = Input.moveVector();
      if ((mv.x || mv.y) && !p.stunned && p.dashTime <= 0) {
        const s = p.eff();
        p.tryMove(mv.x * s.moveSpeed * dt, mv.y * s.moveSpeed * dt, this);
        if (!Input.mouse.inside && !(Input.touch && (Input.attackHeld || Input.aimHold > 0))) {
          p.facing = Math.atan2(mv.y, mv.x);
        }
      }
      if (Input.touch) {
        // Dokunmatikte fare yok: dokunduğun yöne ya da en yakın düşmana dön
        if (Input.aimHold > 0) {
          Input.aimHold -= dt;
          const aim = Input.aimWorld(this.renderer, p);
          p.facing = U.angle(p.x, p.y, aim.x, aim.y);
        } else {
          const tgt = Input.autoAimTarget(this);
          if (tgt) p.facing = U.angle(p.x, p.y, tgt.x, tgt.y);
        }
      } else if (Input.mouse.inside) {
        const aim = Input.aimWorld(this.renderer, p);
        p.facing = U.angle(p.x, p.y, aim.x, aim.y);
      }
      if ((Input.attackHeld || Input.keys[' ']) && p.atkCd <= 0 && !p.stunned && p.busy <= 0) {
        this.basicAttack();
      }
      this.autoPotionCheck();
    } else {
      p.deathTimer -= dt;
      if (p.deathTimer <= 0) this.respawn();
    }

    // --- aktörler
    for (const a of this.actors) a.update(dt, this);

    // --- mermiler & alanlar
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      this.projectiles[i].update(dt, this);
      if (this.projectiles[i].dead) this.projectiles.splice(i, 1);
    }
    for (let i = this.areas.length - 1; i >= 0; i--) {
      this.areas[i].update(dt, this);
      if (this.areas[i].dead) this.areas.splice(i, 1);
    }

    // --- ölüleri temizle
    this.actors = this.actors.filter(a => !(a.dead && a !== p && (a.cleanup -= dt) <= 0));

    // --- farm haritasında yeniden doğuş
    if (this.world.def.spawn) {
      this.spawnTimer -= dt;
      const alive = this.actors.filter(a => a.team === 'enemy' && !a.dead).length;
      if (this.spawnTimer <= 0 && alive < this.world.def.spawn) {
        this.spawnTimer = 2.5;
        this.spawnMonster();
      }
    }

    // --- boss barı
    if (this.boss && !this.boss.dead && this.actors.includes(this.boss)) UI.setBossBar(this.boss);
    else if (this.boss) { UI.setBossBar(null); this.boss = null; }

    // --- PvP durumu
    if (this.pvp && this.pvp.active) {
      this.pvp.time -= dt;
      UI.setPvpBar(p, this.pvp.enemy, this.pvp.time);
      if (this.pvp.enemy.dead) this.endPvp(true);
      else if (p.dead) this.endPvp(false);
      else if (this.pvp.time <= 0) {
        this.endPvp((p.hp / p.maxHp) >= (this.pvp.enemy.hp / this.pvp.enemy.maxHp));
      }
    }

    // --- etkileşim ipucu
    const near = this.nearestInteractable();
    UI.showInteract(near ? near.label : null);

    this.fx.update(dt);
    this.renderer.follow(p, dt);
    UI.refreshHud();
  }

  /* ---------------- Saldırılar ---------------- */
  basicAttack() {
    const p = this.player;
    const s = p.eff();
    const C = GameData.BALANCE.combo;

    // --- KOMBO: saldırıya basılı tutunca zincir ilerler, 3. vuruş bitirici
    p.combo = p.comboTimer > 0 ? (p.combo + 1) % C.mults.length : 0;
    p.comboTimer = C.window;
    const step = p.combo;
    const last = step === C.mults.length - 1;

    let mult = C.mults[step];
    if (last && p.race === 'ates') mult *= GameData.RACES.ates.passive.finisherMul;

    p.atkCd = (1 / Math.max(0.2, s.attackSpeed)) * C.speed[step];
    p.busy = 0.24 * C.speed[step];
    const colors = GameData.RACES[p.race].colors;
    UI.setCombo(step + 1, last);

    if (s.range <= 3) {
      /* Metin2 savaşçısı hissi: 1. vuruş sağdan sola, 2. vuruş soldan sağa,
         3. vuruş çevreyi süpüren 360° dönüş. */
      const radius = s.range + 0.7 + C.radiusBonus[step];
      const arc = last ? Math.PI * 2 : 1.5 + C.arcBonus[step];
      const opts = { mult, radius, arc, color: last ? colors.light : colors.aura };
      if (last) opts.effect = Skills.effectFor({ effect: C.finisherEffect }, p.race);   // bitirici: yavaşlat / yak

      p.swingStep = step;
      p.swingSpin = last;
      p.swingDur = last ? 0.34 : 0.22;
      p.swingT = p.swingDur;
      this.fx.swing(p.x, p.y, p.facing, radius, last ? colors.light : colors.aura, step, last);

      const hit = this.meleeSwing(p, opts);
      if (last) {
        this.fx.ring(p.x, p.y, colors.primary, radius);
        this.renderer.shake(hit ? 5 : 2.5);
      } else if (hit) this.renderer.shake(1.4);
    } else {
      // menzilli sınıflarda bitirici çok mermili olur
      const shots = last ? 3 : 1;
      const spread = last ? 0.16 : 0;
      for (let i = 0; i < shots; i++) {
        const a = p.facing + (i - (shots - 1) / 2) * spread;
        this.spawnProjectile({
          owner: p, x: p.x, y: p.y, angle: a, speed: 16, life: s.range / 16 + 0.25,
          mult: mult / (last ? 1.65 : 1), magic: p.cls === 'buyucu',
          color: last ? colors.light : colors.primary, size: last ? 0.26 : 0.2,
          effect: last ? Skills.effectFor({ effect: C.finisherEffect }, p.race) : null
        });
      }
    }
  }

  meleeSwing(actor, opts) {
    const targets = this.actors.filter(a => !a.dead && a.team !== actor.team);
    let hit = 0;
    for (const t of targets) {
      const d = actor.distTo(t);
      if (d > opts.radius + t.r) continue;
      const ang = U.angle(actor.x, actor.y, t.x, t.y);
      if (Math.abs(U.angleDiff(actor.facing, ang)) > (opts.arc || 1.4) / 2 && opts.arc < Math.PI * 2) continue;
      this.dealDamage(actor, t, opts);
      this.fx.hit(t.x, t.y, opts.color || '#fff');
      hit++;
    }
    return hit;
  }

  spawnProjectile(cfg) { this.projectiles.push(new Projectile(cfg)); }
  spawnArea(cfg) { this.areas.push(new AreaEffect(cfg)); }

  /* ---------------- HASAR HATTI (otorite) ---------------- */
  dealDamage(attacker, target, opts = {}) {
    if (target.dead || attacker.dead) return;
    const A = { stats: attacker.eff(), level: attacker.level, element: attacker.element, race: attacker.race, kind: attacker.kind };
    const D = { stats: target.eff(), level: target.level, element: target.element, kind: target.kind, burning: target.burning };
    const res = Combat.calc(A, D, opts);

    target.hp -= res.damage;
    target.hitFlash = 0.12;
    target.squash = Math.min(1, (target.squash || 0) + (res.crit ? 0.9 : 0.5));   // darbe ezilmesi
    target.noHitTime = 0;          // hasar aldı → savaş dışı yenilenme beklemeye girer
    if (target.kind === 'monster' || target.kind === 'boss') target.inCombat = true;
    this.fx.damageNumber(target.x, target.y, res.damage, {
      crit: res.crit, pen: res.penetrated && res.crit === false
    });

    // yan etkiler
    const e = opts.effect;
    if (e) {
      // Irk pasifleri: Su → yavaşlatma süresi uzun · Ateş → yanma hasarı yüksek
      const slowMul = attacker.race === 'su' ? GameData.RACES.su.passive.slowDurMul : 1;
      const burnMul = attacker.race === 'ates' ? GameData.RACES.ates.passive.burnMul : 1;
      if (e.slow) target.addEffect({ type: 'slow', val: e.slow, dur: e.slowDur * slowMul });
      if (e.stun) target.addEffect({ type: 'stun', dur: e.stun });
      if (e.burn) {
        const base = opts.magic ? A.stats.magic : A.stats.attack;
        target.addEffect({ type: 'burn', dps: base * e.burn * burnMul, dur: e.burnDur, source: attacker });
      }
    }

    if (target.hp <= 0) this.onDeath(target, attacker);
  }

  onDeath(actor, killer) {
    if (actor.dead) return;
    actor.dead = true;
    actor.hp = 0;
    actor.cleanup = 2.5;
    this.fx.hit(actor.x, actor.y, actor.color);
    this.fx.ring(actor.x, actor.y, actor.color, actor.size * 2);

    if (actor === this.player) {
      actor.deathTimer = GameData.BALANCE.respawnTime;
      if (!this.pvp) UI.toast('Öldün — yakın kamp noktasına dönüyorsun', 'warn');
      return;
    }
    // maden taşı kırıldıysa fiziksel engelini kaldır
    if (actor.kind === 'stone' && actor.obs) {
      const i = this.world.obstacles.indexOf(actor.obs);
      if (i >= 0) this.world.obstacles.splice(i, 1);
      actor.obs = null;
    }
    if (actor.team === 'enemy' && killer === this.player) {
      this.rewardKill(actor);
    }
  }

  rewardKill(m) {
    const s = this.save;
    if (this.pvp) return; // PvP'de yaratık ödülü yok

    const isBoss = m.tier === 'boss';
    const isStone = m.tier === 'stone';
    const mul = this.ageMul();
    const def = m.def || m.bossDef;
    const xp = Math.round((def.xp || 20) * (1 + (m.level - 1) * 0.12) * mul);
    const gold = Math.round((def.gold || 10) * (1 + (m.level - 1) * 0.10) * mul);

    this.grantXp(xp, m);
    s.gold += gold;
    s.kills++;
    this.questProgress('kill', 1);
    this.questProgress('gold', gold);
    if (isBoss) { s.bossKills++; this.questProgress('boss', 1); }
    if (isStone) { s.stonesBroken = (s.stonesBroken || 0) + 1; this.questProgress('stone', 1); }

    // ganimet
    const drop = Loot.rollDrop({ ...def, name: m.name, tier: m.tier, element: m.element }, m.level, s);
    for (const it of drop.items) {
      if (s.inventory.length < 60) {
        s.inventory.push(it);
        const tone = it.gift ? 'good' : Loot.rarityById(it.rarity).mult >= 1.85 ? 'good' : 'info';
        UI.toast(`${it.gift ? '🎁 Hediye' : 'Ganimet'}: ${it.name}${it.enchanted && !it.gift ? ' (efsunlu)' : ''}`, tone);
      } else UI.toast('Envanter dolu — ganimet kayboldu', 'warn');
    }
    if (drop.potions) {
      for (const [k, n] of Object.entries(drop.potions)) s.potions[k] = (s.potions[k] || 0) + n;
      UI.toast(`İksir hediyesi: ${drop.potions.kucuk}x küçük · ${drop.potions.buyuk}x büyük`, 'good');
    }
    let matCount = 0;
    for (const [k, n] of Object.entries(drop.mats)) { s.mats[k] = (s.mats[k] || 0) + n; matCount += n; }
    if (matCount) this.questProgress('mat', matCount);

    if (isBoss) UI.toast(`${m.name} yenildi! +${U.fmt(xp)} XP · +${U.fmt(gold)} altın`, 'good');
    if (isStone) UI.toast(`${m.name} kırıldı! +${U.fmt(xp)} XP · +${U.fmt(gold)} altın`, 'good');
    this.saveGame();
  }

  grantXp(n, atActor) {
    const s = this.save;
    if (s.level >= GameData.BALANCE.maxLevel) return;
    s.xp += n;
    this.fx.damageNumber(atActor ? atActor.x : this.player.x, atActor ? atActor.y : this.player.y, n, { xp: true });
    let need = StatSystem.xpNeed(s.level);
    while (s.xp >= need && s.level < GameData.BALANCE.maxLevel) {
      s.xp -= need;
      s.level++;
      s.statPoints += GameData.BALANCE.statPointsPerLevel;

      const SL = GameData.SKILL_LEVEL;
      let gainedSkill = 0;
      if (s.level >= SL.firstPointAt) { s.skillPoints += SL.pointsPerLevel; gainedSkill = SL.pointsPerLevel; }

      need = StatSystem.xpNeed(s.level);
      this.player.refreshStats();
      this.player.hp = this.player.maxHp;
      this.fx.levelUp(this.player.x, this.player.y);
      UI.toast(`Level ${s.level}! +${GameData.BALANCE.statPointsPerLevel} stat` +
        (gainedSkill ? ` · +${gainedSkill} yetenek puanı` : ''), 'good');

      // yeni açılan yetenek var mı?
      const idx = SL.unlockAt.indexOf(s.level);
      if (idx >= 0) {
        const id = GameData.CLASSES[s.cls].skills[idx];
        UI.toast(`Yeni yetenek açıldı: ${GameData.SKILLS[id].name[s.race]} (${idx + 1} tuşu)`, 'good');
      }
    }
    UI.refreshHud();
  }

  /* Yetenek yükseltme — hasar artar, bekleme kısalır */
  upgradeSkill(idx) {
    const s = this.save, SL = GameData.SKILL_LEVEL;
    if (idx < 0 || idx > 3) return false;
    if (s.level < (SL.unlockAt[idx] || 1)) {
      UI.toast(`Bu yetenek Level ${SL.unlockAt[idx]}'te açılır`, 'warn'); return false;
    }
    if (s.skillLv[idx] >= SL.max) { UI.toast('Bu yetenek zaten en üst seviyede', 'warn'); return false; }
    if (s.skillPoints <= 0) { UI.toast('Yetenek puanın yok — level atla', 'warn'); return false; }
    s.skillPoints--;
    s.skillLv[idx]++;
    this.player.refreshStats();
    const id = GameData.CLASSES[s.cls].skills[idx];
    UI.toast(`${GameData.SKILLS[id].name[s.race]} → Seviye ${s.skillLv[idx]}`, 'good');
    this.saveGame();
    UI.refreshHud();
    if (UI.panel === 'skills') UI.render();
    return true;
  }

  /* ---------------- Oyuncu aksiyonları ---------------- */
  castSkill(i) {
    if (this.paused || !this.player || this.player.dead) return;
    const aim = Input.aimWorld(this.renderer, this.player);
    Skills.tryCast(this.player, i, this, aim);
  }

  dash() {
    const p = this.player;
    if (p.dead || p.stunned || p.dashCd > 0) return;
    p.dashCd = GameData.BALANCE.dashCd;
    p.dashTime = 0.18;
    const mv = Input.moveVector();
    const dir = (mv.x || mv.y) ? mv : { x: Math.cos(p.facing), y: Math.sin(p.facing) };
    p.dashDir = dir;
  }

  usePotion(type = 'kucuk', silent = false) {
    const p = this.player, s = this.save;
    const def = GameData.POTIONS[type];
    if (!def || p.dead) return false;
    if ((p.potionCds[type] || 0) > 0) return false;
    if ((s.potions[type] || 0) <= 0) {
      if (!silent) UI.toast(`${def.name} kalmadı — markete uğra`, 'warn');
      return false;
    }
    s.potions[type]--;
    p.potionCds[type] = def.cd;

    if (def.mana) {
      p.mana = Math.min(GameData.BALANCE.manaMax, p.mana + def.mana);
      this.fx.damageNumber(p.x, p.y, def.mana, { mana: true });
    } else {
      // Su ırkı pasifi: iksirler daha çok iyileştirir
      const mul = p.race === 'su' ? GameData.RACES.su.passive.potionMul : 1;
      const heal = p.maxHp * def.heal * mul;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      this.fx.damageNumber(p.x, p.y, Math.round(heal), { heal: true });
    }
    // 8 saniyelik otomatik kayıt yeterli; iksir spamında her seferinde yazmıyoruz
    return true;
  }

  /* Otomatik iksir: canın eşiğin altına düşünce küçük iksir içer */
  autoPotionCheck() {
    const p = this.player, s = this.save;
    if (!s.autoPotion || p.dead) return;
    if (p.hp / p.maxHp > GameData.BALANCE.autoPotionAt) return;
    if (!this.usePotion('kucuk', true)) this.usePotion('buyuk', true);
  }

  toggleAutoPotion() {
    const s = this.save;
    s.autoPotion = !s.autoPotion;
    UI.toast(`Otomatik iksir ${s.autoPotion ? 'AÇIK' : 'KAPALI'}`, s.autoPotion ? 'good' : 'warn');
    this.saveGame();
    UI.refreshHud();
  }

  nearestInteractable() {
    const p = this.player;
    let best = null, bd = 3.2;
    for (const n of this.world.npcs) {
      const d = U.dist(p.x, p.y, n.x, n.y);
      if (d < bd) { bd = d; best = { kind: 'npc', o: n, label: n.name }; }
    }
    for (const pt of this.world.portals) {
      const d = U.dist(p.x, p.y, pt.x, pt.y);
      if (d < bd) { bd = d; best = { kind: 'portal', o: pt, label: pt.label }; }
    }
    return best;
  }

  interact() {
    const t = this.nearestInteractable();
    if (!t) return;
    if (t.kind === 'portal') {
      if (t.o.to === 'arena') { UI.openPanel('pvp'); return; }
      this.changeMap(t.o.to);
    } else {
      const map = { market: 'market', craft: 'craft', quest: 'quest', storage: 'storage' };
      UI.openPanel(map[t.o.kind]);
    }
  }

  equip(index) {
    const s = this.save;
    const item = s.inventory[index];
    if (!item) return;
    if (s.level < item.reqLevel) return UI.toast(`Level ${item.reqLevel} gerekli`, 'warn');
    const old = s.equipment[item.slot];
    s.equipment[item.slot] = item;
    s.inventory.splice(index, 1);
    if (old) s.inventory.push(old);
    this.player.refreshStats();
    this.saveGame();
    UI.toast(`Kuşanıldı: ${item.name}`, 'good');
  }

  unequip(slot) {
    const s = this.save;
    const item = s.equipment[slot];
    if (!item) return;
    if (s.inventory.length >= 60) return UI.toast('Envanter dolu', 'warn');
    s.inventory.push(item);
    delete s.equipment[slot];
    this.player.refreshStats();
    this.saveGame();
  }

  respawn() {
    const p = this.player;
    p.dead = false;
    p.effects = [];
    p.hp = p.maxHp * 0.6;
    p.mana = GameData.BALANCE.manaMax;
    const e = this.world.entryPos();
    p.x = e.x; p.y = e.y;
  }

  /* ---------------- Görevler ---------------- */
  rollQuests() {
    const s = this.save;
    while (s.quests.length < 3) {
      const t = U.pick(GameData.QUEST_TEMPLATES);
      if (s.quests.some(q => q.id === t.id)) {
        if (s.quests.length >= GameData.QUEST_TEMPLATES.length) break;
        continue;
      }
      const target = t.id === 'gold'
        ? U.randInt(t.target[0] / 100, t.target[1] / 100) * 100
        : U.randInt(t.target[0], t.target[1]);
      s.quests.push({
        id: t.id, text: t.text(U.fmt(target)), target, progress: 0,
        xp: Math.round(t.xp * (1 + s.level * 0.12)),
        gold: Math.round(t.gold * (1 + s.level * 0.10))
      });
    }
    this.saveGame();
    UI.refreshQuestTracker();
  }

  questProgress(id, n) {
    let changed = false;
    for (const q of this.save.quests) {
      if (q.id === id && q.progress < q.target) {
        q.progress += n;
        if (q.progress >= q.target) UI.toast(`Görev tamam: ${q.text}`, 'good');
        changed = true;
      }
    }
    if (changed) UI.refreshQuestTracker();
  }

  claimQuest(i) {
    const s = this.save;
    const q = s.quests[i];
    if (!q || q.progress < q.target) return;
    this.grantXp(q.xp);
    s.gold += q.gold;
    s.quests.splice(i, 1);
    UI.toast(`Ödül alındı: +${U.fmt(q.xp)} XP, +${U.fmt(q.gold)} altın`, 'good');
    this.rollQuests();
    this.saveGame();
  }

  /* ---------------- PvP ---------------- */
  hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  makeOpponent(code) {
    const s = this.save;
    const h = code ? this.hashCode(code) : U.randInt(0, 1e9);
    const races = ['su', 'ates'], classes = ['savasci', 'okcu', 'buyucu'];
    const race = races[h % 2];
    const cls = classes[(h >> 3) % 3];
    const names = ['Vaskar', 'Nera', 'Torhun', 'Elyra', 'Baran', 'Sinda', 'Karok', 'Melis', 'Doran', 'Ayla'];
    const name = code ? code.toUpperCase() : names[(h >> 5) % names.length];

    /* Rakip statları: oyuncunun KENDİ gücünü referans alıp üzerine yalnızca
       sınıf/ırk profil oranını uygularız. Böylece maç her zaman dengeli olur
       (okçu daha hızlı ve kritikli, savaşçı daha etli — ama toplam güç eşit). */
    const pStats = StatSystem.compute(s);
    const refP = StatSystem.compute({ race: s.race, cls: s.cls, level: s.level, alloc: {}, equipment: {} });
    const refB = StatSystem.compute({ race, cls, level: s.level, alloc: {}, equipment: {} });

    const varia = U.rand(0.94, 1.07);            // küçük rastgele sapma
    const stats = StatSystem.empty();
    for (const k of StatSystem.KEYS) {
      if (k === 'range') { stats[k] = refB[k]; continue; }     // menzil sınıfın kendi değeri
      const ratio = refP[k] > 0 ? refB[k] / refP[k] : 1;
      let v = (pStats[k] || 0) * ratio * varia;
      if (k === 'maxHp' || k === 'attack' || k === 'magic' || k === 'defense') v = Math.round(v);
      stats[k] = StatSystem.softCap(k, v);
    }

    // Şekillendirmeden sonra toplam gücü oyuncuyla eşitle (±%6 sapma bırakarak)
    const target = StatSystem.power(s) * U.rand(0.95, 1.06);
    for (let i = 0; i < 6; i++) {
      const f = U.clamp(target / Math.max(1, StatSystem.powerOf(stats)), 0.5, 2);
      if (Math.abs(f - 1) < 0.02) break;
      for (const k of ['maxHp', 'attack', 'magic', 'defense']) stats[k] = Math.max(1, Math.round(stats[k] * f));
    }

    // arenanın karşı tarafında BOŞ bir noktaya doğ (sütun içine düşmesin)
    const pos = this.world.openNear(this.world.w / 2, this.world.h / 2 - 9, 0.5);
    return new BotActor({ ...pos, race, cls, level: s.level, name, stats }, this);
  }

  startPvp(code) {
    this.changeMap('arena');
    const bot = this.makeOpponent(code);
    this.actors.push(bot);
    this.player.hp = this.player.maxHp;
    this.player.mana = GameData.BALANCE.manaMax;
    this.player.skillCd = [0, 0, 0, 0];
    this.pvp = { active: true, enemy: bot, time: GameData.BALANCE.pvpMatchTime, code };
    UI.setPvpBar(this.player, bot, this.pvp.time);
    UI.toast(`Rakip: ${bot.name} · ${GameData.RACES[bot.race].name} ${GameData.CLASSES[bot.cls].name}`, 'info');
  }

  endPvp(win) {
    if (!this.pvp || !this.pvp.active) return;
    this.pvp.active = false;
    const s = this.save;
    const rewards = win
      ? { xp: Math.round(180 + s.level * 55), gold: Math.round(120 + s.level * 22), mmr: U.randInt(18, 26) }
      : { xp: Math.round(45 + s.level * 12), gold: 0, mmr: -U.randInt(10, 16) };

    this.grantXp(rewards.xp);
    s.gold += rewards.gold;
    s.pvp.mmr = Math.max(0, s.pvp.mmr + rewards.mmr);
    if (win) { s.pvp.wins++; this.questProgress('pvp', 1); }
    else s.pvp.losses++;
    if (rewards.gold) this.questProgress('gold', rewards.gold);

    this.saveGame();
    UI.setPvpBar(null);
    setTimeout(() => UI.pvpResult(win, rewards), 700);
  }
}
