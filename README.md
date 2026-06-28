# 🐺 (BOT)TheiaRyu - Wolvesville Klan Botu

## Kurulum

### 1. index.js dosyasını aç, en üstteki 2 satırı doldur:
```
const API_KEY = "BURAYA_API_KEY_YAZ";
const CLAN_ID = "BURAYA_CLAN_ID_YAZ";
```

**Clan ID bulmak için tarayıcıya yaz:**
`https://api.wolvesville.com/clans/search?name=KLAN_ADIN`
Çıkan sonuçta "id" yazan kısmı kopyala.

---

### 2. Botu klana ekle
Klan lideriysen → Klan Ayarları → Bot Ekle → Bot ID gir

---

### 3. Render.com'da ücretsiz 7/24 yayınla

1. github.com → ücretsiz hesap aç
2. New repository → adı: wolvesville-bot
3. index.js ve package.json dosyalarını yükle
4. render.com → GitHub ile ücretsiz hesap aç
5. New → Web Service → repoyu seç
6. Ayarlar:
   - Environment: Node
   - Start Command: node index.js
   - Plan: Free
7. Deploy!

---

## Komutlar

| Komut | Kim kullanabilir | Açıklama |
|-------|-----------------|----------|
| BOT YARDIM | Herkes | Tüm komutları listeler |
| XP KONTROL | Herkes | Bugün en çok XP kazan 5 üye |
| HAFTALIK XP KONTROL | Herkes | Bu hafta en çok XP kazan 5 üye |
| GÖREV BİLGİ | Herkes | 500 altın bağışlayanların listesi |
| GÖREV BİLGİ YENİLE | Sadece TheiaRyu | Görev listesini sıfırlar |

## Otomatik Mesajlar

| Zaman | Mesaj |
|-------|-------|
| Yeni üye katılınca | Hoş geldin mesajı |
| 500 altın bağışlanınca | Chate bildirim + listeye ekleme |
| Her Pazar 11:00 | 3.000 XP kasamayanların listesi |
| Her Pazar 11:01 | Haftanın en iyi 3 XP kasıcısı |

