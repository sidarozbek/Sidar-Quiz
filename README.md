# Sidar Quiz

Kahoot tarzı, çok oyunculu bir bilgi yarışması. Sorular moderatörün büyük ekranında çıkar. Oyuncular telefonlarından kendi 16-bit karakterlerini yönetir ve doğru bildikleri cevabın platformuna zıplar. Süre bitince ya da moderatör onaylayınca sonuçlar açıklanır.

- 2–15 oyuncu
- Sunucu gerekmez: GitHub Pages'te ücretsiz çalışır
- Oyuncular QR kod ya da 5 haneli oda koduyla katılır

## Tasarım

80'ler ve 90'ların 16-bit oyun dönemi: bütün renkler 16 renkli tek bir retro paletten (Sweetie 16) geliyor, yazılar piksel fontlarla, pencereler SNES dönemi RPG kutuları gibi çift çerçeveli. Arka planda bant bant gün batımı, çizgili synthwave güneşi ve piksel şehir var. Puan tablosu atari salonlarındaki "en yüksek skorlar" ekranı gibi. Moderatör ekranında hafif bir CRT tarama çizgisi efekti var.

Renkleri değiştirmek istersen hepsi `js/common.js` dosyasındaki `PAL`, `ANSWERS` ve `PLAYER_COLORS` listelerinde ve `css/style.css` dosyasının başında.

## Nasıl oynanır

1. **Moderatör** sitenin adresini açar ve **OYUN KUR** düğmesine basar. Ekranı projeksiyona ya da büyük bir ekrana yansıtır. Ekranda oda kodu ve QR kod çıkar.
2. **Oyuncular** QR kodu telefonlarının kamerasıyla okutur. Oyuna sadece QR ile katılınır; sitenin ana adresi sadece oyun kurmaya yarar. Katılma iki adımdır:
   - **Karakterini seç:** 6 karakterden birini seçer (aynı adam, farklı takım elbise ve kravat renkleriyle).
   - **Adını yaz:** seçtiği karakterin önizlemesini görür, adını yazar ve katılır.

   Katıldıktan sonra telefon yatay bir el konsoluna dönüşür: solda yön tuşları, ortada ekran, sağda **A (ZIPLA)** düğmesi. Telefon dik tutulursa "yan çevir" uyarısı çıkar. Android'de telefon kendiliğinden tam ekrana ve yatay moda geçer.
3. Herkes katılınca moderatör **Oyunu başlat** düğmesine basar.
4. Her soruda 3 saniyelik geri sayımdan sonra karakterler yerde başlar. Oyuncular konsoldaki yön tuşları ve **A** düğmesiyle (yukarı ok da zıplatır) doğru bildikleri cevabın platformuna çıkar. Fikrini değiştiren platformdan inip başka birine zıplayabilir.
5. Süre bitince ya da moderatör **Onayla** düğmesine basınca, kimin hangi platformda durduğu cevabı olarak sayılır. Yerde kalan cevap vermemiş olur.
6. Doğru cevap verenler en fazla 1000 puan alır. Platforma ne kadar erken çıkıp orada kalırsan o kadar çok puan alırsın (süre sonunda en az 500).
7. Moderatör **Devam** ile puan tablosuna, oradan sonraki soruya geçer. En sonda ilk üç kürsüye çıkar.

Moderatör ekranında **Enter** tuşu o anki ana düğmeye basar.

## GitHub Pages'te yayınlama

1. GitHub'da yeni bir **public** depo oluştur.
2. Bu klasördeki bütün dosyaları depoya yükle. `index.html` deponun en üst klasöründe olmalı.
3. Deponun **Settings → Pages** sayfasında **Source** olarak "Deploy from a branch" seç, branch olarak `main` ve klasör olarak `/ (root)` seç, kaydet.
4. Bir iki dakika sonra oyun `https://KULLANICI_ADIN.github.io/DEPO_ADI/` adresinde açılır.

QR kod, moderatör sayfasının adresinden otomatik üretilir. GitHub Pages'te açtığında doğru adresi gösterir.

## Arayüz görselleri

Arka plan, cevap tabelaları, soru ve süre pencereleri ve platformlar `assets/ui/` klasöründeki görsellerden çizilir (Gemini ile üretildi, 16 renkli palete oturtuldu). Bir görseli değiştirmek için aynı adla yenisini koyman yeterli. Arka plan 960x540 olmalı ve kaldırım üstten 476. piksel hizasında başlamalı. Ayrıntılar `assets/ui/README.md` dosyasında.

## Yeni karakter eklemek

Karakterler `assets/sprites/<karakter-adı>/` klasörlerinde durur. Her klasörde aynı 9 kare bulunur: `front_idle`, `idle_1`, `idle_2`, `walk_1`–`walk_4`, `run_1`, `run_2` (128x128 PNG, ayaklar 108. satırda). Yeni bir klasör ekle ve `js/common.js` dosyasındaki `CHARACTERS` listesine adını yaz; seçim ekranında otomatik çıkar.

## Kendi sorularını eklemek

İki yol var:

**1. Kalıcı olarak:** `js/questions.js` dosyasındaki listeyi düzenle.

**2. Oyun öncesi dosya yükleyerek:** Moderatör ekranında, lobideyken **Soru dosyası yükle** düğmesine bas ve bir `.json` dosyası seç. Örnek için `ornek-sorular.json` dosyasına bak:

```json
[
  {
    "q": "1 byte kaç bittir?",
    "answers": ["4", "8", "16", "32"],
    "correct": 1,
    "time": 15
  }
]
```

- `answers`: tam olarak 4 cevap (A, B, C, D sırasıyla)
- `correct`: doğru cevabın sırası, `0` = A, `1` = B, `2` = C, `3` = D
- `time`: saniye cinsinden süre (yazmazsan 20)

## Bilmen gerekenler

- **Moderatörün sekmesi oyun boyunca açık kalmalı.** Oyunun bütün mantığı moderatörün tarayıcısında çalışır. Sekme kapanırsa ya da bilgisayar uyku moduna geçerse oyun durur.
- **Bağlantı PeerJS ile kurulur.** Oyuncular birbirini bulmak için PeerJS'in ücretsiz genel sunucusunu kullanır, sonra cihazlar doğrudan (WebRTC) konuşur. Bu genel sunucu bazen yavaşlayabilir ya da kısa süreli kesintiye uğrayabilir.
- **Bazı okul ve şirket ağları WebRTC'yi engeller.** Böyle bir ağda oyuncular odaya bağlanamayabilir. Böyle olursa oyuncuların mobil veriye geçmesi genelde sorunu çözer. Önemli bir etkinlikten önce aynı ağda bir deneme yap.
- **Bağlantısı kopan oyuncu puanını kaybetmez.** Aynı telefondan sayfayı yenileyip tekrar katıldığında kaldığı yerden devam eder.

## Kendi PeerJS sunucunu kullanmak (isteğe bağlı)

Genel sunucu yerine kendi sunucunu kullanmak istersen ([peerjs-server](https://github.com/peers/peerjs-server)), moderatör sayfasını şu parametrelerle aç:

```
host.html?peerhost=sunucu.adresin.com&peerport=443&peerpath=/myapp&peersecure=1
```

Bu parametreler QR koda da eklenir, oyuncular otomatik olarak aynı sunucuyu kullanır.

## Yerelde çalıştırma

```bash
python -m http.server 8000
```

Sonra tarayıcıda `http://localhost:8000` adresini aç. Telefonların bilgisayara erişebilmesi için aynı Wi-Fi ağında olmaları ve adreste `localhost` yerine bilgisayarın yerel IP adresinin yazması gerekir. En kolayı GitHub Pages'te yayınlayıp oradan denemektir.

## Dosya yapısı

```
index.html            Giriş sayfası (sadece oyun kurma)
host.html             Moderatör ekranı
play.html             Oyuncu telefonu (QR ile açılır, yatay el konsolu)
js/common.js          Ortak ayarlar: renkler, şekiller, bağlantı ayarları
js/host.js            Oyun mantığı, fizik, puanlama ve çizim
js/play.js            Telefon kumandası ve bağlantı
js/questions.js       Varsayılan sorular
ornek-sorular.json    Yüklenebilir soru dosyası örneği
css/style.css         Bütün sayfaların stili
assets/sprites/       Karakter kareleri (her karakter ayrı klasörde, 128x128 PNG)
assets/ui/            Arka plan, tabela, pencere ve platform görselleri
fonts/                Piksel fontlar (Press Start 2P, Pixelify Sans)
vendor/               PeerJS ve QR kod kütüphaneleri (MIT lisanslı)
```

## Lisanslar

- [PeerJS](https://github.com/peers/peerjs): MIT
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator): MIT
- [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) ve [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans): SIL Open Font License (lisans metinleri `fonts/` klasöründe)
- Renk paleti: [Sweetie 16](https://lospec.com/palette-list/sweetie-16), GrafxKid
