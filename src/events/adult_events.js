import {applyUniversityProgram,generateUniversityApplications} from '../education/university_system.js';
import {acceptJob,generateJobOffers} from '../career/job_market.js';
import {switchJob} from '../career/career_system.js';
import {setLifestyle} from '../lifestyle/lifestyle_system.js';
import {affordableCarOptions,buyCar,affordableHomeOptions,buyHome} from '../assets/asset_system.js';
import {marryPartner,moveInTogether,ensurePartnershipState} from '../social/partnership_system.js';
import {createRomanticInterest} from '../social/romance_system.js';
import {attemptChild,parenthoodReadiness} from '../family/parenting_system.js';
import {resolvePartnerMove,returnHome,canConsiderReturnHome,deferReturnHome} from '../world/migration_system.js';
import {refreshMilitaryEligibility,completeMilitaryService,deferMilitaryService,paidMilitaryFee} from '../life/military_service.js';

export const adultEvents=[
 {
  id:'military-service-decision',title:'Askerlik Hizmeti',minAge:20,maxAge:40,once:false,majorDecision:false,priority:132,
  condition:s=>{
   const m=refreshMilitaryEligibility(s);
   return m.eligible&&m.status==='pending'&&s.player.age>=(s.nextMilitaryDecisionAge??20);
  },
  choices:s=>[
   {
    id:'standard-service',
    label:'6 aylık temel askerlik hizmetini tamamla',
    majorDecision:true,
    result:'Askerlik hizmetini tamamladın.',
    effect:next=>completeMilitaryService(next,'standard')
   },
   {
    id:'paid-service',
    label:'Bedelli askerlik — ₺'+paidMilitaryFee(s).toLocaleString('tr-TR'),
    majorDecision:true,
    condition:next=>((next.finance?.cash??0)+(next.finance?.savings??0))>=paidMilitaryFee(next),
    result:'Bedelli askerlik kapsamında temel eğitimini tamamladın.',
    effect:next=>completeMilitaryService(next,'paid')
   },
   {
    id:'defer-service',
    label:'Şimdilik ertele',
    condition:next=>next.player.age<35,
    result:'Askerlik kararını bir süre erteledin.',
    effect:next=>deferMilitaryService(next,next.higherEducation?.enrolled?2:1)
   }
  ]
 },
 {
  id:'partner-job-relocation',title:'Eşinin Kariyeri İçin Taşınma',minAge:23,maxAge:58,once:false,majorDecision:false,priority:84,
  condition:s=>Boolean(s.pendingPartnerMove&&s.social?.romance&&['cohabiting','married'].includes(s.social.romance.status)),
  choices:s=>[
   {
    id:'move-with-partner',
    label:s.pendingPartnerMove.cityName+' şehrine birlikte taşın',
    majorDecision:true,
    result:s=>s.pendingPartnerMove?'Taşınma kararı işlendi.':s.location.cityName+' şehrine eşinin kariyeri için taşındınız.',
    effect:s=>resolvePartnerMove(s,true)
   },
   {
    id:'decline-partner-move',
    label:'Mevcut şehirde kal',
    result:'Eşinin iş fırsatına rağmen mevcut şehirde kalmayı seçtiniz.',
    effect:s=>resolvePartnerMove(s,false)
   }
  ]
 },
 {
  id:'return-to-hometown',title:'Memlekete Dönmek',minAge:28,maxAge:70,once:false,majorDecision:false,priority:32,
  condition:s=>canConsiderReturnHome(s),
  choices:s=>[
   {
    id:'return-home',
    label:(s.origin?.cityName??'Memleket')+' şehrine geri dön',
    majorDecision:true,
    result:s=>(s.origin?.cityName??'Memleket')+' şehrine geri döndün.',
    effect:s=>{returnHome(s);s.nextReturnHomeAge=s.player.age+8;}
   },
   {
    id:'stay-city',
    label:'Bulunduğum şehirde kal',
    result:'Kurulu düzenini bozmayıp bulunduğun şehirde kalmaya karar verdin.',
    effect:s=>deferReturnHome(s,8)
   }
  ]
 },
 {
  id:'university-application',title:'Üniversite Başvuruları',minAge:19,maxAge:35,once:false,majorDecision:true,priority:120,
  condition:s=>Array.isArray(s.pendingUniversityApplications)&&s.pendingUniversityApplications.length>0,
  choices:s=>s.pendingUniversityApplications.map(program=>({
   id:'program:'+program.id,
   label:program.universityName+' / '+program.title+' ('+program.cityName+') — kabul %'+program.admissionChance,
   result:next=>next.higherEducation?.programId===program.id?program.universityName+' '+program.title+' bölümüne '+program.cityName+' şehrinde kabul edildin.':program.universityName+' başvurun kabul edilmedi.',
   effect:(next,rng)=>applyUniversityProgram(next,rng,program.id)
  }))
 },
 {
  id:'first-job',title:'İş Teklifleri',minAge:19,maxAge:72,once:false,majorDecision:true,priority:120,
  condition:s=>Array.isArray(s.pendingJobOffers)&&s.pendingJobOffers.length>0,
  choices:s=>s.pendingJobOffers.map(job=>({
   id:'job:'+job.id,label:job.title+' — '+job.cityName+' — ₺'+job.salary.toLocaleString('tr-TR')+'/ay'+(job.requiresMove?' • taşınma ~₺'+job.moveCost.toLocaleString('tr-TR'):''),
   result:next=>job.requiresMove?job.cityName+' şehrine taşınıp '+job.title+' olarak çalışmaya başladın.':job.title+' olarak '+job.cityName+' şehrinde çalışmaya başladın.',effect:next=>acceptJob(next,job.id)
  }))
 },
 {
  id:'career-switch',title:'Kariyerini Değiştirme Fırsatı',minAge:22,maxAge:65,once:false,majorDecision:false,priority:78,
  condition:s=>Array.isArray(s.pendingCareerOffers)&&s.pendingCareerOffers.length>0&&s.career?.employed,
  choices:s=>[
   ...s.pendingCareerOffers.map(job=>({
    id:'switch:'+job.id,label:job.title+' — '+job.cityName+' — ₺'+job.salary.toLocaleString('tr-TR')+'/ay'+(job.requiresMove?' • taşınma ~₺'+job.moveCost.toLocaleString('tr-TR'):''),majorDecision:true,
    result:job.requiresMove?job.cityName+' şehrine taşınıp '+job.title+' pozisyonuna geçtin.':job.title+' pozisyonuna geçtin.',effect:next=>switchJob(next,job)
   })),
   {id:'stay',label:'Mevcut işimde kal',result:'Mevcut kariyerinde kalmayı seçtin.',effect:next=>{next.pendingCareerOffers=null;next.career.satisfaction=Math.min(100,next.career.satisfaction+3);}}
  ]
 },
 {
  id:'gap-year-direction',title:'Bir Sonraki Adım',minAge:19,maxAge:35,once:false,majorDecision:true,priority:115,
  condition:s=>s.nextPath==='gap'&&!s.pendingUniversityApplications&&!s.pendingJobOffers&&!s.higherEducation?.enrolled&&!s.career?.employed,
  choices:[
   {id:'retry-university',label:'Üniversiteyi tekrar dene',result:'Bir sonraki başvuru dönemi için üniversiteye hazırlanmayı seçtin.',effect:(s,rng)=>{s.nextPath='university';s.pendingUniversityApplications=generateUniversityApplications(s,rng.fork('retry-university'));}},
   {id:'seek-work',label:'İş aramaya başla',result:'Çalışma hayatına yönelmeye karar verdin.',effect:(s,rng)=>{s.nextPath='work';s.pendingJobOffers=generateJobOffers(s,rng.fork('gap-job-search'));}},
   {id:'continue-gap',label:'Bir yıl daha bekle',result:'Bir yıl daha kendine zaman ayırmaya karar verdin.',effect:s=>{s.nextPath='gap';}}
  ]
 },
 {
  id:'adult-dating',title:'Yeni Biriyle Tanışma',minAge:18,maxAge:65,once:false,majorDecision:false,priority:42,
  condition:s=>!s.social?.romance&&s.player.age>=(s.nextDatingAge??18)&&(s.preferences?.partnershipDesire??50)>=35&&(s.datingAttempts??0)<7,
  choices:[
   {
    id:'meet',label:'Tanışmaya açık ol',result:s=>s.social.romance?s.social.romance.name+' ile görüşmeye başladın.':'Bu kez bir ilişkiye dönüşmedi.',
    effect:(s,rng)=>{
      const chance=Math.min(.88,.28+s.player.personality.sociability/200+s.player.appearance.attractiveness/300);
      s.datingAttempts=(s.datingAttempts??0)+1;
      if(rng.chance(chance))s.social.romance=createRomanticInterest(s,rng.fork('adult-date'),'romance-'+s.year);
      s.nextDatingAge=s.player.age+(s.social.romance?3:rng.int(2,3));
    }
   },
   {id:'focus-self',label:'Kendime odaklan',result:'Bu dönem ilişki aramamayı seçtin.',effect:s=>{s.datingAttempts=(s.datingAttempts??0)+1;s.nextDatingAge=s.player.age+3;}}
  ]
 },
 {
  id:'adult-lifestyle',title:'Kendi Yaşam Düzenin',minAge:22,maxAge:35,once:true,majorDecision:false,priority:48,
  condition:s=>s.finance&&s.career?.employed,
  choices:[
   {id:'frugal',label:'Tutumlu yaşa',result:'Giderlerini düşük tutmaya karar verdin.',effect:s=>setLifestyle(s,{food:'frugal',clothing:'basic',transport:'public'})},
   {id:'balanced',label:'Dengeli yaşa',result:'Gelir ve yaşam kalitesi arasında denge kurdun.',effect:s=>setLifestyle(s,{food:'standard',clothing:'standard',transport:'public'})},
   {id:'healthy',label:'Sağlık odaklı yaşa',result:'Daha pahalı olsa da sağlıklı yaşamı seçtin.',effect:s=>setLifestyle(s,{food:'healthy',clothing:'standard',transport:'public'})}
  ]
 },
 {
  id:'move-out',title:'Aile Evinden Ayrılmak',minAge:22,maxAge:38,once:false,majorDecision:false,priority:52,
  condition:s=>s.finance?.lifestyle?.housing==='family'&&s.career?.employed&&s.player.age>=(s.nextMoveOutAge??22),
  choices:[
   {id:'stay-family',label:'Bir süre daha ailemle kal',result:'Birikim yapmak için aile evinde kalmaya devam ettin.',effect:s=>{s.nextMoveOutAge=s.player.age+3;}},
   {id:'shared',label:'Paylaşımlı eve çık',majorDecision:true,result:'Paylaşımlı bir eve taşındın.',effect:s=>setLifestyle(s,{housing:'shared'})},
   {id:'studio',label:'Tek başıma stüdyo eve çık',majorDecision:true,condition:s=>(s.career?.monthlyIncome??0)>=40000,result:'Kendi evine çıktın.',effect:s=>setLifestyle(s,{housing:'studio'})}
  ]
 },
 {
  id:'relationship-commitment',title:'İlişkinin Geleceği',minAge:21,maxAge:55,once:false,majorDecision:false,priority:58,
  condition:s=>{
   const r=s.social?.romance;if(!r)return false;ensurePartnershipState(s);
   return r.status==='dating'&&r.yearsTogether>=1&&r.relationship>=48&&s.player.age>=(s.nextCommitmentAge??21)&&(s.preferences?.partnershipDesire??50)>=35;
  },
  choices:[
   {id:'cohabit',label:'Birlikte yaşamayı teklif et',majorDecision:true,result:'Birlikte yaşamaya başladınız.',effect:s=>moveInTogether(s)},
   {id:'marry',label:'Evlilik teklif et',majorDecision:true,condition:s=>s.social.romance.relationship>=54&&(s.preferences?.marriageDesire??50)>=28,result:'Evlendiniz.',effect:s=>marryPartner(s)},
   {id:'wait',label:'İlişkiyi olduğu gibi sürdür',result:'Şimdilik büyük bir adım atmamayı seçtin.',effect:s=>{s.social.romance.relationship=Math.min(100,s.social.romance.relationship+1);s.nextCommitmentAge=s.player.age+2;}}
  ]
 },
 {
  id:'marriage-after-cohabiting',title:'Evlilik Kararı',minAge:20,maxAge:60,once:false,majorDecision:false,priority:57,
  condition:s=>s.social?.romance?.status==='cohabiting'&&s.social.romance.yearsTogether>=2&&s.social.romance.relationship>=48&&s.player.age>=(s.nextMarriageAge??20)&&(s.preferences?.marriageDesire??50)>=28,
  choices:[
   {id:'marry',label:'Evlen',majorDecision:true,result:'Evlendiniz.',effect:s=>marryPartner(s)},
   {id:'continue',label:'Birlikte yaşamaya devam et',result:'Resmî evlilik olmadan birlikte yaşamaya devam ettiniz.',effect:s=>{s.social.romance.relationship=Math.min(100,s.social.romance.relationship+1);s.nextMarriageAge=s.player.age+2;}}
  ]
 },
 {
  id:'child-decision',title:'Aileyi Büyütmek',minAge:21,maxAge:47,once:false,majorDecision:false,priority:62,
  condition:s=>{
   const r=s.social?.romance;
   return Boolean(r&&['cohabiting','married'].includes(r.status)&&(s.children?.length??0)<3&&r.relationship>=42&&s.player.age>=(s.nextChildDecisionAge??21)&&parenthoodReadiness(s)>=40);
  },
  choices:[
   {
    id:'have-child',label:'Çocuk sahibi olmayı deneyin',majorDecision:true,
    result:s=>s.lastParenthoodAttempt?.success?s.lastParenthoodAttempt.childName+' dünyaya geldi.':'Bu yıl çocuk sahibi olamadınız; daha sonra tekrar deneyebilirsiniz.',
    effect:(s,rng)=>{attemptChild(s,rng.fork('child-attempt'));s.nextChildDecisionAge=s.player.age+(s.lastParenthoodAttempt?.success?((s.children?.length??0)>=2?3:2):1);}
   },
   {id:'wait-child',label:'Şimdilik bekle',result:'Çocuk kararını ertelediniz.',effect:s=>{s.nextChildDecisionAge=s.player.age+2;}}
  ]
 },
 {
  id:'buy-car',title:'Otomobil Almak',minAge:23,maxAge:60,once:false,majorDecision:false,priority:35,
  condition:s=>!s.assets?.car&&s.career?.employed&&s.player.age>=(s.nextCarAge??23)&&(s.preferences?.carOwnershipDesire??50)>=50&&affordableCarOptions(s).length>0,
  choices:s=>[
   ...affordableCarOptions(s).map(car=>({id:'car:'+car.id,label:car.label+' — ₺'+car.price.toLocaleString('tr-TR'),majorDecision:true,result:car.label+' satın aldın.',effect:next=>buyCar(next,car.id)})),
   {id:'skip-car',label:'Şimdilik alma',result:'Araba almak yerine paranı korudun.',effect:s=>{s.nextCarAge=s.player.age+3;}}
  ]
 },
 {
  id:'buy-home',title:'Ev Satın Almak',minAge:27,maxAge:65,once:false,majorDecision:false,priority:42,
  condition:s=>!s.assets?.home&&s.career?.employed&&s.player.age>=(s.nextHomeAge??27)&&(s.preferences?.homeOwnershipDesire??50)>=48&&affordableHomeOptions(s).length>0,
  choices:s=>[
   ...affordableHomeOptions(s).map(home=>({id:'home:'+home.id,label:home.label+' — ₺'+home.price.toLocaleString('tr-TR'),majorDecision:true,result:home.label+' satın aldın.',effect:next=>buyHome(next,home.id)})),
   {id:'skip-home',label:'Kirada / mevcut düzende kal',result:'Şimdilik ev satın almamayı seçtin.',effect:s=>{s.nextHomeAge=s.player.age+4;}}
  ]
 }
];
