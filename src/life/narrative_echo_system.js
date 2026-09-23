const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function eligibleMemories(state){
 return (state.lifeMemory?.memories??[]).filter(m=>
  state.player.age-m.age>=3&&
  state.player.age-m.age<=25&&
  m.lastEchoAge!==state.player.age&&
  (m.echoCount??0)<3
 );
}

function eligibleDecisions(state){
 return (state.lifeTree?.nodes??[]).filter(n=>
  state.player.age-n.age>=4&&
  state.player.age-n.age<=30&&
  n.lastEchoAge!==state.player.age&&
  (n.echoCount??0)<2
 );
}

function applyMemoryEcho(state,memory){
 memory.lastEchoAge=state.player.age;
 memory.echoCount=(memory.echoCount??0)+1;
 const positive=memory.valence>0;
 if(state.healthProfile){
  state.healthProfile.stress=clamp((state.healthProfile.stress??20)+(positive?-2:2));
 }
 if(positive&&state.lifeMemory)state.lifeMemory.resilience=clamp((state.lifeMemory.resilience??50)+1);
 if(!positive&&state.lifeMemory)state.lifeMemory.scarLoad=clamp((state.lifeMemory.scarLoad??0)+1);
 return 'Yıllar önceki “'+memory.label+'” dönemi yeniden aklına geldi; etkisi bugün verdiğin kararlarda hâlâ hissediliyor.';
}

function applyDecisionEcho(state,node){
 node.lastEchoAge=state.player.age;
 node.echoCount=(node.echoCount??0)+1;
 const category=node.pacingCategory??'life';
 if(category==='career'&&state.career?.employed)state.career.satisfaction=clamp((state.career.satisfaction??50)+1);
 if(category==='relationship'&&state.social?.romance)state.social.romance.trust=clamp((state.social.romance.trust??60)+1);
 if(category==='family'&&state.children?.length)for(const child of state.children)child.relationship=clamp((child.relationship??60)+1);
 return node.age+' yaşında verdiğin “'+node.label+'” kararı bugün hayatının yönünü hâlâ etkiliyor.';
}

export function processNarrativeEchoesYear(state,rng){
 if(state.player.age<22)return [];
 const entries=[];
 const memories=eligibleMemories(state);
 const decisions=eligibleDecisions(state);
 const yearsSince=state.narrativeEcho?.lastAge==null?99:state.player.age-state.narrativeEcho.lastAge;
 if(yearsSince<2)return entries;
 const pool=[];
 for(const m of memories)pool.push({type:'memory',value:m,weight:Math.max(1,m.intensity??3)});
 for(const n of decisions)pool.push({type:'decision',value:n,weight:4});
 if(!pool.length||!rng.chance(Math.min(.55,.18+yearsSince*.06)))return entries;
 const picked=rng.weighted(pool.map(x=>({value:x,weight:x.weight})));
 const text=picked.type==='memory'?applyMemoryEcho(state,picked.value):applyDecisionEcho(state,picked.value);
 state.narrativeEcho??={lastAge:null,total:0};
 state.narrativeEcho.lastAge=state.player.age;
 state.narrativeEcho.total=(state.narrativeEcho.total??0)+1;
 entries.push({age:state.player.age,kind:'narrative-echo',text});
 return entries;
}
