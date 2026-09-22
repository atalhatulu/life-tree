import {liquidFunds} from '../finance/liquidity.js';

const money=v=>'₺'+Math.round(Math.max(0,v??0)).toLocaleString('tr-TR');
const pct=v=>Math.round(v??0)+'/100';

export function decisionContext(state,event,choice){
 const e=event?.id;
 const id=choice?.id??'';
 const out=[];
 const romance=state.social?.romance;
 const cash=liquidFunds(state);
 const income=state.career?.monthlyIncome??state.finance?.monthlyIncome??0;

 if(e==='career-switch'){
  out.push('Mevcut iş memnuniyeti '+pct(state.career?.satisfaction??50));
  if(id==='stay')out.push('Mevcut maaş '+money(state.career?.monthlyIncome)+'/ay');
  else{
   const offer=(state.pendingCareerOffers??[]).find(x=>'switch:'+x.id===id);
   if(offer){
    const current=Math.max(1,state.career?.monthlyIncome??1);
    const diff=Math.round(((offer.salary-current)/current)*100);
    out.push('Maaş farkı '+(diff>=0?'+':'')+diff+'%');
    out.push(offer.related?'Yakın/uyumlu kariyer alanı':'Yeni kariyer alanı');
    if(offer.requiresMove)out.push('Taşınma maliyeti '+money(offer.moveCost));
   }
  }
 }
 if(e==='relationship-commitment'||e==='marriage-after-cohabiting'){
  out.push('İlişki '+pct(romance?.relationship));
  out.push('Uyumluluk '+pct(romance?.compatibility));
  out.push((romance?.yearsTogether??0)+' yıllık ilişki');
  out.push('Evlilik isteği '+pct(state.preferences?.marriageDesire??50));
 }
 if(e==='child-decision'){
  out.push('Çocuk isteği '+pct(state.preferences?.parenthoodDesire??50));
  out.push('İlişki '+pct(romance?.relationship));
  out.push('Likit kaynak '+money(cash));
  out.push('Mevcut çocuk '+(state.children?.length??0));
 }
 if(e==='partner-job-relocation'){
  const move=state.pendingPartnerMove;
  out.push('İlişki '+pct(romance?.relationship));
  if(move)out.push('Partner gelir farkı '+money((move.newIncome??0)-(move.oldIncome??0))+'/ay');
  out.push('Memlekete bağlılık '+pct(state.preferences?.hometownAttachment??50));
 }
 if(e==='buy-home'||e==='buy-car'){
  out.push('Likit kaynak '+money(cash));
  out.push('Aylık gelir '+money(income));
  out.push('Mevcut borç '+money(state.finance?.debt));
 }
 if(e==='retirement-decision'){
  out.push(state.player.age+' yaş');
  out.push('Sağlık '+pct(state.player.health?.current));
  out.push('Fitness '+pct(state.healthProfile?.fitness));
  out.push('İş memnuniyeti '+pct(state.career?.satisfaction??50));
 }
 if(e==='health-treatment'){
  const condition=(state.healthProfile?.conditions??[]).find(c=>id==='treat:'+c.id);
  if(condition)out.push(condition.label+' • şiddet '+condition.severity+'/3');
  out.push('Sağlık '+pct(state.player.health?.current));
  out.push('Likit kaynak '+money(cash));
 }
 if(e==='start-business'){
  out.push('Risk toleransı '+pct(state.preferences?.riskTolerance??50));
  out.push('Likit kaynak '+money(cash));
  out.push('Borç '+money(state.finance?.debt));
 }
 if(e==='first-job'){
  const offer=(state.pendingJobOffers??[]).find(x=>'job:'+x.id===id);
  if(offer){
   out.push('Maaş '+money(offer.salary)+'/ay');
   out.push('İş uyumu '+pct(offer.fit));
   if(offer.requiresMove)out.push('Taşınma '+money(offer.moveCost));
  }
 }
 return out;
}
