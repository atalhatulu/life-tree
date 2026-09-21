export const SOCIAL_ACTIVITIES=[
 {id:'park-walk',label:'Parkta yürüyüş',cost:0,preferenceKind:'activity',preferenceKey:'park',baseRelationship:2,stressRelief:2},
 {id:'tea',label:'Çay / kahve ısmarla',cost:300,preferenceKind:'food',preferenceKey:'tea',baseRelationship:2,stressRelief:2},
 {id:'home-meal',label:'Evde yemek ye',cost:600,preferenceKind:'food',preferenceKey:'home-meal',baseRelationship:3,stressRelief:2},
 {id:'doner',label:'Döner ısmarla',cost:700,preferenceKind:'food',preferenceKey:'doner',baseRelationship:3,stressRelief:2},
 {id:'lahmacun',label:'Lahmacun ısmarla',cost:750,preferenceKind:'food',preferenceKey:'lahmacun',baseRelationship:3,stressRelief:2},
 {id:'burger',label:'Hamburger ısmarla',cost:900,preferenceKind:'food',preferenceKey:'burger',baseRelationship:3,stressRelief:2},
 {id:'pizza',label:'Pizza ısmarla',cost:1100,preferenceKind:'food',preferenceKey:'pizza',baseRelationship:3,stressRelief:2},
 {id:'cafe',label:'Kafede buluş',cost:1200,preferenceKind:'activity',preferenceKey:'cafe',baseRelationship:3,stressRelief:3},
 {id:'cinema',label:'Sinemaya git',cost:1600,preferenceKind:'activity',preferenceKey:'cinema',baseRelationship:4,stressRelief:3},
 {id:'picnic',label:'Piknik yap',cost:1800,preferenceKind:'activity',preferenceKey:'picnic',baseRelationship:4,stressRelief:4},
 {id:'football',label:'Birlikte futbol oyna',cost:500,preferenceKind:'activity',preferenceKey:'football',baseRelationship:4,stressRelief:3,physical:true},
 {id:'gaming',label:'Birlikte oyun oyna',cost:400,preferenceKind:'activity',preferenceKey:'gaming',baseRelationship:3,stressRelief:3},
 {id:'museum',label:'Müze / sergi gez',cost:1000,preferenceKind:'activity',preferenceKey:'museum',baseRelationship:4,stressRelief:3},
 {id:'hiking',label:'Doğa yürüyüşüne çık',cost:900,preferenceKind:'activity',preferenceKey:'hiking',baseRelationship:4,stressRelief:4,physical:true},
 {id:'concert',label:'Konsere git',cost:3200,preferenceKind:'activity',preferenceKey:'concert',baseRelationship:5,stressRelief:5},
 {id:'day-trip',label:'Günübirlik gezi yap',cost:6500,preferenceKind:'activity',preferenceKey:'hiking',baseRelationship:6,stressRelief:6}
];

export function socialActivityById(id){return SOCIAL_ACTIVITIES.find(x=>x.id===id)??null;}
