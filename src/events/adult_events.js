import {applyUniversityProgram,generateUniversityApplications} from '../education/university_system.js';
import {acceptJob,generateJobOffers} from '../career/job_market.js';
import {switchJob} from '../career/career_system.js';
import {setLifestyle} from '../lifestyle/lifestyle_system.js';
import {affordableCarOptions,buyCar,affordableHomeOptions,buyHome} from '../assets/asset_system.js';
import {marryPartner,moveInTogether,ensurePartnershipState} from '../social/partnership_system.js';
import {createRomanticInterest} from '../social/romance_system.js';
import {addChild} from '../family/parenting_system.js';

export const adultEvents=[
 {
  id:'university-application',title:'Üniversite Başvuruları',minAge:19,maxAge:35,once:false,majorDecision:true,priority:120,
  condition:s=>Array.isArray(s.pendingUniversityApplications)&&s.pendingUniversityApplications.length>0,
  choices:s=>s.pendingUniversityApplications.map(program=>({
   id:'program:'+program.id,
   label:program.title+' — kabul ihtimali %'+program.admissionChance,
   result:next=>next.higherEducation?.programId===program.id?program.title+' bölümüne kabul edildin.':program.title+' başvurun kabul edilmedi.',
   effect:(next,rng)=>applyUniversityProgram(next,rng,program.id)
  }))
 },
 {
  id:'first-job',title:'İş Teklifleri',minAge:19,maxAge:65,once:false,majorDecision:true,priority:120,
  condition:s=>Array.isArray(s.pendingJobOffers)&&s.pendingJobOffers.length>0,
  choices:s=>s.pendingJobOffers.map(job=>({
   id:'job:'+job.id,label:job.title+' — ₺'+job.salary.toLocaleString('tr-TR')+'/ay',
   result:job.title+' olarak çalışmaya başladın.',effect:next=>acceptJob(next,job.id)
  }))
 },
 {
  id:'career-switch',title:'Kariyerini Değiştirme Fırsatı',minAge:22,maxAge:65,once:false,majorDecision:true,priority:78,
  condition:s=>Array.isArray(s.pendingCareerOffers)&&s.pendingCareerOffers.length>0&&s.career?.employed,
  choices:s=>[
   ...s.pendingCareerOffers.map(job=>({
    id:'switch:'+job.id,label:job.title+' — ₺'+job.salary.toLocaleString('tr-TR')+'/ay',
    result:job.title+' pozisyonuna geçtin.',effect:next=>switchJob(next,job)
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
  id:'adult-dating',title:'Yeni Biriyle Tanışma',minAge:19,maxAge:55,once:false,majorDecision:false,priority:18,
  condition:s=>!s.social?.romance&&s.player.age>=(s.nextDatingAge??19),
  choices:[
   {
    id:'meet',label:'Tanışmaya açık ol',result:s=>s.social.romance?s.social.romance.name+' ile görüşmeye başladın.':'Bu kez bir ilişkiye dönüşmedi.',
    effect:(s,rng)=>{
      const chance=Math.min(.82,.22+s.player.personality.sociability/180+s.player.appearance.attractiveness/260);
      if(rng.chance(chance))s.social.romance=createRomanticInterest(s,rng.fork('adult-date'),'romance-'+s.year);
      s.nextDatingAge=s.player.age+(s.social.romance?2:1);
    }
   },
   {id:'focus-self',label:'Kendime odaklan',result:'Bu dönem ilişki aramamayı seçtin.',effect:s=>{s.nextDatingAge=s.player.age+2;}}
  ]
 },
 {
  id:'adult-lifestyle',title:'Kendi Yaşam Düzenin',minAge:22,maxAge:35,once:true,majorDecision:true,priority:48,
  condition:s=>s.finance&&s.career?.employed,
  choices:[
   {id:'frugal',label:'Tutumlu yaşa',result:'Giderlerini düşük tutmaya karar verdin.',effect:s=>setLifestyle(s,{food:'frugal',clothing:'basic',transport:'public'})},
   {id:'balanced',label:'Dengeli yaşa',result:'Gelir ve yaşam kalitesi arasında denge kurdun.',effect:s=>setLifestyle(s,{food:'standard',clothing:'standard',transport:'public'})},
   {id:'healthy',label:'Sağlık odaklı yaşa',result:'Daha pahalı olsa da sağlıklı yaşamı seçtin.',effect:s=>setLifestyle(s,{food:'healthy',clothing:'standard',transport:'public'})}
  ]
 },
 {
  id:'move-out',title:'Aile Evinden Ayrılmak',minAge:22,maxAge:38,once:false,majorDecision:true,priority:52,
  condition:s=>s.finance?.lifestyle?.housing==='family'&&s.career?.employed&&s.player.age>=(s.nextMoveOutAge??22),
  choices:[
   {id:'stay-family',label:'Bir süre daha ailemle kal',result:'Birikim yapmak için aile evinde kalmaya devam ettin.',effect:s=>{s.nextMoveOutAge=s.player.age+3;}},
   {id:'shared',label:'Paylaşımlı eve çık',result:'Paylaşımlı bir eve taşındın.',effect:s=>setLifestyle(s,{housing:'shared'})},
   {id:'studio',label:'Tek başıma stüdyo eve çık',condition:s=>(s.career?.monthlyIncome??0)>=40000,result:'Kendi evine çıktın.',effect:s=>setLifestyle(s,{housing:'studio'})}
  ]
 },
 {
  id:'relationship-commitment',title:'İlişkinin Geleceği',minAge:22,maxAge:55,once:false,majorDecision:true,priority:58,
  condition:s=>{
   const r=s.social?.romance;if(!r)return false;ensurePartnershipState(s);
   return r.status==='dating'&&r.yearsTogether>=2&&r.relationship>=62&&s.player.age>=(s.nextCommitmentAge??22);
  },
  choices:[
   {id:'cohabit',label:'Birlikte yaşamayı teklif et',result:'Birlikte yaşamaya başladınız.',effect:s=>moveInTogether(s)},
   {id:'marry',label:'Evlilik teklif et',condition:s=>s.social.romance.relationship>=70,result:'Evlendiniz.',effect:s=>marryPartner(s)},
   {id:'wait',label:'İlişkiyi olduğu gibi sürdür',result:'Şimdilik büyük bir adım atmamayı seçtin.',effect:s=>{s.social.romance.relationship=Math.min(100,s.social.romance.relationship+1);s.nextCommitmentAge=s.player.age+2;}}
  ]
 },
 {
  id:'marriage-after-cohabiting',title:'Evlilik Kararı',minAge:23,maxAge:60,once:false,majorDecision:true,priority:57,
  condition:s=>s.social?.romance?.status==='cohabiting'&&s.social.romance.yearsTogether>=3&&s.social.romance.relationship>=68&&s.player.age>=(s.nextMarriageAge??23),
  choices:[
   {id:'marry',label:'Evlen',result:'Evlendiniz.',effect:s=>marryPartner(s)},
   {id:'continue',label:'Birlikte yaşamaya devam et',result:'Resmî evlilik olmadan birlikte yaşamaya devam ettiniz.',effect:s=>{s.social.romance.relationship=Math.min(100,s.social.romance.relationship+1);s.nextMarriageAge=s.player.age+2;}}
  ]
 },
 {
  id:'child-decision',title:'Aileyi Büyütmek',minAge:24,maxAge:42,once:false,majorDecision:true,priority:54,
  condition:s=>s.social?.romance?.status==='married'&&(s.children?.length??0)<3&&s.social.romance.relationship>=60&&s.player.age>=(s.nextChildDecisionAge??24),
  choices:[
   {id:'have-child',label:'Çocuk sahibi ol',result:s=>s.children.at(-1).name+' dünyaya geldi.',effect:(s,rng)=>{addChild(s,rng.fork('child'));s.nextChildDecisionAge=s.player.age+2;}},
   {id:'wait-child',label:'Şimdilik bekle',result:'Çocuk kararını ertelediniz.',effect:s=>{s.nextChildDecisionAge=s.player.age+3;}}
  ]
 },
 {
  id:'buy-car',title:'Otomobil Almak',minAge:23,maxAge:60,once:false,majorDecision:true,priority:35,
  condition:s=>!s.assets?.car&&s.career?.employed&&s.player.age>=(s.nextCarAge??23)&&affordableCarOptions(s).length>0,
  choices:s=>[
   ...affordableCarOptions(s).map(car=>({id:'car:'+car.id,label:car.label+' — ₺'+car.price.toLocaleString('tr-TR'),result:car.label+' satın aldın.',effect:next=>buyCar(next,car.id)})),
   {id:'skip-car',label:'Şimdilik alma',result:'Araba almak yerine paranı korudun.',effect:s=>{s.nextCarAge=s.player.age+3;}}
  ]
 },
 {
  id:'buy-home',title:'Ev Satın Almak',minAge:27,maxAge:65,once:false,majorDecision:true,priority:42,
  condition:s=>!s.assets?.home&&s.career?.employed&&s.player.age>=(s.nextHomeAge??27)&&affordableHomeOptions(s).length>0,
  choices:s=>[
   ...affordableHomeOptions(s).map(home=>({id:'home:'+home.id,label:home.label+' — ₺'+home.price.toLocaleString('tr-TR'),result:home.label+' satın aldın.',effect:next=>buyHome(next,home.id)})),
   {id:'skip-home',label:'Kirada / mevcut düzende kal',result:'Şimdilik ev satın almamayı seçtin.',effect:s=>{s.nextHomeAge=s.player.age+4;}}
  ]
 }
];
