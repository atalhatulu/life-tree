export const TURKEY_CITIES=[
 {id:'istanbul',name:'İstanbul',weight:18,cost:1.35,wage:1.18,housing:1.55,jobs:1.24,university:1.20},
 {id:'ankara',name:'Ankara',weight:8,cost:1.12,wage:1.08,housing:1.15,jobs:1.10,university:1.18},
 {id:'izmir',name:'İzmir',weight:7,cost:1.18,wage:1.05,housing:1.22,jobs:1.06,university:1.12},
 {id:'bursa',name:'Bursa',weight:6,cost:1.02,wage:1.04,housing:1.00,jobs:1.10,university:1.02},
 {id:'antalya',name:'Antalya',weight:5,cost:1.12,wage:1.00,housing:1.18,jobs:1.02,university:.98},
 {id:'adana',name:'Adana',weight:4,cost:.90,wage:.92,housing:.84,jobs:.94,university:.96},
 {id:'konya',name:'Konya',weight:4,cost:.86,wage:.93,housing:.80,jobs:.96,university:.98},
 {id:'gaziantep',name:'Gaziantep',weight:4,cost:.90,wage:.95,housing:.83,jobs:1.00,university:.92},
 {id:'mersin',name:'Mersin',weight:4,cost:.94,wage:.94,housing:.90,jobs:.94,university:.94},
 {id:'eskisehir',name:'Eskişehir',weight:3,cost:.95,wage:.91,housing:.92,jobs:.90,university:1.15},
 {id:'samsun',name:'Samsun',weight:3,cost:.88,wage:.91,housing:.84,jobs:.90,university:.96},
 {id:'kayseri',name:'Kayseri',weight:3,cost:.86,wage:.94,housing:.80,jobs:.98,university:.94},
 {id:'diyarbakir',name:'Diyarbakır',weight:3,cost:.84,wage:.89,housing:.76,jobs:.86,university:.92},
 {id:'trabzon',name:'Trabzon',weight:2,cost:.92,wage:.90,housing:.88,jobs:.88,university:.96}
];

export function cityById(id){
 return TURKEY_CITIES.find(city=>city.id===id)??TURKEY_CITIES[0];
}

export function pickBirthCity(rng){
 return rng.weighted(TURKEY_CITIES.map(city=>({value:city,weight:city.weight})));
}

export function locationProfile(state){
 return cityById(state.location?.cityId??state.origin?.cityId??'istanbul');
}
