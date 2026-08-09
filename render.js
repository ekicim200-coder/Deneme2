/* =============================================================
   render.js — 2.5D izometrik çizim + görsel efektler
   Tüm çizim canvas üzerinde; asset yok, her şey vektörel.
   ============================================================= */

const TW = 64, TH = 32; // izometrik karo genişlik/yükseklik

class Fx {
  constructor() { this.parts = []; this.numbers = []; this.rings = []; this.arcs = []; this.swings = []; }

  hit(x, y, color) {
    for (let i = 0; i < 7; i++) {
      const a = U.rand(0, Math.PI * 2);
      this.parts.push({ x, y, z: U.rand(0.3, 1.0), vx: Math.cos(a) * U.rand(1, 4), vy: Math.sin(a) * U.rand(1, 4), vz: U.rand(1, 4), life: U.rand(0.25, 0.5), max: 0.5, color, size: U.rand(2, 4) });
    }
  }
  trail(x, y, color) {
    this.parts.push({ x, y, z: 0.4, vx: 0, vy: 0, vz: 0.6, life: 0.35, max: 0.35, color, size: 5 });
  }
  ring(x, y, color, radius) { this.rings.push({ x, y, color, r: 0.2, max: radius, life: 0.45, total: 0.45 }); }
  arc(x, y, angle, radius, color) { this.arcs.push({ x, y, angle, radius, color, life: 0.22, total: 0.22 }); }

  /* Savaşçı kombosu: yay boyunca süpüren kılıç izi.
     step 0 → sağdan sola, step 1 → soldan sağa, step 2 → 360° dönüş (bitirici) */
  swing(x, y, angle, radius, color, step = 0, spin = false) {
    const arcs = spin
      ? { from: -Math.PI, to: Math.PI, dur: 0.34, width: 11 }
      : step === 1
        ? { from: 1.15, to: -0.75, dur: 0.20, width: 8 }
        : { from: -1.15, to: 0.75, dur: 0.22, width: 8 };
    this.swings.push({
      x, y, angle, radius, color, spin,
      from: arcs.from, to: arcs.to, width: arcs.width,
      life: arcs.dur, total: arcs.dur
    });
  }
  damageNumber(x, y, value, opt = {}) {
    this.numbers.push({ x, y, value, life: 1.0, vy: -1.4, crit: !!opt.crit, heal: !!opt.heal, burn: !!opt.burn, pen: !!opt.pen, xp: !!opt.xp, mana: !!opt.mana });
  }
  levelUp(x, y) {
    for (let i = 0; i < 30; i++) {
      const a = U.rand(0, Math.PI * 2);
      this.parts.push({ x, y, z: 0.2, vx: Math.cos(a) * U.rand(0.5, 2.5), vy: Math.sin(a) * U.rand(0.5, 2.5), vz: U.rand(3, 7), life: 1.1, max: 1.1, color: '#ffd15c', size: U.rand(2, 5) });
    }
  }

  update(dt) {
    for (let i = this.swings.length - 1; i >= 0; i--) {
      this.swings[i].life -= dt;
      if (this.swings[i].life <= 0) this.swings.splice(i, 1);
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= 6 * dt;
      p.life -= dt; if (p.life <= 0) this.parts.splice(i, 1);
    }
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      n.y += n.vy * dt * 0.35; n.life -= dt;
      if (n.life <= 0) this.numbers.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt; r.r = U.lerp(0.2, r.max, 1 - r.life / r.total);
      if (r.life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      this.arcs[i].life -= dt;
      if (this.arcs[i].life <= 0) this.arcs.splice(i, 1);
    }
  }
}

class Renderer {
  constructor(canvas, game) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.cam = { x: 15, y: 15, zoom: 1 };
    this.shakeAmt = 0; this.shakeT = 0; this.sx = 0; this.sy = 0;   // vuruş sarsıntısı
    this.mini = document.getElementById('minimap');
    this.mctx = this.mini ? this.mini.getContext('2d') : null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cv.width = this.cv.clientWidth * dpr;
    this.cv.height = this.cv.clientHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.vw = this.cv.clientWidth;
    this.vh = this.cv.clientHeight;
    this.cam.zoom = U.clamp(Math.min(this.vw / 900, this.vh / 560), 0.62, 1.35);
  }

  iso(x, y) {
    return { x: (x - y) * (TW / 2), y: (x + y) * (TH / 2) };
  }

  /* Ekran sarsıntısı — bitirici vuruşta darbe hissi */
  shake(amount) { this.shakeAmt = Math.max(this.shakeAmt, amount); this.shakeT = 0.18; }

  shakeOffset() {
    if (this.shakeT <= 0 || this.shakeAmt <= 0) return { x: 0, y: 0 };
    const k = this.shakeAmt * (this.shakeT / 0.18);
    return { x: (Math.random() - 0.5) * k, y: (Math.random() - 0.5) * k };
  }

  worldToScreen(x, y) {
    const i = this.iso(x, y), c = this.iso(this.cam.x, this.cam.y);
    return {
      x: (i.x - c.x) * this.cam.zoom + this.vw / 2 + this.sx,
      y: (i.y - c.y) * this.cam.zoom + this.vh / 2 + this.sy
    };
  }

  screenToWorld(sx, sy) {
    const c = this.iso(this.cam.x, this.cam.y);
    const ix = (sx - this.vw / 2) / this.cam.zoom + c.x;
    const iy = (sy - this.vh / 2) / this.cam.zoom + c.y;
    return {
      x: (ix / (TW / 2) + iy / (TH / 2)) / 2,
      y: (iy / (TH / 2) - ix / (TW / 2)) / 2
    };
  }

  follow(target, dt) {
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeAmt = 0; }
    this.cam.x = U.lerp(this.cam.x, target.x, Math.min(1, dt * 6));
    this.cam.y = U.lerp(this.cam.y, target.y, Math.min(1, dt * 6));
  }

  /* ---------------- Ana çizim ---------------- */
  draw() {
    const g = this.game, ctx = this.ctx, w = g.world;
    const so = this.shakeOffset(); this.sx = so.x; this.sy = so.y;
    ctx.clearRect(0, 0, this.vw, this.vh);

    // arka plan gradyanı
    const bg = ctx.createLinearGradient(0, 0, 0, this.vh);
    bg.addColorStop(0, '#080b14');
    bg.addColorStop(1, '#10141f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.vw, this.vh);

    this.drawGround(w);

    // derinlik sıralı nesneler
    const items = [];
    for (const o of w.obstacles) { if (o.kind !== 'ore') items.push({ d: o.x + o.y, kind: 'obs', o }); }
    for (const p of w.portals) items.push({ d: p.x + p.y - 0.1, kind: 'portal', o: p });
    for (const n of w.npcs) items.push({ d: n.x + n.y, kind: 'npc', o: n });
    for (const a of g.actors) if (!a.removed) items.push({ d: a.x + a.y, kind: 'actor', o: a });
    for (const p of g.projectiles) items.push({ d: p.x + p.y + 0.5, kind: 'proj', o: p });
    items.sort((a, b) => a.d - b.d);

    // zemin üstü efektler (alan büyüleri, halkalar)
    for (const a of g.areas) this.drawAreaMarker(a);
    for (const r of g.fx.rings) this.drawRing(r);
    for (const a of g.fx.arcs) this.drawArc(a);
    for (const sw of g.fx.swings) this.drawSwing(sw);

    for (const it of items) {
      if (it.kind === 'obs') this.drawObstacle(it.o);
      else if (it.kind === 'portal') this.drawPortal(it.o);
      else if (it.kind === 'npc') this.drawNpc(it.o);
      else if (it.kind === 'actor') this.drawActor(it.o);
      else if (it.kind === 'proj') this.drawProjectile(it.o);
    }

    this.drawParticles(g.fx.parts);
    this.drawNumbers(g.fx.numbers);
    this.drawMinimap();
  }

  drawGround(w) {
    const ctx = this.ctx;
    const base = (w.ground || w.def.ground), acc = (w.accent || w.def.accent);
    for (let y = 0; y < w.h; y++) {
      for (let x = 0; x < w.w; x++) {
        const s = this.worldToScreen(x + 0.5, y + 0.5);
        if (s.x < -TW || s.x > this.vw + TW || s.y < -TH * 3 || s.y > this.vh + TH * 3) continue;
        const t = w.tiles[y][x];
        ctx.beginPath();
        const hw = (TW / 2) * this.cam.zoom, hh = (TH / 2) * this.cam.zoom;
        ctx.moveTo(s.x, s.y - hh);
        ctx.lineTo(s.x + hw, s.y);
        ctx.lineTo(s.x, s.y + hh);
        ctx.lineTo(s.x - hw, s.y);
        ctx.closePath();
        ctx.fillStyle = ((x + y) % 2 === 0) ? base : this.shade(base, 1.08);
        ctx.fill();
        if (t > 0.94) { ctx.fillStyle = this.alpha(acc, 0.25); ctx.fill(); }
        ctx.strokeStyle = 'rgba(0,0,0,0.14)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  drawObstacle(o) {
    const ctx = this.ctx, z = this.cam.zoom;
    const s = this.worldToScreen(o.x, o.y);
    const h = o.height * TH * z;

    if (o.kind === 'building') {
      const hw = (o.bw / 2) * TW * 0.5 * z, hh = (o.bh / 2) * TH * 0.5 * z * 2;
      // gövde
      ctx.fillStyle = this.shade(o.color, 0.7);
      ctx.beginPath();
      ctx.moveTo(s.x - hw, s.y); ctx.lineTo(s.x - hw, s.y - h);
      ctx.lineTo(s.x, s.y - h + hh); ctx.lineTo(s.x, s.y + hh);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = this.shade(o.color, 0.5);
      ctx.beginPath();
      ctx.moveTo(s.x + hw, s.y); ctx.lineTo(s.x + hw, s.y - h);
      ctx.lineTo(s.x, s.y - h + hh); ctx.lineTo(s.x, s.y + hh);
      ctx.closePath(); ctx.fill();
      // çatı
      ctx.fillStyle = this.shade(o.color, 1.15);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - h - hh); ctx.lineTo(s.x + hw, s.y - h);
      ctx.lineTo(s.x, s.y - h + hh); ctx.lineTo(s.x - hw, s.y - h);
      ctx.closePath(); ctx.fill();
      if (o.name) {
        ctx.font = `600 ${12 * z}px Barlow, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(232,224,205,0.85)';
        ctx.fillText(o.name, s.x, s.y - h - hh - 6 * z);
      }
      return;
    }

    // kaya / ağaç / sütun
    const r = o.r * TW * 0.5 * z;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(s.x, s.y, r, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();

    if (o.kind === 'tree') {
      ctx.fillStyle = this.shade(o.color, 0.5);
      ctx.fillRect(s.x - r * 0.18, s.y - h * 0.55, r * 0.36, h * 0.55);
      ctx.fillStyle = o.color;
      ctx.beginPath(); ctx.ellipse(s.x, s.y - h * 0.62, r * 0.95, r * 0.85, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = this.shade(o.color, 1.25);
      ctx.beginPath(); ctx.ellipse(s.x - r * 0.25, s.y - h * 0.72, r * 0.45, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = this.shade(o.color, 0.75);
      ctx.beginPath();
      ctx.moveTo(s.x - r, s.y); ctx.lineTo(s.x - r * 0.7, s.y - h);
      ctx.lineTo(s.x + r * 0.7, s.y - h); ctx.lineTo(s.x + r, s.y);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = this.shade(o.color, 1.2);
      ctx.beginPath(); ctx.ellipse(s.x, s.y - h, r * 0.7, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* Maden taşı: kristal blok + can barı + nabız gibi atan element aurası */
  drawOre(a) {
    const ctx = this.ctx, z = this.cam.zoom;
    const s = this.worldToScreen(a.x, a.y);
    const r = a.r * TW * 0.5 * z;
    const h = 46 * a.size * z;
    const t = performance.now() / 1000;

    // gölge
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(s.x, s.y, r * 1.05, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();

    if (a.dead) {
      ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = a.color;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, r * 0.9, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore(); return;
    }

    // aura
    ctx.save();
    ctx.globalAlpha = 0.20 + Math.sin(t * 2.2 + a.pulse) * 0.10;
    const g = ctx.createRadialGradient(s.x, s.y - h * 0.4, 2, s.x, s.y - h * 0.4, r * 2.4);
    g.addColorStop(0, a.color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(s.x, s.y - h * 0.35, r * 2.4, r * 1.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // kristal gövde (iki yüzlü prizma)
    const flash = a.hitFlash > 0;
    const body = flash ? '#ffffff' : a.color;
    ctx.fillStyle = this.shade(body, 0.55);
    ctx.beginPath();
    ctx.moveTo(s.x - r, s.y); ctx.lineTo(s.x - r * 0.55, s.y - h * 0.8);
    ctx.lineTo(s.x, s.y - h); ctx.lineTo(s.x, s.y - h * 0.05);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = this.shade(body, 1.1);
    ctx.beginPath();
    ctx.moveTo(s.x + r, s.y); ctx.lineTo(s.x + r * 0.55, s.y - h * 0.8);
    ctx.lineTo(s.x, s.y - h); ctx.lineTo(s.x, s.y - h * 0.05);
    ctx.closePath(); ctx.fill();
    // taban kaya
    ctx.fillStyle = 'rgba(30,34,44,0.9)';
    ctx.beginPath(); ctx.ellipse(s.x, s.y - 2 * z, r * 1.0, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();

    // can barı + ad
    const bw = 64 * z, bh = 6 * z, by = s.y - h - 16 * z;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(s.x - bw / 2, by, bw, bh);
    ctx.fillStyle = a.color;
    ctx.fillRect(s.x - bw / 2, by, bw * U.clamp(a.hp / a.maxHp, 0, 1), bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1;
    ctx.strokeRect(s.x - bw / 2, by, bw, bh);
    ctx.font = `700 ${11 * z}px Barlow, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(232,224,205,0.92)';
    ctx.fillText(`${a.name} · Lv${a.level}`, s.x, by - 4 * z);
    if (a.wavesLeft > 0) {
      ctx.font = `600 ${9.5 * z}px Barlow, system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,180,90,0.8)';
      ctx.fillText(`${a.wavesLeft} dalga kaldı`, s.x, by + bh + 10 * z);
    }
  }

  drawPortal(p) {
    const ctx = this.ctx, z = this.cam.zoom;
    const s = this.worldToScreen(p.x, p.y);
    const t = performance.now() / 1000;
    const r = p.r * TW * 0.45 * z;
    ctx.save();
    ctx.globalAlpha = 0.75 + Math.sin(t * 3) * 0.2;
    const grd = ctx.createRadialGradient(s.x, s.y - r * 0.6, 2, s.x, s.y - r * 0.6, r * 1.6);
    grd.addColorStop(0, this.alpha(p.color, 0.95));
    grd.addColorStop(1, this.alpha(p.color, 0));
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.ellipse(s.x, s.y - r * 0.6, r * 1.5, r * 1.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.strokeStyle = p.color; ctx.lineWidth = 2.5 * z;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, r, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();

    ctx.font = `700 ${12 * z}px Barlow, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8e0cd';
    ctx.fillText(p.label, s.x, s.y - r * 2.1);
  }

  drawNpc(n) {
    const ctx = this.ctx, z = this.cam.zoom;
    const s = this.worldToScreen(n.x, n.y);
    const colors = { market: '#e8c04a', craft: '#c9723a', quest: '#7fc4ff', storage: '#9fe0a0' };
    const c = colors[n.kind] || '#fff';
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(s.x, s.y, 13 * z, 6 * z, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = this.shade(c, 0.75);
    ctx.beginPath();
    ctx.moveTo(s.x - 9 * z, s.y); ctx.lineTo(s.x - 6 * z, s.y - 26 * z);
    ctx.lineTo(s.x + 6 * z, s.y - 26 * z); ctx.lineTo(s.x + 9 * z, s.y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f0e0c8';
    ctx.beginPath(); ctx.arc(s.x, s.y - 32 * z, 6 * z, 0, Math.PI * 2); ctx.fill();
    ctx.font = `600 ${11 * z}px Barlow, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = c;
    ctx.fillText('❖ ' + n.name, s.x, s.y - 44 * z);
  }

  drawActor(a) {
    if (a.kind === 'stone') return this.drawOre(a);
    const ctx = this.ctx, z = this.cam.zoom;
    const s = this.worldToScreen(a.x, a.y);
    const scale = a.size * z;
    const bodyH = 34 * scale;

    // gölge
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(s.x, s.y, 15 * scale, 7 * scale, 0, 0, Math.PI * 2); ctx.fill();

    if (a.dead) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = a.color;
      ctx.beginPath(); ctx.ellipse(s.x, s.y - 3 * scale, 15 * scale, 6 * scale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }

    // ekran açısına dönüştürülmüş yön
    const fdx = Math.cos(a.facing), fdy = Math.sin(a.facing);
    const sang = Math.atan2((fdx + fdy) * (TH / 2), (fdx - fdy) * (TW / 2));
    const bob = Math.sin(a.animTime * 9) * (a.busy > 0 ? 0 : 1.2) * scale;

    // element aurası
    const race = a.element === 'ates' ? GameData.RACES.ates : GameData.RACES.su;
    if (a.team === 'player' || a.cls) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      const g = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, 26 * scale);
      g.addColorStop(0, race.colors.aura); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, 26 * scale, 13 * scale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    const hit = a.hitFlash > 0;
    const main = hit ? '#ffffff' : a.color;

    // bacaklar
    ctx.strokeStyle = this.shade(main, 0.5);
    ctx.lineWidth = 4.5 * scale; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.x - 4 * scale, s.y - 10 * scale); ctx.lineTo(s.x - 5 * scale, s.y - 1 * scale);
    ctx.moveTo(s.x + 4 * scale, s.y - 10 * scale); ctx.lineTo(s.x + 5 * scale, s.y - 1 * scale);
    ctx.stroke();

    // gövde
    const ty = s.y - bodyH + bob;
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.moveTo(s.x - 9 * scale, s.y - 9 * scale);
    ctx.lineTo(s.x - 7.5 * scale, ty + 6 * scale);
    ctx.lineTo(s.x + 7.5 * scale, ty + 6 * scale);
    ctx.lineTo(s.x + 9 * scale, s.y - 9 * scale);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = this.alpha('#000', 0.18);
    ctx.beginPath();
    ctx.moveTo(s.x + 1 * scale, s.y - 9 * scale);
    ctx.lineTo(s.x + 1 * scale, ty + 6 * scale);
    ctx.lineTo(s.x + 7.5 * scale, ty + 6 * scale);
    ctx.lineTo(s.x + 9 * scale, s.y - 9 * scale);
    ctx.closePath(); ctx.fill();

    // kafa
    ctx.fillStyle = hit ? '#fff' : this.shade(main, 1.35);
    ctx.beginPath(); ctx.arc(s.x, ty - 2 * scale, 7 * scale, 0, Math.PI * 2); ctx.fill();

    // silah / sınıf işareti
    let swing = a.busy > 0 ? Math.sin((0.35 - Math.max(0, a.busy)) / 0.35 * Math.PI) : 0;
    let spinExtra = 0;
    if (a.swingT > 0 && a.swingDur > 0) {
      const t = 1 - U.clamp(a.swingT / a.swingDur, 0, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      if (a.swingSpin) { spinExtra = ease * Math.PI * 2; swing = 1; }        // 360° dönüş
      else swing = (a.swingStep === 1 ? -1 : 1) * (1 - Math.abs(ease - 0.5) * 2) * 1.6;
    }
    const wx = s.x + Math.cos(sang) * 13 * scale;
    const wy = ty + 6 * scale + Math.sin(sang) * 7 * scale;
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(sang + swing * 1.5 - 0.6 + spinExtra);
    const cls = a.cls || (a.tier ? 'monster' : 'savasci');
    if (cls === 'okcu') {
      ctx.strokeStyle = '#c9a06a'; ctx.lineWidth = 3 * scale;
      ctx.beginPath(); ctx.arc(0, 0, 11 * scale, -1.1, 1.1); ctx.stroke();
      ctx.strokeStyle = this.alpha('#fff', 0.6); ctx.lineWidth = 1.2 * scale;
      ctx.beginPath(); ctx.moveTo(5 * scale, -9.5 * scale); ctx.lineTo(5 * scale, 9.5 * scale); ctx.stroke();
    } else if (cls === 'buyucu') {
      ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 3.5 * scale;
      ctx.beginPath(); ctx.moveTo(-4 * scale, 10 * scale); ctx.lineTo(2 * scale, -12 * scale); ctx.stroke();
      ctx.fillStyle = race.colors.primary;
      ctx.beginPath(); ctx.arc(2.5 * scale, -14 * scale, 4.5 * scale, 0, Math.PI * 2); ctx.fill();
    } else if (cls === 'savasci') {
      ctx.strokeStyle = '#dfe4ee'; ctx.lineWidth = 4 * scale;
      ctx.beginPath(); ctx.moveTo(-3 * scale, 6 * scale); ctx.lineTo(16 * scale, -8 * scale); ctx.stroke();
      ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 4.5 * scale;
      ctx.beginPath(); ctx.moveTo(-6 * scale, 9 * scale); ctx.lineTo(-2 * scale, 6 * scale); ctx.stroke();
    } else {
      ctx.fillStyle = this.shade(main, 0.7);
      ctx.beginPath(); ctx.ellipse(0, 0, 7 * scale, 4 * scale, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // durum efektleri
    if (a.effects.length) {
      let ox = -((a.effects.length - 1) * 5 * scale) / 2;
      for (const e of a.effects) {
        const col = e.type === 'burn' ? '#ff7a2f' : e.type === 'slow' ? '#4fd6ff'
          : e.type === 'stun' ? '#ffd15c' : '#9fe0a0';
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(s.x + ox, ty - 16 * scale, 2.6 * scale, 0, Math.PI * 2); ctx.fill();
        ox += 5 * scale;
      }
    }

    // HP barı (oyuncu hariç, üstte DOM barı var)
    if (a.team !== 'player') this.drawHpBar(a, s, scale, ty);
  }

  drawHpBar(a, s, scale, ty) {
    const ctx = this.ctx;
    const w = (a.tier === 'boss' ? 60 : 34) * scale;
    const h = 5 * scale;
    const x = s.x - w / 2, y = ty - 26 * scale;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    const ratio = U.clamp(a.hp / a.maxHp, 0, 1);
    ctx.fillStyle = a.tier === 'boss' ? '#ff4d6d' : (a.cls ? '#ff8a5c' : '#8fd45c');
    ctx.fillRect(x, y, w * ratio, h);
    ctx.font = `600 ${9.5 * scale}px Barlow, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(232,224,205,0.9)';
    ctx.fillText(`${a.name} · Lv${a.level}`, s.x, y - 4 * scale);
  }

  drawProjectile(p) {
    const ctx = this.ctx, z = this.cam.zoom;
    const s = this.worldToScreen(p.x, p.y);
    const r = p.size * TW * 0.4 * z;
    ctx.save();
    const g = ctx.createRadialGradient(s.x, s.y - 16 * z, 1, s.x, s.y - 16 * z, r * 2.2);
    g.addColorStop(0, p.color); g.addColorStop(1, this.alpha(p.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(s.x, s.y - 16 * z, r * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(s.x, s.y - 16 * z, r * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  drawAreaMarker(a) {
    const ctx = this.ctx, z = this.cam.zoom;
    const s = this.worldToScreen(a.x, a.y);
    const rx = a.radius * TW * 0.5 * z, ry = a.radius * TH * 0.5 * z;
    ctx.save();
    ctx.globalAlpha = 0.22 + Math.sin(performance.now() / 90) * 0.05;
    ctx.fillStyle = a.color;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = a.color; ctx.lineWidth = 2 * z;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  drawRing(r) {
    const ctx = this.ctx, z = this.cam.zoom;
    const s = this.worldToScreen(r.x, r.y);
    ctx.save();
    ctx.globalAlpha = U.clamp(r.life / r.total, 0, 1) * 0.8;
    ctx.strokeStyle = r.color; ctx.lineWidth = 3 * z;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, r.r * TW * 0.5 * z, r.r * TH * 0.5 * z, 0, 0, Math.PI * 2);
    ctx.stroke(); ctx.restore();
  }

  drawArc(a) {
    const ctx = this.ctx, z = this.cam.zoom;
    const s = this.worldToScreen(a.x, a.y);
    const fdx = Math.cos(a.angle), fdy = Math.sin(a.angle);
    const sang = Math.atan2((fdx + fdy) * (TH / 2), (fdx - fdy) * (TW / 2));
    ctx.save();
    ctx.globalAlpha = U.clamp(a.life / a.total, 0, 1) * 0.75;
    ctx.translate(s.x, s.y - 16 * z);
    ctx.scale(1, TH / TW);
    ctx.rotate(sang);
    ctx.strokeStyle = a.color; ctx.lineWidth = 7 * z;
    ctx.beginPath(); ctx.arc(0, 0, a.radius * TW * 0.5 * z, -0.7, 0.7); ctx.stroke();
    ctx.restore();
  }

  /* Süpüren kılıç izi — Metin2 savaşçısının vuruş hissi */
  drawSwing(sw) {
    const ctx = this.ctx, z = this.cam.zoom;
    const s = this.worldToScreen(sw.x, sw.y);
    const fdx = Math.cos(sw.angle), fdy = Math.sin(sw.angle);
    const sang = Math.atan2((fdx + fdy) * (TH / 2), (fdx - fdy) * (TW / 2));
    const t = 1 - U.clamp(sw.life / sw.total, 0, 1);        // 0 → 1 ilerleme
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const head = sw.from + (sw.to - sw.from) * ease;         // kılıcın ucu
    const tail = sw.from + (sw.to - sw.from) * Math.max(0, ease - 0.42);
    const R = sw.radius * TW * 0.5 * z;

    ctx.save();
    ctx.translate(s.x, s.y - 16 * z);
    ctx.scale(1, TH / TW);
    ctx.rotate(sang);
    ctx.globalCompositeOperation = 'lighter';

    // iz (kuyruktan başa doğru solan şerit)
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const a0 = tail + (head - tail) * (i / steps);
      const a1 = tail + (head - tail) * ((i + 1) / steps);
      ctx.globalAlpha = (0.10 + 0.55 * (i / steps)) * U.clamp(sw.life / sw.total + 0.35, 0, 1);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = (sw.width * (0.45 + 0.55 * (i / steps))) * z;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, R, Math.min(a0, a1), Math.max(a0, a1));
      ctx.stroke();
    }
    // kılıcın ucundaki parlama
    ctx.globalAlpha = 0.9 * U.clamp(sw.life / sw.total, 0, 1);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(Math.cos(head) * R, Math.sin(head) * R, 3.2 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawParticles(parts) {
    const ctx = this.ctx, z = this.cam.zoom;
    for (const p of parts) {
      const s = this.worldToScreen(p.x, p.y);
      ctx.save();
      ctx.globalAlpha = U.clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y - p.z * 18 * z, p.size * z, 0, Math.PI * 2);
      ctx.fill(); ctx.restore();
    }
  }

  drawNumbers(nums) {
    const ctx = this.ctx, z = this.cam.zoom;
    ctx.textAlign = 'center';
    for (const n of nums) {
      const s = this.worldToScreen(n.x, n.y);
      const t = 1 - n.life;
      const y = s.y - 40 * z - t * 34 * z;
      ctx.save();
      ctx.globalAlpha = U.clamp(n.life * 1.4, 0, 1);
      let color = '#f2eee0', size = 15, text = U.fmt(n.value);
      if (n.crit) { color = '#ffd15c'; size = 22; text = U.fmt(n.value) + '!'; }
      if (n.heal) { color = '#8fd45c'; text = '+' + U.fmt(n.value); }
      if (n.burn) { color = '#ff8a4a'; size = 12; }
      if (n.xp) { color = '#7fc4ff'; text = '+' + U.fmt(n.value) + ' XP'; }
      if (n.mana) { color = '#6ba8ff'; text = '+' + U.fmt(n.value) + ' MP'; }
      ctx.font = `800 ${size * z}px Barlow, system-ui, sans-serif`;
      ctx.lineWidth = 3 * z; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(text, s.x, y); ctx.fillStyle = color;
      ctx.fillText(text, s.x, y);
      if (n.crit) {
        ctx.font = `700 ${9 * z}px Barlow, system-ui, sans-serif`;
        ctx.fillStyle = '#ffd15c';
        ctx.fillText('CRITICAL', s.x, y - 16 * z);
      }
      if (n.pen) {
        ctx.font = `700 ${9 * z}px Barlow, system-ui, sans-serif`;
        ctx.fillStyle = '#ff9ad0';
        ctx.fillText('PENETRATE', s.x, y + 12 * z);
      }
      ctx.restore();
    }
  }

  drawMinimap() {
    if (!this.mctx) return;
    const g = this.game, w = g.world, ctx = this.mctx;
    const size = this.mini.width;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(8,11,20,0.85)';
    ctx.fillRect(0, 0, size, size);
    const sc = size / Math.max(w.w, w.h);
    ctx.fillStyle = 'rgba(120,140,180,0.25)';
    for (const o of w.obstacles) ctx.fillRect(o.x * sc - 1, o.y * sc - 1, 2.5, 2.5);
    for (const p of w.portals) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x * sc - 2, p.y * sc - 2, 4, 4);
    }
    for (const a of g.actors) {
      if (a.dead) continue;
      ctx.fillStyle = a.team === 'player' ? '#ffd15c' : (a.tier === 'boss' ? '#ff4d6d' : '#ff8a5c');
      ctx.fillRect(a.x * sc - 1.5, a.y * sc - 1.5, 3, 3);
    }
  }

  /* renk yardımcıları */
  shade(hex, f) {
    const c = hex.replace('#', '');
    const n = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = U.clamp(Math.round(r * f), 0, 255);
    g = U.clamp(Math.round(g * f), 0, 255);
    b = U.clamp(Math.round(b * f), 0, 255);
    return `rgb(${r},${g},${b})`;
  }
  alpha(hex, a) {
    if (hex.startsWith('rgb')) return hex.replace('rgb(', 'rgba(').replace(')', `,${a})`);
    const c = hex.replace('#', '');
    const n = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
}
