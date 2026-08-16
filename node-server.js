/* ============================================================
   node-server.js — Gerçek yetkili sunucu (bağımlılık yok).

   Çalıştırma:
     node server/node-server.js
   Sonra tarayıcıda:
     http://localhost:8080/?mode=remote

   Bu modda oyun mantığı tarayıcıda DEĞİL, burada çalışır. Client
   sadece komut yollar; yang, EXP, drop ve + basma sonucu bu süreçte
   belirlenir. Kayıt dosyaya yazılır (save/<oturum>.json).

   Not: Bu tek oyunculu oturumları hizmet eden basit bir iskelettir.
   Çok oyunculuya geçerken yapılacaklar dosya sonundaki notlarda.
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GS = require('./gameserver.js');

const ROOT = path.join(__dirname, '..');
const SAVE_DIR = path.join(ROOT, 'save');
const PORT = process.env.PORT || 8080;

if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });

/* ---------- oturumlar ---------- */
const sessions = new Map();   // sid -> { srv, lastSeen }

function loadSession(sid) {
  if (sessions.has(sid)) return sessions.get(sid);
  const srv = GS.createServer({});
  const file = path.join(SAVE_DIR, sid + '.json');
  if (fs.existsSync(file)) {
    try { srv.load(JSON.parse(fs.readFileSync(file, 'utf8'))); }
    catch (e) { console.warn('Kayıt okunamadı:', e.message); }
  }
  const s = { srv, lastSeen: Date.now(), sid };
  sessions.set(sid, s);
  return s;
}

function persist(s) {
  if (!s.srv.hasCharacter()) return;
  fs.writeFileSync(path.join(SAVE_DIR, s.sid + '.json'), JSON.stringify(s.srv.save()));
}

/* 30 saniyede bir kayıt + 2 saat işlem görmeyen oturumu bellekten düşür */
setInterval(() => {
  const cutoff = Date.now() - 2 * 3600 * 1000;
  sessions.forEach((s, sid) => {
    persist(s);
    if (s.lastSeen < cutoff) sessions.delete(sid);
  });
}, 30000);

/* ---------- statik dosya sunumu ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };

function serveStatic(req, res) {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  /* dizin dışına çıkma denemelerini engelle */
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Yasak'); }
  if (file.includes(path.join(ROOT, 'save'))) { res.writeHead(403); return res.end('Yasak'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Bulunamadı'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ---------- oturum çerezi ---------- */
function getSid(req, res) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/akcay_sid=([a-f0-9]{32})/);
  if (m) return m[1];
  const sid = crypto.randomBytes(16).toString('hex');
  res.setHeader('Set-Cookie', `akcay_sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
  return sid;
}

/* ---------- basit hız sınırı ----------
   Tek istemcinin tick spam ile sunucuyu yormasını engeller.        */
const rate = new Map();
function rateLimited(sid) {
  const now = Date.now();
  const r = rate.get(sid) || { n: 0, t: now };
  if (now - r.t > 1000) { r.n = 0; r.t = now; }
  r.n++;
  rate.set(sid, r);
  return r.n > 40;              // saniyede 40 komut üstü reddedilir
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.split('?')[0] === '/api') {
    const sid = getSid(req, res);
    let body = '';
    req.on('data', c => {
      body += c;
      if (body.length > 64 * 1024) { req.destroy(); }   // devasa gövde reddi
    });
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      if (rateLimited(sid)) { res.writeHead(429); return res.end(JSON.stringify({ ok: false, error: 'Çok fazla istek.' })); }
      let msg;
      try { msg = JSON.parse(body || '{}'); }
      catch (e) { res.writeHead(400); return res.end(JSON.stringify({ ok: false, error: 'Bozuk istek.' })); }

      const s = loadSession(sid);
      s.lastSeen = Date.now();
      const out = s.srv.command(String(msg.cmd || ''), msg.payload || {});
      res.writeHead(200);
      res.end(JSON.stringify(out));
    });
    return;
  }
  if (req.method === 'GET') return serveStatic(req, res);
  res.writeHead(405); res.end('Yöntem desteklenmiyor');
});

server.listen(PORT, () => {
  console.log(`\n  Akçay Vakayinamesi sunucusu ayakta.`);
  console.log(`  Tarayıcıda aç:  http://localhost:${PORT}/?mode=remote\n`);
});

process.on('SIGINT', () => {
  console.log('\n  Kayıtlar yazılıyor...');
  sessions.forEach(persist);
  process.exit(0);
});

/* ------------------------------------------------------------
   ÇOK OYUNCULUYA GEÇERKEN YAPILACAKLAR
   1. Oturum çerezi yerine gerçek hesap + parola özeti (argon2/bcrypt).
   2. Oyun döngüsünü sunucuda sabit tick ile çalıştır (setInterval 100ms),
      client'ın tick komutunu tamamen kaldır — şu an dt sunucu saatinden
      okunuyor, ama tick'i client tetikliyor.
   3. Durumu bellekten veritabanına taşı (Postgres: characters, items,
      item_affixes, skills, inventory; item.uid birincil anahtar).
   4. Anlık görüntüyü WebSocket ile it (fark/delta gönder), istekle çekme.
   5. Aynı haritadaki oyuncuları tek "map instance" içinde topla,
      mob HP'sini paylaş, ganimet hakkını ilk vurana ver.
   ------------------------------------------------------------ */
