import {pendingYoungChild,setUpbringingStyle,pendingTeenEducation,setChildEducationPlan} from '../family/parenting_decisions.js';

export const parentingEvents=[
 {
  id:'parenting-style',
  title:'Ebeveynlik Yaklaşımın',
  minAge:22,maxAge:70,once:false,majorDecision:false,priority:62,
  condition:s=>Boolean(pendingYoungChild(s)),
  choices:s=>{
   const child=pendingYoungChild(s);
   return [
    {id:'supportive:'+child.id,label:child.name+' için destekleyici yaklaşım',result:child.name+' ile destekleyici ve iletişime açık bir ebeveynlik kurdun.',effect:next=>setUpbringingStyle(next,child.id,'supportive')},
    {id:'strict:'+child.id,label:child.name+' için disiplinli yaklaşım',result:child.name+' için daha disiplinli sınırlar koydun.',effect:next=>setUpbringingStyle(next,child.id,'strict')},
    {id:'free:'+child.id,label:child.name+' daha özgür büyüsün',result:child.name+' kendi ilgi ve seçimlerini daha özgür keşfetti.',effect:next=>setUpbringingStyle(next,child.id,'free')}
   ];
  }
 },
 {
  id:'child-education-plan',
  title:'Çocuğunun Eğitim Yolu',
  minAge:34,maxAge:75,once:false,majorDecision:false,priority:64,
  condition:s=>Boolean(pendingTeenEducation(s)),
  choices:s=>{
   const child=pendingTeenEducation(s);
   const canFund=(s.finance?.cash??0)>=150000||(s.career?.monthlyIncome??0)>=60000||(s.retirement?.pensionMonthly??0)>=45000;
   return [
    ...(canFund?[{id:'university:'+child.id,label:child.name+' için üniversiteyi destekle',majorDecision:true,result:child.name+' için üniversite yoluna maddi ve manevi destek vermeye karar verdin.',effect:next=>setChildEducationPlan(next,child.id,'university')}]:[]),
    {id:'vocational:'+child.id,label:child.name+' için mesleki yolu destekle',majorDecision:true,result:child.name+' için daha doğrudan mesleki bir yol seçtiniz.',effect:next=>setChildEducationPlan(next,child.id,'vocational')},
    {id:'independent:'+child.id,label:'Kararı '+child.name+' versin',result:child.name+' kendi eğitim kararını vermekte daha bağımsız kaldı.',effect:next=>setChildEducationPlan(next,child.id,'independent')}
   ];
  }
 }
];
