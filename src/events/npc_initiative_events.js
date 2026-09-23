import {pendingInitiative,resolveNpcInitiative} from '../life/npc_initiative_system.js';

function planLabel(plan){
 return plan==='university'?'üniversite':plan==='vocational'?'mesleki eğitim':'doğrudan çalışma';
}
function resolveEffect(type,response){
 return s=>resolveNpcInitiative(s,type,response);
}
function stageWord(i){
 return (i?.data?.stage??1)>=3?'artık bir dönüm noktasına gelen':(i?.data?.stage??1)===2?'yeniden ağırlaşan':'';
}

export const npcInitiativeEvents=[
 {
  id:'npc-partner-relocation-request',title:'Partnerinin Kariyer Talebi',minAge:20,maxAge:70,priority:120,majorDecision:true,
  condition:s=>Boolean(pendingInitiative(s,'partner-relocation')),
  choices:s=>{
   const i=pendingInitiative(s,'partner-relocation');
   const repeat=stageWord(i);
   return [
    {id:'accept',label:(repeat?repeat+' kariyer meselesini çöz: ':'')+i.actorName+' ile '+i.data.targetCityName+' şehrine taşın',result:'Partnerinin kariyer hedefini birlikte sahiplenmeye karar verdiniz.',effect:resolveEffect('partner-relocation','accept')},
    {id:'compromise',label:'Taşınmadan başka bir çözüm arayın',result:'İkinizin de hayatını tamamen bozmadan orta yol aradınız.',effect:resolveEffect('partner-relocation','compromise')},
    {id:'reject',label:'Taşınmayı reddet',result:'Mevcut hayat düzenini korumayı seçtin.',effect:resolveEffect('partner-relocation','reject')}
   ];
  }
 },
 {
  id:'npc-partner-family-priority',title:'Partnerin Daha Fazla Ortak Hayat İstiyor',minAge:22,maxAge:70,priority:116,majorDecision:true,
  condition:s=>Boolean(pendingInitiative(s,'partner-family-priority')),
  choices:s=>{
   const i=pendingInitiative(s,'partner-family-priority');
   const suffix=(i?.data?.stage??1)>=3?' — bu kez kalıcı bir plan yap':(i?.data?.stage??1)===2?' — bu kez somut değişiklik yap':'';
   return [
   {id:'accept',label:'İlişki ve aile hayatını daha fazla öne al'+suffix,result:'Partnerinin beklentisini ciddiye aldın.',effect:resolveEffect('partner-family-priority','accept')},
   {id:'compromise',label:'Ortak bir denge kurmayı teklif et',result:'Tamamen yön değiştirmeden alan açmayı seçtin.',effect:resolveEffect('partner-family-priority','compromise')},
   {id:'reject',label:'Önceliklerini değiştirme',result:'Kendi yaşam önceliklerini korudun.',effect:resolveEffect('partner-family-priority','reject')}
  ];
  }
 },
 {
  id:'npc-partner-life-balance',title:'Partnerin Hayat Temposunu Değiştirmek İstiyor',minAge:22,maxAge:70,priority:114,majorDecision:true,
  condition:s=>Boolean(pendingInitiative(s,'partner-life-balance')),
  choices:s=>{
   const i=pendingInitiative(s,'partner-life-balance');
   const suffix=(i?.data?.stage??1)>=3?' ve düzeni kökten değiştirin':(i?.data?.stage??1)===2?' ve çalışma düzenini yeniden kurun':'';
   return [
   {id:'accept',label:'Birlikte tempoyu düşürün'+suffix,result:'Daha dengeli bir yaşam için birlikte değişiklik yaptınız.',effect:resolveEffect('partner-life-balance','accept')},
   {id:'compromise',label:'Sadece bazı yükleri azaltın',result:'Kısmi bir denge planı yaptınız.',effect:resolveEffect('partner-life-balance','compromise')},
   {id:'reject',label:'Mevcut tempoya devam edin',result:'Hayat düzenini değiştirmemeyi seçtin.',effect:resolveEffect('partner-life-balance','reject')}
  ];
  }
 },
 {
  id:'npc-child-direction-request',title:'Çocuğun Kendi Yolunu Seçmek İstiyor',minAge:34,maxAge:75,priority:118,majorDecision:true,
  condition:s=>Boolean(pendingInitiative(s,'child-direction')),
  choices:s=>{
   const i=pendingInitiative(s,'child-direction');
   return [
    {id:'accept',label:i.actorName+' için '+planLabel(i.data.desiredPlan)+' yolunu destekle',result:'Çocuğunun kendi geleceğini seçmesine izin verdin.',effect:resolveEffect('child-direction','accept')},
    {id:'compromise',label:'Bir yıl deneyip sonra yeniden konuşun',result:'Kesin bir karar dayatmak yerine deneme alanı bıraktın.',effect:resolveEffect('child-direction','compromise')},
    {id:'reject',label:'Bu yönün doğru olmadığını söyle',result:'Çocuğunun istediği yolu desteklemedin.',effect:resolveEffect('child-direction','reject')}
   ];
  }
 },
 {
  id:'npc-friend-support-request',title:'Yakın Arkadaşın Senden Destek İstiyor',minAge:20,maxAge:80,priority:108,
  condition:s=>Boolean(pendingInitiative(s,'friend-support-request')),
  choices:s=>{
   const i=pendingInitiative(s,'friend-support-request');
   return [
    {id:'accept',label:i.actorName+' için gerçekten zaman ayır',result:'Arkadaşının yükünü paylaşmayı seçtin.',effect:resolveEffect('friend-support-request','accept')},
    {id:'compromise',label:'Sınırlı ama somut destek ver',result:'Elinden geldiği kadar yanında oldun.',effect:resolveEffect('friend-support-request','compromise')},
    {id:'reject',label:'Bu kez yardımcı olamayacağını söyle',result:'Kendi yüklerin nedeniyle destek veremedin.',effect:resolveEffect('friend-support-request','reject')}
   ];
  }
 }
];
