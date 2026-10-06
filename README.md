# WhatsApp Grup Botu

Excel ya da Google Forms listesindeki telefon numaralarını, seçtiğin WhatsApp grubuna tek tek ekler.
Hiçbir dosyayı düzenlemen gerekmez; bot her şeyi adım adım sorar. Windows için hazırlanmıştır.

> ⚠️ **Resmi değildir.** Bu proje WhatsApp ya da Meta ile bağlantılı değildir; WhatsApp Web'i
> [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) ile otomatikleştirir. WhatsApp
> otomasyonu kullanım koşullarına aykırı sayılabilir ve numaranın kısıtlanmasına yol açabilir.
> Kullanım sorumluluğu kullanana aittir.

```
Hangi WhatsApp numarasıyla ekleme yapılacak?
  1) +90 5XX XXX XX XX ile devam et
  2) Yeni bir WhatsApp numarası bağla (QR okutacaksın)

---------------- ÖZET ----------------
Grup               : Kulüp Üyeleri
Eklenecek          : 18 kişi (tahmini süre ~32 dk)
Zaten grupta       : 4
--------------------------------------
Ekleme başlasın mı? (E/H):
```

---

## İlk kurulum (bilgisayar başına bir kez)

1. **Node.js kur:** https://nodejs.org adresinden **LTS** yazan sürümü indir, kurulumda hep "İleri"ye bas.
2. **Chrome ya da Edge** kurulu olsun (Windows'ta Edge zaten vardır).
3. **Botu indir:** Bu sayfanın üstündeki yeşil **Code** düğmesi → **Download ZIP**. İnen zip'i
   bilgisayarında istediğin bir yere (ör. Masaüstü) çıkar.

İlk çalıştırmada bot gerekli parçaları kendisi indirir (birkaç dakika sürer, internet gerekir).

---

## Her kullanımda

### 1. Grubu hazırla
Grubu **telefondan kendin kur** ve grupta **yönetici** ol. Bot grup kuramaz, sadece üye ekler.

### 2. Listeyi koy
Google Forms → **Yanıtlar** → **E-Tablolar'da görüntüle** → **Dosya → İndir → Microsoft Excel (.xlsx)**.
İnen dosyayı **bu klasörün içine** koy (alt klasöre değil). Varsa eski listeyi sil.

- Dosyanın adı önemli değil.
- İlk satır başlık olmalı (Google Forms'ta zaten öyle).
- Telefon sütununun başlığında "telefon", "numara" ya da "cep" geçmesi yeterli.
- Numaralar nasıl yazılmış olursa olsun okunur: `0532 123 45 67`, `5321234567`, `+90 532 123 45 67`.
- Örnek liste için `ornek` klasörüne bak.

### 3. Botu çalıştır
**`baslat.bat`** dosyasına çift tıkla ve soruları cevapla:

1. **Hangi WhatsApp numarasıyla?**
   - İlk seferde **"Yeni bir WhatsApp numarası bağla"**yı seç. Bir Chrome penceresi açılır; oradaki QR kodu
     telefonda **WhatsApp → Ayarlar → Bağlı cihazlar → Cihaz bağla** ile okut.
   - Sonraki seferlerde numaran listede çıkar, onu seçmen yeter.
2. **Grup adından bir parça yaz** → yönetici olduğun gruplar listelenir, grubun numarasını yaz.
3. **Özeti kontrol et** → kaç kişi eklenecek, kaçı zaten grupta, ne kadar sürecek.
4. **"Ekleme başlasın mı?"** → `E` dersen başlar, `H` dersen hiçbir şey yapmaz.

Ekleme sırasında pencereyi kapatma. Kişiler 1–2,5 dakika arayla tek tek eklenir.
Sonuç `raporlar` klasörüne kaydedilir.

---

## Sık sorulanlar

**Formdan yeni kayıt geldi, ne yapayım?**
Listeyi tekrar indir, eskisinin yerine koy, botu çalıştır. Zaten gruptakiler atlanır, sadece yeniler eklenir.

**Raporda "Davet gönderildi" yazıyor.**
O kişinin gizlilik ayarı doğrudan eklenmeye izin vermiyor. Bot ona WhatsApp'tan grup daveti gönderdi;
davete tıklayınca gruba katılır.

**"Sonraki çalıştırmaya kaldı" yazıyor.**
Numaranın güvenliği için bot bir seferde en fazla 25 kişi ekler. Ertesi gün tekrar çalıştır, kalanları ekler.

**Grubum listede çıkmıyor.**
O grupta yönetici olduğundan emin ol. Grubu yeni kurduysan biraz bekleyip tekrar ara.

**Bu bilgisayardan numaramı çıkarmak istiyorum.**
Botu çalıştır → "Kayıtlı bir numaranın bağlantısını kaldır". Telefonda da **Bağlı cihazlar**'dan bu bilgisayarı çıkar.

**Bot hata verdi.**
WhatsApp Web güncellenince bot bazen bozulabilir. Penceredeki hata yazısının ekran görüntüsünü bu botu kuran kişiye gönder.

---

## Dikkat

- **Ban riski:** Bot WhatsApp'ın resmi bir aracı değildir. Bir seferde en fazla 25 kişi ekler ve eklemeler
  arasında bekler; yine de günde bir kereden fazla çalıştırma.
- **KVKK:** Formda üyelerden, numaralarının WhatsApp grubuna eklenmek için kullanılacağına dair onay al.
- **Klasörü başkasına verirken** `.wwebjs_auth` klasörünü ve `oturumlar.json` dosyasını **verme**:
  bunlar senin bağlı WhatsApp oturumundur; veren kişinin hesabıyla işlem yapılabilir.
  `node_modules` ve `raporlar` klasörlerini de vermene gerek yok. (Başkalarına en kolayı bu GitHub
  sayfasının linkini göndermek.)
- Gelişmiş ayarlar (bekleme süreleri, tek seferdeki kişi sınırı) `config.json` içindedir; normalde dokunma.
