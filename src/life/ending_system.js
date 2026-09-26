const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function avg(values,fallback=50){
 const xs=values.filter(v=>Number.isFinite(v));
 return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:fallback;
}

function netWorth(state){
 const f=state.finance??{};
 return Math.round((f.cash??0)+(f.savings??0)+(state.assets?.home?.price??0)+(state.assets?.car?.price??0)-(f.debt??0));
}

function familyStrength(state){
 const values=[];
 if(state.social?.romance)values.push(state.social.romance.relationship??50,state.social.romance.trust??50);
 for(const c of state.children??[])values.push(c.relationship??60,c.development?.parentAttachment??60);
 return clamp(avg(values,45));
}

function socialStrength(state){
 const friends=state.social?.friends??[];
 const rel=friends.map(f=>f.relationship??50);
 const close=friends.filter(f=>f.closeFriend).length;
 return clamp(avg(rel,35)+Math.min(25,close*8));
}

function careerStrength(state){
 const c=state.career??{};
 if(state.retirement?.retired)return clamp((c.performance??55)*.4+(c.satisfaction??55)*.25+(c.level??2)*8+15);
 if(!c.employed)return 25;
 return clamp((c.performance??50)*.38+(c.satisfaction??50)*.28+(c.level??1)*9+(c.network??50)*.12);
}

function fulfillment(state){
 const completed=state.lifeGoals?.completed?.length??0;
 const active=state.lifeGoals?.active;
 const wellbeing=(state.player.health?.current??50)*.25+(100-(state.healthProfile?.stress??40))*.2;
 const relationships=familyStrength(state)*.25+socialStrength(state)*.15;
 const goals=Math.min(25,completed*9)+(active?.progress??0)*.15;
 return clamp(wellbeing+relationships+goals);
}

export const ENDING_ARCHETYPES=[
 {
  id:'dynasty-heart',
  title:'Bir Hanedanın Merkezi',
  description:'Hayatının sonunda güçlü aile bağlarının merkezinde kaldın; senden sonra devam edecek bir aile hattı bıraktın.',
  match:m=>m.children>=2&&m.family>=76&&m.age>=65,
  score:m=>m.family+m.children*8+m.age*.15
 },
 {
  id:'quiet-security',
  title:'Sessiz Güvenlik',
  description:'Büyük kırılmalar yerine istikrarı seçtin; hayatının sonunda maddi ve duygusal olarak görece güvenli bir düzen bıraktın.',
  match:m=>m.netWorth>0&&m.financeStability>=68&&m.family>=58&&m.age>=65,
  score:m=>m.financeStability+m.family+m.age*.1
 },
 {
  id:'lonely-summit',
  title:'Yalnız Zirve',
  description:'Kariyerinde güçlü bir konuma ulaştın; fakat yakın ilişkiler aynı ölçüde hayatının merkezinde olmadı.',
  match:m=>m.career>=78&&m.family<48&&m.social<48,
  score:m=>m.career+(100-m.family)*.35+(100-m.social)*.25
 },
 {
  id:'second-spring',
  title:'İkinci Bahar',
  description:'Hayatının ilerleyen döneminde yönünü değiştirdin ve son yıllarını önceki çizginden farklı bir şekilde kurdun.',
  match:m=>m.lateMajorDecisions>=2&&m.age>=60&&m.fulfillment>=62,
  score:m=>m.lateMajorDecisions*18+m.fulfillment
 },
 {
  id:'unfinished-road',
  title:'Yarım Kalan Yol',
  description:'Hayat, bazı büyük hedeflerin ve bağların tamamlanmasına fırsat vermeden sona erdi.',
  match:m=>m.age<52&&((m.activeGoalProgress??0)>=45||m.majorDecisions>=3),
  score:m=>(52-m.age)*2+(m.activeGoalProgress??0)+m.majorDecisions*3
 },
 {
  id:'web-of-people',
  title:'İnsanlarla Örülü Bir Hayat',
  description:'Arkadaşlıklar, aile ve ilişkiler hayatının en güçlü izini oluşturdu.',
  match:m=>m.social>=74&&m.family>=62,
  score:m=>m.social+m.family
 },
 {
  id:'curious-wanderer',
  title:'Merakın İzinde',
  description:'Farklı yollar denedin; kararların seni tek bir hedefe değil, değişen ilgi ve deneyimlere taşıdı.',
  match:m=>m.majorDecisions>=7&&m.completedGoals<=1&&m.age>=45,
  score:m=>m.majorDecisions*5+m.fulfillment*.45
 },
 {
  id:'steady-worker',
  title:'Emekle Kurulan Yıllar',
  description:'Çalışmak ve gündelik sorumluluklar hayatının uzun bir bölümüne yön verdi.',
  match:m=>m.career>=48&&m.age>=55&&m.financeStability<75,
  score:m=>m.career*.8+m.age*.3
 },
 {
  id:'late-peace',
  title:'Sakinleşen Yıllar',
  description:'Hayatının ilerleyen dönemlerinde hızını azalttın ve günlük yaşamında daha sakin bir ritim buldun.',
  match:m=>m.age>=68&&m.fulfillment>=52&&m.career<72,
  score:m=>m.fulfillment+m.age*.3
 },
 {
  id:'self-made',
  title:'Kendi Yolunu Açan',
  description:'Kariyer, para ve bağımsızlık ekseninde kendi düzenini kurarak hayatını tamamladın.',
  match:m=>m.career>=68&&m.netWorth>0&&m.majorDecisions>=5,
  score:m=>m.career*.65+m.financeStability*.5+m.majorDecisions*1.5
 },
 {
  id:'resilient-survivor',
  title:'Direnerek Geçen Bir Hayat',
  description:'Zorlu dönemlerden, baskılardan ve kayıplardan geçtin; buna rağmen hayatını uzun süre taşıdın.',
  match:m=>m.resilience>=68&&m.scarLoad>=35&&m.age>=60,
  score:m=>m.resilience+m.scarLoad+m.age*.1
 },
 {
  id:'peaceful-circle',
  title:'Tamamlanan Çember',
  description:'Hayatın sonuna yüksek bir tamamlanmışlık hissi, güçlü bağlar ve kapanmış hedeflerle ulaştın.',
  match:m=>m.fulfillment>=78&&m.age>=70,
  score:m=>m.fulfillment+m.family*.35+m.social*.2
 },
 {
  id:'ordinary-life',
  title:'Yaşanmış Bir Hayat',
  description:'Ne tek bir başarı ne de tek bir kırılma seni tanımladı; farklı dönemlerin toplamından oluşan bir hayat yaşadın.',
  match:()=>true,
  score:m=>m.fulfillment+m.age*.2
 }
];

export function lifeMetrics(state){
 const debt=state.finance?.debt??0;
 const nw=netWorth(state);
 const annual=Math.max(1,(state.career?.monthlyIncome??state.retirement?.pensionMonthly??0)*12);
 const financeStability=clamp(55+Math.min(30,nw/Math.max(annual,100000)*12)-debt/Math.max(annual,100000)*8);
 const nodes=state.lifeTree?.nodes??[];
 return {
  age:state.player.age,
  cause:state.death?.cause??'Bilinmeyen neden',
  children:state.children?.length??0,
  family:familyStrength(state),
  social:socialStrength(state),
  career:careerStrength(state),
  fulfillment:fulfillment(state),
  financeStability,
  netWorth:nw,
  resilience:state.lifeMemory?.resilience??50,
  scarLoad:state.lifeMemory?.scarLoad??0,
  majorDecisions:nodes.length,
  lateMajorDecisions:nodes.filter(n=>n.age>=45).length,
  activeGoalProgress:state.lifeGoals?.active?.progress??null,
  completedGoals:state.lifeGoals?.completed?.length??0
 };
}

export function classifyEnding(state){
 const metrics=lifeMetrics(state);
 const ranked=ENDING_ARCHETYPES
  .filter(e=>e.match(metrics,state))
  .map(e=>({ending:e,score:e.score(metrics,state)}))
  .sort((a,b)=>b.score-a.score);
 const chosen=(ranked[0]??{ending:ENDING_ARCHETYPES.at(-1)}).ending;
 return {
  id:chosen.id,
  title:chosen.title,
  description:chosen.description,
  age:metrics.age,
  cause:metrics.cause,
  metrics
 };
}

export function buildLifeRecap(state){
 const ending=classifyEnding(state);
 const highlights=[];
 const career=state.career;
 if(career?.title||state.player.job)highlights.push({kind:'career',text:(career?.title??state.player.job)+' olarak bir kariyer çizgisi kurdun.'});
 if(state.social?.romance){
  const p=state.social.romance;
  highlights.push({kind:'relationship',text:(p.name??'Partnerin')+' ile '+(p.yearsTogether??0)+' yıllık bir bağ kurdun.'});
 }
 const children=state.children?.length??0;
 if(children)highlights.push({kind:'family',text:children+' çocuk yetiştirdin.'});
 const completed=state.lifeGoals?.completed??[];
 if(completed.length)highlights.push({kind:'goal',text:completed.length+' uzun vadeli yaşam hedefini tamamladın.'});
 const moves=state.migrationHistory?.length??0;
 if(moves)highlights.push({kind:'migration',text:moves+' önemli taşınma yaşadın.'});
 const nodes=state.lifeTree?.nodes??[];
 if(nodes.length)highlights.push({kind:'decision',text:nodes.length+' kritik karar hayatının yönünü değiştirdi.'});

 return {
  ending,
  lifespan:{age:state.player.age,birthYear:state.year-state.player.age,deathYear:state.year},
  highlights:highlights.slice(0,6),
  netWorth:ending.metrics.netWorth,
  children,
  majorDecisions:nodes.length,
  completedGoals:ending.metrics.completedGoals
 };
}

export function ensureLifeFinale(state){
 state.lifeTree??={nodes:[],branches:[],nextBranchId:1};
 if(state.player?.alive)return null;
 if(!state.lifeTree.finale)state.lifeTree.finale=buildLifeRecap(state);
 return state.lifeTree.finale;
}
