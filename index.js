const https = require("https");

const API_KEY = (process.env.API_KEY || "").trim();
const CLAN_ID = (process.env.CLAN_ID || "").trim();
const LIDER_USERNAME = "TheiaRyu";
const BOT_ADI = "BOT(TheiaRyu)";

console.log("API_KEY uzunluk:", API_KEY.length);
console.log("CLAN_ID:", CLAN_ID);

const BASE_URL = "https://api.wolvesville.com";
const HEADERS = {
  Authorization: `Bot ${API_KEY}`,
  "Content-Type": "application/json",
};

const gunlukXp = {};
const haftalikXp = {};
let gorevListesi = [];
let lastMessageDate = new Date().toISOString();
let sonPazarMesaji = null;
let sonPazarTop3 = null;
let islenenBagislar = new Set(); // Daha önce işlenen bağış ID'leri
let botPlayerId = null;

function getHaftaNo() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
}
function getBugunTarih() { return new Date().toDateString(); }

function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = { hostname: url.hostname, path: url.pathname + url.search, method, headers: HEADERS };
    const req = https.request(options, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
    });
    req.on("error", (e) => { console.error("API Hata:", e.message); resolve({}); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sendMessage(msg) {
  console.log("[BOT]", msg.slice(0, 60));
  return apiRequest("POST", `/clans/${CLAN_ID}/chat`, { message: msg });
}
function getClanChat() { return apiRequest("GET", `/clans/${CLAN_ID}/chat`); }
function getClanMembers() { return apiRequest("GET", `/clans/${CLAN_ID}/members/detailed`); }
function getPlayerInfo(playerId) { return apiRequest("GET", `/players/${playerId}`); }
function getBotInfo() { return apiRequest("GET", `/players/me`); }
function getClanLedger() { return apiRequest("GET", `/clans/${CLAN_ID}/ledger`); }

async function botIdOgren() {
  try {
    const me = await getBotInfo();
    if (me && me.id) { botPlayerId = me.id; console.log("Bot ID:", botPlayerId); }
  } catch (e) {}
}

async function xpGuncelle() {
  try {
    const members = await getClanMembers();
    if (!Array.isArray(members)) return;
    const bugun = getBugunTarih();
    const haftaNo = getHaftaNo();
    let sayac = 0;
    for (const m of members) {
      if (m.status !== "ACCEPTED") continue;
      const pid = m.playerId;
      const username = m.username;
      const xpSimdi = m.xp ?? m.totalXp ?? m.experience ?? m.seasonXp ?? 0;
      sayac++;
      if (!gunlukXp[pid] || gunlukXp[pid].tarih !== bugun) {
        gunlukXp[pid] = { username, xpStart: xpSimdi, xpNow: xpSimdi, tarih: bugun };
      } else {
        gunlukXp[pid].xpNow = xpSimdi;
        gunlukXp[pid].username = username;
      }
      if (!haftalikXp[pid] || haftalikXp[pid].haftaNo !== haftaNo) {
        haftalikXp[pid] = { username, xpStart: xpSimdi, xpNow: xpSimdi, haftaNo };
      } else {
        haftalikXp[pid].xpNow = xpSimdi;
        haftalikXp[pid].username = username;
      }
    }
    console.log("XP güncellendi! Üye:", sayac);
  } catch (e) { console.error("XP hatası:", e.message); }
}

// Bağış takibi - ledger'dan 500 altın DONATE işlemlerini kontrol et
async function bagisKontrol() {
  try {
    const ledger = await getClanLedger();
    if (!Array.isArray(ledger)) return;

    for (const kayit of ledger) {
      const id = kayit.id;
      if (!id || islenenBagislar.has(id)) continue;

      const tip = (kayit.type || "").toUpperCase();
      const miktar = kayit.gold || 0;
      const username = kayit.playerUsername || kayit.username || "Bilinmeyen";

      // Sadece 500 altın DONATE işlemleri
      if (tip === "DONATE" && miktar === 500) {
        islenenBagislar.add(id);
        if (!gorevListesi.includes(username)) {
          gorevListesi.push(username);
          await sendMessage(`💰 ${username} göreve 500 altın bağışladı! Görev listesine eklendi ✅`);
          console.log("Bağış eklendi:", username);
        }
      }
    }
  } catch (e) { console.error("Bağış hatası:", e.message); }
}

async function handleBotYardim() {
  await sendMessage(
    `🤖 BOT(TheiaRyu) Komutları:\n` +
    `XP KONTROL → Bugün top 5 XP\n` +
    `HAFTALIK XP KONTROL → Bu hafta top 5\n` +
    `GÖREV BİLGİ → 500 altın bağışlayanlar\n` +
    `GÖREV EKLE @isim → Listeye ekle (lider)\n` +
    `GÖREV KALDIR @isim → Listeden çıkar (lider)\n` +
    `GÖREV BİLGİ YENİLE → Tümünü sıfırla (lider)\n` +
    `BOT YARDIM → Bu liste`
  );
}

async function handleGunlukXp() {
  const bugun = getBugunTarih();
  const liste = Object.values(gunlukXp)
    .filter(u => u.tarih === bugun)
    .map(u => ({ username: u.username, xp: u.xpNow - u.xpStart }))
    .sort((a, b) => b.xp - a.xp).slice(0, 5);
  if (liste.length === 0) { await sendMessage("📊 Bugün henüz XP verisi yok, birkaç dakika bekle."); return; }
  const m = ["1.","2.","3.","4.","5."];
  let msg = `📊 Bugünün XP Sıralaması:\n`;
  liste.forEach((u, i) => { msg += `${m[i]} ${u.username} XP-${u.xp.toLocaleString()}\n`; });
  await sendMessage(msg.trim());
}

async function handleHaftalikXp() {
  const haftaNo = getHaftaNo();
  const liste = Object.values(haftalikXp)
    .filter(u => u.haftaNo === haftaNo)
    .map(u => ({ username: u.username, xp: u.xpNow - u.xpStart }))
    .sort((a, b) => b.xp - a.xp).slice(0, 5);
  if (liste.length === 0) { await sendMessage("📊 Bu hafta henüz XP verisi yok."); return; }
  const m = ["1.","2.","3.","4.","5."];
  let msg = `📊 Haftalık XP Sıralaması:\n`;
  liste.forEach((u, i) => { msg += `${m[i]} ${u.username} XP-${u.xp.toLocaleString()}\n`; });
  await sendMessage(msg.trim());
}

async function handleGorevBilgi() {
  if (gorevListesi.length === 0) { await sendMessage("📋 GÖREV LİSTESİ\nHenüz 500 altın bağışlayan yok."); return; }
  let msg = `📋 GÖREV LİSTESİ (500 altın bağışlayanlar):\n`;
  gorevListesi.forEach((nick, i) => { msg += `${i + 1}. ${nick}\n`; });
  await sendMessage(msg.trim());
}

async function handleGorevEkle(yazanUsername, hedef) {
  if (yazanUsername !== LIDER_USERNAME) { await sendMessage(`❌ Bu komutu sadece ${LIDER_USERNAME} kullanabilir.`); return; }
  if (!hedef) { await sendMessage(`❌ Kullanım: GÖREV EKLE @kullaniciadi`); return; }
  if (gorevListesi.includes(hedef)) { await sendMessage(`⚠️ ${hedef} zaten görev listesinde!`); return; }
  gorevListesi.push(hedef);
  await sendMessage(`✅ ${hedef} görev listesine eklendi!`);
}

async function handleGorevKaldir(yazanUsername, hedef) {
  if (yazanUsername !== LIDER_USERNAME) { await sendMessage(`❌ Bu komutu sadece ${LIDER_USERNAME} kullanabilir.`); return; }
  if (!hedef) { await sendMessage(`❌ Kullanım: GÖREV KALDIR @kullaniciadi`); return; }
  const idx = gorevListesi.findIndex(n => n.toLowerCase() === hedef.toLowerCase());
  if (idx === -1) { await sendMessage(`❌ ${hedef} listede bulunamadı.`); return; }
  gorevListesi.splice(idx, 1);
  await sendMessage(`✅ ${hedef} görev listesinden kaldırıldı!`);
}

async function handleGorevYenile(yazanUsername) {
  if (yazanUsername !== LIDER_USERNAME) { await sendMessage(`❌ Bu komutu sadece ${LIDER_USERNAME} kullanabilir.`); return; }
  gorevListesi = [];
  islenenBagislar = new Set();
  await sendMessage(`✅ Görev listesi sıfırlandı!`);
}

async function yeniUyeKarsilama(username) {
  const isim = username || "yeni üye";
  await sendMessage(`👋 ${isim} KARA İNCİ'ye HOŞ GELDİNİZ! 🐺\nDetaylar için BOT YARDIM yazabilirsiniz.`);
}

async function haftalikKontrol() {
  const simdi = new Date();
  const gun = simdi.getDay();
  const saat = simdi.getHours();
  const dakika = simdi.getMinutes();
  const bugun = getBugunTarih();
  const haftaNo = getHaftaNo();

  if (gun === 0 && saat === 11 && dakika === 0 && sonPazarMesaji !== bugun) {
    sonPazarMesaji = bugun;
    const dusuk = Object.values(haftalikXp)
      .filter(u => u.haftaNo === haftaNo)
      .map(u => ({ username: u.username, xp: u.xpNow - u.xpStart }))
      .filter(u => u.xp < 3000);
    if (dusuk.length === 0) {
      await sendMessage("✅ Harika! Herkes 3.000 XP kotasını doldurdu!");
    } else {
      let msg = `⚠️ Bu hafta 3.000 XP kasamayanlar:\n`;
      dusuk.forEach((u, i) => { msg += `${i + 1}. ${u.username} (${u.xp.toLocaleString()} XP)\n`; });
      await sendMessage(msg.trim());
    }
  }

  if (gun === 0 && saat === 11 && dakika === 1 && sonPazarTop3 !== bugun) {
    sonPazarTop3 = bugun;
    const top3 = Object.values(haftalikXp)
      .filter(u => u.haftaNo === haftaNo)
      .map(u => ({ username: u.username, xp: u.xpNow - u.xpStart }))
      .sort((a, b) => b.xp - a.xp).slice(0, 3);
    if (top3.length === 0) return;
    const m = ["🥇","🥈","🥉"];
    let msg = `🏆 Haftanın En İyi 3 Kasıcısı:\n`;
    top3.forEach((u, i) => { msg += `${m[i]} ${u.username} XP-${u.xp.toLocaleString()}\n`; });
    await sendMessage(msg.trim());
  }
}

async function checkMessages() {
  try {
    const messages = await getClanChat();
    if (!Array.isArray(messages) || messages.length === 0) return;
    const yeniMesajlar = messages.filter(m => new Date(m.date) > new Date(lastMessageDate));
    if (yeniMesajlar.length === 0) return;
    lastMessageDate = yeniMesajlar[yeniMesajlar.length - 1].date;

    for (const mesaj of yeniMesajlar) {
      const text = (mesaj.msg || "").trim();
      const playerId = mesaj.playerId;

      // Sistem mesajı - katılma kontrolü
      if (mesaj.isSystem || mesaj.type === "SYSTEM" || !playerId) {
        const textLower = text.toLowerCase();
        if (textLower.includes("joined") || textLower.includes("katıldı") || textLower.includes("katildi")) {
          const username = mesaj.username || mesaj.playerUsername || null;
          await yeniUyeKarsilama(username);
        }
        continue;
      }

      if (botPlayerId && playerId === botPlayerId) continue;

      const upper = text.toUpperCase();
      if (upper === "BOT YARDIM") {
        await handleBotYardim();
      } else if (upper === "XP KONTROL") {
        await handleGunlukXp();
      } else if (upper === "HAFTALIK XP KONTROL") {
        await handleHaftalikXp();
      } else if (upper === "GÖREV BİLGİ" || upper === "GOREV BILGI") {
        await handleGorevBilgi();
      } else if (upper === "GÖREV BİLGİ YENİLE" || upper === "GOREV BILGI YENILE") {
        const p = await getPlayerInfo(playerId);
        await handleGorevYenile(p?.username || null);
      } else if (upper.startsWith("GÖREV EKLE") || upper.startsWith("GOREV EKLE")) {
        const p = await getPlayerInfo(playerId);
        const hedef = text.split("@")[1]?.trim() || null;
        await handleGorevEkle(p?.username || null, hedef);
      } else if (upper.startsWith("GÖREV KALDIR") || upper.startsWith("GOREV KALDIR")) {
        const p = await getPlayerInfo(playerId);
        const hedef = text.split("@")[1]?.trim() || null;
        await handleGorevKaldir(p?.username || null, hedef);
      }
    }
  } catch (err) { console.error("Mesaj hatası:", err.message); }
}

console.log(`🐺 BOT(TheiaRyu) başlatıldı!`);
botIdOgren();
xpGuncelle();
bagisKontrol(); // Başlangıçta mevcut bağışları yükle
setInterval(xpGuncelle, 3 * 60 * 1000);
setInterval(bagisKontrol, 60 * 1000); // Her dakika bağış kontrol
setInterval(async () => {
  await checkMessages();
  await haftalikKontrol();
}, 10000);
checkMessages();
