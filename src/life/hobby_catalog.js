export const HOBBY_ACTIVITIES=[
 {id:'football',label:'Futbol',cost:500,interest:'futbol',stressRelief:3,physicalGain:1.4},
 {id:'music',label:'Müzik',cost:900,interest:'müzik',stressRelief:4,curiosityGain:.3},
 {id:'reading',label:'Okuma',cost:250,interest:'okuma',stressRelief:3,curiosityGain:.6},
 {id:'gaming',label:'Oyun',cost:400,interest:'oyun',stressRelief:4},
 {id:'painting',label:'Resim',cost:700,interest:'resim',stressRelief:4,curiosityGain:.3},
 {id:'running',label:'Koşu',cost:0,interest:'koşu',stressRelief:3,physicalGain:1.6},
 {id:'cooking',label:'Yemek yapmak',cost:800,interest:'yemek',stressRelief:3,curiosityGain:.2},
 {id:'cars',label:'Otomobil hobisi',cost:1200,interest:'otomobil',stressRelief:2,curiosityGain:.2},
 {id:'technology',label:'Teknoloji',cost:700,interest:'teknoloji',stressRelief:2,curiosityGain:.5},
 {id:'nature',label:'Doğa',cost:350,interest:'doğa',stressRelief:5,physicalGain:.8},
 {id:'cinema',label:'Sinema',cost:900,interest:'sinema',stressRelief:4,curiosityGain:.2},
 {id:'dance',label:'Dans',cost:800,interest:'dans',stressRelief:4,physicalGain:1.2},
 {id:'photography',label:'Fotoğraf',cost:900,interest:'fotoğraf',stressRelief:4,curiosityGain:.4}
];

export function hobbyById(id){return HOBBY_ACTIVITIES.find(x=>x.id===id)??null;}
