# Akçay Vakayinamesi

Metin2'nin **oynanış felsefesini** temel alan, özgün içerikli tarayıcı MMORPG iskeleti.
Marka, isim, harita, görsel ve kod olarak hiçbir şey kopyalanmadı; kopyalanan tek şey
şu döngü:

**farm → EXP → level → item düşür → + bas → efsun ara → skill geliştir → daha güçlü harita**

## Çalıştırma

**Yerel mod (kurulum yok):** `index.html` dosyasını tarayıcıda aç. Sunucu mantığı aynı
sekmede çalışır, kayıt tarayıcıya yazılır.

**Sunucu modu (gerçek yetkili sunucu):**
```
node server/node-server.js
# tarayıcıda: http://localhost:8080/?mode=remote
```
Bu modda EXP, yang, drop ve + basma sonucu Node sürecinde belirlenir; client sadece
komut yollar. Kayıtlar `save/<oturum>.json` içine yazılır.

**Testler:**
```
node tests/selftest.js     # 67 test + 1 saatlik ilerleme simülasyonu
```

## Dosya yapısı

```
data/      balance.js   tüm progression eğrileri (EXP, stat, + basma, rarity, ekonomi)
           items.js     item kataloğu (kademe × slot çarpımıyla üretilir), efsun havuzu
           world.js     8 harita, mob arketipleri, bosslar, NPC'ler
           skills.js    3 sınıf × 4 yetenek, formül tabanlı seviye eğrileri
server/    core.js         saf matematik: item üretimi, efsun rolü, drop, savaş
           gameserver.js   yetkili sunucu: durum, komut doğrulama, kayıt
           node-server.js  HTTP taşıma katmanı (bağımlılık yok)
client/    icons.js     prosedürel SVG item ikonları (dış asset yok)
           net.js       taşıma soyutlaması (yerel ↔ uzak, tek satır değişir)
           app.js       arayüz; hiçbir oyun kuralı içermez
css/       style.css    tüm görsel
tests/     selftest.js  doğrulama ve denge simülasyonu
```

## Tasarım kararları

**Neden veri ve mantık ayrı?** Yeni silah/zırh/mob/harita/skill eklemek için `data/`
altındaki bir diziye satır eklemek yeterli. `server/` ve `client/` hiç değişmez.
Örneğin yeni bir kademe eklemek `items.js` içindeki `TIERS` dizisine tek nesne
eklemektir; katalog 11 yeni item'i (3 silah + 8 zırh/aksesuar) kendiliğinden üretir.

**Neden client hiçbir şey hesaplamıyor?** Client'ın gösterdiği her sayı sunucudan
gelen anlık görüntüdedir. Client tarafında `state.char.yang = 999999999` yazmak
hiçbir şeyi değiştirmez — test 8 bunu doğruluyor.

**Neden tick'i client tetikliyor ama hızlanma olmuyor?** Sunucu `dt`yi kendi
saatinden okur ve 0.35 saniyeyle sınırlar. Saniyede 500 tick atmak oyunu
hızlandırmaz, sadece aynı dt'yi böler.

## Denge çapaları

| Sistem | Değer |
|---|---|
| EXP | Lv1→2: 100 · Lv10: 2.500 · Lv30: 30.000 · Lv50: 200.000 |
| Seviye farkı | 5 seviye düşük mob %20 EXP, 10 seviye düşük %2 |
| Silah | Acemi 15–22 · Çelik 45–66 · Kara Çelik 102–150 |
| + basma | +9 = tabanın 2,70 katı · +8→+9 başarı %20 |
| Ekipman drop | normal mobdan ~%5, kademe haritayla sınırlı |
| Efsanevi | sadece boss + Lv40 üstü + %2'nin altında |
| Mükemmel efsun | 3 adet %90+ roll: on binde 5'ten az |

## Sonraki faz

1. Görev zinciri (şu an yalnızca sistem iskeleti var)
2. Oyuncular arası pazar
3. WebSocket + hesap sistemi (yol haritası `node-server.js` sonunda)
4. Ekipmanın karakter üzerinde görünmesi
