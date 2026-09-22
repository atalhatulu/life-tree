import {growTrait} from '../character/personality_dynamics.js';

const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const rel=(s,id)=>s.player.relationships?.[id]??60;
const setRel=(s,id,value)=>{s.player.relationships??={};s.player.relationships[id]=clamp(value);};
const addStress=(s,delta)=>{s.healthProfile??={conditions:[],stress:20,fitness:50,lastCheckupAge:null};s.healthProfile.stress=clamp(s.healthProfile.stress+delta);};

export const storyEvents=[
 {
  id:'childhood-friend-invite',title:'Okuldan Sonra',minAge:8,maxAge:13,once:true,priority:4,
  condition:s=>(s.social?.friends?.length??0)>0,
  choices:s=>{
   const friend=s.social.friends[0];
   return [
    {id:'join-friend',label:friend.name+' ile okuldan sonra vakit geçir',result:friend.name+' ile okul dışında da yakınlaşmaya başladın.',effect:n=>{friend.relationship=clamp((friend.relationship??55)+5);n.player.personality.sociability=growTrait(n.player.personality.sociability,1);}},
    {id:'go-home',label:'Eve dönüp kendi işlerinle ilgilen',result:'O gün kendi düzenine dönmeyi seçtin.',effect:n=>{n.player.personality.discipline=growTrait(n.player.personality.discipline,1);}}
   ];
  }
 },
 {
  id:'family-weekend-choice',title:'Ailece Bir Gün',minAge:9,maxAge:17,once:true,priority:4,
  condition:s=>Boolean(s.parents?.mother?.alive||s.parents?.father?.alive),
  choices:[
   {id:'family-day',label:'Ailenle günü birlikte geçir',result:'Ailenle geçirdiğin sakin bir gün bağlarınızı güçlendirdi.',effect:s=>{for(const id of ['mother','father'])if(s.player.relationships?.[id]!=null)setRel(s,id,rel(s,id)+3);addStress(s,-2);}},
   {id:'own-time',label:'Kendi planını yap',result:'O günü kendi ilgi alanlarına ayırdın.',effect:s=>{s.player.personality.curiosity=growTrait(s.player.personality.curiosity,2);}}
  ]
 },
 {
  id:'exam-pressure-moment',title:'Yoğun Bir Eğitim Dönemi',minAge:15,maxAge:22,once:false,priority:6,
  condition:s=>Boolean(s.education?.enrolled||s.higherEducation?.enrolled)&&(s.healthProfile?.stress??20)>=35&&s.player.age>=(s.nextExamPressureAge??15),
  choices:[
   {id:'push-through',label:'Bir süre daha tempoyu artır',result:'Yoğun dönemde derslerine daha fazla yüklendin.',effect:s=>{if(s.higherEducation?.enrolled)s.higherEducation.performance=clamp((s.higherEducation.performance??50)+3);else if(s.education)s.education.studyEffort=clamp((s.education.studyEffort??0)+18);addStress(s,4);s.nextExamPressureAge=s.player.age+3;}},
   {id:'protect-balance',label:'Temponu azaltıp dengeyi koru',result:'Başarı kadar tükenmemeyi de önemsedin.',effect:s=>{addStress(s,-5);s.nextExamPressureAge=s.player.age+3;}}
  ]
 },
 {
  id:'work-burnout-warning',title:'İş Temposu Ağırlaşıyor',minAge:24,maxAge:62,once:false,priority:18,
  condition:s=>s.career?.employed&&(s.healthProfile?.stress??0)>=58&&s.player.age>=(s.nextBurnoutEventAge??24),
  choices:[
   {id:'set-boundaries',label:'İş yüküne sınır koy',result:'İş dışında kendine daha fazla alan açmaya karar verdin.',effect:s=>{s.career.satisfaction=clamp((s.career.satisfaction??50)+4);s.career.performance=clamp((s.career.performance??50)-2);addStress(s,-8);s.nextBurnoutEventAge=s.player.age+4;}},
   {id:'keep-pushing',label:'Bu dönemi çalışarak aş',result:'Yoğun tempoyu sürdürdün; kariyerin ilerledi ama bedeli stres oldu.',effect:s=>{s.career.performance=clamp((s.career.performance??50)+4);s.career.satisfaction=clamp((s.career.satisfaction??50)-3);addStress(s,5);s.nextBurnoutEventAge=s.player.age+4;}}
  ]
 },
 {
  id:'friend-needs-support',title:'Bir Arkadaşının Sana İhtiyacı Var',minAge:20,maxAge:70,once:false,priority:10,
  condition:s=>(s.social?.friends?.length??0)>0&&s.player.age>=(s.nextFriendSupportAge??20),
  choices:s=>{
   const friend=[...(s.social.friends??[])].sort((a,b)=>(b.relationship??50)-(a.relationship??50))[0];
   return [
    {id:'support-friend',label:friend.name+' için zaman ayır',result:friend.name+' zor bir dönemden geçerken yanında oldun.',effect:n=>{friend.relationship=clamp((friend.relationship??50)+6);addStress(n,1);n.nextFriendSupportAge=n.player.age+5;}},
    {id:'cannot-help',label:'Bu kez kendi sorumluluklarına odaklan',result:'Bu kez arkadaşına istediğin kadar zaman ayıramadın.',effect:n=>{friend.relationship=clamp((friend.relationship??50)-3);n.nextFriendSupportAge=n.player.age+5;}}
   ];
  }
 },
 {
  id:'couple-finance-talk',title:'Ev Bütçesi Üzerine Konuşma',minAge:24,maxAge:65,once:false,priority:20,
  condition:s=>['cohabiting','married'].includes(s.social?.romance?.status)&&Boolean(s.finance)&&s.player.age>=(s.nextCoupleFinanceAge??24)&&((s.finance.debt??0)>300000||(s.finance.monthlyExpenses??0)>(s.finance.monthlyIncome??0)*.75),
  choices:[
   {id:'plan-together',label:'Birlikte bütçe planı yap',result:'Partnerinle para konusunda ortak bir plan oluşturdunuz.',effect:s=>{s.social.romance.relationship=clamp((s.social.romance.relationship??60)+3);addStress(s,-3);s.nextCoupleFinanceAge=s.player.age+4;}},
   {id:'avoid-talk',label:'Konuyu şimdilik ertele',result:'Para konuşmasını ertelemek kısa vadede kolay geldi ama gerilim kaldı.',effect:s=>{s.social.romance.relationship=clamp((s.social.romance.relationship??60)-2);addStress(s,3);s.nextCoupleFinanceAge=s.player.age+3;}}
  ]
 },
 {
  id:'parent-child-time',title:'Çocuğunla Geçireceğin Zaman',minAge:28,maxAge:65,once:false,priority:14,
  condition:s=>(s.children??[]).some(c=>c.age>=6&&c.age<=17)&&s.player.age>=(s.nextChildBondAge??28),
  choices:s=>{
   const child=(s.children??[]).find(c=>c.age>=6&&c.age<=17);
   return [
    {id:'make-time',label:child.name+' ile özel zaman geçir',result:child.name+' ile baş başa geçirdiğiniz zaman ilişkinizi güçlendirdi.',effect:n=>{child.relationship=clamp((child.relationship??60)+5);n.nextChildBondAge=n.player.age+4;}},
    {id:'too-busy',label:'Bu dönem sorumluluklara öncelik ver',result:'Yoğunluk yüzünden çocuğunla planladığın kadar zaman geçiremedin.',effect:n=>{child.relationship=clamp((child.relationship??60)-3);n.nextChildBondAge=n.player.age+3;}}
   ];
  }
 },
 {
  id:'midlife-priority-check',title:'Hayatındaki Öncelikler',minAge:40,maxAge:52,once:true,priority:12,
  choices:[
   {id:'career-priority',label:'Kariyere ağırlık ver',result:'Önümüzdeki yıllarda kariyerini daha fazla öne koymaya karar verdin.',effect:s=>{s.player.personality.ambition=growTrait(s.player.personality.ambition,2);if(s.career?.employed)s.career.satisfaction=clamp((s.career.satisfaction??50)+2);}},
   {id:'people-priority',label:'Yakınlarına daha çok zaman ayır',result:'Hayatının bu döneminde insan ilişkilerini daha fazla öne koydun.',effect:s=>{s.player.personality.sociability=growTrait(s.player.personality.sociability,2);addStress(s,-2);}},
   {id:'health-priority',label:'Sağlığını önceliklendir',result:'Günlük düzeninde sağlık ve fiziksel kapasiteyi daha çok önemsemeye karar verdin.',effect:s=>{addStress(s,-3);}}
  ]
 },
 {
  id:'retirement-social-rhythm',title:'Emeklilikte Günlerin',minAge:62,maxAge:82,once:true,priority:9,
  condition:s=>Boolean(s.retirement?.retired),
  choices:[
   {id:'keep-circle',label:'Sosyal çevreni canlı tut',result:'Emeklilikte arkadaşlıklarını korumaya özellikle önem verdin.',effect:s=>{for(const f of s.social?.friends??[])f.relationship=clamp((f.relationship??50)+2);addStress(s,-2);}},
   {id:'quiet-rhythm',label:'Daha sakin bir günlük düzen kur',result:'Emeklilikte daha sakin ve kendi ritminde bir yaşam kurdun.',effect:s=>{addStress(s,-4);}},
   {id:'family-rhythm',label:'Aileyle daha sık görüş',result:'Emeklilik yıllarında aileyle geçirilen zamanı artırdın.',effect:s=>{for(const id of ['mother','father'])if(s.player.relationships?.[id]!=null)setRel(s,id,rel(s,id)+2);for(const c of s.children??[])c.relationship=clamp((c.relationship??60)+2);}}
  ]
 },
 {
  id:'late-life-independence',title:'Bağımsızlığını Korumak',minAge:72,maxAge:92,once:true,priority:16,
  condition:s=>(s.lateLife?.mobility??100)<55&&!s.lateLife?.careNeed,
  choices:[
   {id:'adapt-home',label:'Günlük düzenini fiziksel durumuna göre uyarlamaya başla',result:'Günlük hayatını daha güvenli ve sürdürülebilir olacak şekilde düzenledin.',effect:s=>{s.lateLife??={};s.lateLife.mobility=clamp((s.lateLife.mobility??50)+3);addStress(s,-2);}},
   {id:'carry-on',label:'Şimdilik düzenini değiştirme',result:'Bağımsızlığını aynı şekilde sürdürmeyi seçtin.',effect:s=>{addStress(s,1);}}
  ]
 }
];
