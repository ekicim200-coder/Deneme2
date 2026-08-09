/* =============================================================
   ui.js — HUD, paneller, envanter, market, craft, görev, çağ, PvP
   ============================================================= */

const UI = {
  game: null,
  panel: null,
  selected: null,
  marketStock: [],

  init(game) {
    this.game = game;
    this.el = {
      hud: document.getElementById('hud'),
      hpFill: document.getElementById('hp-fill'),
      hpText: document.getElementById('hp-text'),
      xpFill: document.getElementById('xp-fill'),
      xpText: document.getElementById('xp-text'),
      manaFill: document.getElementById('mana-fill'),
      pName: document.getElementById('p-name'),
      pLevel: document.getElementById('p-level'),
      pClass: document.getElementById('p-class'),
      gold: document.getElementById('res-gold'),
      mats: document.getElementById('res-mats'),
      age: document.getElementById('res-age'),
      zone: document.getElementById('zone-name'),
      skillbar: document.getElementById('skillbar'),
      quest: document.getElementById('quest-tracker'),
      boss: document.getElementById('boss-bar'),
      pvp: document.getElementById('pvp-bar'),
      toasts: document.getElementById('toasts'),
      modalLayer: document.getElementById('modal-layer'),
      modal: document.getElementById('modal'),
      statDot: document.getElementById('statpoint-dot'),
      interact: document.getElementById('interact-hint')
    };

    document.querySelectorAll('[data-panel]').forEach(b => {
      b.addEventListener('click', () => this.openPanel(b.dataset.panel));
    });
    this.el.modalLayer.addEventListener('click', (e) => {
      if (e.target === this.el.modalLayer) this.closePanel();
    });
    this.buildSkillbar();
  },

  /* ---------------- Toast ---------------- */
  toast(msg, type = 'info') {
    const d = document.createElement('div');
    d.className = 'toast toast-' + type;
    d.textContent = msg;
    this.el.toasts.appendChild(d);
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, 2600);
  },

  /* ---------------- HUD ---------------- */
  refreshHud() {
    const g = this.game, s = g.save, p = g.player;
    if (!p) return;
    const hpR = U.clamp(p.hp / p.maxHp, 0, 1);
    this.el.hpFill.style.width = (hpR * 100) + '%';
    this.el.hpText.textContent = `${U.fmt(Math.max(0, p.hp))} / ${U.fmt(p.maxHp)}`;
    const need = StatSystem.xpNeed(s.level);
    this.el.xpFill.style.width = U.clamp(s.xp / need, 0, 1) * 100 + '%';
    this.el.xpText.textContent = `${U.fmt(s.xp)} / ${U.fmt(need)} XP`;
    this.el.manaFill.style.width = U.clamp(p.mana / GameData.BALANCE.manaMax, 0, 1) * 100 + '%';
    this.el.pName.textContent = s.name;
    this.el.pLevel.textContent = 'Lv ' + s.level;
    this.el.pClass.textContent = `${GameData.RACES[s.race].name} · ${GameData.CLASSES[s.cls].name}`;
    this.el.gold.textContent = U.fmt(s.gold);
    this.el.mats.textContent = U.fmt(Object.values(s.mats).reduce((a, b) => a + b, 0));
    this.el.age.textContent = GameData.AGES.find(a => a.id === s.age).name;
    this.el.zone.textContent = g.world.name || g.world.def.name;
    this.el.statDot.classList.toggle('hidden', s.statPoints <= 0);
    this.el.statDot.textContent = s.statPoints;
  },

  refreshSkillCooldowns() {
    const p = this.game.player;
    if (!p) return;
    for (let i = 0; i < 4; i++) {
      const el = document.getElementById('skill-' + i);
      if (!el) continue;
      const skId = GameData.CLASSES[p.cls].skills[i];
      const sk = GameData.SKILLS[skId];
      const r = U.clamp(p.skillCd[i] / sk.cd, 0, 1);
      el.querySelector('.cd').style.height = (r * 100) + '%';
      el.querySelector('.cd-text').textContent = p.skillCd[i] > 0 ? Math.ceil(p.skillCd[i]) : '';
      el.classList.toggle('nomana', p.mana < sk.mana);
    }
    const dash = document.getElementById('btn-dash');
    if (dash) dash.querySelector('.cd').style.height =
      U.clamp(p.dashCd / GameData.BALANCE.dashCd, 0, 1) * 100 + '%';
    const s = this.game.save;
    for (const pot of Object.values(GameData.POTIONS)) {
      const el = document.getElementById('btn-pot-' + pot.id);
      if (!el) continue;
      el.querySelector('.cd').style.height = U.clamp((p.potionCds[pot.id] || 0) / pot.cd, 0, 1) * 100 + '%';
      el.querySelector('.count').textContent = s.potions[pot.id] || 0;
      el.classList.toggle('empty', (s.potions[pot.id] || 0) <= 0);
    }
    const auto = document.getElementById('btn-auto');
    if (auto) {
      auto.classList.toggle('on', !!s.autoPotion);
      auto.querySelector('.count').textContent = s.autoPotion ? 'AÇIK' : 'KAPALI';
    }
    // kombo göstergesi solar
    const ci = document.getElementById('combo-ind');
    if (ci && p.comboTimer <= 0) ci.classList.add('hidden');
  },

  buildSkillbar() {
    const g = this.game, s = g.save;
    const skills = GameData.CLASSES[s.cls].skills;
    let html = '';
    skills.forEach((id, i) => {
      const sk = GameData.SKILLS[id];
      const info = Skills.info(id, s.race, s.cls, null);
      const tip = `${info.name} — ${info.typeName}\n${info.how}\n` +
        info.rows.map(([k, v]) => `${k}: ${v}`).join('\n') +
        (info.effects.length ? '\n' + info.effects.join('\n') : '');
      html += `<button class="skill" id="skill-${i}" data-skill="${i}" title="${tip.replace(/"/g, '&quot;')}">
        <span class="key">${i + 1}</span>
        <span class="sname">${sk.name[s.race]}</span>
        <span class="mana">${sk.mana}</span>
        <span class="cd"></span><span class="cd-text"></span>
      </button>`;
    });
    html += `<button class="skill util" id="btn-dash"><span class="key">Shift</span><span class="sname">Sıçra</span><span class="cd"></span><span class="cd-text"></span></button>`;
    for (const pot of Object.values(GameData.POTIONS)) {
      html += `<button class="skill util pot" id="btn-pot-${pot.id}" data-pot="${pot.id}" title="${pot.name}" style="--pot:${pot.color}">
        <span class="key">${pot.key}</span><span class="sname">${pot.mana ? 'Mana' : pot.heal >= 0.5 ? 'Büyük' : 'Küçük'}</span>
        <span class="count">0</span><span class="cd"></span><span class="cd-text"></span></button>`;
    }
    html += `<button class="skill util auto" id="btn-auto" title="Otomatik iksir (V)"><span class="key">V</span><span class="sname">Oto</span><span class="count">—</span></button>`;
    this.el.skillbar.innerHTML = html;
    this.el.skillbar.querySelectorAll('[data-skill]').forEach(b => {
      b.addEventListener('click', () => this.game.castSkill(+b.dataset.skill));
    });
    document.getElementById('btn-dash').addEventListener('click', () => this.game.dash());
    this.el.skillbar.querySelectorAll('[data-pot]').forEach(b => {
      b.addEventListener('click', () => this.game.usePotion(b.dataset.pot));
    });
    document.getElementById('btn-auto').addEventListener('click', () => this.game.toggleAutoPotion());
  },

  /* Kombo göstergesi — basılı tutunca 1 → 2 → BİTİRİCİ */
  setCombo(step, finisher) {
    const el = document.getElementById('combo-ind');
    if (!el) return;
    el.classList.remove('hidden');
    el.classList.toggle('finish', !!finisher);
    el.innerHTML = finisher
      ? `<b>BİTİRİCİ!</b><span>x${step} kombo</span>`
      : `<b>x${step}</b><span>kombo</span>`;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  },

  setBossBar(boss) {
    if (!boss) { this.el.boss.classList.add('hidden'); return; }
    this.el.boss.classList.remove('hidden');
    const r = U.clamp(boss.hp / boss.maxHp, 0, 1) * 100;
    this.el.boss.innerHTML = `
      <div class="bb-name">${boss.name} <span>Lv ${boss.level} · ${boss.phase.name}</span></div>
      <div class="bar big"><div class="fill boss" style="width:${r}%"></div></div>`;
  },

  setPvpBar(player, enemy, time) {
    if (!enemy) { this.el.pvp.classList.add('hidden'); return; }
    this.el.pvp.classList.remove('hidden');
    const a = U.clamp(player.hp / player.maxHp, 0, 1) * 100;
    const b = U.clamp(enemy.hp / enemy.maxHp, 0, 1) * 100;
    this.el.pvp.innerHTML = `
      <div class="pvp-side">
        <div class="pn">${player.name}</div>
        <div class="bar"><div class="fill ally" style="width:${a}%"></div></div>
      </div>
      <div class="pvp-timer">${Math.max(0, Math.ceil(time))}<span>VS</span></div>
      <div class="pvp-side right">
        <div class="pn">${enemy.name}</div>
        <div class="bar"><div class="fill foe" style="width:${b}%"></div></div>
      </div>`;
  },

  showInteract(text) {
    if (!text) { this.el.interact.classList.add('hidden'); return; }
    this.el.interact.classList.remove('hidden');
    this.el.interact.innerHTML = `<b>E</b> ${text}`;
  },

  refreshQuestTracker() {
    const qs = this.game.save.quests;
    if (!qs.length) { this.el.quest.innerHTML = '<div class="qt-empty">Görev Ustası Arin\'den görev al</div>'; return; }
    this.el.quest.innerHTML = qs.map(q => {
      const done = q.progress >= q.target;
      return `<div class="qt ${done ? 'done' : ''}">
        <span class="qt-text">${q.text}</span>
        <span class="qt-num">${Math.min(q.progress, q.target)}/${q.target}</span>
      </div>`;
    }).join('');
  },

  /* ---------------- Panel yönetimi ---------------- */
  openPanel(name) {
    this.panel = name;
    this.game.paused = true;
    this.el.modalLayer.classList.remove('hidden');
    this.render();
  },

  closePanel() {
    this.panel = null;
    this.selected = null;
    this.game.paused = false;
    this.el.modalLayer.classList.add('hidden');
    this.el.modal.innerHTML = '';
  },

  render() {
    const map = {
      char: () => this.renderChar(),
      inventory: () => this.renderInventory(),
      market: () => this.renderMarket(),
      craft: () => this.renderCraft(),
      quest: () => this.renderQuests(),
      age: () => this.renderAges(),
      pvp: () => this.renderPvp(),
      skills: () => this.renderSkills(),
      help: () => this.renderHelp(),
      storage: () => this.renderStorage()
    };
    if (map[this.panel]) map[this.panel]();
  },

  shell(title, body, cls = '') {
    this.el.modal.className = 'modal ' + cls;
    this.el.modal.innerHTML = `
      <header class="modal-head">
        <h2>${title}</h2>
        <button class="close" id="modal-close">✕</button>
      </header>
      <div class="modal-body">${body}</div>`;
    document.getElementById('modal-close').addEventListener('click', () => this.closePanel());
  },

  /* ---------------- Karakter / Statlar ---------------- */
  renderChar() {
    const s = this.game.save;
    const st = StatSystem.compute(s);
    const rows = [
      ['maxHp', U.fmt(st.maxHp)], ['hpRegen', st.hpRegen.toFixed(1) + '/sn'],
      ['attack', U.fmt(st.attack)], ['magic', U.fmt(st.magic)],
      ['defense', U.fmt(st.defense)], ['attackSpeed', st.attackSpeed.toFixed(2)],
      ['moveSpeed', st.moveSpeed.toFixed(1)], ['critChance', (st.critChance * 100).toFixed(1) + '%'],
      ['critDamage', (st.critDamage * 100).toFixed(0) + '%'], ['penetration', (st.penetration * 100).toFixed(1) + '%'],
      ['range', st.range.toFixed(1)], ['elementDamage', (st.elementDamage * 100).toFixed(1) + '%'],
      ['elementRes', (st.elementRes * 100).toFixed(1) + '%'],
      ['resSu', (st.resSu * 100).toFixed(1) + '%'], ['resAtes', (st.resAtes * 100).toFixed(1) + '%'],
      ['dmgBoss', (st.dmgBoss * 100).toFixed(1) + '%'], ['dmgMonster', (st.dmgMonster * 100).toFixed(1) + '%'],
      ['dmgPlayer', (st.dmgPlayer * 100).toFixed(1) + '%'], ['dmgStone', (st.dmgStone * 100).toFixed(1) + '%']
    ].map(([k, v]) => `<div class="strow"><span>${U.statName(k)}</span><b>${v}</b></div>`).join('');

    const alloc = GameData.ALLOC.map(a => {
      const pts = s.alloc[a.key] || 0;
      const cap = GameData.SOFTCAP[a.key];
      const capNote = cap ? `<i class="cap">soft-cap ${a.fmt === 'pct' ? (cap.soft * 100) + '%' : cap.soft}</i>` : '';
      return `<div class="alrow">
        <span class="alname">${a.name} ${capNote}</span>
        <span class="alpts">${pts}</span>
        <button class="mini" data-alloc="${a.key}" data-n="1" ${s.statPoints < 1 ? 'disabled' : ''}>+1</button>
        <button class="mini" data-alloc="${a.key}" data-n="5" ${s.statPoints < 5 ? 'disabled' : ''}>+5</button>
      </div>`;
    }).join('');

    const eq = GameData.SLOTS.map(sl => {
      const it = s.equipment[sl.key];
      return `<div class="eqslot ${it ? 'r-' + it.rarity : 'empty'}" data-eqslot="${sl.key}">
        <span class="eqname">${sl.name}</span>
        <b>${it ? it.name : '—'}</b>
        ${it ? `<i>Lv${it.ilvl} · ${Loot.rarityById(it.rarity).name}</i>` : ''}
      </div>`;
    }).join('');

    const power = StatSystem.power(s);

    this.shell('Karakter', `
      <div class="char-grid">
        <div class="col">
          <div class="ident">
            <div class="ident-badge" style="--c:${GameData.RACES[s.race].colors.primary}">${s.level}</div>
            <div>
              <h3>${s.name}</h3>
              <p>${GameData.RACES[s.race].name} · ${GameData.CLASSES[s.cls].name}</p>
              <p class="dim">Güç: <b>${U.fmt(power)}</b> · Çağ: ${GameData.AGES.find(a => a.id === s.age).name}</p>
            </div>
          </div>
          <div class="race-passive" style="--c:${GameData.RACES[s.race].colors.primary}">
            <b>Pasif · ${GameData.RACES[s.race].passive.name}</b>
            <span>${GameData.RACES[s.race].passive.text}</span>
          </div>
          <h4>Statlar</h4>
          <div class="stats">${rows}</div>
        </div>
        <div class="col">
          <h4>Stat Puanı Dağıt <span class="pill">${s.statPoints} puan</span></h4>
          <div class="alloc">${alloc}</div>
          <button class="btn ghost" id="btn-reset-alloc">Puanları sıfırla (500 altın)</button>
          <h4>Ekipman</h4>
          <div class="eqgrid">${eq}</div>
        </div>
      </div>`, 'wide');

    this.el.modal.querySelectorAll('[data-alloc]').forEach(b => {
      b.addEventListener('click', () => {
        const n = +b.dataset.n;
        if (s.statPoints < n) return;
        s.alloc[b.dataset.alloc] = (s.alloc[b.dataset.alloc] || 0) + n;
        s.statPoints -= n;
        this.game.player.refreshStats();
        this.game.saveGame();
        this.renderChar();
        this.refreshHud();
      });
    });
    this.el.modal.querySelectorAll('[data-eqslot]').forEach(b => {
      b.addEventListener('click', () => {
        const it = s.equipment[b.dataset.eqslot];
        if (it) this.itemPopup(it, 'equipped');
      });
    });
    document.getElementById('btn-reset-alloc').addEventListener('click', () => {
      if (s.gold < 500) return this.toast('500 altın gerekiyor', 'warn');
      s.gold -= 500;
      let back = 0;
      for (const k in s.alloc) { back += s.alloc[k]; s.alloc[k] = 0; }
      s.statPoints += back;
      this.game.player.refreshStats();
      this.game.saveGame();
      this.toast(`${back} stat puanı geri alındı`, 'good');
      this.renderChar(); this.refreshHud();
    });
  },

  /* ---------------- Yetenekler ---------------- */
  renderSkills() {
    const s = this.game.save;
    const st = StatSystem.compute(s);
    const ids = GameData.CLASSES[s.cls].skills;
    const race = GameData.RACES[s.race];

    const cards = ids.map((id, i) => {
      const info = Skills.info(id, s.race, s.cls, st);
      const rows = info.rows.map(([k, v]) => `<div class="skrow"><span>${k}</span><b>${v}</b></div>`).join('');
      const eff = info.effects.length
        ? `<ul class="skeff">${info.effects.map(e => `<li>${e}</li>`).join('')}</ul>`
        : '<p class="dim small">Ek etkisi yok.</p>';
      return `<div class="skcard" style="--c:${race.colors.primary}">
        <div class="skhead">
          <span class="skkey">${i + 1}</span>
          <div>
            <b>${info.name}</b>
            <span class="dim small">${info.typeName}</span>
          </div>
        </div>
        <p class="skhow">${info.how}</p>
        <p class="dim small">${info.desc}</p>
        <div class="skrows">${rows}</div>
        <h5>Etkiler</h5>
        ${eff}
      </div>`;
    }).join('');

    const combo = GameData.BALANCE.combo;
    this.shell('Yetenekler', `
      <div class="skills-wrap">
        <div class="skinfo" style="--c:${race.colors.primary}">
          <b>Temel saldırı — kombo</b>
          <p>Sol tıkı basılı tut: vuruşlar zincirlenir.
             1. vuruş %${Math.round(combo.mults[0] * 100)}, 2. vuruş %${Math.round(combo.mults[1] * 100)},
             3. vuruş %${Math.round(combo.mults[2] * 100)} hasar verir ve <b>çevreni 360° süpürür</b>.
             Her vuruş bir öncekinden hızlıdır; ${combo.window} saniye vurmazsan zincir başa döner.
             ${s.race === 'ates' ? 'Ateş ırkı olarak bitiricin +%25 hasar vurur.' : 'Su ırkı olarak bitiricin düşmanı yavaşlatır.'}</p>
        </div>
        <div class="skgrid">${cards}</div>
        <div class="skinfo" style="--c:${race.colors.primary}">
          <b>Pasif · ${race.passive.name}</b>
          <p>${race.passive.text}</p>
        </div>
      </div>`, 'wide');
  },

  /* ---------------- Envanter ---------------- */
  renderInventory() {
    const s = this.game.save;
    const cells = s.inventory.map((it, i) => `
      <button class="icell r-${it.rarity}" data-inv="${i}">
        <span class="ic-slot">${GameData.SLOTS.find(x => x.key === it.slot).name}</span>
        <span class="ic-name">${it.name}</span>
        <span class="ic-lv">Lv${it.ilvl}${it.enchanted ? ' <i class="ench-dot" title="Efsunlu">✦</i>' : ''}</span>
      </button>`).join('') || '<p class="dim">Envanter boş. Farm haritasında ganimet topla.</p>';

    const mats = Object.entries(s.mats).filter(([, n]) => n > 0).map(([k, n]) =>
      `<div class="mat"><i style="background:${GameData.MATERIALS[k].color}"></i>${GameData.MATERIALS[k].name}<b>${n}</b></div>`
    ).join('') || '<p class="dim">Materyal yok.</p>';

    // Üzerindeki ekipman — silah dahil, özellikleriyle birlikte
    const worn = GameData.SLOTS.map(sl => {
      const it = s.equipment[sl.key];
      if (!it) {
        return `<div class="worn empty"><span class="wslot">${sl.name}</span><b>— boş —</b></div>`;
      }
      const r = Loot.rarityById(it.rarity);
      const tier = it.tier ? Loot.tierById(it.tier) : null;
      const stats = Object.entries(it.stats).map(([k, v]) => {
        const rare = it.rareAffixes && it.rareAffixes.includes(k);
        return `<i class="${rare ? 'rare' : ''}">${U.statName(k)} <b>${U.fmtStat(k, v)}</b></i>`;
      }).join('');
      return `<div class="worn r-${it.rarity}" data-worn="${sl.key}">
        <span class="wslot">${sl.name}${it.enchanted ? ' <em class="ench-dot">✦</em>' : ''}</span>
        <b style="color:${r.color}">${it.name}</b>
        <span class="wmeta">${r.name} · Lv${it.ilvl}${tier ? ` · ${tier.name}` : ''} · güç ${U.fmt(Loot.score(it, s.cls))}</span>
        <div class="wstats">${stats}</div>
      </div>`;
    }).join('');

    this.shell(`Envanter <span class="pill">${s.inventory.length}/60</span>`, `
      <div class="inv-wrap">
        <div class="worn-box">
          <h4>Üzerindekiler <span class="dim small">— tıklayınca çıkarabilirsin</span></h4>
          <div class="worn-grid">${worn}</div>
        </div>
        <div class="icells">${cells}</div>
        <div class="matbox"><h4>Craft Materyalleri</h4>${mats}</div>
        <div class="inv-actions">
          <button class="btn ghost" id="btn-sell-junk">Common eşyaları sat</button>
          <span class="dim">Bir eşyaya tıkla: kuşan, sat veya at.</span>
        </div>
      </div>`, 'wide');

    this.el.modal.querySelectorAll('[data-inv]').forEach(b => {
      b.addEventListener('click', () => this.itemPopup(s.inventory[+b.dataset.inv], 'inventory', +b.dataset.inv));
    });
    this.el.modal.querySelectorAll('[data-worn]').forEach(b => {
      b.addEventListener('click', () => this.itemPopup(s.equipment[b.dataset.worn], 'equipped'));
    });
    document.getElementById('btn-sell-junk').addEventListener('click', () => {
      let gold = 0, n = 0;
      s.inventory = s.inventory.filter(it => {
        if (it.rarity === 'common') { gold += Loot.sellValue(it); n++; return false; }
        return true;
      });
      s.gold += gold;
      this.game.saveGame();
      this.toast(`${n} eşya satıldı · +${U.fmt(gold)} altın`, 'good');
      this.renderInventory(); this.refreshHud();
    });
  },

  itemStatsHtml(item, compareTo) {
    return Object.entries(item.stats).map(([k, v]) => {
      let diff = '';
      if (compareTo) {
        const ov = compareTo.stats[k] || 0;
        const d = v - ov;
        if (Math.abs(d) > 0.0001) {
          diff = `<i class="${d > 0 ? 'up' : 'down'}">${U.fmtStat(k, d)}</i>`;
        }
      }
      const rare = item.rareAffixes && item.rareAffixes.includes(k);
      return `<div class="istat${rare ? ' rare' : ''}"><span>${U.statName(k)}${rare ? ' <i class="rare-tag">nadir</i>' : ''}</span><b>${U.fmtStat(k, v)}</b>${diff}</div>`;
    }).join('');
  },

  itemPopup(item, source, index) {
    const s = this.game.save;
    const equipped = s.equipment[item.slot];
    const cmp = source === 'inventory' ? equipped : null;
    const r = Loot.rarityById(item.rarity);
    const canEquip = s.level >= item.reqLevel;

    const buttons = source === 'inventory'
      ? `<button class="btn primary" id="ip-equip" ${canEquip ? '' : 'disabled'}>Kuşan${canEquip ? '' : ` (Lv${item.reqLevel})`}</button>
         <button class="btn" id="ip-sell">Sat · ${U.fmt(Loot.sellValue(item))} altın</button>
         <button class="btn danger" id="ip-drop">At</button>`
      : source === 'equipped'
        ? `<button class="btn" id="ip-unequip">Çıkar</button>`
        : `<button class="btn primary" id="ip-buy">Satın al · ${U.fmt(item.price)} altın</button>`;

    const pop = document.createElement('div');
    pop.className = 'itempop-layer';
    pop.innerHTML = `<div class="itempop r-${item.rarity}">
      <h3 style="color:${r.color}">${item.name}</h3>
      <p class="dim">${GameData.SLOTS.find(x => x.key === item.slot).name} · ${r.name} · Item Lv ${item.ilvl} · Gerekli Lv ${item.reqLevel}</p>
      <p class="dim small">${item.tierName ? `Kuşam: <b style="color:${Loot.tierById(item.tier).color}">${item.tierName}</b> (Lv ${Loot.tierById(item.tier).min}–${Loot.tierById(item.tier).max})` : ''}</p>
      <p class="ench ${item.enchanted ? 'yes' : 'no'}">${item.gift ? '🎁 Boss hediyesi · ' : ''}${item.enchanted ? 'Efsunlu — ek özellikler taşır' : 'Efsunsuz — yalnızca ana statı var'}${item.rareAffixes && item.rareAffixes.length ? ` · <b>${item.rareAffixes.length} nadir efsun</b>` : ''}</p>
      <div class="istats">${this.itemStatsHtml(item, cmp)}</div>
      ${cmp ? `<p class="dim small">Kuşanılı: ${cmp.name} (güç ${U.fmt(Loot.score(cmp, s.cls))}) → bu: ${U.fmt(Loot.score(item, s.cls))}</p>` : ''}
      <div class="ip-actions">${buttons}<button class="btn ghost" id="ip-close">Kapat</button></div>
    </div>`;
    document.body.appendChild(pop);
    const close = () => pop.remove();
    pop.addEventListener('click', e => { if (e.target === pop) close(); });
    document.getElementById('ip-close').addEventListener('click', close);

    const eq = document.getElementById('ip-equip');
    if (eq) eq.addEventListener('click', () => {
      this.game.equip(index); close(); this.renderInventory(); this.refreshHud();
    });
    const un = document.getElementById('ip-unequip');
    if (un) un.addEventListener('click', () => {
      this.game.unequip(item.slot); close(); this.renderChar(); this.refreshHud();
    });
    const sell = document.getElementById('ip-sell');
    if (sell) sell.addEventListener('click', () => {
      s.gold += Loot.sellValue(item);
      s.inventory.splice(index, 1);
      this.game.saveGame(); close(); this.renderInventory(); this.refreshHud();
      this.toast('Satıldı', 'good');
    });
    const drop = document.getElementById('ip-drop');
    if (drop) drop.addEventListener('click', () => {
      if (!confirm(`"${item.name}" atılsın mı? Bu geri alınamaz.`)) return;
      s.inventory.splice(index, 1);
      this.game.saveGame(); close(); this.renderInventory();
    });
    const buy = document.getElementById('ip-buy');
    if (buy) buy.addEventListener('click', () => {
      if (s.gold < item.price) return this.toast('Altın yetersiz', 'warn');
      if (s.inventory.length >= 60) return this.toast('Envanter dolu', 'warn');
      s.gold -= item.price;
      s.inventory.push(item);
      this.marketStock = this.marketStock.filter(x => x.uid !== item.uid);
      this.game.saveGame(); close(); this.renderMarket(); this.refreshHud();
      this.toast('Satın alındı', 'good');
    });
  },

  /* ---------------- Market ---------------- */
  renderMarket() {
    const s = this.game.save;
    // Açılışta oyuncunun kendi kademesi seçili gelir
    if (!this.marketTier) this.marketTier = Loot.tierOf(s.level).id;
    if (!this.marketStock.length || this.stockTier !== this.marketTier) {
      this.marketStock = Loot.makeStock(this.marketTier, s.race, s.cls, 9);
      this.stockTier = this.marketTier;
    }
    const tier = Loot.tierById(this.marketTier);
    const locked = s.level < tier.min;

    const tabs = GameData.GEAR_TIERS.map(t => `
      <button class="tier-tab ${t.id === this.marketTier ? 'on' : ''} ${s.level < t.min ? 'locked' : ''}"
              data-tier="${t.id}" style="--tc:${t.color}">
        <b>${t.name}</b><span>Lv ${t.min}–${t.max}</span>
      </button>`).join('');

    const stock = this.marketStock.map(it => `
      <button class="mcell r-${it.rarity} ${it.enchanted ? 'ench' : ''}" data-buy="${it.uid}">
        <span class="ic-slot">${GameData.SLOTS.find(x => x.key === it.slot).name}${it.enchanted ? ' <i class="ench-dot">✦</i>' : ''}</span>
        <span class="ic-name">${it.name}</span>
        <span class="ic-price">${U.fmt(it.price)} <i>altın</i></span>
      </button>`).join('');

    this.shell('Tüccar Vela', `
      <div class="shop">
        <div class="shop-top">
          <p>Kesende <b>${U.fmt(s.gold)}</b> altın var.</p>
          <div>
            <button class="btn ghost" id="reroll">Stoğu yenile · 150 altın</button>
          </div>
        </div>
        <div class="tier-tabs">${tabs}</div>
        <p class="tier-note ${locked ? 'warn' : ''}">
          ${locked
            ? `Bu kademe <b>Level ${tier.min}</b>'den itibaren kuşanılır — şimdi alabilirsin ama giyemezsin.`
            : `<b>${tier.name}</b> rafı · Lv ${tier.min}–${tier.max} · ✦ işaretliler efsunlu, diğerleri efsunsuz.`}
        </p>
        <div class="potion-shop">
          ${Object.values(GameData.POTIONS).map(pt => `
            <div class="pot-row" style="--pot:${pt.color}">
              <div class="pot-info">
                <b>${pt.name}</b>
                <span>${pt.mana ? `+${pt.mana} mana` : `+%${Math.round(pt.heal * 100)} can`} · ${pt.cd}sn bekleme · elinde <b>${s.potions[pt.id] || 0}</b></span>
              </div>
              <div class="pot-buy">
                <button class="btn small" data-pot-buy="${pt.id}" data-n="1">1 adet · ${pt.price} altın</button>
                <button class="btn small primary" data-pot-buy="${pt.id}" data-n="${pt.bundle}">${pt.bundle} adet · ${Math.round(pt.price * pt.bundle * 0.85)} altın</button>
              </div>
            </div>`).join('')}
        </div>
        <div class="mcells">${stock}</div>
      </div>`, 'wide');

    this.el.modal.querySelectorAll('[data-tier]').forEach(b => {
      b.addEventListener('click', () => { this.marketTier = +b.dataset.tier; this.renderMarket(); });
    });
    this.el.modal.querySelectorAll('[data-buy]').forEach(b => {
      b.addEventListener('click', () => {
        const it = this.marketStock.find(x => x.uid === b.dataset.buy);
        this.itemPopup(it, 'market');
      });
    });
    this.el.modal.querySelectorAll('[data-pot-buy]').forEach(b => {
      b.addEventListener('click', () => {
        const pt = GameData.POTIONS[b.dataset.potBuy];
        const n = +b.dataset.n;
        const cost = n > 1 ? Math.round(pt.price * n * 0.85) : pt.price;
        if (s.gold < cost) return this.toast('Altın yetersiz', 'warn');
        s.gold -= cost;
        s.potions[pt.id] = (s.potions[pt.id] || 0) + n;
        this.toast(`${n}x ${pt.name} alındı`, 'good');
        this.game.saveGame(); this.renderMarket(); this.refreshHud();
      });
    });
    document.getElementById('reroll').addEventListener('click', () => {
      if (s.gold < 150) return this.toast('Altın yetersiz', 'warn');
      s.gold -= 150;
      this.marketStock = Loot.makeStock(this.marketTier, s.race, s.cls, 9);
      this.game.saveGame(); this.renderMarket(); this.refreshHud();
    });
  },

  /* ---------------- Craft ---------------- */
  renderCraft() {
    const s = this.game.save;
    const list = GameData.RECIPES.map(r => {
      const err = Loot.canCraft(r, s);
      const mats = Object.entries(r.mats).map(([m, n]) =>
        `<span class="${(s.mats[m] || 0) >= n ? 'ok' : 'no'}">${GameData.MATERIALS[m].name} ${s.mats[m] || 0}/${n}</span>`).join('');
      return `<div class="recipe r-${r.rarity}">
        <div>
          <h4>${r.name}</h4>
          <p class="dim">${GameData.SLOTS.find(x => x.key === r.slot).name} · ${Loot.rarityById(r.rarity).name} · Item Lv ${s.level + 2}</p>
          <div class="mats">${mats}<span class="${s.gold >= r.cost.gold ? 'ok' : 'no'}">${U.fmt(r.cost.gold)} altın</span></div>
        </div>
        <button class="btn primary" data-craft="${r.id}" ${err ? 'disabled' : ''}>${err || 'Döv'}</button>
      </div>`;
    }).join('');

    this.shell('Demirci Kadir', `<div class="craft">${list}</div>`);

    this.el.modal.querySelectorAll('[data-craft]').forEach(b => {
      b.addEventListener('click', () => {
        const r = GameData.RECIPES.find(x => x.id === b.dataset.craft);
        const err = Loot.canCraft(r, s);
        if (err) return this.toast(err, 'warn');
        const item = Loot.craft(r, s);
        s.inventory.push(item);
        U.bus.emit('craft', item);
        this.game.saveGame();
        this.toast(`Dövüldü: ${item.name}`, 'good');
        this.renderCraft(); this.refreshHud();
      });
    });
  },

  /* ---------------- Görevler ---------------- */
  renderQuests() {
    const s = this.game.save;
    const list = s.quests.map((q, i) => {
      const done = q.progress >= q.target;
      return `<div class="questrow ${done ? 'done' : ''}">
        <div>
          <h4>${q.text}</h4>
          <p class="dim">Ödül: ${U.fmt(q.xp)} XP · ${U.fmt(q.gold)} altın</p>
          <div class="bar"><div class="fill" style="width:${U.clamp(q.progress / q.target, 0, 1) * 100}%"></div></div>
        </div>
        <button class="btn primary" data-claim="${i}" ${done ? '' : 'disabled'}>${done ? 'Ödülü al' : `${Math.min(q.progress, q.target)}/${q.target}`}</button>
      </div>`;
    }).join('') || '<p class="dim">Aktif görev yok.</p>';

    this.shell('Görev Ustası Arin', `
      <div class="quests">
        ${list}
        <button class="btn" id="new-quests" ${s.quests.length >= 3 ? 'disabled' : ''}>Yeni görev al</button>
      </div>`);

    this.el.modal.querySelectorAll('[data-claim]').forEach(b => {
      b.addEventListener('click', () => {
        this.game.claimQuest(+b.dataset.claim);
        this.renderQuests(); this.refreshHud();
      });
    });
    document.getElementById('new-quests').addEventListener('click', () => {
      this.game.rollQuests();
      this.renderQuests(); this.refreshHud();
    });
  },

  /* ---------------- Çağlar ---------------- */
  renderAges() {
    const s = this.game.save;
    const list = GameData.AGES.map(a => {
      const cur = a.id === s.age;
      const unlocked = a.id <= s.age;
      const ok = s.level >= a.reqLevel && s.bossKills >= a.reqBoss;
      return `<div class="agerow ${cur ? 'current' : ''} ${unlocked ? 'unlocked' : ''}">
        <div class="agemark" style="--c:${a.accent}">${a.id}</div>
        <div>
          <h4>${a.name}</h4>
          <p class="dim">Gereken: Lv ${a.reqLevel} · ${a.reqBoss} boss · Yaratık Lv ${a.monLv} · Item Tier ${a.itemTier}</p>
        </div>
        ${cur && a.id < 7 ? '' : ''}
        <span class="agestate">${unlocked ? (cur ? 'Şu anki çağ' : 'Geçildi') : (ok ? 'Hazır' : 'Kilitli')}</span>
      </div>`;
    }).join('');

    const next = GameData.AGES.find(a => a.id === s.age + 1);
    const canAdvance = next && s.level >= next.reqLevel && s.bossKills >= next.reqBoss;

    this.shell('Çağlar', `
      <div class="ages">
        ${list}
        <div class="agefoot">
          <p class="dim">Yeni çağ: daha güçlü yaratıklar, daha yüksek item level, yeni ganimet.</p>
          <button class="btn primary" id="advance-age" ${canAdvance ? '' : 'disabled'}>
            ${next ? (canAdvance ? `${next.name}'na ilerle` : `${next.name} için Lv ${next.reqLevel} ve ${next.reqBoss} boss gerekli`) : 'Son çağdasın'}
          </button>
        </div>
      </div>`);

    const btn = document.getElementById('advance-age');
    if (btn && canAdvance) btn.addEventListener('click', () => {
      s.age = next.id;
      this.game.saveGame();
      this.toast(`Yeni çağ: ${next.name}`, 'good');
      U.bus.emit('age', next.id);
      this.renderAges(); this.refreshHud();
    });
  },

  /* ---------------- Depo ---------------- */
  renderStorage() {
    const s = this.game.save;
    const bank = s.storage.map((it, i) => `<button class="icell r-${it.rarity}" data-take="${i}">
      <span class="ic-slot">${GameData.SLOTS.find(x => x.key === it.slot).name}</span>
      <span class="ic-name">${it.name}</span><span class="ic-lv">Lv${it.ilvl}</span></button>`).join('')
      || '<p class="dim">Depo boş.</p>';
    const inv = s.inventory.map((it, i) => `<button class="icell r-${it.rarity}" data-put="${i}">
      <span class="ic-slot">${GameData.SLOTS.find(x => x.key === it.slot).name}</span>
      <span class="ic-name">${it.name}</span><span class="ic-lv">Lv${it.ilvl}</span></button>`).join('')
      || '<p class="dim">Envanter boş.</p>';

    this.shell('Depocu Nuran', `
      <div class="storage">
        <div><h4>Depo <span class="pill">${s.storage.length}/40</span></h4><div class="icells">${bank}</div></div>
        <div><h4>Envanter</h4><div class="icells">${inv}</div></div>
      </div>`, 'wide');

    this.el.modal.querySelectorAll('[data-put]').forEach(b => b.addEventListener('click', () => {
      if (s.storage.length >= 40) return this.toast('Depo dolu', 'warn');
      s.storage.push(s.inventory.splice(+b.dataset.put, 1)[0]);
      this.game.saveGame(); this.renderStorage();
    }));
    this.el.modal.querySelectorAll('[data-take]').forEach(b => b.addEventListener('click', () => {
      if (s.inventory.length >= 60) return this.toast('Envanter dolu', 'warn');
      s.inventory.push(s.storage.splice(+b.dataset.take, 1)[0]);
      this.game.saveGame(); this.renderStorage();
    }));
  },

  /* ---------------- PvP ---------------- */
  rankOf(mmr) {
    let r = GameData.RANKS[0];
    for (const x of GameData.RANKS) if (mmr >= x.min) r = x;
    return r;
  },

  renderPvp() {
    const s = this.game.save;
    const rank = this.rankOf(s.pvp.mmr);
    this.shell('PvP Arenası', `
      <div class="pvp-panel">
        <div class="rankbox" style="--c:${rank.color}">
          <div class="rankname">${rank.name}</div>
          <div class="mmr">${s.pvp.mmr} MMR</div>
          <div class="wl">${s.pvp.wins}G / ${s.pvp.losses}M</div>
        </div>
        <div class="pvp-actions">
          <button class="btn primary big" id="find-match">Savaş bul</button>
          <div class="duel">
            <p class="dim">Arkadaş düellosu: arkadaşının savaş kodunu gir, aynı güçte özel oda kurulur.</p>
            <div class="row">
              <input id="duel-code" placeholder="Örn: ARIN-4821" maxlength="16">
              <button class="btn" id="duel-btn">Düello</button>
            </div>
            <p class="dim small">Senin kodun: <b>${s.code}</b></p>
          </div>
        </div>
        <div id="mm-status" class="mm-status hidden"></div>
        <p class="dim small">Kazanan: XP + altın + rank puanı. Kaybeden yalnızca rank puanı kaybeder — eşya kaybı yok.</p>
      </div>`);

    document.getElementById('find-match').addEventListener('click', () => this.startMatchmaking(null));
    document.getElementById('duel-btn').addEventListener('click', () => {
      const code = document.getElementById('duel-code').value.trim();
      if (code.length < 3) return this.toast('Geçerli bir kod gir', 'warn');
      this.startMatchmaking(code);
    });
  },

  startMatchmaking(code) {
    const box = document.getElementById('mm-status');
    box.classList.remove('hidden');
    const steps = code
      ? [{ t: 400, m: `Davet gönderiliyor: ${code}` }, { t: 900, m: 'Davet kabul edildi — özel oda kuruluyor' }, { t: 700, m: 'Arena yükleniyor' }]
      : [{ t: 900, m: 'Rakip aranıyor · ±100 MMR' }, { t: 900, m: 'Arama genişletildi · ±250 MMR' }, { t: 700, m: 'Rakip bulundu — arena yükleniyor' }];
    let i = 0;
    const run = () => {
      if (i >= steps.length) {
        this.closePanel();
        this.game.startPvp(code);
        return;
      }
      box.innerHTML = `<span class="spin"></span> ${steps[i].m}`;
      setTimeout(() => { i++; run(); }, steps[i].t);
    };
    run();
  },

  pvpResult(win, rewards) {
    const s = this.game.save;
    const rank = this.rankOf(s.pvp.mmr);
    this.game.paused = true;
    this.el.modalLayer.classList.remove('hidden');
    this.shell(win ? 'Zafer' : 'Yenilgi', `
      <div class="result ${win ? 'win' : 'lose'}">
        <div class="rbig">${win ? '⚔ KAZANDIN' : '✖ KAYBETTİN'}</div>
        <div class="rrew">
          <div><span>XP</span><b>+${U.fmt(rewards.xp)}</b></div>
          <div><span>Altın</span><b>+${U.fmt(rewards.gold)}</b></div>
          <div><span>MMR</span><b>${rewards.mmr >= 0 ? '+' : ''}${rewards.mmr}</b></div>
        </div>
        <p class="dim">Rank: <b style="color:${rank.color}">${rank.name}</b> · ${s.pvp.mmr} MMR</p>
        <div class="ip-actions">
          <button class="btn primary" id="pvp-again">Tekrar savaş</button>
          <button class="btn" id="pvp-city">Şehre dön</button>
        </div>
      </div>`);
    document.getElementById('pvp-again').addEventListener('click', () => {
      this.closePanel(); this.game.startPvp(null);
    });
    document.getElementById('pvp-city').addEventListener('click', () => {
      this.closePanel(); this.game.changeMap('city');
    });
  },

  renderHelp() {
    this.shell('Kontroller ve Sistem', `
      <div class="help">
        <div class="keys">
          <div><b>W A S D</b> Hareket</div>
          <div><b>Sol tık / Space</b> Saldırı</div>
          <div><b>1 2 3 4</b> Yetenekler</div>
          <div><b>Shift</b> Sıçrama</div>
          <div><b>Sol tık (basılı tut)</b> Kombo saldırı — 3. vuruş bitirici</div>
          <div><b>Q</b> Küçük can iksiri</div>
          <div><b>R</b> Büyük can iksiri</div>
          <div><b>F</b> Mana iksiri</div>
          <div><b>V</b> Otomatik iksir aç/kapat</div>
          <div><b>Y</b> Yetenek açıklamaları</div>
          <div><b>Madenler</b> Taşa vur, içinden düşman çıkar, kırınca ganimet düşer</div>
          <div><b>E</b> NPC / portal ile etkileşim</div>
          <div><b>C</b> Karakter · <b>I</b> Envanter · <b>M</b> Çağlar</div>
          <div><b>Esc</b> Paneli kapat</div>
        </div>
        <h4>Döngü</h4>
        <p class="dim">Farm → XP + altın → level → stat puanı → ekipman → boss → PvP → rank → yeni çağ.</p>
        <h4>Element</h4>
        <p class="dim">Su ↔ Ateş: karşıt elemente +%20 hasar. Element direnci bunu geri kırar.</p>
        <h4>Delici vuruş</h4>
        <p class="dim">Rakip savunmasının bir bölümünü yok sayar. Kritik ile birleşince en yüksek tekli hasarı verir.</p>
        <div class="ip-actions"><button class="btn danger" id="wipe">Kaydı sil ve baştan başla</button></div>
      </div>`);
    document.getElementById('wipe').addEventListener('click', () => {
      if (!confirm('Tüm ilerleme silinecek. Emin misin?')) return;
      localStorage.removeItem(Game.SAVE_KEY);
      location.reload();
    });
  }
};
