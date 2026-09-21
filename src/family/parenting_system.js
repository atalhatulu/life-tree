import {createChild} from './descendant_generator.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function ensureChildren(state){
 state.children??=[];
 return state.children;
}

export function addChild(state,rng){
 const children=ensureChildren(state);
 const child=createChild(state,rng,'child-'+state.year+'-'+children.length);
 children.push(child);
 state.finance??={};
 state.finance.childMonthlyCost=(state.finance.childMonthlyCost??0)+6500;
 return child;
}

export function processChildrenYear(state,rng){
 const entries=[];
 for(const child of ensureChildren(state)){
  child.age+=1;
  child.health.current=clamp(child.health.current+rng.int(-2,2));
  if(child.age===6) entries.push({age:state.player.age,kind:'family',text:child.name+' okula başladı.'});
  if(child.age===18) entries.push({age:state.player.age,kind:'family',text:child.name+' yetişkinliğe adım attı.'});
 }
 if(state.finance){
  state.finance.childMonthlyCost=ensureChildren(state).reduce((sum,child)=>{
   if(child.age>=22)return sum;
   if(child.age>=18)return sum+(child.educationPlan==='university'?8500:child.educationPlan==='vocational'?4000:2500);
   if(child.age>=13)return sum+7500;
   return sum+6500;
  },0);
 }
 return entries;
}
