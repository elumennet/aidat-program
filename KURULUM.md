# Aidat — Telefona Kurulum ve Kullanım

© 2026 Cemal Solmaz — Tüm hakları saklıdır.

---

## Kısa yol (en kolay): Dosyayı telefondan aç

Bu yol için bilgisayar veya internet **gerekmez**; program telefonda çevrimdışı çalışır.

1. `index.html` dosyasını (ve yanındaki `app.js`, `style.css`, `manifest.webmanifest`, `sw.js`, `icon-*.png` dosyalarını) telefonun **Dosyalar / Dosya Yöneticisi** uygulamasına kopyala (WhatsApp'tan kendine gönder, USB kablo, Google Drive, e-posta… hangisi kolaysa).
2. Hepsini **aynı klasöre** koy, örn. `Belgeler/Aidat`.
3. Dosya yöneticisinde `index.html` dosyasına dokun → **Chrome** (veya Safari) ile aç.
4. Sağ üstteki menüden **"Ana ekrana ekle"** seç. Artık simgeden açılır.

> Not: Bazı Android dosya yöneticileri HTML'i metin olarak açabilir. O zaman Chrome'u aç, adres çubuğuna
> `file:///sdcard/Belgeler/Aidat/index.html` yaz (klasör adını kendi klasörüne göre değiştir).

---

## Önerilen yol: Telefon + bilgisayar aynı Wi-Fi'da

Bu yol "gerçek uygulama" gibi çalışır: simge, tam ekran, çevrimdışı. Telefona kurulum bir kez yapılır.

### 1) Bilgisayarda sunucuyu başlat
`aidat-program` klasöründeki **`Telefonda-Calistir.bat`** dosyasına çift tıkla.
Siyah bir pencere açılır ve şunu yazar:

```
  Aidat programı hazır. Telefondan aç:
     http://192.168.1.142:8080
```

**Bu pencereyi kapatma** (kapatırsan telefon açamaz).

### 2) Telefondan aç
Telefon ile bilgisayar **aynı Wi-Fi** ağında olmalı.

- **Android (Chrome):** yukarıdaki adresi yaz → sağ üst ⋮ menü → **"Uygulamayı yükle"** / **"Ana ekrana ekle"**.
- **iPhone (Safari):** adresi yaz → alttaki **Paylaş** düğmesi → **"Ana Ekrana Ekle"** → Ekle.

Ekranda **Aidat** simgesi çıkar. Bir kez açtıktan sonra internet/ Wi-Fi olmasa da çalışır (çevrimdışı önbellek).

### 3) Kullanmaya başla
İlk açılışta örnek veriler gelir. Kendi binanı girmek için:

1. **Daireler → Ayarlar** → bina adı, aylık aidat, aidat günü, devreden kasa → **Kaydet**.
2. **Daireler → "Tümünü sil"** ile örnekleri temizle, sonra kendi dairelerini ekle.
3. **Daireler → + Daire** (daireler) ve **Daireler → Dükkanlar → + Dükkan** (her dükkana ayrı aidat).
   Çok dükkan varsa **"Toplu dükkan"** ile satır satır ekleyebilirsin.
4. **Aidat** ekranında her ay dairelerin/dükkanların ödemesini ✓ ile işaretle (veya "Tümünü tahsil et").
5. **Gider** ekranında fatura/bakım giderlerini gir — kalem adını kendin yazarsın.
6. **Borç** ekranında kimin ne kadar borcu var görürsün; **Rapor** ekranında son 12 ayın gelir-gideri çıkar.

---

## Yedekleme (önemli!)

Veriler **yalnızca o telefonun tarayıcısında** saklanır. Telefon değiştirirken ya da tarayıcı verilerini temizlemeden önce:

- **Daireler → Ayarlar → Yedek al** → `aidat-yedek-TARİH.json` dosyası indirilir. Bu dosyayı kendine e-postayla gönder / Drive'a yükle.
- Yeni telefonda programı aç → **Ayarlar → Yedekten geri yükle** → dosyayı seç.

> Tarayıcıda "site verilerini temizle" yaparsan kayıtlar silinir. Arada bir yedek almak iyi olur.

---

## Sık sorulanlar

**Adres açılmıyor?**
- Telefon ve bilgisayar aynı Wi-Fi'da mı?
- Bilgisayarda `Telefonda-Calistir.bat` penceresi açık mı?
- Windows güvenlik duvarı sorarsa **"Özel ağlarda izin ver"** seç.
- IP değişmiş olabilir: siyah penceredeki adresi yeniden oku.

**Simge eklenmiyor?**
- iPhone'da yalnızca **Safari** ile eklenebilir (Chrome değil).
- Android'de sayfa tam yüklenmeden "Ana ekrana ekle" çıkmayabilir; birkaç saniye bekle.

**Programı kapatmak / güncellemek?**
- Sunucu penceresini kapatmak yeterli; telefondaki veriler durur.
- Yeni sürüm gelince klasördeki dosyaları değiştir, telefondaki simgeyi aç → güncellenir.

**Birden fazla telefon/kişi kullanacak mı?**
- Şu an her telefon kendi verisini tutar (senkron yok). Ortak kullanım için yedek dosyasını paylaşabilir veya programı bir web adresine taşıyabiliriz.

---

## İletişim

- ☎ Telefon: +90 532 205 01 97
- ✉ cemalsolmaz@outlook.com · elumennet@hotmail.com · elumennet@gmail.com
- 📍 Sümer Mahallesi 69126 Sokak Evliya Apt No:10 Zemin Kat No:10/A Seyhan/Adana
