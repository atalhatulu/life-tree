const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function ready(s,id,years=4){
 s.storyletCooldowns??={};
 const last=s.storyletCooldowns[id];
 return last==null||s.player.age-last>=years;
}
function cool(s,id){
 s.storyletCooldowns??={};
 s.storyletCooldowns[id]=s.player.age;
}
function stress(s,d){if(s.healthProfile)s.healthProfile.stress=clamp((s.healthProfile.stress??20)+d);}
function relationship(s,d,tension=0){
 const r=s.social?.romance;if(!r)return;
 r.relationship=clamp((r.relationship??60)+d);
 r.relationshipTension=clamp((r.relationshipTension??10)+tension);
 r.trust=clamp((r.trust??60)+Math.round(d*.7));
 r.resentment=clamp((r.resentment??20)+Math.max(0,tension));
}

export const systemicStorylets=[
 {
  id:'storylet-work-follows-home',title:'İş Eve Taşındı',minAge:23,maxAge:62,priority:66,
  condition:s=>ready(s,'work-home',4)&&(s.career?.workplace?.burnout??0)>=62&&Boolean(s.social?.romance),
  choices:[
   {id:'open-up',label:'Partnerinle açıkça konuş',result:'İş stresini saklamak yerine paylaştın.',effect:s=>{relationship(s,5,-5);stress(s,-4);cool(s,'work-home');}},
   {id:'push-through',label:'Bir süre daha işe odaklan',result:'İşi öne koydun; evdeki gerilim büyüdü.',effect:s=>{s.career.workplace.recognition=clamp(s.career.workplace.recognition+4);relationship(s,-4,7);stress(s,3);cool(s,'work-home');}},
   {id:'set-boundary',label:'İş sınırlarını sertleştir',result:'Mesaiyi kısmaya ve iş sınırları koymaya başladın.',effect:s=>{s.career.workplace.workload=clamp(s.career.workplace.workload-7);s.career.workplace.burnout=clamp(s.career.workplace.burnout-6);s.career.performance=clamp(s.career.performance-2);cool(s,'work-home');}}
  ]
 },
 {
  id:'storylet-money-argument',title:'Para Tartışması',minAge:24,maxAge:70,priority:68,
  condition:s=>ready(s,'money-argument',4)&&Boolean(s.social?.romance)&&(s.householdDynamics?.financialPressure??0)>=58,
  choices:[
   {id:'budget-together',label:'Birlikte bütçe çıkarın',result:'Masrafları masaya yatırıp ortak plan yaptınız.',effect:s=>{relationship(s,5,-6);s.social.romance.moneyAlignment=clamp((s.social.romance.moneyAlignment??50)+8);stress(s,-2);cool(s,'money-argument');}},
   {id:'avoid',label:'Konuyu kapat',result:'Tartışmayı erteledin ama sorun çözülmedi.',effect:s=>{relationship(s,-2,6);s.social.romance.resentment=clamp((s.social.romance.resentment??20)+6);cool(s,'money-argument');}},
   {id:'cut-costs',label:'Kendi harcamalarını kıs',result:'Bütçede kişisel fedakârlık yapmayı seçtin.',effect:s=>{if(s.finance?.lifestyle){s.finance.lifestyle.clothing='basic';if(s.finance.lifestyle.food==='premium')s.finance.lifestyle.food='standard';}relationship(s,3,-3);cool(s,'money-argument');}}
  ]
 },
 {
  id:'storylet-bad-boss-offer',title:'Yöneticiyle Yol Ayrımı',minAge:24,maxAge:61,priority:61,
  condition:s=>ready(s,'bad-boss',5)&&(s.career?.workplace?.bossQuality??100)<=34&&s.career?.employed,
  choices:[
   {id:'confront',label:'Yöneticinle yüzleş',result:'Sorunları doğrudan dile getirdin.',effect:s=>{s.career.workplace.bossQuality=clamp(s.career.workplace.bossQuality+5);s.career.workplace.officePolitics=clamp(s.career.workplace.officePolitics+4);s.career.workplace.reputation=clamp(s.career.workplace.reputation+2);cool(s,'bad-boss');}},
   {id:'document',label:'Sessizce kayıt tut ve network yap',result:'Çatışmak yerine pozisyonunu güçlendirdin.',effect:s=>{s.career.network=clamp((s.career.network??50)+6);s.career.workplace.reputation=clamp(s.career.workplace.reputation+4);cool(s,'bad-boss');}},
   {id:'endure',label:'İdare et',result:'Şimdilik düzeni bozmadın.',effect:s=>{s.career.workplace.burnout=clamp(s.career.workplace.burnout+7);stress(s,4);cool(s,'bad-boss');}}
  ]
 },
 {
  id:'storylet-recognition-vs-life',title:'Görünür Bir Fırsat',minAge:26,maxAge:58,priority:59,
  condition:s=>ready(s,'recognition-life',7)&&(s.career?.workplace?.recognition??0)>=72&&Boolean(s.social?.romance),
  choices:[
   {id:'take-project',label:'Büyük projeyi üstlen',result:'Kariyer fırsatını seçtin.',effect:s=>{s.career.performance=clamp(s.career.performance+5);s.career.workplace.recognition=clamp(s.career.workplace.recognition+6);s.career.workplace.workload=clamp(s.career.workplace.workload+8);relationship(s,-2,3);cool(s,'recognition-life');}},
   {id:'decline-project',label:'Özel hayatı koru',result:'Fırsatı geri çevirip hayat dengesini korudun.',effect:s=>{s.career.satisfaction=clamp((s.career.satisfaction??50)+2);relationship(s,4,-3);stress(s,-3);cool(s,'recognition-life');}}
  ]
 },
 {
  id:'storylet-child-needs-you',title:'Çocuğun Sana İhtiyaç Duyuyor',minAge:28,maxAge:58,priority:63,
  condition:s=>ready(s,'child-needs',3)&&(s.children??[]).some(c=>c.age>=8&&c.age<=17&&(c.parenting?.emotionalSecurity??70)<62),
  choices:s=>{
   const child=s.children.find(c=>c.age>=8&&c.age<=17&&(c.parenting?.emotionalSecurity??70)<62);
   return [
    {id:'make-time',label:child.name+' için programını boşalt',result:'Çocuğuna gerçek anlamda zaman ayırdın.',effect:n=>{const c=n.children.find(x=>x.id===child.id);c.relationship=clamp((c.relationship??70)+8);c.parenting.emotionalSecurity=clamp((c.parenting.emotionalSecurity??60)+9);c.parenting.involvement=clamp((c.parenting.involvement??55)+7);if(n.career?.workplace)n.career.workplace.workload=clamp(n.career.workplace.workload+2);cool(n,'child-needs');}},
    {id:'buy-support',label:'Kurs / destek ayarla',result:'Zaman yerine maddi ve profesyonel destek sundun.',effect:n=>{const cost=5000;if((n.finance?.cash??0)>=cost)n.finance.cash-=cost;const c=n.children.find(x=>x.id===child.id);c.parenting.accumulatedSupport=(c.parenting.accumulatedSupport??0)+5;c.relationship=clamp((c.relationship??70)+3);cool(n,'child-needs');}},
    {id:'dismiss',label:'Kendi başına çözmesini bekle',result:'Müdahale etmemeyi seçtin.',effect:n=>{const c=n.children.find(x=>x.id===child.id);c.relationship=clamp((c.relationship??70)-5);c.parenting.emotionalSecurity=clamp((c.parenting.emotionalSecurity??60)-5);cool(n,'child-needs');}}
   ];
  }
 },
 {
  id:'storylet-close-friend-crisis',title:'Eski Bir Arkadaş Aradı',minAge:21,maxAge:75,priority:46,
  condition:s=>ready(s,'friend-crisis',6)&&(s.social?.friends??[]).some(f=>f.closeFriend&&(f.trust??0)>=65),
  choices:s=>{
   const f=s.social.friends.find(x=>x.closeFriend&&(x.trust??0)>=65);
   return [
    {id:'show-up',label:f.name+' için zaman ayır',result:'Arkadaşının yanında oldun.',effect:n=>{const x=n.social.friends.find(y=>y.id===f.id);x.relationship=clamp(x.relationship+7);x.trust=clamp((x.trust??60)+8);x.reciprocity=clamp((x.reciprocity??50)+5);stress(n,2);cool(n,'friend-crisis');}},
    {id:'send-message',label:'Mesajla destek ol',result:'Uzaktan da olsa yanında olduğunu gösterdin.',effect:n=>{const x=n.social.friends.find(y=>y.id===f.id);x.relationship=clamp(x.relationship+3);x.trust=clamp((x.trust??60)+3);cool(n,'friend-crisis');}},
    {id:'too-busy',label:'Şu ara yetişemiyorum',result:'Bu kez arkadaşına zaman ayıramadın.',effect:n=>{const x=n.social.friends.find(y=>y.id===f.id);x.relationship=clamp(x.relationship-4);x.trust=clamp((x.trust??60)-5);cool(n,'friend-crisis');}}
   ];
  }
 },
 {
  id:'storylet-emergency-reserve',title:'Beklenmedik Masraf',minAge:23,maxAge:75,priority:64,
  condition:s=>ready(s,'reserve-choice',4)&&Boolean(s.householdDynamics?.recentShock)&&s.householdDynamics.recentShock.age===s.player.age,
  choices:[
   {id:'pay-cash',label:'Rezervden karşıla',condition:s=>(s.finance?.cash??0)>5000,result:'Masrafı rezervinden karşıladın.',effect:s=>{stress(s,-2);s.lifeMemory.tags.money=(s.lifeMemory.tags.money??0)+1;cool(s,'reserve-choice');}},
   {id:'tighten',label:'Önümüzdeki ayları sıkılaştır',result:'Harcamaları azaltıp şoku absorbe etmeyi seçtin.',effect:s=>{if(s.finance?.lifestyle){s.finance.lifestyle.food='frugal';s.finance.lifestyle.clothing='basic';}stress(s,2);cool(s,'reserve-choice');}},
   {id:'ignore-debt',label:'Borçla devam et',result:'Masrafı borç tarafında bıraktın.',effect:s=>{stress(s,4);if(s.social?.romance)s.social.romance.resentment=clamp((s.social.romance.resentment??20)+3);cool(s,'reserve-choice');}}
  ]
 },
 {
  id:'storylet-secure-couple-future',title:'Birlikte Gelecek Planı',minAge:27,maxAge:62,priority:44,
  condition:s=>ready(s,'future-plan',6)&&(s.social?.romance?.trust??0)>=78&&(s.social?.romance?.sharedGoals??0)>=68,
  choices:[
   {id:'financial-goal',label:'Ortak birikim hedefi koyun',result:'Ortak finans hedefi belirlediniz.',effect:s=>{s.social.romance.moneyAlignment=clamp(s.social.romance.moneyAlignment+6);s.social.romance.sharedGoals=clamp(s.social.romance.sharedGoals+5);if(s.finance)s.finance.savings=(s.finance.savings??0)+Math.min(s.finance.cash??0,5000);cool(s,'future-plan');}},
   {id:'family-goal',label:'Aile hayatını konuşun',result:'Aile ve yaşam beklentilerinizi açıkça konuştunuz.',effect:s=>{s.social.romance.sharedGoals=clamp(s.social.romance.sharedGoals+8);s.social.romance.trust=clamp(s.social.romance.trust+3);cool(s,'future-plan');}},
   {id:'keep-light',label:'Plan yapmadan devam edin',result:'İlişkiyi akışına bırakmayı seçtiniz.',effect:s=>{s.social.romance.intimacy=clamp(s.social.romance.intimacy+2);cool(s,'future-plan');}}
  ]
 },
 {
  id:'storylet-burnout-crossroads',title:'Tükenmişlik Eşiği',minAge:25,maxAge:60,priority:74,
  condition:s=>ready(s,'burnout-crossroads',5)&&(s.career?.workplace?.burnout??0)>=76,
  choices:[
   {id:'slow-down',label:'İş yükünü azaltmaya çalış',result:'Performans riskine rağmen tempoyu düşürdün.',effect:s=>{s.career.workplace.workload=clamp(s.career.workplace.workload-12);s.career.workplace.burnout=clamp(s.career.workplace.burnout-10);s.career.performance=clamp(s.career.performance-3);stress(s,-7);cool(s,'burnout-crossroads');}},
   {id:'vacation',label:'Parayı kullanıp kısa tatil yap',condition:s=>(s.finance?.cash??0)>=12000,result:'Kısa bir tatille zihnini toparladın.',effect:s=>{s.finance.cash-=12000;s.career.workplace.burnout=clamp(s.career.workplace.burnout-14);stress(s,-10);if(s.social?.romance)relationship(s,4,-4);cool(s,'burnout-crossroads');}},
   {id:'grind',label:'Dayan ve devam et',result:'İşi bırakmadın; bedelini stresle ödedin.',effect:s=>{s.career.workplace.recognition=clamp(s.career.workplace.recognition+5);s.career.workplace.burnout=clamp(s.career.workplace.burnout+7);stress(s,8);cool(s,'burnout-crossroads');}}
  ]
 },
 {
  id:'storylet-adult-child-request',title:'Yetişkin Çocuğundan Bir İstek',minAge:45,maxAge:78,priority:49,
  condition:s=>ready(s,'adult-child-request',7)&&(s.children??[]).some(c=>c.age>=20),
  choices:s=>{
   const c=s.children.find(x=>x.age>=20);
   return [
    {id:'help-money',label:c.name+' için maddi destek ver',condition:n=>(n.finance?.cash??0)>=15000,result:'Yetişkin çocuğuna maddi destek verdin.',effect:n=>{n.finance.cash-=15000;const x=n.children.find(y=>y.id===c.id);x.relationship=clamp((x.relationship??70)+6);cool(n,'adult-child-request');}},
    {id:'help-time',label:'Para yerine zaman ve bağlantılarını kullan',result:'Sorunu birlikte çözmeye çalıştınız.',effect:n=>{const x=n.children.find(y=>y.id===c.id);x.relationship=clamp((x.relationship??70)+5);if(n.career)n.career.network=clamp((n.career.network??50)-2);cool(n,'adult-child-request');}},
    {id:'say-no',label:'Kendi ayakları üzerinde durmasını iste',result:'Bu kez yardım etmemeyi seçtin.',effect:n=>{const x=n.children.find(y=>y.id===c.id);x.relationship=clamp((x.relationship??70)-4);cool(n,'adult-child-request');}}
   ];
  }
 },
 {
  id:'storylet-debt-career-risk',title:'Borç Varken Kariyer Riski',minAge:25,maxAge:58,priority:62,
  condition:s=>ready(s,'debt-career-risk',5)&&(s.finance?.debt??0)>600000&&s.career?.employed&&(s.career?.satisfaction??60)<45,
  choices:[
   {id:'stay-safe',label:'Borç bitene kadar güvenli işte kal',result:'Finansal güvenliği kariyer memnuniyetinin önüne koydun.',effect:s=>{s.career.stability=clamp((s.career.stability??50)+5);s.career.satisfaction=clamp((s.career.satisfaction??50)-2);stress(s,2);cool(s,'debt-career-risk');}},
   {id:'search-anyway',label:'Yine de yeni fırsat ara',result:'Borç yüküne rağmen kariyer hareketliliğini seçtin.',effect:s=>{s.career.network=clamp((s.career.network??50)+4);s.career.satisfaction=clamp((s.career.satisfaction??50)+3);stress(s,3);cool(s,'debt-career-risk');}}
  ]
 },
 {
  id:'storylet-old-scar-trigger',title:'Eski Bir Yara Hatırlattı',minAge:30,maxAge:80,priority:38,
  condition:s=>ready(s,'scar-trigger',7)&&(s.lifeMemory?.scarLoad??0)>=30,
  choices:[
   {id:'reflect',label:'Üzerine düşün ve kabullen',result:'Geçmişi bastırmak yerine anlamlandırmaya çalıştın.',effect:s=>{s.lifeMemory.resilience=clamp((s.lifeMemory.resilience??50)+5);s.lifeMemory.scarLoad=clamp((s.lifeMemory.scarLoad??0)-3);stress(s,-4);cool(s,'scar-trigger');}},
   {id:'avoid',label:'Üzerini kapat',result:'Eski meseleyi tekrar açmamayı seçtin.',effect:s=>{stress(s,2);cool(s,'scar-trigger');}},
   {id:'lean-on-someone',label:'Yakın olduğun biriyle paylaş',condition:s=>Boolean(s.social?.romance||(s.social?.friends??[]).some(f=>f.closeFriend)),result:'Yükü tek başına taşımamayı seçtin.',effect:s=>{stress(s,-5);s.lifeMemory.resilience=clamp((s.lifeMemory.resilience??50)+3);if(s.social?.romance)relationship(s,3,-2);cool(s,'scar-trigger');}}
  ]
 }
];
