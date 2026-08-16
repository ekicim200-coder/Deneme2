/* ============================================================
   net.js — Client ↔ Sunucu taşıma katmanı.

   İki mod:
   'local'  → sunucu aynı sekmede çalışır (çift tıkla-oyna).
   'remote' → gerçek HTTP sunucusuna bağlanır (node server/node-server.js).

   Oyun kodunun geri kalanı hangi modda olduğunu bilmez; tek yaptığı
   Net.send(...) çağırmaktır. Böylece tek satır değiştirerek gerçek
   çok oyunculu sunucuya geçilebilir.
   ============================================================ */
(function (root) {
  'use strict';

  const MODE = (new URLSearchParams(location.search).get('mode')) ||
    (location.protocol === 'file:' ? 'local' : 'local');
  const API = '/api';
  const SAVE_KEY = 'akcay_save_v1';

  let server = null;
  let listeners = [];

  /* Tarayıcı depolaması bazı ortamlarda kapalı olabilir; sessizce
     bellek içi yedeğe düşeriz, oyun yine de çalışır. */
  const memStore = {};
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return memStore[k] || null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { memStore[k] = v; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { delete memStore[k]; } }
  };

  function init() {
    if (MODE === 'local') {
      server = root.GameServer.createServer({});
      const raw = store.get(SAVE_KEY);
      if (raw) { try { server.load(JSON.parse(raw)); } catch (e) { console.warn('Kayıt okunamadı', e); } }
    }
    return Promise.resolve(MODE);
  }

  function send(cmd, payload) {
    if (MODE === 'local') {
      const res = server.command(cmd, payload || {});
      if (res.events && res.events.length) listeners.forEach(fn => fn(res.events));
      return Promise.resolve(res);
    }
    return fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd, payload: payload || {} })
    }).then(r => r.json()).then(res => {
      if (res.events && res.events.length) listeners.forEach(fn => fn(res.events));
      return res;
    });
  }

  function onEvents(fn) { listeners.push(fn); }

  function save() {
    if (MODE !== 'local' || !server || !server.hasCharacter()) return;
    store.set(SAVE_KEY, JSON.stringify(server.save()));
  }
  function wipe() { store.del(SAVE_KEY); }
  function hasSave() { return !!store.get(SAVE_KEY); }
  function hasCharacter() { return MODE === 'local' ? (server && server.hasCharacter()) : false; }

  root.Net = { init, send, onEvents, save, wipe, hasSave, hasCharacter, MODE };
})(typeof self !== 'undefined' ? self : this);
