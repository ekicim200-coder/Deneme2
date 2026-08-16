/* ============================================================
   app.js — Arayüz ve oyun döngüsü.
   Bu dosya HİÇBİR oyun kuralı içermez. Sadece sunucudan gelen
   anlık görüntüyü çizer ve kullanıcı girdisini komuta çevirir.
   ============================================================ */
(function (root) {
  'use strict';

  const B = root.Balance, I = root.ItemData, W = root.WorldData, S = root.SkillData;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.prototype.slice.call(document.querySelectorAll(s));
  const fmt = n => Math.round(n).toLocaleString('tr-TR');
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

  let ST = null;              // son sunucu anlık görüntüsü
  let logLines = [];
  let selectedUid = null;     // geliştirme ekranında seçili eşya
  let activeModal = null;
  let lastRender = 0;
  const sig = {};                 // panel imzaları: değişmediyse yeniden çizme
  function changed(key, value) {
    if (sig[key] === value) return false;
    sig[key] = value; return true;
  }

  /* ---------------- KARAKTER OLUŞTURMA ---------------- */
  function showCreate() {
    const wrap = $('#gate');
    wrap.classList.remove('hidden');
    wrap.innerHTML = `
      <div class="gate-card">
        <h1 class="brand">Akçay Vakayinamesi</h1>
        <p class="tagline">Sisli çayırda başlayan yol, Yıldızdüşü Krateri'nde biter.</p>
        <div class="class-grid">
          ${Object.keys(B.CLASSES).map(k => {
      const c = B.CLASSES[k];
      return `<button class="class-card" data-cls="${k}">
              <span class="cc-icon">${k === 'warrior' ? '⚔' : k === 'archer' ? '🏹' : '✦'}</span>
              <span class="cc-name">${c.name}</span>
              <span class="cc-desc">${c.desc}</span>
              <span class="cc-stats">Can ${c.base.hp} · Saldırı ${c.base.atk} · Savunma ${c.base.def}</span>
            </button>`;
    }).join('')}
        </div>
        <label class="name-row">
          <span>Karakter adı</span>
          <input id="nameInput" maxlength="16" placeholder="Gezgin" autocomplete="off" />
        </label>
        <button id="startBtn" class="primary-btn" disabled>Sınıf seç</button>
        ${root.Net.hasSave() ? '<button id="wipeBtn" class="ghost-btn">Eski kaydı sil</button>' : ''}
      </div>`;

    let chosen = null;
    $$('.class-card').forEach(b => b.addEventListener('click', () => {
      $$('.class-card').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel'); chosen = b.dataset.cls;
      $('#startBtn').disabled = false;
      $('#startBtn').textContent = B.CLASSES[chosen].name + ' olarak başla';
    }));
    $('#startBtn').addEventListener('click', () => {
      const name = ($('#nameInput').value || 'Gezgin').trim();
      root.Net.send('newCharacter', { name, cls: chosen }).then(r => {
        if (!r.ok) return toast(r.error, 'bad');
        apply(r); wrap.classList.add('hidden'); $('#app').classList.remove('hidden');
      });
    });
    const wb = $('#wipeBtn');
    if (wb) wb.addEventListener('click', () => { root.Net.wipe(); location.reload(); });
  }

  /* ---------------- OLAY GÜNLÜĞÜ ---------------- */
  function pushEvents(events) {
    events.forEach(e => {
      logLines.push(e);
      if (e.type === 'level') { toast(e.text, 'level'); flash('level'); }
      if (e.type === 'boss') toast(e.text, 'boss');
      if (e.type === 'death') toast(e.text, 'bad');
      if (e.type === 'unlock') toast(e.text, 'good');
      if (e.type === 'warn') toast(e.text, 'bad');
      if (e.drops && e.drops.length) e.drops.forEach(d => {
        if (d.rarity && d.rarity !== 'common') toast(`${d.name} düştü!`, 'drop-' + d.rarity);
      });
    });
    if (logLines.length > 220) logLines = logLines.slice(-160);
    renderLog();
  }

  function renderLog() {
    const box = $('#log');
    if (!box) return;
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.innerHTML = logLines.slice(-70).map(e => {
      let cls = 'l-' + e.type, extra = '';
      if (e.drops && e.drops.length) {
        extra = '<div class="l-drops">' + e.drops.map(d =>
          `<span class="drop ${d.rarity || 'mat'}">${d.name}${d.qty > 1 ? ' ×' + d.qty : ''}</span>`).join('') + '</div>';
      }
      const mult = e.expMult !== undefined && e.expMult < 100 ? ` <em class="pen">EXP %${e.expMult}</em>` : '';
      return `<div class="line ${cls}">${e.text}${mult}${extra}</div>`;
    }).join('');
    if (atBottom) box.scrollTop = box.scrollHeight;
  }

  /* ---------------- BİLDİRİM ---------------- */
  let toastT = null;
  function toast(text, kind) {
    const t = $('#toasts');
    const n = el('div', 'toast ' + (kind || ''), text);
    t.appendChild(n);
    setTimeout(() => { n.classList.add('out'); setTimeout(() => n.remove(), 400); }, 2600);
    while (t.children.length > 5) t.removeChild(t.firstChild);
  }
  function flash(cls) {
    const f = $('#flash'); f.className = 'flash ' + cls;
    setTimeout(() => f.className = 'flash', 700);
  }

  /* ---------------- ÜST ÇUBUK / HUD ---------------- */
  function renderHUD() {
    const c = ST.char;
    $('#chName').textContent = c.name;
    $('#chClass').textContent = c.className;
    $('#chLevel').textContent = c.level;
    $('#yang').textContent = fmt(c.yang);

    bar('#hpBar', c.hp, c.stats.hp, `${fmt(c.hp)} / ${fmt(c.stats.hp)}`);
    bar('#mpBar', c.mp, c.stats.mp, `${fmt(c.mp)} / ${fmt(c.stats.mp)}`);
    bar('#expBar', c.exp, c.expNext, `${fmt(c.exp)} / ${fmt(c.expNext)}  (%${(c.exp / c.expNext * 100).toFixed(1)})`);

    /* buff göstergesi */
    $('#buffs').innerHTML = c.buffs.map(b =>
      `<span class="buff" title="${b.name}">${b.icon}<i>${Math.ceil(b.left)}</i></span>`).join('');
  }

  function bar(sel, v, max, label) {
    const e = $(sel);
    e.querySelector('i').style.width = Math.max(0, Math.min(100, v / max * 100)) + '%';
    e.querySelector('span').textContent = label;
  }

  /* ---------------- STATLAR ---------------- */
  function renderStats() {
    const s = ST.char.stats;
    if (!changed('stats', JSON.stringify(s) + (ST.char.equipment.weapon ? ST.char.equipment.weapon.uid + ST.char.equipment.weapon.plus : ''))) return;
    $('#statList').innerHTML = B.STATS.map(d => {
      const v = s[d.k] || 0;
      if (!v && ['poison', 'stun', 'vsHuman'].indexOf(d.k) >= 0) return '';
      const disp = Number.isInteger(v) ? v : v.toFixed(1);
      return `<li><span>${d.label}</span><b>${disp}${d.suffix}</b></li>`;
    }).join('');
    const w = ST.char.equipment.weapon;
    $('#dmgLine').textContent = w ? weaponRange(w) : '1 – 3';
  }

  function weaponRange(item) {
    const st = itemStats(item);
    return `${st.minDamage} – ${st.maxDamage}`;
  }

  /* Client tarafı sadece GÖSTERİM için hesaplar; hasar sunucuda belirlenir. */
  function itemStats(item) { return root.Core.itemStats(item); }

  /* ---------------- EKİPMAN ---------------- */
  const SLOT_ORDER = ['head', 'necklace', 'earring', 'weapon', 'body', 'shield', 'gloves', 'bracelet', 'boots'];
  function renderEquipment() {
    const eq = ST.char.equipment;
    const s = SLOT_ORDER.map(k => eq[k] ? eq[k].uid + ':' + eq[k].plus : '-').join('|');
    if (!changed('equip', s)) return;
    $('#equipGrid').innerHTML = SLOT_ORDER.map(slot => {
      const it = eq[slot];
      return `<div class="eq-slot ${it ? 'filled ' + it.rarity : ''}" data-slot="${slot}" data-uid="${it ? it.uid : ''}">
        ${it ? root.Icons.forItem(it, I) : `<span class="eq-ph">${I.EQUIP_LABEL[slot]}</span>`}
        ${it && it.plus ? `<b class="plus">+${it.plus}</b>` : ''}
      </div>`;
    }).join('');

    $$('#equipGrid .eq-slot').forEach(n => {
      const uid = n.dataset.uid;
      if (uid) {
        n.addEventListener('mouseenter', ev => showTip(findAnyItem(uid), ev.currentTarget));
        n.addEventListener('mouseleave', hideTip);
        n.addEventListener('click', () => cmd('unequip', { slot: n.dataset.slot }));
        n.setAttribute('draggable', 'true');
        n.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', 'eq:' + n.dataset.slot));
      }
      n.addEventListener('dragover', e => e.preventDefault());
      n.addEventListener('drop', e => {
        e.preventDefault();
        const d = e.dataTransfer.getData('text/plain');
        if (d.indexOf('inv:') === 0) cmd('equip', { uid: d.slice(4) });
      });
    });
  }

  /* ---------------- ENVANTER ---------------- */
  function renderInventory() {
    const inv = ST.char.inventory;
    const s = inv.map(x => x.uid + ':' + (x.qty || 0) + ':' + (x.plus || 0)).join('|') + '/' + ST.char.inventoryMax;
    if (!changed('inv', s)) return;
    const grid = $('#invGrid');
    const cells = [];
    for (let i = 0; i < ST.char.inventoryMax; i++) {
      const it = inv[i];
      if (!it) { cells.push('<div class="inv-cell empty"></div>'); continue; }
      cells.push(`<div class="inv-cell ${it.rarity || 'mat'}" data-uid="${it.uid}" draggable="true">
        ${root.Icons.forItem(it, I)}
        ${it.qty > 1 ? `<b class="qty">${it.qty}</b>` : ''}
        ${it.plus ? `<b class="plus">+${it.plus}</b>` : ''}
      </div>`);
    }
    grid.innerHTML = cells.join('');
    $('#invCount').textContent = `${inv.length} / ${ST.char.inventoryMax}`;

    $$('#invGrid .inv-cell[data-uid]').forEach(n => {
      const uid = n.dataset.uid;
      const item = inv.find(x => x.uid === uid);
      n.addEventListener('mouseenter', ev => showTip(item, ev.currentTarget));
      n.addEventListener('mouseleave', hideTip);
      n.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', 'inv:' + uid));
      n.addEventListener('click', () => onItemClick(item));
      n.addEventListener('contextmenu', e => { e.preventDefault(); openItemMenu(item, e); });
    });
  }

  function onItemClick(item) {
    if (!item) return;
    if (I.CONSUMABLES[item.tpl]) return cmd('useItem', { uid: item.uid });
    if (I.template(item.tpl)) return cmd('equip', { uid: item.uid });
    toast('Bu eşya doğrudan kullanılamaz.', 'bad');
  }

  function openItemMenu(item, ev) {
    const m = $('#ctxMenu');
    const canEquip = !!I.template(item.tpl);
    const canUse = !!I.CONSUMABLES[item.tpl];
    m.innerHTML = [
      canEquip ? '<button data-a="equip">Kuşan</button>' : '',
      canUse ? '<button data-a="use">Kullan</button>' : '',
      canEquip ? '<button data-a="upgrade">Geliştirmeye gönder</button>' : '',
      '<button data-a="sell">Sat (kasabada)</button>'
    ].join('');
    m.style.left = Math.min(ev.clientX, innerWidth - 190) + 'px';
    m.style.top = Math.min(ev.clientY, innerHeight - 160) + 'px';
    m.classList.remove('hidden');
    m.onclick = e => {
      const a = e.target.dataset.a; if (!a) return;
      m.classList.add('hidden');
      if (a === 'equip') cmd('equip', { uid: item.uid });
      if (a === 'use') cmd('useItem', { uid: item.uid });
      if (a === 'sell') cmd('shopSell', { uid: item.uid });
      if (a === 'upgrade') { selectedUid = item.uid; openUpgrade(); }
    };
  }
  document.addEventListener('click', e => {
    if (!e.target.closest('#ctxMenu')) $('#ctxMenu').classList.add('hidden');
  });

  /* ---------------- TOOLTIP ---------------- */
  function findAnyItem(uid) {
    const c = ST.char;
    return c.inventory.find(x => x.uid === uid) ||
      Object.keys(c.equipment).map(s => c.equipment[s]).find(x => x && x.uid === uid) || null;
  }

  function showTip(item, anchor) {
    if (!item) return;
    const tip = $('#tooltip');
    tip.innerHTML = tooltipHTML(item);
    tip.classList.remove('hidden');
    const r = anchor.getBoundingClientRect();
    const th = tip.offsetHeight, tw = tip.offsetWidth;
    let top = r.top, left = r.right + 10;
    if (left + tw > innerWidth - 8) left = r.left - tw - 10;
    if (top + th > innerHeight - 8) top = innerHeight - th - 8;
    tip.style.top = Math.max(8, top) + 'px';
    tip.style.left = Math.max(8, left) + 'px';
  }
  function hideTip() { $('#tooltip').classList.add('hidden'); }

  function tooltipHTML(item) {
    const tpl = I.template(item.tpl);
    if (!tpl) {
      const m = I.MATERIALS[item.tpl] || I.CONSUMABLES[item.tpl];
      const isBook = item.tpl.indexOf('book_') === 0;
      const name = isBook ? (S.get(item.tpl.slice(5)) ? S.get(item.tpl.slice(5)).name + ' Kitabı' : 'Yetenek Kitabı') : (m ? m.name : item.tpl);
      const desc = isBook ? 'Yetenek geliştirmede kullanılır.'
        : m && m.heal ? `Kullanınca ${m.heal} can yeniler.`
          : m && m.mana ? `Kullanınca ${m.mana} mana yeniler.`
            : m && m.helper ? B.UPGRADE_HELPERS[item.tpl].desc
              : 'Eşya geliştirmede kullanılan malzeme.';
      return `<h4 class="mat">${name}</h4><p class="tt-desc">${desc}</p>
        ${item.qty ? `<p class="tt-line">Adet: <b>${item.qty}</b></p>` : ''}
        <p class="tt-price">Satış: ${fmt((I.MATERIALS[item.tpl] || I.CONSUMABLES[item.tpl] || { price: 10 }).price * B.ECONOMY.sellRatio)} yang</p>`;
    }
    const rar = B.RARITY[item.rarity];
    const st = itemStats(item);
    const canUse = ST.char.level >= tpl.levelReq && (!tpl.classReq || tpl.classReq === ST.char.cls);
    const rows = [];
    if (st.minDamage) rows.push(`<li><span>Saldırı</span><b>${st.minDamage} – ${st.maxDamage}</b></li>`);
    ['def', 'hp', 'mp', 'magicAtk', 'magicDef', 'atk'].forEach(k => {
      if (st[k]) rows.push(`<li><span>${B.STAT_LABEL[k]}</span><b>+${st[k]}</b></li>`);
    });
    ['crit', 'pierce', 'block', 'dodge', 'atkSpeed', 'moveSpeed'].forEach(k => {
      if (st[k]) rows.push(`<li><span>${B.STAT_LABEL[k]}</span><b>+${st[k]}%</b></li>`);
    });

    const affixes = (item.affixes || []).map(a => {
      const pct = Math.round(a.v / a.max * 100);
      const q = pct >= 90 ? 'perfect' : pct >= 65 ? 'good' : '';
      return `<li class="af ${q}"><span>${B.STAT_LABEL[a.k]}</span><b>+${a.v}${B.STAT_SUFFIX[a.k]}</b>
        <i class="afbar"><u style="width:${pct}%"></u></i></li>`;
    }).join('');

    const nextInfo = (item.plus || 0) < B.UPGRADE_MAX
      ? `<div class="tt-up">Sonraki geliştirme: <b>+${(item.plus || 0) + 1}</b> · başarı <b>%${B.UPGRADE_RATE[item.plus || 0]}</b></div>` : '';

    return `<h4 class="${item.rarity}">${tpl.name}${item.plus ? ' <em>+' + item.plus + '</em>' : ''}</h4>
      <p class="tt-sub"><span class="${item.rarity}">${rar.label}</span> · ${I.EQUIP_LABEL[tpl.slot]}
        · <span class="${canUse ? '' : 'bad'}">Seviye ${tpl.levelReq}</span>
        ${tpl.classReq ? ' · ' + B.CLASSES[tpl.classReq].name : ''}</p>
      <ul class="tt-stats">${rows.join('')}</ul>
      ${affixes ? `<div class="tt-affix"><h5>Efsunlar</h5><ul>${affixes}</ul></div>` : ''}
      ${nextInfo}
      <p class="tt-price">Satış: ${fmt(root.Core.itemPrice(item) * B.ECONOMY.sellRatio)} yang</p>`;
  }

  /* ---------------- HARİTA VE MOBLAR ---------------- */
  function renderMap() {
    const m = ST.map;
    $('#mapName').textContent = m.name;
    $('#mapDesc').textContent = m.desc;
    $('#field').dataset.theme = m.theme;

    const town = m.type === 'town';
    $('#townPanel').classList.toggle('hidden', !town);
    $('#mobPanel').classList.toggle('hidden', town);
    if (town) { if (changed('town', m.id)) renderTown(); return; }
    sig.town = null;

    const list = $('#mobList');
    list.innerHTML = ST.mobs.map(mo => {
      if (mo.dead) return `<div class="mob dead"><span class="mob-name">— yeniden doğuyor (${mo.respawnIn}sn) —</span></div>`;
      const diff = mo.level - ST.char.level;
      const dcls = diff >= 5 ? 'd-hard' : diff >= 0 ? 'd-even' : diff >= -4 ? 'd-easy' : 'd-grey';
      const pen = Math.round(B.expMultiplier(ST.char.level, mo.level) * 100);
      return `<div class="mob ${mo.isBoss ? 'boss' : ''} ${ST.char.target === mo.iid ? 'targeted' : ''}" data-iid="${mo.iid}">
        <span class="mob-badge ${dcls}">Lv${mo.level}</span>
        <span class="mob-name">${mo.isBoss ? '👑 ' : ''}${mo.name}</span>
        <span class="mob-exp ${pen < 60 ? 'low' : ''}">EXP %${pen}</span>
        <i class="mob-hp"><u style="width:${mo.hp / mo.maxHp * 100}%"></u></i>
      </div>`;
    }).join('');
    $$('#mobList .mob[data-iid]').forEach(n =>
      n.addEventListener('click', () => cmd('engage', { iid: +n.dataset.iid })));
  }

  function renderTown() {
    root.Net.send('npcs').then(r => {
      $('#npcList').innerHTML = r.data.map(n =>
        `<button class="npc" data-role="${n.role}">
          <span class="npc-ico">${n.icon}</span>
          <span class="npc-body"><b>${n.name}</b><i>${n.line}</i></span>
        </button>`).join('');
      $$('#npcList .npc').forEach(b => b.addEventListener('click', () => openNPC(b.dataset.role)));
    });
  }

  /* ---------------- YETENEK ÇUBUĞU ---------------- */
  function renderSkillBar() {
    const c = ST.char;
    const list = S.forClass(c.cls).filter(s => s.type !== 'passive');
    const s = list.map(x => x.id + ':' + (c.skills[x.id] || 0)).join('|');
    if (!changed('skills', s)) { updateCooldowns(); return; }
    $('#skillBar').innerHTML = list.map((s, i) => {
      const lv = c.skills[s.id] || 0;
      const cd = c.cooldowns[s.id] || 0;
      const total = lv ? s.cd(lv) : 1;
      return `<button class="sk ${lv ? '' : 'locked'}" data-id="${s.id}" ${lv ? '' : 'disabled'} title="${s.name}">
        <span class="sk-ico">${s.icon}</span>
        <span class="sk-key">${i + 1}</span>
        ${lv ? `<span class="sk-lv">Sv${lv}</span>` : `<span class="sk-lv req">Lv${s.reqLevel}</span>`}
        ${cd > 0 ? `<i class="sk-cd" style="height:${cd / total * 100}%"></i><em class="sk-cdn">${cd.toFixed(1)}</em>` : ''}
      </button>`;
    }).join('');
    $$('#skillBar .sk').forEach(b => b.addEventListener('click', () => cmd('useSkill', { skillId: b.dataset.id })));
    updateCooldowns();
  }

  /* Bekleme sayacı DOM'u yeniden kurmadan güncellenir (akıcılık için). */
  function updateCooldowns() {
    const c = ST.char;
    $$('#skillBar .sk').forEach(b => {
      const id = b.dataset.id, lv = c.skills[id] || 0;
      const cd = c.cooldowns[id] || 0;
      let veil = b.querySelector('.sk-cd'), num = b.querySelector('.sk-cdn');
      if (cd > 0 && lv) {
        const total = S.get(id).cd(lv);
        if (!veil) { veil = el('i', 'sk-cd'); b.appendChild(veil); num = el('em', 'sk-cdn'); b.appendChild(num); }
        veil.style.height = (cd / total * 100) + '%';
        num.textContent = cd.toFixed(1);
      } else if (veil) { veil.remove(); if (num) num.remove(); }
    });
  }

  /* ---------------- MODALLAR ---------------- */
  function openModal(title, bodyHTML, cls) {
    activeModal = title;
    const m = $('#modal');
    m.className = 'modal ' + (cls || '');
    m.querySelector('.m-title').textContent = title;
    m.querySelector('.m-body').innerHTML = bodyHTML;
    m.classList.remove('hidden');
  }
  function closeModal() { activeModal = null; $('#modal').classList.add('hidden'); }
  $('#modal .m-close').addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); hideTip(); } });

  /* --- Harita / ışınlanma --- */
  function openMaps() {
    root.Net.send('maps').then(r => {
      const html = `<div class="map-list">${r.data.map(m => {
        const cur = m.id === ST.map.id;
        const lock = !m.unlocked;
        return `<button class="map-row ${cur ? 'cur' : ''} ${lock ? 'lock' : ''}" data-id="${m.id}" ${lock || cur ? 'disabled' : ''}>
          <span class="mr-thumb" data-theme="${m.theme}"></span>
          <span class="mr-body">
            <b>${m.name}</b>
            <i>${m.desc}</i>
            <em>Seviye ${m.minLevel}${m.maxLevel < 100 ? '–' + m.maxLevel : '+'}${m.cost ? ' · Yol ücreti ' + fmt(m.cost) + ' yang' : ' · Ücretsiz'}</em>
          </span>
          <span class="mr-state">${cur ? 'Buradasın' : lock ? '🔒 Lv' + m.minLevel : 'Git'}</span>
        </button>`;
      }).join('')}</div>`;
      openModal('Bölgeler', html, 'wide');
      $$('#modal .map-row').forEach(b => b.addEventListener('click', () => {
        cmd('travel', { mapId: b.dataset.id }).then(ok => { if (ok) closeModal(); });
      }));
    });
  }

  /* --- Yetenek ekranı --- */
  function openSkills() {
    root.Net.send('skillInfo').then(r => {
      const c = ST.char;
      const html = `<p class="m-note">Yetenek puanı: <b>${c.skillPoints}</b> · Yang: <b>${fmt(c.yang)}</b></p>
      <div class="skill-list">${r.data.map(s => {
        const canLearn = s.level < s.maxLevel && c.level >= s.reqLevel;
        const cost = s.cost;
        const lack = !cost ? true : (c.skillPoints < cost.point || c.yang < cost.yang || (cost.books > 0 && s.owned < cost.books));
        return `<div class="skill-row ${s.level ? '' : 'unlearned'}">
          <span class="sr-ico">${s.icon}</span>
          <div class="sr-body">
            <b>${s.name} ${s.level ? `<em>Sv ${s.level}/${s.maxLevel}</em>` : `<em class="req">Lv ${s.reqLevel} gerekli</em>`}</b>
            <i>${s.desc}</i>
            <div class="sr-stats">
              ${s.damage !== null && s.damage !== undefined ? `<span>Hasar <b>${s.damage}</b>${s.nextDamage ? ` → <b class="up">${s.nextDamage}</b>` : ''}</span>` : ''}
              ${s.type !== 'passive' ? `<span>Mana <b>${s.mp}</b></span><span>Bekleme <b>${s.cd.toFixed(1)}sn</b></span>` : '<span>Pasif</span>'}
            </div>
            ${cost ? `<div class="sr-cost">Gereken: <b>${cost.point}</b> puan · <b>${fmt(cost.yang)}</b> yang
              ${cost.books ? ` · <b>${cost.books}</b> kitap (elinde ${s.owned})` : ''}
              ${cost.rate < 100 ? ` · başarı <b>%${cost.rate}</b>` : ''}</div>` : '<div class="sr-cost">Azami seviye</div>'}
          </div>
          <button class="sr-btn" data-id="${s.id}" ${canLearn && !lack ? '' : 'disabled'}>${s.level ? 'Geliştir' : 'Öğren'}</button>
        </div>`;
      }).join('')}</div>`;
      openModal('Yetenekler', html, 'wide');
      $$('#modal .sr-btn').forEach(b => b.addEventListener('click', () => {
        root.Net.send('learnSkill', { skillId: b.dataset.id }).then(res => {
          apply(res);
          if (!res.ok) return toast(res.error, 'bad');
          if (res.data && res.data.success === false) toast('Geliştirme başarısız — puan iade edildi.', 'bad');
          openSkills();
        });
      }));
    });
  }

  /* --- Geliştirme (+ basma) ekranı — oyunun imza ekranı --- */
  function openUpgrade() {
    const c = ST.char;
    const cands = c.inventory.filter(x => I.template(x.tpl))
      .concat(Object.keys(c.equipment).map(s => c.equipment[s]).filter(Boolean));
    if (!selectedUid && cands.length) selectedUid = cands[0].uid;
    const item = cands.find(x => x.uid === selectedUid) || null;

    const picker = `<div class="up-picker">${cands.map(x =>
      `<button class="up-pick ${x.uid === selectedUid ? 'sel' : ''} ${x.rarity}" data-uid="${x.uid}">
        ${root.Icons.forItem(x, I)}${x.plus ? `<b class="plus">+${x.plus}</b>` : ''}
      </button>`).join('') || '<p class="m-note">Geliştirilecek eşyan yok.</p>'}</div>`;

    if (!item) return openModal('Usta Kayra — Geliştirme', picker, 'upgrade');

    root.Net.send('upgradeInfo', { uid: item.uid, helpers: currentHelpers() }).then(r => {
      const info = r.data;
      const tpl = I.template(item.tpl);
      const owned = h => c.inventory.filter(x => x.tpl === h).reduce((n, x) => n + x.qty, 0);

      const body = `
        ${picker}
        <div class="up-stage">
          <div class="up-item ${item.rarity}" id="upItem">
            ${root.Icons.forItem(item, I)}
            <b class="up-plus">+${item.plus || 0}</b>
          </div>
          <div class="up-arrow">→</div>
          <div class="up-item next ${item.rarity}">
            ${root.Icons.forItem({ tpl: item.tpl, plus: (item.plus || 0) + 1, rarity: item.rarity }, I)}
            <b class="up-plus next">+${(item.plus || 0) + 1}</b>
          </div>
        </div>
        <h3 class="up-name">${tpl.name}</h3>
        ${info ? `
        <div class="up-gauge"><i style="width:${info.rate}%"></i><span>Başarı şansı %${info.rate}</span></div>
        <div class="up-cost">
          <div class="uc-row"><span>Yang</span><b class="${c.yang >= info.yang ? '' : 'bad'}">${fmt(info.yang)}</b></div>
          ${Object.keys(info.mats).map(m =>
        `<div class="uc-row"><span>${I.MATERIALS[m].name}</span><b class="${owned(m) >= info.mats[m] ? '' : 'bad'}">${owned(m)} / ${info.mats[m]}</b></div>`).join('')}
        </div>
        <div class="up-helpers">
          ${Object.keys(B.UPGRADE_HELPERS).map(h => `
            <label class="helper ${owned(h) ? '' : 'off'}">
              <input type="checkbox" data-h="${h}" ${currentHelpers().indexOf(h) >= 0 ? 'checked' : ''} ${owned(h) ? '' : 'disabled'}/>
              <span>${B.UPGRADE_HELPERS[h].label} <i>(${owned(h)} adet)</i><em>${B.UPGRADE_HELPERS[h].desc}</em></span>
            </label>`).join('')}
        </div>
        <p class="up-risk ${info.failPolicy === 'down' ? 'danger' : ''}">
          Başarısızlıkta: ${info.failPolicy === 'down' ? 'eşya bir seviye geriler' : 'sadece malzemeler kaybolur'}.
        </p>
        <button id="doUpgrade" class="primary-btn big">Geliştir</button>`
          : '<p class="m-note">Bu eşya azami seviyede (+9).</p>'}`;

      openModal('Usta Kayra — Geliştirme', body, 'upgrade');

      $$('#modal .up-pick').forEach(b => b.addEventListener('click', () => { selectedUid = b.dataset.uid; openUpgrade(); }));
      $$('#modal .helper input').forEach(cb => cb.addEventListener('change', openUpgrade));
      const btn = $('#doUpgrade');
      if (btn) btn.addEventListener('click', () => doUpgrade(item.uid));
    });
  }

  let helperState = [];
  function currentHelpers() {
    const boxes = $$('#modal .helper input:checked');
    if (boxes.length) helperState = boxes.map(b => b.dataset.h);
    else if (document.querySelector('#modal .helper')) helperState = [];
    return helperState;
  }

  function doUpgrade(uid) {
    const stage = $('#upItem');
    stage.classList.add('forging');
    root.Net.send('upgrade', { uid, helpers: currentHelpers() }).then(res => {
      apply(res);
      setTimeout(() => {
        stage.classList.remove('forging');
        if (!res.ok) { toast(res.error, 'bad'); return openUpgrade(); }
        if (res.data.success) { flash('success'); toast('Geliştirme başarılı! +' + res.data.plus, 'good'); }
        else { flash('fail'); toast(res.data.downgraded ? 'Başarısız — eşya geriledi.' : 'Başarısız — malzemeler yandı.', 'bad'); }
        openUpgrade();
      }, 650);
    });
  }

  /* --- NPC / mağaza --- */
  function openNPC(role) {
    if (role === 'upgrade') { selectedUid = null; return openUpgrade(); }
    if (role === 'skill') return openSkills();
    if (role === 'teleport') return openMaps();

    root.Net.send('shopStock', { role }).then(r => {
      const stock = r.data;
      const html = `<div class="shop">
        <div class="shop-side">
          <h5>Satılık</h5>
          <div class="shop-list">${stock.map(s => `
            <button class="shop-row ${ST.char.yang >= s.price ? '' : 'poor'}" data-id="${s.id}" data-stack="${s.stack ? 1 : 0}">
              <span class="sr-ic">${root.Icons.forTemplateId(s.id, I)}</span>
              <span class="sr-nm"><b>${s.name}</b><i>Seviye ${s.levelReq}</i></span>
              <span class="sr-pr">${fmt(s.price)}</span>
            </button>`).join('')}</div>
        </div>
        <div class="shop-side">
          <h5>Çantan — tıklayınca satılır</h5>
          <div class="shop-list">${ST.char.inventory.map(x => `
            <button class="shop-row sell" data-uid="${x.uid}">
              <span class="sr-ic">${root.Icons.forItem(x, I)}</span>
              <span class="sr-nm"><b>${root.Core.itemName(x)}${x.qty > 1 ? ' ×' + x.qty : ''}</b><i>${x.rarity ? B.RARITY[x.rarity].label : 'Malzeme'}</i></span>
              <span class="sr-pr gain">+${fmt(root.Core.itemPrice(x) * B.ECONOMY.sellRatio * (x.qty || 1))}</span>
            </button>`).join('')}</div>
        </div>
      </div>`;
      openModal(role === 'shop_weapon' ? 'Demirci Vardan' : role === 'shop_armor' ? 'Zırhçı Nesrin' : 'Şifacı Doruk', html, 'wide');

      $$('#modal .shop-row[data-id]').forEach(b => b.addEventListener('click', (ev) => {
        const qty = b.dataset.stack === '1' ? (ev.shiftKey ? 10 : 1) : 1;
        root.Net.send('shopBuy', { id: b.dataset.id, qty }).then(res => {
          apply(res); if (!res.ok) toast(res.error, 'bad'); else openNPC(role);
        });
      }));
      $$('#modal .shop-row.sell').forEach(b => b.addEventListener('click', () => {
        root.Net.send('shopSell', { uid: b.dataset.uid }).then(res => {
          apply(res); if (!res.ok) toast(res.error, 'bad'); else openNPC(role);
        });
      }));
    });
  }

  /* ---------------- KOMUT SARMALAYICI ---------------- */
  function cmd(name, payload) {
    return root.Net.send(name, payload).then(res => {
      apply(res);
      if (!res.ok) { toast(res.error, 'bad'); return false; }
      return true;
    });
  }

  function apply(res) {
    if (res.events && res.events.length && root.Net.MODE !== 'local') pushEvents(res.events);
    if (res.state && res.state.char) { ST = res.state; render(); }
  }

  /* ---------------- ÇİZİM ---------------- */
  function render(force) {
    if (!ST || !ST.char) return;
    const now = performance.now();
    if (!force && now - lastRender < 90) return;
    lastRender = now;
    renderHUD(); renderStats(); renderEquipment(); renderInventory(); renderMap(); renderSkillBar();
  }

  /* ---------------- DÖNGÜ ---------------- */
  function loop() {
    root.Net.send('tick').then(res => { apply(res); });
  }

  /* ---------------- KISAYOLLAR ---------------- */
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 4 && ST) {
      const list = S.forClass(ST.char.cls).filter(s => s.type !== 'passive');
      if (list[n - 1]) cmd('useSkill', { skillId: list[n - 1].id });
    }
    const k = e.key.toLowerCase();
    if (k === 'i') $('#invGrid').scrollIntoView({ behavior: 'smooth' });
    if (k === 'k') openSkills();
    if (k === 'm') openMaps();
    if (k === 'u') { selectedUid = null; openUpgrade(); }
    if (k === 'q') {
      const pot = ST && ST.char.inventory.find(x => I.CONSUMABLES[x.tpl] && I.CONSUMABLES[x.tpl].heal);
      if (pot) cmd('useItem', { uid: pot.uid });
    }
  });

  /* ---------------- AÇILIŞ ---------------- */
  function boot() {
    root.Net.onEvents(pushEvents);
    root.Net.init().then(() => {
      $('#btnMaps').addEventListener('click', openMaps);
      $('#btnSkills').addEventListener('click', openSkills);
      $('#btnUpgrade').addEventListener('click', () => { selectedUid = null; openUpgrade(); });
      $('#btnTown').addEventListener('click', () => cmd('travel', { mapId: 'town' }));
      $('#btnReset').addEventListener('click', () => {
        if (confirm('Karakterin silinecek. Emin misin?')) { root.Net.wipe(); location.reload(); }
      });

      root.Net.send('tick').then(res => {
        if (res.state && res.state.char) {
          ST = res.state; $('#app').classList.remove('hidden'); render(true);
          toast('Hoş geldin, ' + ST.char.name + '.', 'good');
        } else showCreate();
        setInterval(loop, 120);
        setInterval(() => root.Net.save(), 8000);
        window.addEventListener('beforeunload', () => root.Net.save());
      });
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})(typeof self !== 'undefined' ? self : this);
