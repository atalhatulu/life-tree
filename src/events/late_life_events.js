import {retirementEligibility,retire} from '../career/retirement_system.js';
import {canStartBusiness,startBusiness} from '../career/entrepreneurship_system.js';
import {treatmentOptions,treatCondition} from '../health/treatment_system.js';

export const lateLifeEvents=[
 {
  id:'health-treatment',
  title:'Tedavi Kararı',
  minAge:1,maxAge:100,once:false,majorDecision:false,priority:80,
  condition:s=>treatmentOptions(s).length>0&&s.player.age>=(s.nextTreatmentDecisionAge??18),
  choices:s=>[
   ...treatmentOptions(s).map(option=>({
    id:'treat:'+option.id,
    label:option.familyCovered?option.label+' için tedavi ol — aile karşılıyor':option.label+' için tedavi ol — ₺'+option.cost.toLocaleString('tr-TR'),
    majorDecision:option.severity>=3,
    result:next=>{
     const condition=next.healthProfile.conditions.find(c=>c.id===option.id);
     return condition?.treatmentSuccessful
      ? option.label+' için tedavi olumlu sonuç verdi.'
      : option.label+' için tedavi beklenen etkiyi göstermedi.';
    },
    effect:(next,rng)=>{
     treatCondition(next,option.id,rng.fork(option.id));
     next.nextTreatmentDecisionAge=next.player.age+1;
    }
   })),
   {
    id:'defer-treatment',
    label:'Şimdilik tedaviyi ertele',
    result:'Tedaviyi erteledin.',
    effect:s=>{
     s.nextTreatmentDecisionAge=s.player.age+2;
     s.healthProfile.stress=Math.min(100,s.healthProfile.stress+4);
    }
   }
  ]
 },
 {
  id:'start-business',
  title:'Kendi İşini Kurmak',
  minAge:25,maxAge:58,once:false,majorDecision:false,priority:44,
  condition:s=>canStartBusiness(s)&&(s.preferences?.riskTolerance??50)>=55&&s.player.age>=(s.nextBusinessAge??25),
  choices:s=>[
   ...(s.career?.employed?[{
    id:'launch-side-business',
    label:'İşimi bırakmadan yan girişim başlat',
    majorDecision:true,
    result:'Mevcut işini koruyup yan tarafta bir işletme kurdun.',
    effect:(next,rng)=>{startBusiness(next,rng.fork('side-launch'),'side');next.nextBusinessAge=99;}
   }]:[]),
   {
    id:'launch-business',
    label:'Tam zamanlı girişimci ol',
    majorDecision:true,
    result:'Kariyerini bırakıp kendi işletmene odaklandın.',
    effect:(next,rng)=>{startBusiness(next,rng.fork('launch'),'full-time');next.nextBusinessAge=99;}
   },
   {
    id:'keep-career',
    label:'Mevcut düzenimi koru',
    result:'Şimdilik girişimcilik riskini almadın.',
    effect:next=>{next.preferences.riskTolerance=Math.max(0,next.preferences.riskTolerance-5);next.nextBusinessAge=next.player.age+4;}
   }
  ]
 },
 {
  id:'retirement-decision',
  title:'Emeklilik Zamanı',
  minAge:58,maxAge:72,once:false,majorDecision:false,priority:130,
  condition:s=>retirementEligibility(s)&&s.player.age>=(s.nextRetirementAge??58),
  choices:[
   {
    id:'retire',
    label:'Emekli ol',
    majorDecision:true,
    result:s=>'Emekli oldun. Aylık emekli gelirin ₺'+s.retirement.pensionMonthly.toLocaleString('tr-TR')+'.',
    effect:s=>retire(s)
   },
   {
    id:'continue-work',
    label:'Çalışmaya devam et',
    result:'Çalışmaya devam etmeyi seçtin.',
    effect:s=>{
     s.nextRetirementAge=s.player.age+2;
     if(s.career?.employed){
      s.career.satisfaction=Math.min(100,(s.career.satisfaction??50)+2);
     }else if(s.business?.active){
      s.business.health=Math.min(100,(s.business.health??50)+2);
     }
    }
   }
  ]
 }
];
