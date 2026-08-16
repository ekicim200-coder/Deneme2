/* ============================================================
   icons.js — Prosedürel SVG item ikonları.
   Hiçbir item "sadece yazı" değildir: her eşya kademesine göre
   renklenmiş, kalitesine göre çerçeveli, + seviyesine göre parlayan
   gerçek bir ikon üretir. Dış dosya/asset gerekmez.
   ============================================================ */
(function (root) {
  'use strict';

  /* Kademe paletleri — kademe yükseldikçe metal soğuktan sıcağa döner. */
  const PAL = {
    wood: { a: '#a97d4e', b: '#6d4c2c', edge: '#d9b98a' },
    iron: { a: '#9aa3ab', b: '#5d666e', edge: '#cdd5db' },
    steel: { a: '#b9c6d4', b: '#67788a', edge: '#e6eef6' },
    jade: { a: '#7fc9a3', b: '#3d7d61', edge: '#c8f2dd' },
    dark: { a: '#5d6270', b: '#2a2d36', edge: '#9aa0b4' },
    bone: { a: '#e2d7bd', b: '#9c8b68', edge: '#fff6e2' },
    star: { a: '#9db8ff', b: '#4a5ec2', edge: '#e2ecff' }
  };
  const RARITY_COLOR = {
    common: '#b9c2c9', uncommon: '#5fd35f', rare: '#4ea8ff',
    epic: '#c06bff', legendary: '#ffab2e'
  };

  function grad(id, p) {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.edge}"/><stop offset="45%" stop-color="${p.a}"/>
      <stop offset="100%" stop-color="${p.b}"/></linearGradient>`;
  }

  /* Her ikon 64×64 viewBox içinde çizilir. */
  const SHAPES = {
    weapon_sword: g => `<path d="M32 4 L38 14 L38 40 L32 46 L26 40 L26 14 Z" fill="url(#${g})" stroke="#0008"/>
      <rect x="20" y="44" width="24" height="5" rx="2" fill="#4b3521"/>
      <rect x="30" y="48" width="4" height="12" fill="#6b4a2a"/><circle cx="32" cy="61" r="3" fill="#c9a227"/>`,
    weapon_bow: g => `<path d="M20 8 Q46 32 20 56" fill="none" stroke="url(#${g})" stroke-width="6" stroke-linecap="round"/>
      <path d="M20 8 L20 56" stroke="#e8e0cd" stroke-width="1.6"/>
      <path d="M20 32 L44 32" stroke="#c9a227" stroke-width="2.5"/><path d="M44 28 L50 32 L44 36 Z" fill="#c9a227"/>`,
    weapon_staff: g => `<rect x="29" y="18" width="6" height="42" rx="3" fill="url(#${g})"/>
      <circle cx="32" cy="14" r="10" fill="url(#${g})" opacity=".55"/>
      <circle cx="32" cy="14" r="6" fill="#8fd8ff"/><circle cx="30" cy="12" r="2" fill="#fff" opacity=".9"/>`,
    helmet: g => `<path d="M14 34 Q14 12 32 12 Q50 12 50 34 L50 46 L40 46 L40 36 Q40 30 32 30 Q24 30 24 36 L24 46 L14 46 Z" fill="url(#${g})" stroke="#0008"/>
      <rect x="28" y="8" width="8" height="8" rx="2" fill="#c9a227"/>`,
    armor: g => `<path d="M18 16 L32 10 L46 16 L44 44 Q32 54 20 44 Z" fill="url(#${g})" stroke="#0008"/>
      <path d="M32 12 L32 48" stroke="#0006" stroke-width="1.5"/>
      <path d="M22 22 L42 22" stroke="#0004" stroke-width="1.5"/><circle cx="32" cy="26" r="4" fill="#c9a227"/>`,
    gloves: g => `<path d="M20 22 L20 12 L26 12 L26 20 L30 20 L30 10 L36 10 L36 20 L40 20 L40 14 L46 14 L46 34 Q46 48 33 48 Q20 48 20 36 Z" fill="url(#${g})" stroke="#0008"/>
      <rect x="20" y="40" width="26" height="6" fill="#4b3521" opacity=".8"/>`,
    boots: g => `<path d="M22 10 L34 10 L34 34 L48 40 L48 52 L18 52 L18 22 Z" fill="url(#${g})" stroke="#0008"/>
      <rect x="18" y="46" width="30" height="6" fill="#332417"/>`,
    shield: g => `<path d="M32 8 L50 16 L50 34 Q50 50 32 58 Q14 50 14 34 L14 16 Z" fill="url(#${g})" stroke="#0008"/>
      <path d="M32 14 L32 52" stroke="#0005" stroke-width="1.5"/><circle cx="32" cy="30" r="6" fill="#c9a227" opacity=".85"/>`,
    necklace: g => `<path d="M16 16 Q32 40 48 16" fill="none" stroke="url(#${g})" stroke-width="4"/>
      <path d="M32 34 L38 44 L32 54 L26 44 Z" fill="#7fd7ff" stroke="#0008"/>`,
    earring: g => `<circle cx="32" cy="22" r="10" fill="none" stroke="url(#${g})" stroke-width="4"/>
      <circle cx="32" cy="42" r="7" fill="#ff8fc4" stroke="#0008"/>`,
    bracelet: g => `<ellipse cx="32" cy="32" rx="16" ry="12" fill="none" stroke="url(#${g})" stroke-width="7"/>
      <circle cx="32" cy="20" r="5" fill="#8ef0a8" stroke="#0008"/>`,
    mat_iron: () => `<path d="M14 40 L24 24 L44 24 L52 40 L38 50 L22 50 Z" fill="#8b949c" stroke="#0008"/><path d="M24 24 L38 50" stroke="#0004"/>`,
    mat_steel: () => `<path d="M16 38 L26 20 L46 22 L50 40 L36 52 L20 48 Z" fill="#c3d1de" stroke="#0008"/><path d="M26 20 L36 52" stroke="#0003"/>`,
    mat_power: () => `<path d="M32 8 L48 26 L40 54 L24 54 L16 26 Z" fill="#ff9d4d" stroke="#0008"/><path d="M32 8 L32 54" stroke="#0004"/><path d="M16 26 L48 26" stroke="#0004"/>`,
    mat_soul: () => `<path d="M32 8 L48 26 L40 54 L24 54 L16 26 Z" fill="#a97bff" stroke="#0008"/><circle cx="32" cy="30" r="7" fill="#fff" opacity=".55"/>`,
    mat_magic: () => `<path d="M32 6 L46 20 L46 44 L32 58 L18 44 L18 20 Z" fill="#4fd8ff" stroke="#0008"/><path d="M32 6 L32 58 M18 20 L46 44 M46 20 L18 44" stroke="#ffffff55"/>`,
    mat_scroll: () => `<rect x="14" y="16" width="36" height="32" rx="3" fill="#e8dcb8" stroke="#0008"/>
      <path d="M20 24 H44 M20 32 H44 M20 40 H36" stroke="#8a6f3d" stroke-width="2"/>
      <rect x="10" y="12" width="6" height="40" rx="3" fill="#8a5a2a"/><rect x="48" y="12" width="6" height="40" rx="3" fill="#8a5a2a"/>`,
    mat_protect: () => `<path d="M32 8 L50 16 V34 Q50 50 32 57 Q14 50 14 34 V16 Z" fill="#ffd77a" stroke="#0008"/>
      <path d="M24 32 L30 40 L42 24" stroke="#6b4a12" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    mat_book: () => `<rect x="14" y="12" width="36" height="40" rx="3" fill="#7a3b3b" stroke="#0008"/>
      <rect x="18" y="16" width="28" height="32" fill="#e8dcb8"/><path d="M24 24 H40 M24 32 H40 M24 40 H34" stroke="#8a6f3d" stroke-width="2"/>`,
    pot_hp: () => `<path d="M26 10 H38 V20 L44 30 V48 Q44 54 32 54 Q20 54 20 48 V30 L26 20 Z" fill="#e8496a" stroke="#0008"/>
      <rect x="26" y="6" width="12" height="6" rx="2" fill="#6b4a2a"/><ellipse cx="27" cy="36" rx="3" ry="6" fill="#fff" opacity=".35"/>`,
    pot_mp: () => `<path d="M26 10 H38 V20 L44 30 V48 Q44 54 32 54 Q20 54 20 48 V30 L26 20 Z" fill="#4a7de8" stroke="#0008"/>
      <rect x="26" y="6" width="12" height="6" rx="2" fill="#6b4a2a"/><ellipse cx="27" cy="36" rx="3" ry="6" fill="#fff" opacity=".35"/>`,
    yang: () => `<circle cx="32" cy="32" r="20" fill="#e8c34a" stroke="#8a6a12" stroke-width="3"/><rect x="27" y="27" width="10" height="10" fill="#8a6a12"/>`
  };

  /* item: {tpl, plus, rarity} veya {icon:'mat_iron'} */
  function build(spec) {
    const shapeKey = spec.shape;
    const shape = SHAPES[shapeKey] || SHAPES.mat_iron;
    const pal = PAL[spec.pal] || PAL.iron;
    const gid = 'g' + Math.random().toString(36).slice(2, 8);
    const rc = RARITY_COLOR[spec.rarity] || null;
    const plus = spec.plus || 0;

    const glow = plus >= 9 ? 1.0 : plus >= 7 ? 0.7 : plus >= 4 ? 0.38 : 0;
    const glowColor = plus >= 9 ? '#fff0a8' : plus >= 7 ? '#ffb347' : '#7fd7ff';

    return `<svg class="ico-svg" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>${grad(gid, pal)}
        <filter id="f${gid}" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="${2.5 * glow}" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      ${rc ? `<rect x="1.5" y="1.5" width="61" height="61" rx="8" fill="none" stroke="${rc}" stroke-width="2.5" opacity=".85"/>` : ''}
      ${glow ? `<rect x="4" y="4" width="56" height="56" rx="7" fill="${glowColor}" opacity="${0.12 * glow}"/>` : ''}
      <g ${glow ? `filter="url(#f${gid})"` : ''}>${shape(gid)}</g>
    </svg>`;
  }

  /* Herhangi bir item nesnesinden ikon üretir. */
  function forItem(item, ItemData) {
    const tpl = ItemData.template(item.tpl);
    if (tpl) {
      const shape = tpl.icon === 'weapon' ? 'weapon_' + tpl.variant : tpl.icon;
      return build({ shape, pal: tpl.pal, rarity: item.rarity, plus: item.plus });
    }
    if (item.tpl && item.tpl.indexOf('book_') === 0) return build({ shape: 'mat_book', pal: 'iron' });
    const m = ItemData.MATERIALS[item.tpl] || ItemData.CONSUMABLES[item.tpl];
    if (m) return build({ shape: m.icon, pal: 'iron' });
    return build({ shape: 'mat_iron', pal: 'iron' });
  }

  function forTemplateId(id, ItemData) {
    const tpl = ItemData.template(id);
    if (tpl) return build({ shape: tpl.icon === 'weapon' ? 'weapon_' + tpl.variant : tpl.icon, pal: tpl.pal, rarity: 'common', plus: 0 });
    return forItem({ tpl: id }, ItemData);
  }

  root.Icons = { build, forItem, forTemplateId, RARITY_COLOR, PAL };
})(typeof self !== 'undefined' ? self : this);
