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

   Katıldıktan sonra telefon yatay bir el konsoluna dönüşür: solda **analog çubuk**, ortada ekran, sağda **A (ZIPLA)** düğmesi. Çubuğu ne kadar itersen karakter o kadar hızlı yürür; yukarı itmek de zıplatır. Ekranın sağ üstündeki üç çizgi bağlantı kalitesini gösterir. Telefon dik tutulursa "yan çevir" uyarısı çıkar. Android'de telefon kendiliğinden tam ekrana ve yatay moda geçer.
3. Herkes katılınca moderatör **Oyunu başlat** düğmesine basar.
4. **Okuma süresi:** Her soru önce tek başına gelir. Soru uzunluğuna göre 3–8 saniye cevaplar kapalı kalır, herkes soruyu okuyabilir. Bu sırada karakterler serbestçe yürüyebilir.
5. **Cevap süresi:** Cevaplar dört tabelada açılır. Oyuncular analog çubuk ve **A** düğmesiyle doğru bildikleri cevabın platformuna çıkar. Fikrini değiştiren platformdan inip başka birine zıplayabilir. Platformların üstünde kaç kişinin durduğu canlı görünür.
6. **Açıklama:** Süre bitince ya da moderatör **Onayla**'ya basınca cevaplar kilitlenir. Yanlış platformlar üstlerindekilerle birlikte çöker, doğru cevap parlar, puanlar karakterlerin üstünde belirir. Telefonlar sonucu büyük ekranla aynı anda gösterir.
7. **Puanlama (Kahoot formülü):** Doğru cevap en fazla 1000, en az 500 puan. Platforma ne kadar erken yerleşirsen o kadar çok puan alırsın. İlk 0,5 saniye içinde yerleşene tam puan verilir. Sayılan an, oyuncunun **son kez** platforma yerleştiği andır. Üst üste doğru cevaplar karakterin üstünde **SERİ** rozeti olarak görünür. **Son soru 2 kat puandır.**
8. Moderatör **Devam** ile puan tablosuna, oradan sonraki soruya geçer. En sonda ilk üç kürsüye çıkar.

## Moderatör kontrolleri

| Tuş | Düğme | Ne yapar |
| --- | --- | --- |
| Enter / Boşluk | Ana düğme | Başlat, okumayı kısalt, kilitle, açıklamayı hızlandır, devam |
| P | Duraklat | Soruyu durdurur; devam edince 3-2-1 sayar |
| T | +10 sn | Cevap süresine 10 saniye ekler |
| S | Atla | Soruyu puansız geçer |
| L | Katılım | Yeni oyuncuların katılımını kilitler/açar (kopanlar yine dönebilir) |
| M | Ses | Müziği ve efektleri açar/kapatır |
| F | | FPS, ping ve bağlantı türü ekranı |
| C | | Tarama çizgisi (CRT) efektini açar/kapatır |
| Z | | Tam sayı ölçek (en keskin piksel) / ekranı doldur |
| | Karaktere tıkla | O oyuncuyu oyundan çıkarır (onay sorar) |

Moderatör sekmesi gizlenirse (başka sekmeye geçilirse) oyun kendiliğinden duraklar.

## Ses

Müzik ve efektler sadece büyük ekranda çalar, kodla üretilir (dosya yok). Tarayıcı kuralı gereği ses, moderatör sayfaya ilk tıkladığında açılır. Efektler [ZzFX](https://github.com/KilledByAPixel/ZzFX) ile (MIT lisansı), müzik kendi yazdığımız küçük bir chiptune çalıcıyla.

## Takılma ve gecikme sorunları

- Moderatör ekranında **F** tuşuna basınca sol altta FPS ve her oyuncunun gecikmesi (ping) görünür. 80 ms altı iyi, 150 ms üstü yavaş sayılır.
- Bilgisayarın oyunu kaldırıp kaldırmadığını denemek için adrese `?bots=15` ekle (`host.html?bots=15`): 15 sahte oyuncu katılır ve rastgele dolaşır.
- FPS düşük olsa bile oyunun hızı değişmez; fizik her zaman saniyede 60 adım çalışır.
- Ping yüksekse sorun ağdadır: telefonlarla moderatör bilgisayarının aynı Wi-Fi'de olması gecikmeyi en çok düşüren şeydir.
- F ekranındaki **bağlantı türü**: `LAN` en iyisi (aynı ağ), `NAT` internet üzerinden doğrudan, `TURN` aracı sunucu üzerinden (en yavaşı). Çoğu oyuncu TURN görünüyorsa ya da hiç bağlanamıyorsa okul/şirket ağı doğrudan bağlantıyı engelliyor demektir: `js/config.js` dosyasındaki açıklamaya göre ücretsiz bir 443 portlu TURN sunucusu ekle.
- Oyuncuların hareketleri ayrı, **sırasız ve kayıplı** bir veri kanalından gider: kaybolan bir paket sonrakileri bekletmez. Telefonlar oyun sırasında saniyede 30 kez gönderir; bu, telefonun Wi-Fi'sinin uyuklamasını da önler.
- Telefonların ve moderatör bilgisayarının ekranı oyun sırasında kararmaz (Wake Lock; iPhone'da iOS 18.4 ve sonrası).

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
js/audio.js           Müzik ve ses efektleri
js/config.js          İsteğe bağlı TURN sunucusu ayarı
vendor/               PeerJS, QR kod ve ZzFX kütüphaneleri (MIT lisanslı)
```

## Lisanslar

- [PeerJS](https://github.com/peers/peerjs): MIT
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator): MIT
- [ZzFX](https://github.com/KilledByAPixel/ZzFX): MIT
- [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) ve [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans): SIL Open Font License (lisans metinleri `fonts/` klasöründe)
- Renk paleti: [Sweetie 16](https://lospec.com/palette-list/sweetie-16), GrafxKid
