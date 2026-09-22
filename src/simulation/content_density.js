export const CONTENT_AGE_BANDS=[
 {id:'0-12',min:0,max:12},
 {id:'13-18',min:13,max:18},
 {id:'19-25',min:19,max:25},
 {id:'26-40',min:26,max:40},
 {id:'41-60',min:41,max:60},
 {id:'61+',min:61,max:Infinity}
];

function isMeaningful(item){
 if(!item)return false;
 if(item.kind==='finance'||item.kind==='activity')return false;
 return ['choice','education','career','relationship','family','health','mental-health','social','world','death'].includes(item.kind)
  || Boolean(item.eventId);
}

export function auditContentDensity(state){
 const finalAge=Math.max(0,state.player?.age??0);
 const meaningful=(state.history??[]).filter(isMeaningful);
 const result={};
 for(const band of CONTENT_AGE_BANDS){
  const end=Math.min(finalAge,band.max);
  const start=band.min;
  if(end<start){
   result[band.id]={yearsObserved:0,activeYears:0,quietYears:0,meaningfulEntries:0,densityPct:0};
   continue;
  }
  const yearsObserved=end-start+1;
  const rows=meaningful.filter(x=>Number.isFinite(x.age)&&x.age>=start&&x.age<=band.max);
  const activeYears=new Set(rows.map(x=>x.age)).size;
  result[band.id]={
   yearsObserved,
   activeYears,
   quietYears:Math.max(0,yearsObserved-activeYears),
   meaningfulEntries:rows.length,
   densityPct:Number((activeYears/yearsObserved*100).toFixed(1))
  };
 }
 return result;
}
