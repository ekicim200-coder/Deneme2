/* =============================================================
   main.js — Açılış: karakter oluşturma, kayıttan devam, oyunu başlat
   ============================================================= */

const Boot = {
  race: 'su',
  cls: 'savasci',
  game: null,

  init() {
    this.game = new Game();
    this.buildRaces();
    this.buildClasses();
    this.updatePreview();

    const cont = document.getElementById('continue-box');
    const saved = this.game.loadSave();
    if (saved) {
      cont.classList.remove('hidden');
      cont.innerHTML = `
        <div>
          <span class="dim">Kayıtlı karakter</span>
          <h3>${saved.name} · Lv ${saved.level}</h3>
          <p class="dim">${GameData.RACES[saved.race].name} · ${GameData.CLASSES[saved.cls].name} · ${U.fmt(saved.gold)} altın</p>
        </div>
        <button class="btn primary" id="btn-continue">Devam et</button>`;
      document.getElementById('btn-continue').addEventListener('click', () => this.launch(saved));
    }

    document.getElementById('btn-start').addEventListener('click', () => {
      const name = document.getElementById('char-name').value.trim() || 'Gezgin';
      if (saved && !confirm('Yeni karakter mevcut kaydın üzerine yazılır. Devam edilsin mi?')) return;
      this.launch(Game.emptySave(name, this.race, this.cls));
    });

    document.getElementById('char-name').addEventListener('input', () => this.updatePreview());
  },

  buildRaces() {
    const box = document.getElementById('race-list');
    box.innerHTML = Object.values(GameData.RACES).map(r => `
      <button class="pick race ${r.id === this.race ? 'on' : ''}" data-race="${r.id}" style="--c:${r.colors.primary}">
        <span class="glyph">${r.id === 'su' ? '❄' : '🜂'}</span>
        <h3>${r.name}</h3>
        <p>${r.desc}</p>
        <span class="bonus">${r.bonusText}</span>
        ${r.passive ? `<span class="bonus passive"><b>Pasif · ${r.passive.name}:</b> ${r.passive.text}</span>` : ''}
      </button>`).join('');
    box.querySelectorAll('[data-race]').forEach(b => b.addEventListener('click', () => {
      this.race = b.dataset.race;
      box.querySelectorAll('.pick').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      this.buildClasses();
      this.updatePreview();
    }));
  },

  buildClasses() {
    const box = document.getElementById('class-list');
    box.innerHTML = Object.values(GameData.CLASSES).map(c => {
      const skills = c.skills.map(id => GameData.SKILLS[id].name[this.race]).join(' · ');
      return `<button class="pick cls ${c.id === this.cls ? 'on' : ''}" data-cls="${c.id}" style="--c:${GameData.RACES[this.race].colors.primary}">
        <h3>${c.name}</h3>
        <p class="role">${c.role}</p>
        <p>${c.desc}</p>
        <span class="bonus">${skills}</span>
      </button>`;
    }).join('');
    box.querySelectorAll('[data-cls]').forEach(b => b.addEventListener('click', () => {
      this.cls = b.dataset.cls;
      box.querySelectorAll('.pick').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      this.updatePreview();
    }));
  },

  updatePreview() {
    const fake = { race: this.race, cls: this.cls, level: 1, alloc: {}, equipment: {} };
    const s = StatSystem.compute(fake);
    const rows = [
      ['Can', U.fmt(s.maxHp)], ['Saldırı', U.fmt(s.attack)], ['Büyü', U.fmt(s.magic)],
      ['Savunma', U.fmt(s.defense)], ['Saldırı Hızı', s.attackSpeed.toFixed(2)],
      ['Koşu Hızı', s.moveSpeed.toFixed(1)], ['Kritik', (s.critChance * 100).toFixed(1) + '%'],
      ['Menzil', s.range.toFixed(1)]
    ];
    document.getElementById('preview').innerHTML = `
      <h4>Başlangıç statları</h4>
      <div class="pv-stats">${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
    document.documentElement.style.setProperty('--accent', GameData.RACES[this.race].colors.primary);
  },

  launch(save) {
    document.getElementById('screen-create').classList.add('hidden');
    document.getElementById('screen-game').classList.remove('hidden');
    document.documentElement.style.setProperty('--accent', GameData.RACES[save.race].colors.primary);
    // canvas boyutu görünür olduktan sonra hesaplanmalı
    requestAnimationFrame(() => this.game.start(save));
  }
};

window.addEventListener('DOMContentLoaded', () => Boot.init());
