const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function ensureLifeMemory(state){
 state.lifeMemory??={memories:[],tags:{},resilience:50,scarLoad:0,lastRecordedAge:null};
 state.lifeMemory.memories??=[];
 state.lifeMemory.tags??={};
 return state.lifeMemory;
}

function addMemory(state,id,label,valence,intensity,tags=[]){
 const m=ensureLifeMemory(state);
 if(m.memories.some(x=>x.id===id))return false;
 m.memories.push({id,label,age:state.player.age,valence,intensity,tags});
 for(const tag of tags)m.tags[tag]=(m.tags[tag]??0)+intensity;
 return true;
}

export function processMemoryConsequencesYear(state){
 const m=ensureLifeMemory(state);
 const entries=[];
 if(state.lastDivorceAge===state.player.age&&addMemory(state,'divorce-'+state.player.age,'Boşanma',-1,8,['loss','relationship'])){
  entries.push({age:state.player.age,kind:'memory',text:'Boşanmanın etkisi bu dönemin önemli anılarından biri oldu.'});
 }
 if(state.widowedAtAge===state.player.age&&addMemory(state,'widow-'+state.player.age,'Eş kaybı',-1,10,['loss','grief'])){
  entries.push({age:state.player.age,kind:'memory',text:'Eş kaybı hayatında kalıcı bir iz bıraktı.'});
 }
 if((state.finance?.financialDistressYears??0)>=2&&addMemory(state,'debt-crisis-'+state.player.age,'Finansal kriz',-1,6,['money','scar'])){
  entries.push({age:state.player.age,kind:'memory',text:'Uzayan finansal baskı gelecekteki para kararlarını etkileyecek kadar ağırlaştı.'});
 }
 if((state.career?.workplace?.burnout??0)>=75&&addMemory(state,'burnout-'+state.player.age,'Tükenmişlik dönemi',-1,6,['work','scar'])){
  entries.push({age:state.player.age,kind:'memory',text:'İş tükenmişliği hafızanda olumsuz bir dönem olarak yer etti.'});
 }
 if((state.social?.romance?.trust??0)>=82&&(state.social?.romance?.yearsTogether??0)>=5&&addMemory(state,'secure-partnership-'+state.player.age,'Güvenli ilişki dönemi',1,5,['relationship','support'])){
  entries.push({age:state.player.age,kind:'memory',text:'Uzun süreli güvenli ilişkin sana güçlü bir destek duygusu kazandırdı.'});
 }
 if((state.career?.workplace?.recognition??0)>=80&&addMemory(state,'career-recognition-'+state.player.age,'Kariyer başarısı',1,5,['work','confidence'])){
  entries.push({age:state.player.age,kind:'memory',text:'Kariyerindeki görünür başarı kendine güvenini besledi.'});
 }
 const positive=(m.tags.support??0)+(m.tags.confidence??0);
 const negative=(m.tags.scar??0)+(m.tags.loss??0)+(m.tags.grief??0);
 m.scarLoad=clamp(Math.round(negative*.8));
 m.resilience=clamp(50+Math.round(positive*.7)-Math.round(negative*.25)+((state.player.personality?.patience??50)-50)*.1);
 if(m.scarLoad>=35)state.healthProfile.stress=clamp((state.healthProfile?.stress??20)+2);
 if(m.resilience>=65)state.healthProfile.stress=clamp((state.healthProfile?.stress??20)-2);
 m.memories=m.memories.slice(-40);
 return entries;
}
