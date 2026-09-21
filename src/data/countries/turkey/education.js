export const SCHOOL_PREFIXES=[
 'Atatürk','Cumhuriyet','Yunus Emre','Mevlana','Mimar Sinan','Barış Manço',
 'Şehit Öğretmenler','Gazi','Fatih','Hacı Bektaş Veli','Namık Kemal','Halide Edip Adıvar'
];

export const UNIVERSITIES=[
 {id:'istanbul-university',name:'İstanbul Üniversitesi',cityId:'istanbul'},
 {id:'marmara',name:'Marmara Üniversitesi',cityId:'istanbul'},
 {id:'yildiz',name:'Yıldız Teknik Üniversitesi',cityId:'istanbul'},
 {id:'ankara-university',name:'Ankara Üniversitesi',cityId:'ankara'},
 {id:'gazi',name:'Gazi Üniversitesi',cityId:'ankara'},
 {id:'ege',name:'Ege Üniversitesi',cityId:'izmir'},
 {id:'dokuz-eylul',name:'Dokuz Eylül Üniversitesi',cityId:'izmir'},
 {id:'uludag',name:'Bursa Uludağ Üniversitesi',cityId:'bursa'},
 {id:'anadolu',name:'Anadolu Üniversitesi',cityId:'eskisehir'},
 {id:'akdeniz',name:'Akdeniz Üniversitesi',cityId:'antalya'},
 {id:'cukurova',name:'Çukurova Üniversitesi',cityId:'adana'},
 {id:'selcuk',name:'Selçuk Üniversitesi',cityId:'konya'},
 {id:'gaziantep',name:'Gaziantep Üniversitesi',cityId:'gaziantep'},
 {id:'ondokuz-mayis',name:'Ondokuz Mayıs Üniversitesi',cityId:'samsun'}
];

export const UNIVERSITY_NAMES=UNIVERSITIES.map(x=>x.name);

export const UNIVERSITY_PROGRAMS=[
 {id:'engineering',title:'Mühendislik',minReadiness:58,duration:4,interests:['teknoloji','matematik'],careerTags:['engineer','developer']},
 {id:'business',title:'İşletme',minReadiness:48,duration:4,interests:['ticaret','sosyallik'],careerTags:['accountant','shopkeeper']},
 {id:'education',title:'Eğitim Bilimleri',minReadiness:50,duration:4,interests:['okuma','eğitim','insanlar'],careerTags:['teacher']},
 {id:'health',title:'Sağlık Bilimleri',minReadiness:62,duration:4,interests:['sağlık','insanlar'],careerTags:['nurse']},
 {id:'arts',title:'Sanat ve Tasarım',minReadiness:44,duration:4,interests:['müzik','resim','dans','fotoğraf'],careerTags:['designer']},
 {id:'computer',title:'Bilgisayar Bilimleri',minReadiness:60,duration:4,interests:['teknoloji','oyun','matematik'],careerTags:['developer']},
 {id:'law',title:'Hukuk',minReadiness:67,duration:4,interests:['okuma','insanlar'],careerTags:['lawyer']},
 {id:'medicine',title:'Tıp',minReadiness:78,duration:6,interests:['sağlık','okuma'],careerTags:['doctor']}
];
