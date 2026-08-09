/* =============================================================
   utils.js — matematik, rastgelelik, biçimlendirme, event bus
   ============================================================= */

const U = {
  clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
  lerp(a, b, t) { return a + (b - a) * t; },
  rand(a = 0, b = 1) { return a + Math.random() * (b - a); },
  randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  chance(p) { return Math.random() < p; },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  weightedPick(list, weightKey = 'weight') {
    let total = 0;
    for (const it of list) total += it[weightKey];
    let r = Math.random() * total;
    for (const it of list) { r -= it[weightKey]; if (r <= 0) return it; }
    return list[list.length - 1];
  },

  dist(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); },
  dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },
  angle(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); },

  uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); },

  fmt(n) {
    n = Math.floor(n);
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  },
  pct(v, d = 0) { return (v * 100).toFixed(d) + '%'; },

  /* Stat değerini okunur biçime çevirir */
  fmtStat(key, v) {
    const pctKeys = ['critChance', 'critDamage', 'penetration', 'elementDamage', 'elementRes',
                     'resSu', 'resAtes', 'dmgBoss', 'dmgMonster', 'dmgPlayer', 'dmgStone'];
    if (pctKeys.includes(key)) return (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';
    if (key === 'attackSpeed') return (v >= 0 ? '+' : '') + v.toFixed(2);
    if (key === 'moveSpeed' || key === 'hpRegen') return (v >= 0 ? '+' : '') + v.toFixed(1);
    return (v >= 0 ? '+' : '') + Math.round(v);
  },

  statName(key) {
    const map = {
      maxHp: 'Can', hpRegen: 'HP Yenilenmesi', attack: 'Saldırı Gücü', magic: 'Büyü Gücü',
      defense: 'Savunma', attackSpeed: 'Saldırı Hızı', moveSpeed: 'Koşu Hızı',
      critChance: 'Kritik Şans', critDamage: 'Kritik Hasar', penetration: 'Delici Vuruş',
      range: 'Menzil', elementDamage: 'Element Hasarı', elementRes: 'Element Direnci',
      resSu: 'Suya Karşı Dayanıklılık', resAtes: 'Ateşe Karşı Dayanıklılık',
      dmgBoss: "Boss'a Karşı Güçlü", dmgMonster: 'Canavara Karşı Güçlü',
      dmgPlayer: 'Oyuncuya Karşı Güçlü', dmgStone: 'Maden Taşına Karşı Güçlü'
    };
    return map[key] || key;
  },

  /* Basit yayın-abone sistemi (görev takibi, UI güncellemesi) */
  bus: {
    _h: {},
    on(evt, fn) { (this._h[evt] = this._h[evt] || []).push(fn); },
    emit(evt, data) { (this._h[evt] || []).forEach(fn => fn(data)); }
  },

  /* Nokta bir daire içinde mi */
  inCircle(px, py, cx, cy, r) { return U.dist2(px, py, cx, cy) <= r * r; },

  /* Açı farkı (-PI..PI) */
  angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  },

  now() { return performance.now() / 1000; }
};
