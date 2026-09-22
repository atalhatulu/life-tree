export const HOBBY_ACTIVITIES=[
 {id:'football',label:'Futbol',frequencyWeight:.9,cost:500,interest:'futbol',stressRelief:3,physicalGain:1.4},
 {id:'music',label:'Müzik',frequencyWeight:1.05,cost:900,interest:'müzik',stressRelief:4,curiosityGain:.3},
 {id:'reading',label:'Okuma',frequencyWeight:1.1,cost:250,interest:'okuma',stressRelief:3,curiosityGain:.6},
 {id:'gaming',label:'Oyun',frequencyWeight:1.05,cost:400,interest:'oyun',stressRelief:4},
 {id:'painting',label:'Resim',frequencyWeight:1,cost:700,interest:'resim',stressRelief:4,curiosityGain:.3},
 {id:'running',label:'Koşu',cost:0,interest:'koşu',stressRelief:2,physicalGain:1.1,frequencyWeight:.55},
 {id:'cooking',label:'Yemek yapmak',frequencyWeight:1,cost:800,interest:'yemek',stressRelief:3,curiosityGain:.2},
 {id:'cars',label:'Otomobil hobisi',frequencyWeight:.85,cost:1200,interest:'otomobil',stressRelief:2,curiosityGain:.2},
 {id:'technology',label:'Teknoloji',frequencyWeight:1,cost:700,interest:'teknoloji',stressRelief:2,curiosityGain:.5},
 {id:'nature',label:'Doğa',frequencyWeight:1.1,cost:350,interest:'doğa',stressRelief:5,physicalGain:.8},
 {id:'cinema',label:'Sinema',frequencyWeight:1,cost:900,interest:'sinema',stressRelief:4,curiosityGain:.2},
 {id:'dance',label:'Dans',frequencyWeight:.95,cost:800,interest:'dans',stressRelief:4,physicalGain:1.2},
 {id:'photography',label:'Fotoğraf',frequencyWeight:1,cost:900,interest:'fotoğraf',stressRelief:4,curiosityGain:.4}
];

export function hobbyById(id){return HOBBY_ACTIVITIES.find(x=>x.id===id)??null;}
