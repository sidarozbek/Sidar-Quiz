// Varsayılan soru listesi. Kendi sorularını buraya yazabilir
// ya da moderatör ekranındaki "Soru dosyası yükle" düğmesiyle bir .json dosyası yükleyebilirsin.
//
// Biçim:
//   q:       soru metni
//   answers: tam olarak 4 cevap
//   correct: doğru cevabın sırası (0 = A, 1 = B, 2 = C, 3 = D)
//   time:    saniye cinsinden süre (isteğe bağlı, varsayılan 20)

window.DEFAULT_QUESTIONS = [
  {
    q: "Türkiye'nin başkenti neresidir?",
    answers: ['İstanbul', 'Ankara', 'İzmir', 'Bursa'],
    correct: 1,
    time: 15,
  },
  {
    q: 'Bir yılda kaç ay vardır?',
    answers: ['10', '11', '12', '13'],
    correct: 2,
    time: 15,
  },
  {
    q: 'Güneş sistemindeki en büyük gezegen hangisidir?',
    answers: ['Jüpiter', 'Satürn', 'Dünya', 'Mars'],
    correct: 0,
    time: 20,
  },
  {
    q: '16-bit oyun konsollarından biri hangisidir?',
    answers: ['PlayStation 5', 'Atari 2600', 'Xbox', 'Super Nintendo'],
    correct: 3,
    time: 20,
  },
  {
    q: 'Suyun deniz seviyesindeki kaynama noktası kaç °C\'dir?',
    answers: ['90', '100', '110', '120'],
    correct: 1,
    time: 15,
  },
];
