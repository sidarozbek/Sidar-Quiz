// Sidar Quiz ayarları
//
// Okul ve şirket ağları çoğu zaman sadece 443 portuna izin verir. Böyle ağlarda
// oyuncular bağlanamıyor ya da çok gecikmeli bağlanıyorsa 443/TLS üzerinden çalışan
// bir TURN sunucusu ekle. Ücretsiz seçenek: Metered "Open Relay" (ayda 20 GB, kayıt gerekir):
//   https://www.metered.ca/tools/openrelay/
// Kayıt olunca panelde verilen adresleri, kullanıcı adını ve şifreyi aşağıya yaz ve satırların başındaki // işaretlerini kaldır.
// 15 oyunculu bir saatlik oyun en kötü durumda yaklaşık 100 MB harcar.

window.SIDAR_CONFIG = {
  iceServers: [
    // { urls: 'turn:global.relay.metered.ca:80', username: 'KULLANICI', credential: 'SIFRE' },
    // { urls: 'turn:global.relay.metered.ca:443?transport=tcp', username: 'KULLANICI', credential: 'SIFRE' },
    // { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: 'KULLANICI', credential: 'SIFRE' },
  ],
};
