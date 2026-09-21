import {JOBS} from '../data/catalog.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function assignAdultPath(child,rng){
 child.adultLife??={};
 if(child.adultLife.initialized)return;
 const educationChance=clamp(Math.round(35+(child.personality.curiosity??50)*.25+(child.personality.discipline??50)*.20));
 const college=rng.int(1,100)<=educationChance;
 child.adultLife.educationLevel=college?4:rng.int(1,3);
 const eligible=JOBS.filter(j=>j.id!=='unemployed'&&j.educationMin<=child.adultLife.educationLevel);
 if(eligible.length){
  const job=rng.weighted(eligible.map(value=>({value,weight:value.weight})));
  child.adultLife.jobId=job.id;
  child.adultLife.jobTitle=job.title;
  child.adultLife.monthlyIncome=rng.int(job.income[0],Math.max(job.income[0],Math.round(job.income[1]*.7)));
 }
 child.adultLife.partnered=false;
 child.adultLife.children=0;
 child.adultLife.initialized=true;
}

export function processDescendantLives(state,rng){
 const entries=[];
 for(const child of state.children??[]){
  if(child.age<18)continue;
  assignAdultPath(child,rng.fork(child.id+'-adult'));
  const life=child.adultLife;
  if(child.age>=22&&!life.partnered&&rng.fork(child.id+'-partner-'+child.age).chance(.12+(child.personality.sociability??50)*.0015)){
   life.partnered=true;
   life.partnerAge=child.age;
   entries.push({age:state.player.age,kind:'family',text:child.name+' ciddi bir ilişkiye başladı.'});
  }
  if(child.age>=25&&life.partnered&&life.children<2&&rng.fork(child.id+'-baby-'+child.age).chance(.08)){
   life.children+=1;
   state.grandchildren=(state.grandchildren??0)+1;
   entries.push({age:state.player.age,kind:'family',text:child.name+' çocuk sahibi oldu. Artık torunun var.'});
  }
  child.health.current=clamp(child.health.current+rng.int(-2,2));
 }
 return entries;
}
