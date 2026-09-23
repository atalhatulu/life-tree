const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function ensureConsequenceChains(state){
 state.consequenceChains??=[];
 return state.consequenceChains;
}

function startChain(state,type,data={}){
 const chains=ensureConsequenceChains(state);
 if(chains.some(c=>c.type===type&&!c.resolved))return null;
 const chain={id:type+'-'+state.year,type,startedAtAge:state.player.age,step:0,resolved:false,data};
 chains.push(chain);
 return chain;
}

export function processConsequenceChainsYear(state,rng){
 const entries=[];
 const chains=ensureConsequenceChains(state);

 if((state.career?.workplace?.burnout??0)>=72){
  startChain(state,'burnout-spiral');
 }
 if((state.householdDynamics?.financialPressure??0)>=70){
  startChain(state,'financial-strain');
 }
 if((state.social?.romance?.resentment??0)>=70){
  startChain(state,'relationship-erosion');
 }

 for(const chain of chains){
  if(chain.resolved)continue;
  chain.step+=1;

  if(chain.type==='burnout-spiral'){
    if(chain.step===1){
      state.healthProfile.stress=clamp((state.healthProfile?.stress??20)+4);
      if(state.social?.romance)state.social.romance.intimacy=clamp((state.social.romance.intimacy??60)-3);
      entries.push({age:state.player.age,kind:'consequence-chain',text:'Tükenmişlik bu yıl iş dışında da etkisini göstermeye başladı.'});
    }else if(chain.step===2){
      if(state.career?.workplace){
        state.career.workplace.reputation=clamp(state.career.workplace.reputation-4);
        state.career.performance=clamp((state.career.performance??50)-3);
      }
      entries.push({age:state.player.age,kind:'consequence-chain',text:'Uzayan tükenmişlik performans ve itibarına zarar verdi.'});
    }else{
      if((state.career?.workplace?.burnout??0)<55){
        chain.resolved=true;
        entries.push({age:state.player.age,kind:'consequence-chain',text:'Tükenmişlik döngüsünü kırmayı başardın.'});
      }else if(rng.fork(chain.id+'-exit').chance(.25)){
        state.pendingCareerOffers??=[];
        entries.push({age:state.player.age,kind:'consequence-chain',paceBlock:true,text:'Tükenmişlik artık mevcut işinde kalıp kalmama sorusuna dönüştü.'});
        chain.resolved=true;
      }
    }
  }

  if(chain.type==='financial-strain'){
    if(chain.step===1){
      state.healthProfile.stress=clamp((state.healthProfile?.stress??20)+3);
      entries.push({age:state.player.age,kind:'consequence-chain',text:'Finansal baskı günlük kararlarını daha temkinli hale getirdi.'});
    }else if(chain.step===2){
      if(state.social?.romance){
        state.social.romance.moneyAlignment=clamp((state.social.romance.moneyAlignment??50)-4);
        state.social.romance.resentment=clamp((state.social.romance.resentment??20)+3);
      }
      entries.push({age:state.player.age,kind:'consequence-chain',text:'Uzayan para baskısı ilişkilerine de yansımaya başladı.'});
    }else{
      if((state.householdDynamics?.financialPressure??0)<45){
        chain.resolved=true;
        entries.push({age:state.player.age,kind:'consequence-chain',text:'Hane bütçesini yeniden dengeledin; finansal baskı azaldı.'});
      }else if(rng.fork(chain.id+'-shock').chance(.2)){
        state.healthProfile.stress=clamp((state.healthProfile?.stress??20)+5);
        entries.push({age:state.player.age,kind:'consequence-chain',text:'Finansal baskı artık kalıcı bir yaşam stresi haline geldi.'});
        chain.resolved=true;
      }
    }
  }

  if(chain.type==='relationship-erosion'){
    const r=state.social?.romance;
    if(!r){chain.resolved=true;continue;}
    if(chain.step===1){
      r.trust=clamp((r.trust??60)-4);
      entries.push({age:state.player.age,kind:'consequence-chain',text:'Biriken kırgınlık güveni aşındırmaya başladı.'});
    }else if(chain.step===2){
      r.intimacy=clamp((r.intimacy??60)-5);
      r.relationshipTension=clamp((r.relationshipTension??20)+5);
      entries.push({age:state.player.age,kind:'consequence-chain',text:'İlişkinizde duygusal mesafe belirginleşti.'});
    }else{
      if((r.resentment??0)<45&&r.trust>=55){
        chain.resolved=true;
        entries.push({age:state.player.age,kind:'consequence-chain',text:'İlişkinizdeki aşınmayı birlikte toparladınız.'});
      }else if(r.relationship<=35||r.trust<=30){
        entries.push({age:state.player.age,kind:'consequence-chain',paceBlock:true,text:'İlişkinizdeki uzun süreli aşınma artık ciddi bir kırılma noktasına geldi.'});
        chain.resolved=true;
      }
    }
  }
 }
 state.consequenceChains=chains.filter(c=>!c.resolved||state.player.age-c.startedAtAge<=8).slice(-12);
 return entries;
}
