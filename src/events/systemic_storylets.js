const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const stress=(s,d)=>{if(s.healthProfile)s.healthProfile.stress=clamp((s.healthProfile.stress??30)+d);};

export const systemicStorylets=[
 {
  id:'systemic-burnout-crossroads',title:'Tükenmişlik Sınırı',minAge:22,maxAge:65,once:false,priority:55,
  condition:s=>s.career?.employed&&(s.mentalHealth?.burnout??0)>=62&&s.player.age>=(s.nextSystemicBurnoutAge??22),
  choices:[
   {id:'recover',label:'Temponu düşür ve toparlanmaya öncelik ver',result:'Kariyer hızından biraz vazgeçip toparlanmaya alan açtın.',effect:s=>{s.mentalHealth.burnout=clamp(s.mentalHealth.burnout-18);s.career.performance=clamp(s.career.performance-3);stress(s,-7);s.nextSystemicBurnoutAge=s.player.age+4;}},
   {id:'push',label:'Kariyeri öne koyup devam et',result:'Yüksek tempoyu sürdürmeyi seçtin.',effect:s=>{s.career.performance=clamp(s.career.performance+3);s.mentalHealth.burnout=clamp(s.mentalHealth.burnout+10);stress(s,5);s.nextSystemicBurnoutAge=s.player.age+3;}}
  ]
 },
 {
  id:'systemic-isolation-choice',title:'Sosyal Çevren Daralıyor',minAge:25,maxAge:85,once:false,priority:32,
  condition:s=>(s.socialWellbeing?.isolation??0)>=62&&s.player.age>=(s.nextIsolationStoryAge??25),
  choices:[
   {id:'reconnect',label:'İnsanlara yeniden zaman ayır',result:'Sosyal bağlarını yeniden kurmaya bilinçli olarak zaman ayırdın.',effect:s=>{for(const f of s.social?.friends??[])f.relationship=clamp((f.relationship??50)+4);stress(s,-4);s.nextIsolationStoryAge=s.player.age+4;}},
   {id:'accept-solitude',label:'Yalnız düzenini sürdür',result:'Daha yalnız bir yaşam ritmini sürdürdün.',effect:s=>{stress(s,2);s.nextIsolationStoryAge=s.player.age+4;}}
  ]
 },
 {
  id:'systemic-health-work-tradeoff',title:'Sağlık ve İş Arasında',minAge:35,maxAge:70,once:false,priority:58,
  condition:s=>s.career?.employed&&(s.body?.recovery??100)<48&&(s.healthProfile?.conditions?.length??0)>0&&s.player.age>=(s.nextHealthWorkAge??35),
  choices:[
   {id:'protect-health',label:'İş yükünü azalt',result:'Sağlık kapasiteni korumak için iş yükünü azalttın.',effect:s=>{s.career.performance=clamp(s.career.performance-2);s.career.satisfaction=clamp(s.career.satisfaction+3);stress(s,-6);s.nextHealthWorkAge=s.player.age+4;}},
   {id:'maintain-work',label:'Çalışma düzenini koru',result:'Sağlık baskısına rağmen çalışma düzenini değiştirmedin.',effect:s=>{s.body.recovery=clamp(s.body.recovery-4);stress(s,4);s.nextHealthWorkAge=s.player.age+3;}}
  ]
 }
];
