export const PHYSICAL_ACTIVITIES=[
 {id:'walk',label:'Tempolu yürüyüş',preferenceKey:'park',cost:0,minCapacity:15,fitnessGain:1.7,stressRelief:2,intensity:1,buildFocus:0},
 {id:'yoga',label:'Yoga / esneme',preferenceKey:'gym',cost:500,minCapacity:18,fitnessGain:2.0,stressRelief:4,intensity:1,buildFocus:.2},
 {id:'cycling',label:'Bisiklet sür',preferenceKey:'hiking',cost:600,minCapacity:28,fitnessGain:2.9,stressRelief:3,intensity:2,buildFocus:.3},
 {id:'run',label:'Koşu yap',preferenceKey:'hiking',cost:0,minCapacity:38,fitnessGain:3.2,stressRelief:3,intensity:3,buildFocus:.4},
 {id:'swim',label:'Yüzmeye git',preferenceKey:'gym',cost:900,minCapacity:32,fitnessGain:3.1,stressRelief:4,intensity:2,buildFocus:.5},
 {id:'gym',label:'Ağırlık antrenmanı yap',preferenceKey:'gym',cost:1200,minCapacity:42,fitnessGain:3.4,stressRelief:2,intensity:3,buildFocus:1}
];

export function physicalActivityById(id){return PHYSICAL_ACTIVITIES.find(x=>x.id===id)??null;}
