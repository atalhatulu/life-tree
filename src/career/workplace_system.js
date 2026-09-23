const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function ensureWorkplaceState(state,rng){
 const c=state.career;
 if(!c?.employed)return null;
 c.workplace??={
  bossQuality:rng.int(28,88),
  teamCohesion:rng.int(30,85),
  cultureFit:rng.int(35,82),
  workload:rng.int(35,72),
  autonomy:rng.int(25,80),
  recognition:45,
  burnout:15,
  reputation:50,
  officePolitics:rng.int(10,65)
 };
 return c.workplace;
}

export function processWorkplaceYear(state,rng){
 const c=state.career;
 const entries=[];
 if(!c?.employed)return entries;
 const w=ensureWorkplaceState(state,rng.fork('init'));
 const pressure=Math.max(0,w.workload-55)+Math.max(0,w.officePolitics-60)*.5+Math.max(0,50-w.bossQuality)*.4;
 const buffers=Math.max(0,w.teamCohesion-55)*.25+Math.max(0,w.autonomy-50)*.18+Math.max(0,w.cultureFit-50)*.18;
 w.burnout=clamp(w.burnout+Math.round(pressure*.12-buffers*.08)+rng.int(-2,3));
 w.recognition=clamp(w.recognition+rng.int(-3,4)+((c.performance??50)>70?2:0)+((c.network??50)>65?1:0));
 w.reputation=clamp(w.reputation+rng.int(-2,2)+((c.performance??50)-55)*.035+((w.recognition??45)-50)*.02);
 w.teamCohesion=clamp(w.teamCohesion+rng.int(-3,3));
 w.bossQuality=clamp(w.bossQuality+rng.int(-2,2));
 w.workload=clamp(w.workload+rng.int(-4,4));
 c.satisfaction=clamp((c.satisfaction??50)+Math.round((w.cultureFit-50)*.03+(w.bossQuality-50)*.025-(w.burnout-35)*.04));
 c.performance=clamp((c.performance??50)+Math.round((w.recognition-50)*.02+(w.teamCohesion-50)*.015-(w.burnout-50)*.035));
 if(w.burnout>=70){
  state.healthProfile.stress=clamp((state.healthProfile?.stress??20)+6);
  entries.push({age:state.player.age,kind:'workplace',text:'İş yükü ve tükenmişlik artık günlük hayatına taşmaya başladı.'});
 }
 if(w.bossQuality<=32&&rng.chance(.22))entries.push({age:state.player.age,kind:'workplace',text:'Yöneticinle yaşadığın sürtüşme iş memnuniyetini düşürdü.'});
 if(w.recognition>=76&&rng.chance(.2))entries.push({age:state.player.age,kind:'workplace',text:'İş yerinde yaptığın iş daha görünür hale geldi; itibarın arttı.'});
 return entries;
}
