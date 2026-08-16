/* ============================================================
   gameserver.js — YETKİLİ SUNUCU (authoritative server).

   Güvenlik modeli:
   - Tüm karakter verisi bu modülün kapanışında (closure) tutulur.
     Dışarıya sadece derin kopyalanmış, temizlenmiş anlık görüntü verilir.
   - Client yalnızca "komut" gönderir. Yang, EXP, hasar, drop, başarı
     oranı gibi hiçbir değeri client belirleyemez, sadece talep eder.
   - Zaman sunucunun kendi saatinden okunur ve dt üstten kırpılır;
     client tick spam'i yaparak oyunu hızlandıramaz.
   - Her komut girdiyi ayrı ayrı doğrular (sahip miyim, seviyem yeter mi,
     param yeter mi, envanter dolu mu).
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../data/balance.js'), require('../data/items.js'),
      require('../data/world.js'), require('../data/skills.js'), require('./core.js'));
  } else {
    root.GameServer = factory(root.Balance, root.ItemData, root.WorldData, root.SkillData, root.Core);
  }
})(typeof self !== 'undefined' ? self : this, function (B, I, W, S, C) {
  'use strict';

  const INVENTORY_SLOTS = 45;
  const STACK_MAX = 200;
  const MAX_DT = 0.35;              // tek tick'te işlenecek azami süre (sn)
  const DEATH_YANG_LOSS = 0.05;     // ölümde kaybedilen yang oranı
  const MOBS_PER_MAP = 8;
  const RESPAWN_TIME = 6;           // normal mob yeniden doğma (sn)

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function createServer(options) {
    options = options || {};
    const rng = options.seed ? C.RNG(options.seed) : C.defaultRng;
    const now = options.clock || (() => Date.now() / 1000);

    /* ---------------- DAHİLİ DURUM ---------------- */
    let char = null;
    let world = { mapId: 'town', mobs: [], nextMobId: 1, bossTimer: {} };
    let lastTick = now();
    let events = [];

    function log(type, text, extra) { events.push(Object.assign({ type, text, t: now() }, extra || {})); }

    /* ---------------- KARAKTER ---------------- */
    function newCharacter(name, cls) {
      if (!B.CLASSES[cls]) throw new Error('Geçersiz sınıf');
      name = String(name || '').trim().slice(0, 16) || 'Gezgin';

      const ch = {
        name, cls, level: 1, exp: 0, yang: 3000,
        hp: 0, mp: 0, skillPoints: 0,
        equipment: { weapon: null, head: null, body: null, shield: null, gloves: null, boots: null, necklace: null, earring: null, bracelet: null },
        inventory: [],
        skills: {}, cooldowns: {}, buffs: [],
        mapId: 'town', unlockedMaps: ['town', 'meadow'],
        kills: 0, deaths: 0, playtime: 0, created: now(),
        stats: {}
      };
      char = ch;

      /* başlangıç ekipmanı ve sarf */
      const starterWeapon = C.createItem('w_' + B.CLASSES[cls].weapon + '_t1', { rng, rarity: 'common', noAffix: true });
      const starterArmor = C.createItem('a_armor_t1', { rng, rarity: 'common', noAffix: true });
      char.equipment.weapon = starterWeapon;
      char.equipment.body = starterArmor;
      addItem(C.createStack('pot_hp_s', 10));
      addItem(C.createStack('pot_mp_s', 5));
      addItem(C.createStack('iron_shard', 5));

      /* sınıfın ilk skilli otomatik öğrenilir */
      const first = S.forClass(cls).find(s => s.reqLevel === 1);
      if (first) char.skills[first.id] = 1;

      recalc();
      char.hp = char.stats.hp; char.mp = char.stats.mp;
      travel('meadow', true);
      log('sys', `${name} adlı ${B.CLASSES[cls].name} dünyaya adım attı.`);
      return snapshot();
    }

    function recalc() {
      char.stats = C.aggregateStats(char);
      if (char.hp > char.stats.hp) char.hp = char.stats.hp;
      if (char.mp > char.stats.mp) char.mp = char.stats.mp;
    }

    /* ---------------- ENVANTER ---------------- */
    function freeSlots() { return INVENTORY_SLOTS - char.inventory.length; }

    function addItem(item) {
      if (item.stack) {
        const ex = char.inventory.find(x => x.stack && x.tpl === item.tpl && x.qty < STACK_MAX);
        if (ex) {
          const room = STACK_MAX - ex.qty;
          const move = Math.min(room, item.qty);
          ex.qty += move; item.qty -= move;
          if (item.qty <= 0) return true;
        }
      }
      if (freeSlots() <= 0) return false;
      char.inventory.push(item);
      return true;
    }

    function findItem(uid) { return char.inventory.find(x => x.uid === uid) || null; }

    function countMaterial(id) {
      return char.inventory.reduce((n, x) => n + (x.tpl === id && x.stack ? x.qty : 0), 0);
    }

    function consumeMaterial(id, qty) {
      if (countMaterial(id) < qty) return false;
      let left = qty;
      for (let i = char.inventory.length - 1; i >= 0 && left > 0; i--) {
        const x = char.inventory[i];
        if (x.tpl !== id || !x.stack) continue;
        const take = Math.min(x.qty, left);
        x.qty -= take; left -= take;
        if (x.qty <= 0) char.inventory.splice(i, 1);
      }
      return true;
    }

    function removeItem(uid) {
      const i = char.inventory.findIndex(x => x.uid === uid);
      if (i < 0) return null;
      return char.inventory.splice(i, 1)[0];
    }

    /* ---------------- EXP / LEVEL ---------------- */
    function gainExp(amount) {
      char.exp += amount;
      let leveled = 0;
      while (char.level < B.MAX_LEVEL && char.exp >= B.expToNext(char.level)) {
        char.exp -= B.expToNext(char.level);
        char.level++;
        char.skillPoints += B.SKILL_POINT_PER_LEVEL;
        leveled++;
        recalc();
        char.hp = char.stats.hp; char.mp = char.stats.mp;
        log('level', `Seviye ${char.level}! ${B.SKILL_POINT_PER_LEVEL} yetenek puanı kazandın.`, { level: char.level });
        unlockMaps();
      }
      return leveled;
    }

    function unlockMaps() {
      W.MAPS.forEach(m => {
        if (m.type === 'town') return;
        if (char.level >= m.minLevel && char.unlockedMaps.indexOf(m.id) < 0) {
          char.unlockedMaps.push(m.id);
          log('unlock', `Yeni bölge açıldı: ${m.name}`);
        }
      });
    }

    /* ---------------- HARİTA ---------------- */
    function spawnMob(map) {
      const def = C.pick(rng, map.mobs);
      const level = C.intBetween(rng, def.lvl[0], def.lvl[1]);
      const st = W.mobStats(level, def.arch);
      return {
        iid: world.nextMobId++, id: def.id, name: def.name, arch: def.arch,
        level, hp: st.hp, maxHp: st.hp, atk: st.atk, def: st.def,
        exp: st.exp, yang: st.yang, attackInterval: st.attackInterval,
        isBoss: false, isMagic: st.isMagic, atkCd: st.attackInterval, dead: false, respawn: 0
      };
    }

    function spawnBoss(map) {
      const b = map.boss; if (!b) return null;
      const st = W.mobStats(b.lvl, b.arch);
      return {
        iid: world.nextMobId++, id: b.id, name: b.name, arch: 'boss',
        level: b.lvl, hp: st.hp, maxHp: st.hp, atk: st.atk, def: st.def,
        exp: st.exp, yang: st.yang, attackInterval: st.attackInterval,
        isBoss: true, isMagic: false, atkCd: st.attackInterval, dead: false, respawn: 0
      };
    }

    /* Yolculuk ücreti: ilk saha haritası ücretsizdir. Aksi halde ölüp
       parası biten oyuncu kasabada mahsur kalır (softlock). */
    function travelCost(map) {
      if (!map || map.type === 'town' || map.tier <= 1) return 0;
      return Math.round(B.ECONOMY.teleportBase * (map.tier - 1));
    }

    function travel(mapId, silent) {
      const map = W.mapById(mapId);
      if (!map) return err('Böyle bir bölge yok.');
      if (map.type !== 'town') {
        if (char.unlockedMaps.indexOf(mapId) < 0) return err('Bu bölgeye erişimin yok.');
        if (char.level < map.minLevel) return err(`Bu bölge için en az ${map.minLevel}. seviye gerekir.`);
      }
      if (!silent && char.mapId !== mapId) {
        const cost = travelCost(map);
        if (char.yang < cost) return err(`Yolculuk için ${cost.toLocaleString('tr-TR')} yang gerekli.`);
        char.yang -= cost;
        if (cost) log('sys', `Yol ücreti: ${cost.toLocaleString('tr-TR')} yang.`);
      }
      char.mapId = mapId;
      world.mapId = mapId;
      world.mobs = [];
      char.target = null;
      if (map.type !== 'town') {
        for (let i = 0; i < MOBS_PER_MAP; i++) world.mobs.push(spawnMob(map));
        const bt = world.bossTimer[mapId] || 0;
        if (now() >= bt) { const b = spawnBoss(map); if (b) world.mobs.push(b); }
      }
      log('sys', `${map.name} bölgesine geçildi.`);
      return ok();
    }

    /* ---------------- SAVAŞ ---------------- */
    function attackInterval() {
      const spd = Math.max(40, char.stats.atkSpeed || 100);
      return 2.0 * (100 / spd);
    }

    function killMob(mob) {
      const map = W.mapById(char.mapId);
      mob.dead = true;
      mob.respawn = now() + (mob.isBoss ? (map.boss.respawn || 300) : RESPAWN_TIME);
      if (mob.isBoss) world.bossTimer[char.mapId] = mob.respawn;
      char.kills++;

      /* EXP — seviye farkı cezasıyla */
      const mult = B.expMultiplier(char.level, mob.level);
      const exp = Math.max(1, Math.round(mob.exp * mult));
      const lv = gainExp(exp);

      /* Drop */
      const drops = C.rollDrops({ rng, map, mob, char });
      char.yang += drops.yang;
      const gained = [];
      let full = false;
      drops.items.forEach(it => {
        if (addItem(it)) gained.push(it); else full = true;
      });

      log('kill', `${mob.name} (Lv${mob.level}) yenildi. +${exp.toLocaleString('tr-TR')} EXP, +${drops.yang.toLocaleString('tr-TR')} yang`, {
        expMult: Math.round(mult * 100),
        drops: gained.map(g => ({ uid: g.uid, name: C.itemName(g), rarity: g.rarity || null, qty: g.qty || 1, tpl: g.tpl })),
        boss: mob.isBoss
      });
      if (full) log('warn', 'Envanter dolu! Bazı ganimetler yerde kaldı.');
      if (mob.isBoss) log('boss', `${mob.name} devrildi! Bölge bir süre sakin kalacak.`);
      if (lv) recalc();
      if (char.target === mob.iid) char.target = null;
    }

    function playerDies() {
      char.deaths++;
      const loss = Math.round(char.yang * DEATH_YANG_LOSS);
      char.yang -= loss;
      char.buffs = [];
      log('death', `Yenildin. ${loss.toLocaleString('tr-TR')} yang kaybettin ve kasabaya taşındın.`);
      travel('town', true);
      recalc();
      char.hp = Math.round(char.stats.hp * 0.35);
      char.mp = Math.round(char.stats.mp * 0.35);
    }

    function aliveMobs() { return world.mobs.filter(m => !m.dead); }

    function tick() {
      const t = now();
      let dt = t - lastTick;
      lastTick = t;
      if (!(dt > 0)) return ok();          // saat geri gitmiş, yok say
      dt = Math.min(dt, MAX_DT);           // hızlandırma exploit'ini keser
      if (!char) return ok();
      char.playtime += dt;

      /* yeniden doğma */
      const map = W.mapById(char.mapId);
      world.mobs.forEach((m, idx) => {
        if (m.dead && t >= m.respawn) {
          if (m.isBoss) { const nb = spawnBoss(map); if (nb) world.mobs[idx] = nb; }
          else world.mobs[idx] = spawnMob(map);
        }
      });

      /* buff süreleri */
      let buffChanged = false;
      char.buffs = char.buffs.filter(b => {
        b.left -= dt;
        if (b.left <= 0) { buffChanged = true; log('sys', `${b.name} etkisi sona erdi.`); return false; }
        return true;
      });
      if (buffChanged) recalc();

      /* cooldown */
      for (const k in char.cooldowns) {
        char.cooldowns[k] = Math.max(0, char.cooldowns[k] - dt);
        if (char.cooldowns[k] === 0) delete char.cooldowns[k];
      }

      /* yenilenme — kasaba güvenli bölge olduğu için çok daha hızlı */
      const regenMult = map.type === 'town' ? 12 : 1;
      char.hp = Math.min(char.stats.hp, char.hp + (char.stats.hpRegen || 0) * regenMult * dt);
      char.mp = Math.min(char.stats.mp, char.mp + (char.stats.mpRegen || 0) * regenMult * dt);

      /* savaş */
      if (map.type !== 'town' && char.target) {
        const mob = world.mobs.find(m => m.iid === char.target && !m.dead);
        if (!mob) { char.target = null; }
        else {
          char.atkCd = (char.atkCd || 0) - dt;
          if (char.atkCd <= 0) {
            char.atkCd = attackInterval();
            const r = C.playerHit(char, char.stats, mob, rng, null);
            mob.hp -= r.damage;
            log('hit', `${mob.name} → ${r.damage} hasar${r.crit ? ' (Kritik!)' : ''}${r.pierce ? ' (Delici!)' : ''}`, {
              dmg: r.damage, crit: r.crit, pierce: r.pierce, iid: mob.iid
            });
            if (mob.hp <= 0) killMob(mob);
          }
          if (!mob.dead) {
            mob.atkCd -= dt;
            if (mob.atkCd <= 0) {
              mob.atkCd = mob.attackInterval;
              const r = C.mobHit(mob, char, char.stats, rng);
              if (r.dodged) log('dodge', `${mob.name} saldırısını savuşturdun.`);
              else {
                char.hp -= r.damage;
                log('taken', `${mob.name} sana ${r.damage} hasar verdi${r.blocked ? ' (Blok!)' : ''}`, { dmg: r.damage });
              }
              if (char.hp <= 0) playerDies();
            }
          }
        }
      }
      return ok();
    }

    /* ---------------- KOMUTLAR ---------------- */
    function ok(data) { return { ok: true, data: data || null }; }
    function err(msg) { return { ok: false, error: msg }; }

    function engage(iid) {
      const map = W.mapById(char.mapId);
      if (map.type === 'town') return err('Kasabada savaş yasak.');
      const mob = world.mobs.find(m => m.iid === iid && !m.dead);
      if (!mob) return err('Hedef bulunamadı.');
      char.target = iid;
      char.atkCd = 0.2;
      return ok();
    }

    function useSkill(skillId) {
      const def = S.get(skillId);
      if (!def) return err('Bilinmeyen yetenek.');
      const lv = char.skills[skillId] || 0;
      if (!lv) return err('Bu yeteneği öğrenmedin.');
      if (def.type === 'passive') return err('Pasif yetenek kullanılamaz.');
      if ((char.cooldowns[skillId] || 0) > 0) return err('Yetenek henüz hazır değil.');
      const mp = def.mp(lv);
      if (char.mp < mp) return err('Mana yetersiz.');

      char.mp -= mp;
      char.cooldowns[skillId] = def.cd(lv);

      if (def.type === 'buff') {
        const b = def.buff(lv);
        char.buffs = char.buffs.filter(x => x.id !== skillId);
        const stats = {}; for (const k in b) if (k !== 'dur') stats[k] = b[k];
        char.buffs.push({ id: skillId, name: def.name, icon: def.icon, stats, left: b.dur, dur: b.dur });
        recalc();
        log('skill', `${def.name} etkinleştirildi (${b.dur} sn).`);
        return ok();
      }

      const map = W.mapById(char.mapId);
      if (map.type === 'town') return err('Kasabada saldırı yapılamaz.');
      let targets = [];
      const primary = world.mobs.find(m => m.iid === char.target && !m.dead);
      if (primary) targets.push(primary);
      if (def.target === 'aoe') {
        aliveMobs().forEach(m => { if (targets.indexOf(m) < 0 && targets.length < (def.maxTargets || 3)) targets.push(m); });
      }
      if (!targets.length) return err('Menzilde hedef yok.');

      targets.forEach(mob => {
        const dmg = C.skillDamage(def, lv, char.stats, char);
        const r = C.playerHit(char, char.stats, mob, rng,
          { magic: def.magic, coefApplied: 0, flat: dmg, ignoreDef: def.ignoreDef });
        mob.hp -= r.damage;
        log('skill', `${def.name} → ${mob.name}: ${r.damage} hasar${r.crit ? ' (Kritik!)' : ''}`, { dmg: r.damage, iid: mob.iid });
        if (mob.hp <= 0) killMob(mob);
      });
      return ok();
    }

    function equip(uid) {
      const item = findItem(uid);
      if (!item || item.stack) return err('Bu eşya kuşanılamaz.');
      const tpl = I.template(item.tpl);
      if (!tpl) return err('Bu eşya kuşanılamaz.');
      if (char.level < tpl.levelReq) return err(`${tpl.levelReq}. seviye gerekiyor.`);
      if (tpl.classReq && tpl.classReq !== char.cls) return err('Bu eşya sınıfına uygun değil.');

      const slot = tpl.slot;
      const current = char.equipment[slot];
      removeItem(uid);
      if (current) {
        if (!addItem(current)) { char.inventory.push(item); return err('Envanterde yer yok.'); }
      }
      char.equipment[slot] = item;
      recalc();
      log('sys', `${C.itemName(item)} kuşanıldı.`);
      return ok();
    }

    function unequip(slot) {
      const item = char.equipment[slot];
      if (!item) return err('Bu yuva zaten boş.');
      if (freeSlots() <= 0) return err('Envanterde yer yok.');
      char.equipment[slot] = null;
      addItem(item);
      recalc();
      return ok();
    }

    function upgrade(uid, helpers) {
      helpers = (helpers || []).filter(h => B.UPGRADE_HELPERS[h]);
      const item = findItem(uid) || Object.keys(char.equipment).map(s => char.equipment[s]).find(x => x && x.uid === uid);
      if (!item || item.stack) return err('Geliştirilecek eşya bulunamadı.');
      if (!I.template(item.tpl)) return err('Bu eşya geliştirilemez.');
      const info = C.upgradeInfo(item, helpers);
      if (!info) return err('Bu eşya azami seviyede.');

      if (char.yang < info.yang) return err('Yang yetersiz.');
      for (const m in info.mats) if (countMaterial(m) < info.mats[m]) return err(`${I.MATERIALS[m].name} yetersiz.`);
      for (const h of helpers) if (countMaterial(h) < 1) return err(`${I.MATERIALS[h].name} yetersiz.`);

      char.yang -= info.yang;
      for (const m in info.mats) consumeMaterial(m, info.mats[m]);
      helpers.forEach(h => consumeMaterial(h, 1));

      const success = C.rollUpgrade(rng, info);
      let downgraded = false;
      if (success) {
        item.plus = (item.plus || 0) + 1;
        log('upgrade', `${C.itemName(item)} — geliştirme başarılı!`, { success: true, plus: item.plus, uid: item.uid });
      } else {
        if (info.failPolicy === 'down' && item.plus > 0) { item.plus -= 1; downgraded = true; }
        log('upgrade', `Geliştirme başarısız. ${downgraded ? 'Eşya bir seviye geriledi.' : 'Malzemeler kayboldu.'}`,
          { success: false, plus: item.plus, uid: item.uid });
      }
      recalc();
      return ok({ success, plus: item.plus, downgraded, rate: info.rate });
    }

    function learnSkill(skillId) {
      const def = S.get(skillId);
      if (!def || def.cls !== char.cls) return err('Bu yetenek sınıfına ait değil.');
      const cur = char.skills[skillId] || 0;
      if (cur >= B.SKILL.maxLevel) return err('Yetenek azami seviyede.');
      const target = cur + 1;
      if (char.level < def.reqLevel) return err(`${def.reqLevel}. seviye gerekiyor.`);

      const cost = C.skillCost(skillId, target);
      if (char.skillPoints < cost.point) return err('Yetenek puanı yetersiz.');
      if (char.yang < cost.yang) return err('Yang yetersiz.');
      if (cost.books > 0 && countMaterial(cost.bookId) < cost.books) return err('Yetenek kitabı yetersiz.');

      char.skillPoints -= cost.point;
      char.yang -= cost.yang;
      if (cost.books) consumeMaterial(cost.bookId, cost.books);

      const success = rng() * 100 < cost.rate;
      if (success) {
        char.skills[skillId] = target;
        recalc();
        log('skill', `${def.name} → Seviye ${target}`, { success: true });
        return ok({ success: true, level: target });
      }
      /* Başarısızlık cezası hafif: puan geri gelir, yangın yarısı iade. */
      char.skillPoints += cost.point;
      char.yang += Math.round(cost.yang * B.SKILL.failRefund);
      log('skill', `${def.name} geliştirilemedi. Puan iade edildi, yangın yarısı geri verildi.`, { success: false });
      return ok({ success: false, level: cur });
    }

    function useConsumable(uid) {
      const item = findItem(uid);
      if (!item) return err('Eşya bulunamadı.');
      const def = I.CONSUMABLES[item.tpl];
      if (!def) return err('Bu eşya kullanılamaz.');
      if (char.level < (def.levelReq || 1)) return err(`${def.levelReq}. seviye gerekiyor.`);
      if (def.heal) char.hp = Math.min(char.stats.hp, char.hp + def.heal);
      if (def.mana) char.mp = Math.min(char.stats.mp, char.mp + def.mana);
      item.qty -= 1;
      if (item.qty <= 0) removeItem(uid);
      return ok();
    }

    /* ---------------- MAĞAZA ---------------- */
    function shopStock(role) {
      const out = [];
      if (role === 'shop_potion') {
        for (const id in I.CONSUMABLES) {
          const c = I.CONSUMABLES[id];
          if (c.levelReq <= char.level + 5) out.push({ id, name: c.name, price: c.price, icon: c.icon, levelReq: c.levelReq, stack: true });
        }
        ['iron_shard', 'steel_shard'].forEach(id => {
          const m = I.MATERIALS[id];
          out.push({ id, name: m.name, price: Math.round(m.price * 1.6), icon: m.icon, levelReq: 1, stack: true });
        });
        return out;
      }
      const slots = role === 'shop_weapon' ? ['weapon'] : ['head', 'body', 'shield', 'gloves', 'boots', 'necklace', 'earring', 'bracelet'];
      /* Mağaza yalnızca oyuncunun seviyesine kadar olan kademeleri satar
         ve sadece "common" kalitede — iyi item her zaman farmdan gelir. */
      I.pool(1, 7, slots, char.cls).forEach(tpl => {
        if (tpl.levelReq > char.level + 4) return;
        if (tpl.classReq && tpl.classReq !== char.cls) return;
        out.push({ id: tpl.id, name: tpl.name, price: Math.round(tpl.price * 2.4), icon: tpl.icon, levelReq: tpl.levelReq, tier: tpl.tier, slot: tpl.slot });
      });
      return out.sort((a, b) => a.levelReq - b.levelReq);
    }

    function shopBuy(id, qty) {
      qty = Math.max(1, Math.min(99, parseInt(qty, 10) || 1));
      const map = W.mapById(char.mapId);
      if (map.type !== 'town') return err('Alışveriş sadece kasabada yapılır.');

      const cons = I.CONSUMABLES[id], mat = I.MATERIALS[id], tpl = I.template(id);
      let price, item;
      if (cons) { price = cons.price * qty; item = C.createStack(id, qty); }
      else if (mat) { price = Math.round(mat.price * 1.6) * qty; item = C.createStack(id, qty); }
      else if (tpl) {
        if (tpl.classReq && tpl.classReq !== char.cls) return err('Bu eşya sınıfına uygun değil.');
        if (tpl.levelReq > char.level + 4) return err('Bu eşya senin için henüz satılık değil.');
        qty = 1; price = Math.round(tpl.price * 2.4);
        item = C.createItem(id, { rng, rarity: 'common', noAffix: true });
      } else return err('Böyle bir mal yok.');

      if (char.yang < price) return err('Yang yetersiz.');
      if (freeSlots() <= 0 && !(item.stack && char.inventory.some(x => x.tpl === id && x.qty < STACK_MAX))) return err('Envanterde yer yok.');
      char.yang -= price;
      addItem(item);
      log('shop', `${C.itemName(item)}${qty > 1 ? ' ×' + qty : ''} satın alındı.`);
      return ok();
    }

    function shopSell(uid, qty) {
      const map = W.mapById(char.mapId);
      if (map.type !== 'town') return err('Satış sadece kasabada yapılır.');
      const item = findItem(uid);
      if (!item) return err('Eşya bulunamadı.');
      let gain;
      if (item.stack) {
        qty = Math.max(1, Math.min(item.qty, parseInt(qty, 10) || item.qty));
        gain = Math.round(C.itemPrice(item) * B.ECONOMY.sellRatio * qty);
        item.qty -= qty;
        if (item.qty <= 0) removeItem(uid);
      } else {
        gain = Math.round(C.itemPrice(item) * B.ECONOMY.sellRatio);
        removeItem(uid);
      }
      char.yang += gain;
      log('shop', `Satıldı. +${gain.toLocaleString('tr-TR')} yang`);
      return ok({ gain });
    }

    /* ---------------- ANLIK GÖRÜNTÜ ----------------
       Client'a giden tek veri budur. İçinde hesaplanmış nihai değerler
       vardır; client bunları değiştirse bile sunucu durumu etkilenmez. */
    function snapshot() {
      if (!char) return { char: null };
      const map = W.mapById(char.mapId);
      return clone({
        char: {
          name: char.name, cls: char.cls, className: B.CLASSES[char.cls].name,
          level: char.level, exp: Math.round(char.exp), expNext: B.expToNext(char.level),
          yang: char.yang, hp: Math.round(char.hp), mp: Math.round(char.mp),
          stats: char.stats, skillPoints: char.skillPoints,
          equipment: char.equipment, inventory: char.inventory,
          inventoryMax: INVENTORY_SLOTS,
          skills: char.skills, cooldowns: char.cooldowns, buffs: char.buffs,
          mapId: char.mapId, unlockedMaps: char.unlockedMaps,
          kills: char.kills, deaths: char.deaths, playtime: Math.round(char.playtime),
          target: char.target || null
        },
        map: { id: map.id, name: map.name, type: map.type, desc: map.desc, theme: map.theme, tier: map.tier, minLevel: map.minLevel },
        mobs: world.mobs.map(m => ({
          iid: m.iid, name: m.name, level: m.level, hp: Math.round(m.hp), maxHp: m.maxHp,
          dead: m.dead, isBoss: m.isBoss, arch: m.arch,
          respawnIn: m.dead ? Math.max(0, Math.round(m.respawn - now())) : 0
        })),
        serverTime: now()
      });
    }

    function drainEvents() { const e = events; events = []; return clone(e); }

    /* ---------------- KAYIT ---------------- */
    function save() { return clone({ char, world: { bossTimer: world.bossTimer } }); }
    function load(data) {
      if (!data || !data.char) return false;
      char = data.char;
      char.buffs = char.buffs || []; char.cooldowns = {}; char.target = null;
      world.bossTimer = (data.world && data.world.bossTimer) || {};
      lastTick = now();
      recalc();
      travel(char.mapId || 'town', true);
      return true;
    }

    /* ---------------- KOMUT YÖNLENDİRİCİ ----------------
       Client'ın erişebildiği TEK kapı burasıdır.                     */
    const HANDLERS = {
      newCharacter: (p) => { newCharacter(p.name, p.cls); return ok(); },
      tick: () => tick(),
      travel: (p) => travel(p.mapId),
      engage: (p) => engage(p.iid),
      disengage: () => { char.target = null; return ok(); },
      useSkill: (p) => useSkill(p.skillId),
      equip: (p) => equip(p.uid),
      unequip: (p) => unequip(p.slot),
      upgrade: (p) => upgrade(p.uid, p.helpers),
      learnSkill: (p) => learnSkill(p.skillId),
      useItem: (p) => useConsumable(p.uid),
      shopStock: (p) => ok(shopStock(p.role)),
      shopBuy: (p) => shopBuy(p.id, p.qty),
      shopSell: (p) => shopSell(p.uid, p.qty),
      upgradeInfo: (p) => {
        const item = findItem(p.uid) || Object.keys(char.equipment).map(s => char.equipment[s]).find(x => x && x.uid === p.uid);
        if (!item) return err('Eşya bulunamadı.');
        return ok(C.upgradeInfo(item, p.helpers || []));
      },
      skillInfo: () => {
        const out = S.forClass(char.cls).map(def => {
          const lv = char.skills[def.id] || 0;
          const cost = lv < B.SKILL.maxLevel ? C.skillCost(def.id, lv + 1) : null;
          return {
            id: def.id, name: def.name, icon: def.icon, type: def.type, desc: def.desc,
            reqLevel: def.reqLevel, level: lv, maxLevel: B.SKILL.maxLevel,
            damage: def.dmg && lv ? C.skillDamage(def, lv, char.stats, char) : null,
            nextDamage: def.dmg && lv < B.SKILL.maxLevel ? C.skillDamage(def, lv + 1, char.stats, char) : null,
            mp: lv ? def.mp(lv) : def.mp(1), cd: lv ? def.cd(lv) : def.cd(1),
            cost, owned: cost ? countMaterial(cost.bookId) : 0
          };
        });
        return ok(out);
      },
      maps: () => ok(W.MAPS.map(m => ({
        id: m.id, name: m.name, type: m.type, desc: m.desc, theme: m.theme,
        minLevel: m.minLevel, maxLevel: m.maxLevel, tier: m.tier,
        unlocked: m.type === 'town' || char.unlockedMaps.indexOf(m.id) >= 0,
        cost: travelCost(m)
      }))),
      npcs: () => ok(W.NPCS)
    };

    function command(name, payload) {
      try {
        const h = HANDLERS[name];
        if (!h) return { ok: false, error: 'Bilinmeyen komut: ' + name };
        if (name !== 'newCharacter' && !char) return { ok: false, error: 'Karakter yok.' };
        const res = h(payload || {}) || ok();
        return Object.assign({}, res, { state: snapshot(), events: drainEvents() });
      } catch (e) {
        return { ok: false, error: 'Sunucu hatası: ' + e.message, state: char ? snapshot() : null, events: drainEvents() };
      }
    }

    return { command, save, load, hasCharacter: () => !!char, _debug: { get char() { return char; }, get world() { return world; } } };
  }

  return { createServer, INVENTORY_SLOTS, STACK_MAX };
});
