/* ============================================================
   skills.js — Sınıf bazlı skill ağaçları.
   Her skill seviyesi formülle üretilir: elle 10 satır yazmak yerine
   damage(lv) fonksiyonu kullanılır, böylece dengeleme tek yerden yapılır.
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SkillData = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* growth: her seviyede hasarın çarpanı. 1.21 → Lv1 120 hasar ise
     Lv5 ≈ 235 olur (tasarım dokümanındaki eğriyle uyumlu).            */
  function dmgCurve(base, growth) {
    return (lv) => Math.round(base * Math.pow(growth, lv - 1));
  }

  const SKILLS = {
    /* ---------------- SAVAŞÇI ---------------- */
    cleave: {
      id: 'cleave', cls: 'warrior', name: 'Yarma Darbesi', icon: '🗡',
      type: 'active', target: 'aoe', maxTargets: 3,
      desc: 'Önündeki hedefleri tek yayda biçer.',
      dmg: dmgCurve(120, 1.185), coef: 1.05, magic: false,
      mp: lv => 14 + lv * 3, cd: lv => Math.max(3.0, 5.5 - lv * 0.18), reqLevel: 1
    },
    ironhide: {
      id: 'ironhide', cls: 'warrior', name: 'Demir Deri', icon: '🛡',
      type: 'buff', desc: 'Savunmanı ve canını bir süre yükseltir.',
      buff: lv => ({ def: 6 + lv * 5, hp: 30 + lv * 26, dur: 12 + lv }),
      mp: lv => 20 + lv * 4, cd: lv => 26 - lv * 0.8, reqLevel: 8
    },
    warcry: {
      id: 'warcry', cls: 'warrior', name: 'Savaş Narası', icon: '📣',
      type: 'active', target: 'aoe', maxTargets: 5,
      desc: 'Çevredeki düşmanları sersemletir ve hasar verir.',
      dmg: dmgCurve(90, 1.20), coef: 0.85, stun: lv => 1.0 + lv * 0.16,
      mp: lv => 26 + lv * 5, cd: lv => Math.max(8, 16 - lv * 0.7), reqLevel: 20
    },
    bloodrage: {
      id: 'bloodrage', cls: 'warrior', name: 'Kan Öfkesi', icon: '🔥',
      type: 'passive', desc: 'Kalıcı saldırı ve kritik artışı.',
      passive: lv => ({ atk: lv * 7, crit: lv * 0.8 }), reqLevel: 35
    },

    /* ---------------- OKÇU ---------------- */
    piercing_shot: {
      id: 'piercing_shot', cls: 'archer', name: 'Delici Ok', icon: '🏹',
      type: 'active', target: 'single',
      desc: 'Savunmayı yok sayan tek hedef atışı.',
      dmg: dmgCurve(135, 1.19), coef: 1.10, ignoreDef: true,
      mp: lv => 12 + lv * 3, cd: lv => Math.max(2.5, 4.5 - lv * 0.16), reqLevel: 1
    },
    arrow_rain: {
      id: 'arrow_rain', cls: 'archer', name: 'Ok Yağmuru', icon: '☔',
      type: 'active', target: 'aoe', maxTargets: 6,
      desc: 'Geniş alana ok yağdırır.',
      dmg: dmgCurve(78, 1.21), coef: 0.80,
      mp: lv => 24 + lv * 5, cd: lv => Math.max(7, 14 - lv * 0.6), reqLevel: 12
    },
    hunter_step: {
      id: 'hunter_step', cls: 'archer', name: 'Avcı Adımı', icon: '💨',
      type: 'buff', desc: 'Saldırı hızını ve kaçınmayı yükseltir.',
      buff: lv => ({ atkSpeed: 5 + lv * 3, dodge: 2 + lv * 1.4, dur: 10 + lv }),
      mp: lv => 22 + lv * 4, cd: lv => 28 - lv * 0.9, reqLevel: 22
    },
    eagle_eye: {
      id: 'eagle_eye', cls: 'archer', name: 'Kartal Gözü', icon: '👁',
      type: 'passive', desc: 'Kalıcı kritik ve delici artışı.',
      passive: lv => ({ crit: lv * 1.1, pierce: lv * 1.1 }), reqLevel: 35
    },

    /* ---------------- BÜYÜCÜ ---------------- */
    fireball: {
      id: 'fireball', cls: 'mage', name: 'Ateş Küresi', icon: '☄',
      type: 'active', target: 'aoe', maxTargets: 3,
      desc: 'Çarptığı noktada patlayan alev küresi.',
      dmg: dmgCurve(120, 1.183), coef: 1.05, magic: true,
      mp: lv => 20 + lv * 6, cd: lv => Math.max(3.0, 5.0 - lv * 0.15), reqLevel: 1
    },
    frost_nova: {
      id: 'frost_nova', cls: 'mage', name: 'Ayaz Patlaması', icon: '❄',
      type: 'active', target: 'aoe', maxTargets: 6, magic: true,
      desc: 'Çevreyi dondurur, düşmanları yavaşlatır.',
      dmg: dmgCurve(85, 1.20), coef: 0.85, slow: lv => 0.25 + lv * 0.035,
      mp: lv => 30 + lv * 7, cd: lv => Math.max(8, 15 - lv * 0.65), reqLevel: 14
    },
    mana_shield: {
      id: 'mana_shield', cls: 'mage', name: 'Mana Kalkanı', icon: '🔷',
      type: 'buff', desc: 'Büyü savunmasını ve canını yükseltir.',
      buff: lv => ({ magicDef: 8 + lv * 6, hp: 20 + lv * 18, dur: 14 + lv }),
      mp: lv => 28 + lv * 5, cd: lv => 30 - lv, reqLevel: 24
    },
    arcane_focus: {
      id: 'arcane_focus', cls: 'mage', name: 'Gizem Odağı', icon: '🌀',
      type: 'passive', desc: 'Kalıcı büyü saldırısı ve mana yenilenmesi.',
      passive: lv => ({ magicAtk: lv * 9, mpRegen: lv * 0.3 }), reqLevel: 35
    }
  };

  function forClass(cls) {
    return Object.keys(SKILLS).filter(id => SKILLS[id].cls === cls).map(id => SKILLS[id]);
  }
  function get(id) { return SKILLS[id] || null; }

  return { SKILLS, forClass, get };
});
