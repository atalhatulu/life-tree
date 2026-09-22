import {liquidFunds} from '../finance/liquidity.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const rel=(state)=>state.social?.romance?.relationship??0;

function weightedPick(rng,choices,weightFn){
 const weighted=choices.map(choice=>({value:choice,weight:Math.max(.05,weightFn(choice))}));
 return rng.weighted(weighted);
}

function choiceWeight(state,event,choice){
 const prefs=state.preferences??{};
 const age=state.player.age;
 const cash=liquidFunds(state);
 const income=state.finance?.monthlyIncome??state.career?.monthlyIncome??0;
 const stress=state.healthProfile?.stress??30;
 const health=state.player.health.current??70;
 const fitness=state.healthProfile?.fitness??50;

 if(event.id==='first-romance'||event.id==='adult-dating'){
  if(choice.id==='approach'||choice.id==='meet')return .4+(prefs.partnershipDesire??50)/35+(state.player.personality.sociability??50)/70;
  return .8+(100-(prefs.partnershipDesire??50))/45;
 }
 if(event.id==='relationship-commitment'){
  if(choice.id==='marry')return .3+(prefs.marriageDesire??50)/28+rel(state)/70+(cash>500000?.4:0);
  if(choice.id==='cohabit')return .8+(prefs.partnershipDesire??50)/40+rel(state)/90;
  return .7+(100-(prefs.marriageDesire??50))/55;
 }
 if(event.id==='marriage-after-cohabiting'){
  if(choice.id==='marry')return .5+(prefs.marriageDesire??50)/28+rel(state)/75+(state.social?.romance?.yearsTogether??0)*.08;
  return .8+(100-(prefs.marriageDesire??50))/60;
 }
 if(event.id==='child-decision'){
  const children=state.children?.length??0;
  const financialSecurity=clamp((cash/1200000)+(income/70000),0,2.4);
  const ageFit=age<=34 ? 1 : age<=38 ? .75 : age<=41 ? .45 : .2;
  const existingChildPenalty=children===0 ? 0 : children===1 ? .85 : 1.7;
  const relationshipSupport=clamp((rel(state)-55)/30,0,1.2);
  if(choice.id==='have-child'){
   return .45+(prefs.parenthoodDesire??50)/22+financialSecurity*.55+relationshipSupport+ageFit-existingChildPenalty-Math.max(0,stress-55)*.018;
  }
  return .65+(100-(prefs.parenthoodDesire??50))/55+(children*.55)+(cash<250000 ? .45 : 0)+(age>=39 ? .35 : 0);
 }
 if(event.id==='adult-lifestyle'){
  if(choice.id==='healthy')return .7+(100-health)/45+(100-fitness)/80+(income>50000?.5:0);
  if(choice.id==='frugal')return .8+(state.finance?.debt??0)/700000+(income<35000?.9:0);
  return 1.4;
 }
 if(event.id==='move-out'){
  if(choice.id==='studio')return .4+income/50000+cash/1000000;
  if(choice.id==='shared')return 1+income/70000+(prefs.partnershipDesire??50)/120;
  return .9+(cash<300000?.8:0);
 }
 if(event.id==='buy-car'){
  if(choice.id==='skip-car')return .8+(100-(prefs.carOwnershipDesire??50))/45+(state.finance?.debt??0)/1500000;
  const optionId=choice.id.replace('car:','');
  const option=(state.pendingCarOptions??[]).find(x=>x.id===optionId);
  return .5+(prefs.carOwnershipDesire??50)/30+(income/90000)+(cash>500000?.3:0)-(option?.price??0)/5000000;
 }
 if(event.id==='buy-home'){
  if(choice.id==='skip-home')return .7+(100-(prefs.homeOwnershipDesire??50))/40+(state.finance?.debt??0)/2000000;
  return .45+(prefs.homeOwnershipDesire??50)/28+cash/2500000+income/80000;
 }
 if(event.id==='partner-job-relocation'){
  if(choice.id==='move-with-partner'){
   const o=state.pendingPartnerMove;
   const gain=o?Math.max(0,(o.newIncome??0)-(o.oldIncome??0)):0;
   return .6+gain/25000+rel(state)/80-(prefs.hometownAttachment??50)/130;
  }
  return .8+(prefs.hometownAttachment??50)/65;
 }
 if(event.id==='return-to-hometown'){
  if(choice.id==='return-home')return .5+(prefs.hometownAttachment??50)/28+(age>50?.5:0);
  return .8+(100-(prefs.hometownAttachment??50))/55+(state.player.personality.ambition??50)/100;
 }
 if(event.id==='career-switch'){
  if(choice.id==='stay')return 1+(state.career?.satisfaction??50)/50;
  const id=choice.id.replace('switch:','');
  const offer=(state.pendingCareerOffers??[]).find(x=>x.id===id);
  if(!offer)return .4;
  const current=state.career?.monthlyIncome??0;
  const salaryGain=(offer.salary-current)/Math.max(20000,current||20000);
  const movePenalty=offer.requiresMove ? .45 : 0;
  return .7+Math.max(-.3,salaryGain)*1.4+(100-(state.career?.satisfaction??50))/70-movePenalty;
 }
 if(event.id==='first-job'){
  const id=choice.id.replace('job:','');
  const offer=(state.pendingJobOffers??[]).find(x=>x.id===id);
  if(!offer)return 1;
  const salaryScore=(offer.salary??0)/50000;
  const movePenalty=offer.requiresMove?Math.min(1,(offer.moveCost??0)/Math.max(100000,cash)):.0;
  return .7+salaryScore-movePenalty;
 }
 if(event.id==='university-application'){
  const id=choice.id.replace('program:','');
  const program=(state.pendingUniversityApplications??[]).find(x=>x.id===id);
  if(!program)return 1;
  return .7+(program.admissionChance??50)/70+(state.player.personality.curiosity??50)/120+(state.player.personality.ambition??50)/140;
 }
 if(event.id==='gap-year-direction'){
  if(choice.id==='seek-work')return .7+(state.gapYears??0)*.45+(state.education?.path==='vocational' ? .8 : 0);
  if(choice.id==='retry-university')return .8+(state.player.personality.ambition??50)/80+(state.player.personality.curiosity??50)/100-Math.min(1,(state.gapYears??0)*.12);
  return .5+Math.max(0,2-(state.gapYears??0))*.35;
 }
 if(event.id==='health-treatment'){
  if(choice.id==='defer-treatment')return .35+(cash<100000?.5:0);
  const id=choice.id.replace('treat:','');
  const condition=(state.healthProfile?.conditions??[]).find(c=>c.id===id);
  return .9+(condition?.severity??1)*1.1+(100-health)/50;
 }
 if(event.id==='retirement-decision'){
  if(choice.id==='retire')return .5+Math.max(0,age-58)*.22+(100-health)/35+(100-fitness)/90+(100-(state.career?.satisfaction??50))/100;
  return 1.1+health/100+(state.career?.satisfaction??50)/100;
 }
 if(event.id==='start-business'){
  if(choice.id==='keep-career')return 1.1+(100-(prefs.riskTolerance??50))/45+(state.finance?.debt??0)/1000000;
  if(choice.id==='launch-side-business')return .8+(prefs.riskTolerance??50)/45+cash/3000000;
  return .5+(prefs.riskTolerance??50)/38+cash/2000000-(state.finance?.debt??0)/1500000;
 }
 if(event.id==='after-high-school'){
  const perf=state.education?.performance??50;
  const ambition=state.player.personality.ambition??50;
  const curiosity=state.player.personality.curiosity??50;
  if(choice.id==='university')return .5+perf/45+ambition/80+curiosity/100;
  if(choice.id==='work')return .8+(state.education?.path==='vocational' ? 1.1 : 0)+(100-perf)/90;
  return .55+(100-(state.player.personality.discipline??50))/100;
 }
 if(event.id==='high-school-path'){
  const perf=state.education?.performance??50;
  const curiosity=state.player.personality.curiosity??50;
  const topInterest=Math.max(0,...Object.values(state.player.interests??{}));
  if(choice.id==='academic')return .7+perf/55+curiosity/110;
  if(choice.id==='vocational')return .8+(100-perf)/95+(state.player.personality.discipline??50)/120;
  return .6+topInterest/65+curiosity/140;
 }
 return 1;
}

export function chooseProceduralEventChoice(game,event,policy,rng){
 const choices=game.eventChoices(event);
 if(!choices.length)return null;

 // Named policies are deterministic scenario presets used by tests/showcases.
 // The production Fast Sim "random" policy is the causal procedural population.
 if(policy!=='random'){
  const common={
   'adult-lifestyle':'balanced',
   'move-out':'shared',
   'relationship-commitment':'cohabit',
   'marriage-after-cohabiting':'marry',
   'child-decision':'have-child',
   'career-switch':'stay'
  };
  const preferred={
   academic:{...common,'high-school-path':'academic','after-high-school':'university','first-romance':'leave','gap-year-direction':'retry-university'},
   social:{...common,'high-school-path':'academic','after-high-school':'university','first-romance':'approach','gap-year-direction':'retry-university','relationship-commitment':'marry'},
   vocational:{...common,'high-school-path':'vocational','after-high-school':'work','first-romance':'approach','gap-year-direction':'seek-work'},
   balanced:{...common,'high-school-path':'academic','after-high-school':'university','first-romance':'approach','gap-year-direction':'retry-university'}
  }[policy];

  if(preferred?.[event.id]){
   const exact=choices.find(choice=>choice.id===preferred[event.id]);
   if(exact)return exact;
  }
  if(event.id==='career-switch'&&policy==='vocational'){
   const better=choices.find(choice=>choice.id!=='stay');
   if(better)return better;
  }
  return choices[0];
 }

 return weightedPick(rng,choices,choice=>{
  let weight=choiceWeight(game.state,event,choice);
  if(policy==='academic'&&['academic','university','retry-university'].includes(choice.id))weight*=1.8;
  if(policy==='vocational'&&['vocational','work','seek-work'].includes(choice.id))weight*=1.8;
  if(policy==='social'&&['approach','meet','cohabit','marry','have-child'].includes(choice.id))weight*=1.55;
  if(policy==='frugal'&&['frugal','stay-family','skip-car','skip-home'].includes(choice.id))weight*=1.7;
  if(policy==='healthy'&&choice.id==='healthy')weight*=1.8;
  return weight;
 });
}
