import {setRetirementStyle,setCareMode} from '../life/late_age_system.js';
import {setEstatePlan} from '../finance/estate_planning.js';

function netWorth(state){
 return Math.max(0,(state.finance?.cash??0)+(state.assets?.home?.price??0)+(state.assets?.car?.price??0)-(state.finance?.debt??0));
}

function hasSupportiveAdultChild(state){
 return (state.children??[]).some(c=>c.age>=22&&(c.relationship??50)>=60);
}

export const lateAgeEvents=[
 {
  id:'retirement-lifestyle',
  title:'Emeklilik Hayatın',
  minAge:60,maxAge:80,once:true,majorDecision:false,priority:46,
  condition:s=>Boolean(s.retirement?.retired)&&!s.lateLife?.retirementStyle,
  choices:[
   {id:'active-retirement',label:'Aktif ve hareketli kal',result:'Emeklilikte hareketli bir yaşam kurmaya karar verdin.',effect:s=>setRetirementStyle(s,'active')},
   {id:'family-retirement',label:'Aileye daha çok zaman ayır',result:'Emeklilikte aile bağlarını öne koydun.',effect:s=>setRetirementStyle(s,'family')},
   {id:'quiet-retirement',label:'Daha sakin bir yaşam sür',result:'Emeklilikte daha sakin ve düşük stresli bir düzen seçtin.',effect:s=>setRetirementStyle(s,'quiet')}
  ]
 },
 {
  id:'estate-plan',
  title:'Miras Planın',
  minAge:60,maxAge:85,once:true,majorDecision:true,priority:38,
  condition:s=>netWorth(s)>=250000,
  choices:[
   {id:'balanced-estate',label:'Eş ve çocuklar arasında dengeli paylaştır',result:'Tereken için dengeli bir aile paylaşımı planladın.',effect:s=>setEstatePlan(s,'balanced')},
   {id:'children-estate',label:'Çocukları önceliklendir',condition:s=>(s.children?.length??0)>0,result:'Terekenin büyük bölümünü çocuklarına bırakmaya karar verdin.',effect:s=>setEstatePlan(s,'children-first')},
   {id:'spouse-estate',label:'Eşi önceliklendir',condition:s=>s.social?.romance?.status==='married',result:'Terekenin büyük bölümünde eşini önceliklendirdin.',effect:s=>setEstatePlan(s,'spouse-first')},
   {id:'charity-estate',label:'Bir bölümünü hayır işlerine ayır',result:'Terekenin bir bölümünü hayır amaçlı ayırdın.',effect:s=>setEstatePlan(s,'charity')}
  ]
 },
 {
  id:'elder-care',
  title:'Bakım Düzeni',
  minAge:75,maxAge:100,once:false,majorDecision:false,priority:92,
  condition:s=>Boolean(s.lateLife?.careNeed)&&!s.lateLife?.careMode,
  choices:s=>[
   ...(hasSupportiveAdultChild(s)?[{id:'family-care',label:'Aile desteğiyle yaşa',majorDecision:true,result:'Günlük bakımında ailenden destek almaya başladın.',effect:next=>setCareMode(next,'family')}]:[]),
   {id:'home-care',label:'Evde profesyonel bakım al',majorDecision:true,result:'Evde profesyonel bakım almaya başladın.',effect:next=>setCareMode(next,'home-care')},
   {id:'assisted-care',label:'Destekli yaşam merkezine taşın',majorDecision:true,result:'Destekli yaşam merkezine taşındın.',effect:next=>setCareMode(next,'assisted')}
  ]
 }
];
