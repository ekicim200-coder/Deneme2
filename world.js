/* =============================================================
   world.js — Harita üretimi, engeller, portallar, NPC'ler, çarpışma
   ============================================================= */

class World {
  constructor(mapId, game) {
    this.id = mapId;
    this.def = GameData.MAPS[mapId];
    this.w = this.def.w;
    this.h = this.def.h;
    this.obstacles = [];   // {x,y,r,kind,color,height}
    this.portals = [];     // {x,y,r,to,label,color}
    this.npcs = [];        // {x,y,r,kind,name}
    this.tiles = [];       // görsel varyasyon
    this.game = game;

    /* Maden haritasının elementi HER ZAMAN oyuncunun karşıtıdır:
       Su karakteri → ateş madenleri ve ateş düşmanları, Ateş karakteri → su madenleri. */
    if (this.def.mine) {
      const race = (game && game.save && game.save.race) || 'su';
      this.element = race === 'su' ? 'ates' : 'su';
      this.name = this.element === 'ates' ? 'Ateş Madenleri' : 'Buz Madenleri';
      this.accent = this.element === 'ates' ? '#8a4a2a' : '#3f7f9a';
      this.ground = this.element === 'ates' ? '#2e2028' : '#1e2833';
    } else {
      this.element = this.def.element || null;
      this.name = this.def.name;
      this.accent = this.def.accent;
      this.ground = this.def.ground;
    }
    this.oreSpots = [];
    this.build();
    this.makeTiles();
  }

  makeTiles() {
    for (let y = 0; y < this.h; y++) {
      const row = [];
      for (let x = 0; x < this.w; x++) row.push(Math.random());
      this.tiles.push(row);
    }
  }

  addRock(x, y, r, color, height, kind = 'rock') {
    this.obstacles.push({ x, y, r, color, height, kind });
  }

  build() {
    const d = this.def;
    const cx = this.w / 2, cy = this.h / 2;

    if (d.safe) {
      // ---- ŞEHİR ----
      const bld = (x, y, w, h, color, name) => {
        this.obstacles.push({ x, y, r: Math.max(w, h) * 0.5, bw: w, bh: h, color, height: 2.2, kind: 'building', name });
      };
      bld(cx - 7, cy - 6, 3.2, 3.2, '#5a4f43', 'Market');
      bld(cx + 5, cy - 7, 3.0, 3.0, '#4a4a55', 'Demirci');
      bld(cx - 8, cy + 5, 2.8, 2.8, '#4d5a4a', 'Görev Salonu');
      bld(cx + 7, cy + 6, 2.8, 2.8, '#55495a', 'Depo');

      // dekor sütunlar
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        this.addRock(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11, 0.5, '#6b7285', 1.6, 'pillar');
      }

      this.npcs.push({ x: cx - 7, y: cy - 3.4, r: 1.3, kind: 'market', name: 'Tüccar Vela' });
      this.npcs.push({ x: cx + 5, y: cy - 4.4, r: 1.3, kind: 'craft', name: 'Demirci Kadir' });
      this.npcs.push({ x: cx - 8, y: cy + 7.4, r: 1.3, kind: 'quest', name: 'Görev Ustası Arin' });
      this.npcs.push({ x: cx + 7, y: cy + 8.4, r: 1.3, kind: 'storage', name: 'Depocu Nuran' });

      this.portals.push({ x: cx - 11, y: cy - 11, r: 1.4, to: 'farm_su', label: 'Buz Vadisi', color: '#4fd6ff' });
      this.portals.push({ x: cx + 11, y: cy - 11, r: 1.4, to: 'farm_ates', label: 'Lav Çölü', color: '#ff7a2f' });
      this.portals.push({ x: cx - 11, y: cy + 11, r: 1.4, to: 'boss_su', label: 'Kraken İni', color: '#2f9fd0' });
      this.portals.push({ x: cx + 11, y: cy + 11, r: 1.4, to: 'boss_ates', label: 'Ejderha Yuvası', color: '#e05a2a' });
      this.portals.push({ x: cx, y: cy + 12, r: 1.6, to: 'arena', label: 'PvP Arenası', color: '#ffd15c' });
      const foe = ((this.game && this.game.save && this.game.save.race) === 'su') ? 'ates' : 'su';
      this.portals.push({
        x: cx, y: cy - 12, r: 1.6, to: 'maden',
        label: foe === 'ates' ? 'Ateş Madenleri' : 'Buz Madenleri',
        color: foe === 'ates' ? '#ff7a2f' : '#4fd6ff'
      });

    } else if (d.pvp) {
      // ---- ARENA (simetrik) ----
      for (let i = 0; i < 4; i++) {
        const ox = i % 2 === 0 ? -5 : 5;
        const oy = i < 2 ? -5 : 5;
        this.addRock(cx + ox, cy + oy, 0.9, '#7a7f95', 2.0, 'pillar');
      }
      this.addRock(cx, cy - 8, 1.1, '#8a90a8', 1.6, 'pillar');
      this.addRock(cx, cy + 8, 1.1, '#8a90a8', 1.6, 'pillar');
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        this.addRock(cx + Math.cos(a) * 12.5, cy + Math.sin(a) * 12.5, 0.7, '#5b6076', 1.8, 'pillar');
      }
      this.portals.push({ x: cx, y: cy + 11.5, r: 1.4, to: 'city', label: 'Şehre Dön', color: '#9fe0a0' });

    } else {
      // ---- FARM / BOSS HARİTALARI ----
      const count = d.boss ? 14 : d.mine ? 30 : 46;
      const accent = this.accent;
      for (let i = 0; i < count; i++) {
        const x = U.rand(3, this.w - 3), y = U.rand(3, this.h - 3);
        if (U.dist(x, y, 4, 4) < 6) continue;                 // giriş bölgesi boş
        if (d.boss && U.dist(x, y, cx, cy) < 8) continue;      // boss alanı boş
        this.addRock(x, y, U.rand(0.5, 1.1), accent, U.rand(0.8, 2.0), U.chance(0.5) ? 'rock' : 'tree');
      }
      this.portals.push({ x: 3.5, y: 3.5, r: 1.5, to: 'city', label: 'Şehre Dön', color: '#9fe0a0' });

      /* Maden taşlarının duracağı boş noktalar */
      if (d.mine) {
        for (let i = 0; i < (d.ore || 6); i++) {
          const a = (i / (d.ore || 6)) * Math.PI * 2 + U.rand(-0.25, 0.25);
          const rad = U.rand(9, Math.min(this.w, this.h) * 0.42);
          const p = this.openNear(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, 1.9);
          if (U.dist(p.x, p.y, 4, 4) < 8) continue;
          this.oreSpots.push(p);
        }
      }
    }
  }

  /* Çarpışma testi */
  blocked(x, y, r, ignoreKind) {
    if (x < r + 1 || y < r + 1 || x > this.w - r - 1 || y > this.h - r - 1) return true;
    for (const o of this.obstacles) {
      if (ignoreKind && o.kind === ignoreKind) continue;
      if (o.kind === 'building') {
        const hw = o.bw / 2 + r, hh = o.bh / 2 + r;
        if (Math.abs(x - o.x) < hw && Math.abs(y - o.y) < hh) return true;
      } else if (U.dist2(x, y, o.x, o.y) < (o.r + r) * (o.r + r)) return true;
    }
    return false;
  }

  clampPos(a) {
    a.x = U.clamp(a.x, a.r + 1, this.w - a.r - 1);
    a.y = U.clamp(a.y, a.r + 1, this.h - a.r - 1);
  }

  randomOpenPos(minDistFrom, minDist = 8) {
    for (let i = 0; i < 200; i++) {
      const x = U.rand(3, this.w - 3), y = U.rand(3, this.h - 3);
      if (this.blocked(x, y, 0.6)) continue;
      if (minDistFrom && U.dist(x, y, minDistFrom.x, minDistFrom.y) < minDist) continue;
      return { x, y };
    }
    return { x: this.w / 2, y: this.h / 2 };
  }

  /* Verilen noktaya en yakın boş konum (engel içine doğma sorununu önler) */
  openNear(x, y, radius = 0.5) {
    if (!this.blocked(x, y, radius)) return { x, y };
    for (let r = 0.6; r < 10; r += 0.5) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) {
        const nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r;
        if (!this.blocked(nx, ny, radius)) return { x: nx, y: ny };
      }
    }
    return { x: this.w / 2, y: this.h / 2 };
  }

  entryPos() {
    let p;
    if (this.def.safe) p = { x: this.w / 2, y: this.h / 2 + 4 };
    else if (this.def.pvp) p = { x: this.w / 2, y: this.h / 2 + 9.5 };
    else p = { x: 5.5, y: 5.5 };
    return this.openNear(p.x, p.y, 0.5);
  }
}
