# Arayüz görselleri

Gemini ile üretilip 16 renkli palete oturtulmuş görseller. Biri silinirse
o parça kodla çizilen tasarıma geri döner.

| Dosya | Ne | Nasıl çizilir |
| --- | --- | --- |
| background.png | 960x540 arka plan, kaldırım 476. piksel hizasında | Olduğu gibi |
| sign_A..D.png | Cevap tabelaları | 9 parçalı, 1x |
| window_navy.png | Soru ve lobi penceresi | 9 parçalı, 2x |
| window_dark.png | Süre, skor tablosu ve küçük pencereler | 9 parçalı, 2x |
| pad_A..D.png | Cevap platformları | 3 parçalı (uçlar sabit, orta uzar) |

9 parçalı görsellerde köşeler sabit kalır, kenarlar ve orta kutunun boyuna göre uzar.
Kenar kalınlıkları `js/host.js` içindeki `UI_SPEC` listesinde.
