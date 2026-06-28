const https = require("https");
const fs = require("fs");

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

// ---- VERİ DOSYALARI ----
const DATA_FILE = "data.json";

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    }
  } catch {}
  return {
    gunlukXp: {},      // { playerId: { username, xpStart, xpToday, tarih } }
    haftalikXp: {},    // { playerId: { username, xpStart, xpTotal, haftaNo } }
    gorevListesi: [],  // [ username, ... ]
    sonBagisZamani: null,
  };
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let data = loadData();
let lastMessageDate = new Date().toISOString();

// ---- HAFTA NUMARASI ----
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
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sendMessage(msg) {
  console.log("[BOT MESAJ]", msg);
  return apiRequest("POST", `/clans/${CLAN_ID}/chat`, { message: msg });
}
function getClanChat() { return apiRequest("GET", `/clans/${CLAN_ID}/chat`); }
function getClanMembers() { return apiRequest("GET", `/clans/${CLAN_ID}/members`); }
function getClanInfo() { return apiRequest("GET", `/clans/${CLAN_ID}`); }
function getPlayerInfo(playerId) { return apiRequest("GET", `/players/${playerId}`); }
function getClanLog() { return apiRequest("GET", `/clans/${CLAN_ID}/log`); }

// ---- XP GÜNCELLE (her döngüde tüm üyeler için) ----
async function xpGuncelle() {
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
    if (!data.gunlukXp[pid] || data.gunlukXp[pid].tarih !== bugun) {
      data.gunlukXp[pid] = { username, xpStart: xpSimdi, xpToday: 0, tarih: bugun };
    } else {
      data.gunlukXp[pid].xpToday = xpSimdi - data.gunlukXp[pid].xpStart;
      data.gunlukXp[pid].username = username;
    }

    // Haftalık XP
    if (!data.haftalikXp[pid] || data.haftalikXp[pid].haftaNo !== haftaNo) {
      data.haftalikXp[pid] = { username, xpStart: xpSimdi, xpTotal: 0, haftaNo };
    } else {
      data.haftalikXp[pid].xpTotal = xpSimdi - data.haftalikXp[pid].xpStart;
      data.haftalikXp[pid].username = username;
    }
  }

  saveData(data);
}

// ---- KOMUTLAR ----

async function handleBotYardim() {
  const msg =
    `🤖 ${BOT_ADI} Komutları:\n` +
    `XP KONTROL → Bugün en çok XP kazan 5 üye\n` +
    `HAFTALIK XP KONTROL → Bu hafta en çok XP kazan 5 üye\n` +
    `GÖREV BİLGİ → 500 altın bağışlayanların listesi\n` +
    `GÖREV BİLGİ YENİLE → Listeyi sıfırla (sadece lider)\n` +
    `BOT YARDIM → Bu listeyi gösterir`;
  await sendMessage(msg);
}

async function handleGunlukXp() {
  const liste = Object.values(data.gunlukXp)
    .filter(u => u.tarih === getBugunTarih())
    .sort((a, b) => b.xpToday - a.xpToday)
    .slice(0, 5);

  if (liste.length === 0) {
    await sendMessage("📊 Bugün henüz XP verisi yok.");
    return;
  }

  const madalyalar = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  let msg = `📊 Bugünün XP Sıralaması:\n`;
  liste.forEach((u, i) => {
    msg += `${madalyalar[i]} ${u.username} XP-${u.xpToday.toLocaleString()}\n`;
  });
  await sendMessage(msg.trim());
}

async function handleHaftalikXp() {
  const haftaNo = getHaftaNo();
  const liste = Object.values(data.haftalikXp)
    .filter(u => u.haftaNo === haftaNo)
    .sort((a, b) => b.xpTotal - a.xpTotal)
    .slice(0, 5);

  if (liste.length === 0) {
    await sendMessage("📊 Bu hafta henüz XP verisi yok.");
    return;
  }

  const madalyalar = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  let msg = `📊 Haftalık XP Sıralaması:\n`;
  liste.forEach((u, i) => {
    msg += `${madalyalar[i]} ${u.username} XP-${u.xpTotal.toLocaleString()}\n`;
  });
  await sendMessage(msg.trim());
}

async function handleGorevBilgi() {
  if (data.gorevListesi.length === 0) {
    await sendMessage("📋 GÖREV LİSTESİ\nHenüz 500 altın bağışlayan yok.");
    return;
  }
  let msg = `📋 GÖREV LİSTESİ (500 altın bağışlayanlar):\n`;
  data.gorevListesi.forEach((nick, i) => {
    msg += `${i + 1}. ${nick}\n`;
  });
  await sendMessage(msg.trim());
}

async function handleGorevYenile(yazanUsername) {
  if (yazanUsername !== LIDER_USERNAME) {
    await sendMessage(`❌ Bu komutu sadece klan lideri kullanabilir.`);
    return;
  }
  data.gorevListesi = [];
  saveData(data);
  await sendMessage(`✅ Görev listesi sıfırlandı!`);
}

async function yeniUyeKarsilama(playerId) {
  const player = await getPlayerInfo(playerId);
  const isim = player?.username || "yeni üye";
  await sendMessage(
    `👋 Hoş geldin ${isim}! Klana katıldığın için teşekkürler 🐺\nKomutları görmek için: BOT YARDIM`
  );
}

// ---- BAĞIŞ TAKİBİ ----
async function bagisKontrol() {
  try {
    const log = await getClanLog();
    if (!Array.isArray(log)) return;

    for (const kayit of log) {
      // 500 altın bağışı kontrolü
      const zaman = kayit.date || kayit.timestamp;
      if (!zaman) continue;
      if (data.sonBagisZamani && new Date(zaman) <= new Date(data.sonBagisZamani)) continue;

      // Bağış tipi ve miktar kontrolü (API'ye göre field isimleri değişebilir)
      const tip = (kayit.type || kayit.action || "").toLowerCase();
      const miktar = kayit.amount || kayit.gold || 0;

      if ((tip.includes("donat") || tip.includes("gold") || tip.includes("bagis")) && miktar >= 500) {
        const username = kayit.username || kayit.playerUsername || "Bilinmeyen";
        if (!data.gorevListesi.includes(username)) {
          data.gorevListesi.push(username);
          await sendMessage(`💰 ${username} göreve 500 altın bağışladı! Görev listesine eklendi ✅`);
        }
        data.sonBagisZamani = zaman;
        saveData(data);
      }
    }
  } catch (e) {
    console.error("Bağış kontrol hatası:", e.message);
  }
}

// ---- HAFTALIK OTOMATİK MESAJLAR (Pazar 11:00 ve 11:01) ----
let sonPazarMesaji = null;
let sonPazarTop3 = null;

async function haftalikKontrol() {
  const simdi = new Date();
  const gunTR = simdi.getDay(); // 0 = Pazar
  const saat = simdi.getHours();
  const dakika = simdi.getMinutes();
  const bugun = getBugunTarih();

  // Pazar 11:00 → 3k XP kasamayanlar
  if (gunTR === 0 && saat === 11 && dakika === 0 && sonPazarMesaji !== bugun) {
    sonPazarMesaji = bugun;
    const haftaNo = getHaftaNo();
    const dusuk = Object.values(data.haftalikXp)
      .filter(u => u.haftaNo === haftaNo && u.xpTotal < 3000);

    if (dusuk.length === 0) {
      await sendMessage("✅ Harika! Bu hafta herkes 3.000 XP kotasını doldurdu!");
    } else {
      let msg = `⚠️ Bu hafta 3.000 XP kasamayanlar:\n`;
      dusuk.forEach((u, i) => {
        msg += `${i + 1}. ${u.username} (${u.xpTotal.toLocaleString()} XP)\n`;
      });
      await sendMessage(msg.trim());
    }
  }

  // Pazar 11:01 → En çok XP kazan top 3
  if (gunTR === 0 && saat === 11 && dakika === 1 && sonPazarTop3 !== bugun) {
    sonPazarTop3 = bugun;
    const haftaNo = getHaftaNo();
    const top3 = Object.values(data.haftalikXp)
      .filter(u => u.haftaNo === haftaNo)
      .sort((a, b) => b.xpTotal - a.xpTotal)
      .slice(0, 3);

    if (top3.length === 0) {
      await sendMessage("📊 Bu hafta henüz XP verisi yok.");
      return;
    }

    const madalyalar = ["🥇", "🥈", "🥉"];
    let msg = `🏆 Haftanın En İyi 3 XP Kasıcısı:\n`;
    top3.forEach((u, i) => {
      msg += `${madalyalar[i]} ${u.username} XP-${u.xpTotal.toLocaleString()}\n`;
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

      // Yeni üye katıldı
      if (mesaj.isSystem && text.toLowerCase().includes("joined")) {
        await yeniUyeKarsilama(playerId);
        continue;
      }

      if (!playerId) continue;

      // Komutu yazan kişinin adını bul
      let yazanUsername = null;
      try {
        const p = await getPlayerInfo(playerId);
        yazanUsername = p?.username || null;
      } catch {}

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
  await bagisKontrol();
  await haftalikKontrol();
}

// XP güncellemeyi her 5 dakikada bir yap (API limit için)
async function xpDongu() {
  await xpGuncelle();
}

console.log(`🐺 ${BOT_ADI} başlatıldı!`);
console.log("Komutlar: BOT YARDIM | XP KONTROL | HAFTALIK XP KONTROL | GÖREV BİLGİ | GÖREV BİLGİ YENİLE");

// Mesaj kontrolü her 10 saniyede
setInterval(anadongu, 10000);
// XP güncellemesi her 5 dakikada
setInterval(xpDongu, 5 * 60 * 1000);

// Başlangıçta çalıştır
anadongu();
xpDongu();
