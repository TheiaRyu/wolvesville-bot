const https = require("https");

// =============================================
// BURAYA KENDİ BİLGİLERİNİ GİR
// =============================================
const API_KEY = "GmVLmm5SQPEExHkdgtMk4bklc7PgJFvuTLDZKu4haN1rqCwEUdgNsiOThxRT51gi";
const CLAN_ID = "089c5073-5ff4-4e7b-af0b-484409d5ba4b";
const LIDER_USERNAME = "TheiaRyu";
const BOT_ADI = "(BOT)TheiaRyu";
// =============================================

const BASE_URL = "https://api.wolvesville.com";
const HEADERS = {
  Authorization: `Bot ${API_KEY}`,
  "Content-Type": "application/json",
};

// ---- VERİ BELLEKTE TUTULUYOR ----
const gunlukXp = {};   // { playerId: { username, xpStart, xpNow, tarih } }
const haftalikXp = {}; // { playerId: { username, xpStart, xpNow, haftaNo } }
let gorevListesi = []; // [ username, ... ]
let lastMessageDate = new Date().toISOString();
let sonBagisZamani = null;
let sonPazarMesaji = null;
let sonPazarTop3 = null;
let ilkYukleme = true;

// ---- YARDIMCI ----
function getHaftaNo() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
}
function getBugunTarih() {
  return new Date().toDateString();
}

// ---- HTTP ----
function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: HEADERS,
    };
    const req = https.request(options, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try { resolve(d ? JSON.parse(d) : {}); }
        catch { resolve({}); }
      });
    });
    req.on("error", (e) => { console.error("API Hata:", e.message); resolve({}); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sendMessage(msg) {
  console.log("[BOT]", msg);
  return apiRequest("POST", `/clans/${CLAN_ID}/chat`, { message: msg });
}
function getClanChat() { return apiRequest("GET", `/clans/${CLAN_ID}/chat`); }
function getClanMembers() { return apiRequest("GET", `/clans/${CLAN_ID}/members`); }
function getClanInfo() { return apiRequest("GET", `/clans/${CLAN_ID}`); }
function getPlayerInfo(playerId) { return apiRequest("GET", `/players/${playerId}`); }

// ---- XP GÜNCELLE ----
async function xpGuncelle() {
  try {
    const members = await getClanMembers();
    if (!Array.isArray(members)) return;

    const bugun = getBugunTarih();
    const haftaNo = getHaftaNo();

    for (const m of members) {
      if (m.status !== "ACCEPTED") continue;
      const player = await getPlayerInfo(m.playerId);
      if (!player || player.xp === undefined) continue;

      const pid = m.playerId;
      const username = player.username;
      const xpSimdi = player.xp;

      // Günlük XP
      if (!gunlukXp[pid] || gunlukXp[pid].tarih !== bugun) {
        gunlukXp[pid] = { username, xpStart: xpSimdi, xpNow: xpSimdi, tarih: bugun };
      } else {
        gunlukXp[pid].xpNow = xpSimdi;
        gunlukXp[pid].username = username;
      }

      // Haftalık XP
      if (!haftalikXp[pid] || haftalikXp[pid].haftaNo !== haftaNo) {
        haftalikXp[pid] = { username, xpStart: xpSimdi, xpNow: xpSimdi, haftaNo };
      } else {
        haftalikXp[pid].xpNow = xpSimdi;
        haftalikXp[pid].username = username;
      }
    }

    if (ilkYukleme) {
      console.log("XP verileri yüklendi! Üye sayısı:", Object.keys(gunlukXp).length);
      ilkYukleme = false;
    }
  } catch (e) {
    console.error("XP güncelleme hatası:", e.message);
  }
}

// ---- KOMUTLAR ----
async function handleBotYardim() {
  await sendMessage(
    `🤖 ${BOT_ADI} Komutları:\n` +
    `XP KONTROL → Bugün top 5 XP\n` +
    `HAFTALIK XP KONTROL → Bu hafta top 5\n` +
    `GÖREV BİLGİ → 500 altın bağışlayanlar\n` +
    `GÖREV BİLGİ YENİLE → Listeyi sıfırla (lider)\n` +
    `BOT YARDIM → Bu liste`
  );
}

async function handleGunlukXp() {
  const bugun = getBugunTarih();
  const liste = Object.values(gunlukXp)
    .filter(u => u.tarih === bugun)
    .map(u => ({ username: u.username, xp: u.xpNow - u.xpStart }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 5);

  if (liste.length === 0) {
    await sendMessage("📊 Bugün henüz XP verisi yok, birkaç dakika bekle.");
    return;
  }

  const madalyalar = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  let msg = `📊 Bugünün XP Sıralaması:\n`;
  liste.forEach((u, i) => {
    msg += `${madalyalar[i]} ${u.username} XP-${u.xp.toLocaleString()}\n`;
  });
  await sendMessage(msg.trim());
}

async function handleHaftalikXp() {
  const haftaNo = getHaftaNo();
  const liste = Object.values(haftalikXp)
    .filter(u => u.haftaNo === haftaNo)
    .map(u => ({ username: u.username, xp: u.xpNow - u.xpStart }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 5);

  if (liste.length === 0) {
    await sendMessage("📊 Bu hafta henüz XP verisi yok.");
    return;
  }

  const madalyalar = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  let msg = `📊 Haftalık XP Sıralaması:\n`;
  liste.forEach((u, i) => {
    msg += `${madalyalar[i]} ${u.username} XP-${u.xp.toLocaleString()}\n`;
  });
  await sendMessage(msg.trim());
}

async function handleGorevBilgi() {
  if (gorevListesi.length === 0) {
    await sendMessage("📋 GÖREV LİSTESİ\nHenüz 500 altın bağışlayan yok.");
    return;
  }
  let msg = `📋 GÖREV LİSTESİ:\n`;
  gorevListesi.forEach((nick, i) => {
    msg += `${i + 1}. ${nick}\n`;
  });
  await sendMessage(msg.trim());
}

async function handleGorevYenile(yazanUsername) {
  if (yazanUsername !== LIDER_USERNAME) {
    await sendMessage(`❌ Bu komutu sadece ${LIDER_USERNAME} kullanabilir.`);
    return;
  }
  gorevListesi = [];
  await sendMessage(`✅ Görev listesi sıfırlandı!`);
}

async function yeniUyeKarsilama(playerId) {
  try {
    const player = await getPlayerInfo(playerId);
    const isim = player?.username || "yeni üye";
    await sendMessage(`👋 Hoş geldin ${isim}! 🐺\nKomutlar için: BOT YARDIM`);
  } catch {}
}

// ---- HAFTALIK OTOMATİK MESAJLAR ----
async function haftalikKontrol() {
  const simdi = new Date();
  const gun = simdi.getDay(); // 0 = Pazar
  const saat = simdi.getHours();
  const dakika = simdi.getMinutes();
  const bugun = getBugunTarih();
  const haftaNo = getHaftaNo();

  // Pazar 11:00 → 3k XP kasamayanlar
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
      dusuk.forEach((u, i) => {
        msg += `${i + 1}. ${u.username} (${u.xp.toLocaleString()} XP)\n`;
      });
      await sendMessage(msg.trim());
    }
  }

  // Pazar 11:01 → Top 3
  if (gun === 0 && saat === 11 && dakika === 1 && sonPazarTop3 !== bugun) {
    sonPazarTop3 = bugun;
    const top3 = Object.values(haftalikXp)
      .filter(u => u.haftaNo === haftaNo)
      .map(u => ({ username: u.username, xp: u.xpNow - u.xpStart }))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 3);

    if (top3.length === 0) return;
    const madalyalar = ["🥇", "🥈", "🥉"];
    let msg = `🏆 Haftanın En İyi 3 Kasıcısı:\n`;
    top3.forEach((u, i) => {
      msg += `${madalyalar[i]} ${u.username} XP-${u.xp.toLocaleString()}\n`;
    });
    await sendMessage(msg.trim());
  }
}

// ---- MESAJ OKUMA ----
async function checkMessages() {
  try {
    const messages = await getClanChat();
    if (!Array.isArray(messages) || messages.length === 0) return;

    const yeniMesajlar = messages.filter(
      (m) => new Date(m.date) > new Date(lastMessageDate)
    );
    if (yeniMesajlar.length === 0) return;

    lastMessageDate = yeniMesajlar[yeniMesajlar.length - 1].date;

    for (const mesaj of yeniMesajlar) {
      const text = (mesaj.msg || "").trim();
      const playerId = mesaj.playerId;

      // Yeni üye
      if (mesaj.isSystem && text.toLowerCase().includes("joined")) {
        await yeniUyeKarsilama(playerId);
        continue;
      }

      if (!playerId) continue;

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
        let yazanUsername = null;
        try {
          const p = await getPlayerInfo(playerId);
          yazanUsername = p?.username || null;
        } catch {}
        await handleGorevYenile(yazanUsername);
      }
    }
  } catch (err) {
    console.error("Mesaj hatası:", err.message);
  }
}

// ---- ANA DÖNGÜ ----
async function anadongu() {
  await checkMessages();
  await haftalikKontrol();
}

console.log(`🐺 ${BOT_ADI} başlatıldı!`);

// İlk başta hemen XP yükle
xpGuncelle();

// Her 3 dakikada XP güncelle
setInterval(xpGuncelle, 3 * 60 * 1000);

// Her 10 saniyede mesaj kontrol
setInterval(anadongu, 10000);
anadongu();
