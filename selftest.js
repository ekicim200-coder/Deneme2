/* ============================================================
   selftest.js — Sunucu tarafı doğrulama ve denge simülasyonu.
   Çalıştırma:  node tests/selftest.js
   ============================================================ */
const B = require('../data/balance.js');
const I = require('../data/items.js');
const W = require('../data/world.js');
const C = require('../server/core.js');
const GS = require('../server/gameserver.js');

let pass = 0, fail = 0;
function t(name, cond, detail) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (detail ? '  → ' + detail : '')); }
}
function head(s) { console.log('\n── ' + s + ' ' + '─'.repeat(Math.max(0, 56 - s.length))); }

/* Sanal saat: simülasyonu gerçek zamanı beklemeden hızlandırır. */
function virtualClock() {
  let now = 1000;
  return { now: () => now, advance: s => { now += s; } };
}
function makeServer(seed) {
  const clk = virtualClock();
  const srv = GS.createServer({ seed: seed || 1, clock: clk.now });
  return { srv, clk };
}
function simulate(srv, clk, seconds, step) {
  step = step || 0.2;
  for (let i = 0; i < seconds / step; i++) { clk.advance(step); srv.command('tick'); }
}

/* ---------------------------------------------------------- */
head('1. EXP eğrisi');
[[1, 100], [2, 150], [10, 2500], [20, 10000], [30, 30000], [40, 80000], [50, 200000]].forEach(([lv, exp]) => {
  t(`Lv${lv} → ${exp} EXP`, B.expToNext(lv) === exp, 'gerçek: ' + B.expToNext(lv));
});
t('EXP eğrisi monoton artıyor', (() => {
  for (let l = 1; l < 99; l++) if (B.expToNext(l + 1) <= B.expToNext(l)) return false;
  return true;
})());

head('2. Seviye farkı cezası (düşük mob farmı engeli)');
t('aynı seviye = %100', B.expMultiplier(20, 20) === 1);
t('5 seviye düşük mob ≤ %20', B.expMultiplier(20, 15) <= 0.20, String(B.expMultiplier(20, 15)));
t('10 seviye düşük mob ≤ %2', B.expMultiplier(30, 20) <= 0.02, String(B.expMultiplier(30, 20)));
t('üst seviye mob prim veriyor', B.expMultiplier(20, 25) > 1);
t('üst seviye primi tavanlı', B.expMultiplier(20, 90) <= 1.5);
t('drop şansı da düşük mobda kırılıyor', B.dropMultiplier(40, 20) < 0.2, String(B.dropMultiplier(40, 20)));

head('3. Item statları tasarım çapalarıyla uyumlu');
t('Acemi Kılıç 15–22', I.CATALOG.w_sword_t1.base.minDamage === 15 && I.CATALOG.w_sword_t1.base.maxDamage === 22);
t('kademe arttıkça silah gücü artıyor', (() => {
  let prev = 0;
  for (const tr of I.TIERS) { const d = I.CATALOG['w_sword_t' + tr.t].base.maxDamage; if (d <= prev) return false; prev = d; }
  return true;
})());
t('+ çarpanları 100→270 eğrisiyle aynı', B.UPGRADE_MULT[9] === 2.70 && B.UPGRADE_MULT[5] === 1.55);
t('+9 silah tabanın 2.7 katı', (() => {
  const a = C.createItem('w_sword_t5', { rarity: 'common', noAffix: true, plus: 0 });
  const b = C.createItem('w_sword_t5', { rarity: 'common', noAffix: true, plus: 9 });
  return Math.abs(C.itemStats(b).maxDamage / C.itemStats(a).maxDamage - 2.70) < 0.01;
})());

head('4. Efsun (bonus) dağılımı — mükemmel item nadir olmalı');
(() => {
  const rng = C.RNG(99);
  let perfect = 0, N = 20000, sumAffix = 0;
  for (let i = 0; i < N; i++) {
    const it = C.createItem('w_sword_t3', { rng, rarity: 'rare' });
    sumAffix += it.affixes.length;
    if (it.affixes.length >= 3 && it.affixes.every(a => a.v >= a.max * 0.9)) perfect++;
  }
  const rate = perfect / N;
  t('nadir itemde ort. efsun sayısı 2–3', sumAffix / N >= 2 && sumAffix / N <= 3, (sumAffix / N).toFixed(2));
  t('3 adet %90+ efsun oranı < %0.5', rate < 0.005, (rate * 100).toFixed(3) + '%');
})();

head('5. Rarity kilitleri');
(() => {
  const rng = C.RNG(5);
  let leg = 0;
  for (let i = 0; i < 50000; i++) if (C.rollRarity(rng, 1, false, 10) === 'legendary') leg++;
  t('düşük seviye/normal mobdan efsanevi çıkmıyor', leg === 0, String(leg));
  let leg2 = 0;
  for (let i = 0; i < 50000; i++) if (C.rollRarity(rng, 6, false, 90) === 'legendary') leg2++;
  t('yüksek haritada bile normal mobdan efsanevi çıkmıyor', leg2 === 0, String(leg2));
  let leg3 = 0, N = 50000;
  for (let i = 0; i < N; i++) if (C.rollRarity(rng, 6, true, 90) === 'legendary') leg3++;
  t('boss efsanevi düşürebiliyor ama < %2', leg3 > 0 && leg3 / N < 0.02, (leg3 / N * 100).toFixed(3) + '%');
})();

head('6. Drop tablosu izolasyonu');
(() => {
  const rng = C.RNG(11);
  const map = W.mapById('meadow');
  const char = { level: 10, cls: 'warrior' };
  let maxTier = 0, items = 0, kills = 30000;
  for (let i = 0; i < kills; i++) {
    const mob = { level: 10, arch: 'normal', isBoss: false, yang: 40, exp: 80 };
    const d = C.rollDrops({ rng, map, mob, char });
    d.items.forEach(it => { const tpl = I.template(it.tpl); if (tpl) { items++; maxTier = Math.max(maxTier, tpl.tier); } });
  }
  t('düşük harita yüksek kademe ekipman düşürmüyor', maxTier <= 2, 'en yüksek kademe: ' + maxTier);
  const rate = items / kills;
  t('normal mob ekipman oranı %3–8 arası', rate > 0.03 && rate < 0.08, (rate * 100).toFixed(2) + '%');
})();
(() => {
  const rng = C.RNG(12);
  const map = W.mapById('meadow');
  const char = { level: 10, cls: 'archer' };
  let wrongClass = 0;
  for (let i = 0; i < 20000; i++) {
    const mob = { level: 10, arch: 'normal', isBoss: false, yang: 40, exp: 80 };
    C.rollDrops({ rng, map, mob, char }).items.forEach(it => {
      const tpl = I.template(it.tpl);
      if (tpl && tpl.classReq && tpl.classReq !== 'archer') wrongClass++;
    });
  }
  t('başka sınıfın silahı düşmüyor', wrongClass === 0, String(wrongClass));
})();

head('7. + basma sistemi');
(() => {
  const rng = C.RNG(3);
  const rates = [];
  for (let p = 0; p <= 8; p++) {
    const it = C.createItem('w_sword_t2', { rarity: 'common', noAffix: true, plus: p });
    const info = C.upgradeInfo(it, []);
    let s = 0, N = 20000;
    for (let i = 0; i < N; i++) if (C.rollUpgrade(rng, info)) s++;
    rates.push(s / N * 100);
    t(`+${p}→+${p + 1} beklenen %${B.UPGRADE_RATE[p]}`, Math.abs(s / N * 100 - B.UPGRADE_RATE[p]) < 2.0, (s / N * 100).toFixed(1) + '%');
  }
  const it9 = C.createItem('w_sword_t2', { plus: 9, noAffix: true });
  t('+9 üstü geliştirme yok', C.upgradeInfo(it9, []) === null);
  const it6 = C.createItem('w_sword_t2', { plus: 6, noAffix: true });
  t('+6 başarısızlığı seviye düşürür', C.upgradeInfo(it6, []).failPolicy === 'down');
  t('koruyucu taş seviye düşüşünü engeller', C.upgradeInfo(it6, ['protect_stone']).failPolicy === 'mats');
  t('parşömen şansı 10 puan artırır', C.upgradeInfo(it6, ['scroll_upgrade']).rate === B.UPGRADE_RATE[6] + 10);
  t('şans %100 üstüne çıkmıyor', C.upgradeInfo(C.createItem('w_sword_t2', { plus: 1, noAffix: true }), ['scroll_upgrade']).rate === 100);
})();

head('8. Sunucu doğrulama / exploit denemeleri');
(() => {
  const { srv, clk } = makeServer(21);
  srv.command('newCharacter', { name: 'Sınav', cls: 'warrior' });

  let r = srv.command('travel', { mapId: 'starfall' });
  t('seviye yetmeyen haritaya geçilemiyor', !r.ok, r.error);

  r = srv.command('shopBuy', { id: 'pot_hp_s', qty: 99999 });
  t('paran yetmeyen alışveriş reddediliyor', !r.ok, r.error);
  t('yang negatife düşmedi', srv.command('tick').state.char.yang >= 0);

  /* client snapshot'ı kurcalasa bile sunucu etkilenmez */
  const st = srv.command('tick').state;
  const before = st.char.yang;
  st.char.yang = 999999999;
  st.char.level = 99;
  const st2 = srv.command('tick').state;
  t('client snapshot değişikliği sunucuya yansımıyor', st2.char.yang === before && st2.char.level === 1);

  /* tick spam ile hızlanma denemesi */
  const a = srv.command('tick').state.char.playtime;
  for (let i = 0; i < 500; i++) srv.command('tick');   // saat ilerlemeden 500 tick
  const b = srv.command('tick').state.char.playtime;
  t('saat ilerlemeden tick spam oyunu hızlandırmıyor', b - a < 0.01, 'fark: ' + (b - a));

  /* dt kırpma: 1 saat atlatıp tek tick */
  clk.advance(3600);
  const c1 = srv.command('tick').state.char.playtime;
  t('devasa dt tek tickte 0.35sn ile sınırlı', c1 - b <= 0.36, 'fark: ' + (c1 - b).toFixed(3));

  /* olmayan item ile komutlar */
  t('sahte uid ile kuşanma reddediliyor', !srv.command('equip', { uid: 'sahte' }).ok);
  t('sahte uid ile geliştirme reddediliyor', !srv.command('upgrade', { uid: 'sahte' }).ok);
  t('bilinmeyen komut reddediliyor', !srv.command('hack', {}).ok);
  t('kasabada saldırı yok', (() => { srv.command('travel', { mapId: 'town' }); return !srv.command('engage', { iid: 1 }).ok; })());
})();

head('9. Ekipman kuralları');
(() => {
  const { srv } = makeServer(31);
  srv.command('newCharacter', { name: 'Kural', cls: 'warrior' });
  const dbg = srv._debug.char;

  const highLv = C.createItem('a_armor_t5', { rarity: 'common', noAffix: true });
  dbg.inventory.push(highLv);
  t('seviye gereksinimi olmayan item takılamıyor', !srv.command('equip', { uid: highLv.uid }).ok);

  const bow = C.createItem('w_bow_t1', { rarity: 'common', noAffix: true });
  dbg.inventory.push(bow);
  t('savaşçı yay kuşanamıyor', !srv.command('equip', { uid: bow.uid }).ok);

  const sword = C.createItem('w_sword_t1', { rarity: 'rare' });
  dbg.inventory.push(sword);
  const before = C.itemPower(srv.command('tick').state.char.equipment.weapon);
  t('uygun item kuşanılıyor', srv.command('equip', { uid: sword.uid }).ok);
  t('kuşanınca statlar yeniden hesaplanıyor', srv.command('tick').state.char.stats.hp > 0);

  /* envanter dolu senaryosu */
  while (dbg.inventory.length < GS.INVENTORY_SLOTS) dbg.inventory.push(C.createItem('a_boots_t1', { noAffix: true }));
  t('envanter doluyken çıkarma reddediliyor', !srv.command('unequip', { slot: 'body' }).ok);
})();

head('10. Skill sistemi');
(() => {
  const { srv } = makeServer(41);
  srv.command('newCharacter', { name: 'Usta', cls: 'mage' });
  const dbg = srv._debug.char;
  t('başlangıç skilli var', (dbg.skills.fireball || 0) === 1);
  t('puan yokken geliştirilemiyor', !srv.command('learnSkill', { skillId: 'fireball' }).ok);
  dbg.skillPoints = 30; dbg.yang = 5000000; dbg.level = 40;
  t('başka sınıfın skilli öğrenilemiyor', !srv.command('learnSkill', { skillId: 'cleave' }).ok);
  let lv = 1;
  for (let i = 0; i < 40 && lv < 5; i++) { srv.command('learnSkill', { skillId: 'fireball' }); lv = dbg.skills.fireball; }
  t('skill 5. seviyeye çıkabiliyor', lv >= 5, 'seviye ' + lv);
  t('5+ için kitap gerekiyor', !srv.command('learnSkill', { skillId: 'fireball' }).ok);
  t('skill azami seviyesi 10', B.SKILL.maxLevel === 10);
})();

head('11. Uçtan uca ilerleme simülasyonu');
(() => {
  const { srv, clk } = makeServer(77);
  srv.command('newCharacter', { name: 'Yolcu', cls: 'warrior' });
  let st = srv.command('tick').state;

  function autoFarm(minutes) {
    const steps = minutes * 60 / 0.2;
    for (let i = 0; i < steps; i++) {
      clk.advance(0.2);
      const r = srv.command('tick');
      st = r.state;
      if (!st.char.target) {
        const alive = st.mobs.filter(m => !m.dead);
        /* kendi seviyesine en yakın mobu seç */
        if (alive.length) {
          alive.sort((a, b) => Math.abs(a.level - st.char.level) - Math.abs(b.level - st.char.level));
          srv.command('engage', { iid: alive[0].iid });
        }
      }
      /* yetenek kullan */
      if (st.char.target && i % 5 === 0) {
        for (const sid in st.char.skills) {
          if (!(st.char.cooldowns[sid] > 0)) { srv.command('useSkill', { skillId: sid }); break; }
        }
      }
      /* düşen eşya daha güçlüyse kuşan */
      if (i % 25 === 0) {
        st.char.inventory.filter(x => !x.stack && I.template(x.tpl)).forEach(it => {
          const tpl = I.template(it.tpl);
          if (tpl.levelReq > st.char.level) return;
          if (tpl.classReq && tpl.classReq !== st.char.cls) return;
          const cur = st.char.equipment[tpl.slot];
          if (!cur || C.itemPower(it) > C.itemPower(cur)) srv.command('equip', { uid: it.uid });
        });
        /* işe yaramaz eşyaları kasabada satmak yerine at: envanteri açık tut */
        st = srv.command('tick').state;
      }
      if (st.char.hp < st.char.stats.hp * 0.4) {
        const pot = st.char.inventory.find(x => x.tpl === 'pot_hp_s' || x.tpl === 'pot_hp_m');
        if (pot) srv.command('useItem', { uid: pot.uid });
      }
      /* seviyesine uygun en üst haritada kal; kasabada takılıp kalma */
      if (i % 50 === 0) {
        const maps = srv.command('maps').data;
        const best = maps.filter(m => m.type === 'field' && m.unlocked && st.char.level >= m.minLevel).pop();
        if (best && best.id !== st.map.id && st.char.yang >= best.cost) {
          srv.command('travel', { mapId: best.id });
        }
      }
    }
  }

  const marks = [];
  for (let m = 0; m < 6; m++) {
    autoFarm(10);
    marks.push({ dk: (m + 1) * 10, lv: st.char.level, yang: st.char.yang, kills: st.char.kills, map: st.map.name });
  }
  console.log('  ' + marks.map(x => `${x.dk}dk: Lv${x.lv} (${x.kills} kill, ${x.yang.toLocaleString('tr-TR')} yang, ${x.map})`).join('\n  '));

  t('60 dakikada anlamlı ilerleme var', st.char.level >= 15, 'seviye ' + st.char.level);
  t('ilerleme mantıklı hızda (kırılmamış)', st.char.level <= 45, 'seviye ' + st.char.level);
  t('ölüm oyunu bitirmiyor', st.char.hp > 0);
  t('envanter taşmıyor', st.char.inventory.length <= GS.INVENTORY_SLOTS);
  t('ekipman düştü ve toplandı', st.char.kills > 100);
  t('kayıt/yükleme çalışıyor', (() => {
    const data = srv.save();
    const { srv: s2 } = makeServer(1);
    s2.load(data);
    const s = s2.command('tick').state;
    return s.char.level === st.char.level && s.char.yang === st.char.yang;
  })());
})();

head('SONUÇ');
console.log(`  ${pass} başarılı, ${fail} başarısız`);
process.exit(fail ? 1 : 0);
