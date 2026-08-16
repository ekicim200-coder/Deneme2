/* =============================================================
   input.js — Klavye, fare ve dokunmatik kontrol
   Ekran yönü → izometrik dünya yönüne çevrilir.
   ============================================================= */

const Input = {
  keys: {},
  mouse: { x: 0, y: 0, down: false, inside: false },
  joy: { active: false, dx: 0, dy: 0, id: null },
  attackHeld: false,
  touch: false,          // dokunmatik cihaz mı (otomatik nişan için)

  init(game) {
    this.game = game;
    const cv = game.canvas;
    this.touch = window.matchMedia
      ? window.matchMedia('(pointer: coarse)').matches
      : ('ontouchstart' in window);
    document.body.classList.toggle('is-touch', this.touch);

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      this.keys[k] = true;
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();

      if (k === 'escape') { if (UI.panel) UI.closePanel(); return; }
      if (UI.panel) return;

      if (k === '1') game.castSkill(0);
      if (k === '2') game.castSkill(1);
      if (k === '3') game.castSkill(2);
      if (k === '4') game.castSkill(3);
      if (k === 'q') game.usePotion('kucuk');
      if (k === 'r') game.usePotion('buyuk');
      if (k === 'f') game.usePotion('mana');
      if (k === 'v') game.toggleAutoPotion();
      if (k === 'shift') game.dash();
      if (k === 'e') game.interact();
      if (k === 'c') UI.openPanel('char');
      if (k === 'i') UI.openPanel('inventory');
      if (k === 'm') UI.openPanel('age');
      if (k === 'k') UI.openPanel('quest');
      if (k === 'y') UI.openPanel('skills');
      if (k === 'h') UI.openPanel('help');
    });

    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.attackHeld = false; });

    cv.addEventListener('mousemove', (e) => {
      const r = cv.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      this.mouse.inside = true;
    });
    cv.addEventListener('mousedown', (e) => { if (e.button === 0) this.attackHeld = true; });
    window.addEventListener('mouseup', () => { this.attackHeld = false; });
    cv.addEventListener('contextmenu', e => e.preventDefault());

    /* ---- Dokunmatik: sol joystick, sağ tarafa dokunma = saldırı ---- */
    const joy = document.getElementById('joystick');
    const knob = document.getElementById('joy-knob');
    if (joy) {
      const start = (t) => {
        this.joy.active = true; this.joy.id = t.identifier;
        this.joyOrigin = { x: t.clientX, y: t.clientY };
      };
      const move = (t) => {
        const dx = t.clientX - this.joyOrigin.x, dy = t.clientY - this.joyOrigin.y;
        const d = Math.min(46, Math.hypot(dx, dy));
        const a = Math.atan2(dy, dx);
        this.joy.dx = Math.cos(a) * (d / 46);
        this.joy.dy = Math.sin(a) * (d / 46);
        knob.style.transform = `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px)`;
      };
      const end = () => {
        this.joy.active = false; this.joy.dx = 0; this.joy.dy = 0; this.joy.id = null;
        knob.style.transform = 'translate(0,0)';
      };
      joy.addEventListener('touchstart', e => { e.preventDefault(); start(e.changedTouches[0]); }, { passive: false });
      joy.addEventListener('touchmove', e => {
        e.preventDefault();
        for (const t of e.changedTouches) if (t.identifier === this.joy.id) move(t);
      }, { passive: false });
      joy.addEventListener('touchend', e => { e.preventDefault(); end(); }, { passive: false });
      joy.addEventListener('touchcancel', () => end());
    }

    /* Ekrana dokunma = o yöne nişan al (saldırı ayrı butonda) */
    cv.addEventListener('touchstart', (e) => {
      const r = cv.getBoundingClientRect();
      const t = e.changedTouches[0];
      this.mouse.x = t.clientX - r.left;
      this.mouse.y = t.clientY - r.top;
      this.mouse.inside = true;
      this.aimHold = 1.2;                 // 1.2 sn boyunca bu yöne nişan
    }, { passive: true });

    /* ---- Mobil aksiyon tuşları ---- */
    const hold = (id, onDown, onUp) => {
      const el = document.getElementById(id);
      if (!el) return;
      const down = (e) => { e.preventDefault(); onDown(); };
      const up = (e) => { if (e) e.preventDefault(); if (onUp) onUp(); };
      el.addEventListener('touchstart', down, { passive: false });
      el.addEventListener('touchend', up, { passive: false });
      el.addEventListener('touchcancel', up, { passive: false });
      el.addEventListener('mousedown', down);
      el.addEventListener('mouseup', up);
      el.addEventListener('mouseleave', () => { if (onUp) onUp(); });
    };
    // basılı tut → kombo devam eder
    hold('tb-attack', () => { this.attackHeld = true; }, () => { this.attackHeld = false; });
    hold('tb-dash', () => game.dash());
    hold('tb-interact', () => game.interact());

    // mobil menü aç/kapat
    const mt = document.getElementById('menu-toggle');
    if (mt) mt.addEventListener('click', () => document.body.classList.toggle('menu-open'));
  },

  /* Dokunmatikte otomatik hedefleme: en yakın düşmana dön */
  autoAimTarget(game, maxDist = 11) {
    let best = null, bd = maxDist;
    for (const a of game.actors) {
      if (a.dead || a.team === 'player' || a === game.player) continue;
      const d = U.dist(game.player.x, game.player.y, a.x, a.y);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  },

  /* Ekran yönünü izometrik dünya yönüne çevirir */
  moveVector() {
    let sx = 0, sy = 0;
    if (this.keys['w'] || this.keys['arrowup']) sy -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) sy += 1;
    if (this.keys['a'] || this.keys['arrowleft']) sx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) sx += 1;
    if (this.joy.active) { sx += this.joy.dx; sy += this.joy.dy; }
    if (sx === 0 && sy === 0) return { x: 0, y: 0 };

    // ekran sağı = dünya (+1,-1), ekran aşağısı = dünya (+1,+1)
    const wx = (sx + sy) / Math.SQRT2;
    const wy = (sy - sx) / Math.SQRT2;
    const len = Math.hypot(wx, wy) || 1;
    return { x: wx / len, y: wy / len };
  },

  aimWorld(renderer, player) {
    if (this.mouse.inside) return renderer.screenToWorld(this.mouse.x, this.mouse.y);
    return { x: player.x + Math.cos(player.facing) * 3, y: player.y + Math.sin(player.facing) * 3 };
  }
};
