export const TURKEY_2026_ECONOMY={
 currency:'TRY',
 basis:'2026-real-TRY',
 netMinimumWage:30000,
 lifestyle:{
  housing:{family:1200,shared:10500,studio:16500,apartment:24500,owned:7000},
  food:{frugal:3500,standard:5200,healthy:7500,premium:13000},
  clothing:{basic:1400,standard:3200,premium:7600},
  transport:{public:2200,car:9500},
  leisure:{family:1800,shared:2600,studio:3300,apartment:4400,owned:4200}
 },
 assets:{
  cars:[
   {id:'used',label:'İkinci el otomobil',price:420000,runningCost:7000,status:2},
   {id:'standard',label:'Standart otomobil',price:850000,runningCost:10500,status:4},
   {id:'premium',label:'Premium otomobil',price:1650000,runningCost:18500,status:8}
  ],
  homes:[
   {id:'small-flat',label:'Küçük daire',price:2200000,housing:'owned'},
   {id:'family-flat',label:'Standart daire',price:3800000,housing:'owned'}
  ]
 }
};
