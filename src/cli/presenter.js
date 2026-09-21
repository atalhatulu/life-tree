const LINE='─'.repeat(68);

export function printHeader(game){
 const s=game.state;
 console.log('\n'+LINE);
 console.log(s.player.name+' '+s.player.surname+' — '+s.player.age+' yaş — '+s.year+(s.player.alive?'':' — HAYAT SONA ERDİ'));
 console.log('Konum: '+(s.location?.cityName??s.origin?.cityName??'Türkiye')+' | Doğum: '+(s.origin?.cityName??'—'));
 console.log('Sağlık '+Math.round(s.player.health.current)+'/100 | Görünüş '+s.player.appearance.attractiveness+'/100 | Köken: '+s.household.economicClass);

 if(s.education){
  console.log('Okul: '+s.education.schoolName+' | Başarı '+Math.round(s.education.performance)+'/100 | Motivasyon '+Math.round(s.education.motivation)+'/100');
 }
 if(s.higherEducation){
  console.log('Üniversite: '+s.higherEducation.programTitle+' | '+(s.higherEducation.completed?'Mezun':'Sınıf '+s.higherEducation.year)+' | Performans '+Math.round(s.higherEducation.performance)+'/100');
 }
 if(s.retirement?.retired){
  console.log('Emeklilik: '+s.retirement.previousTitle+' kariyerinden emekli | ₺'+s.retirement.pensionMonthly.toLocaleString('tr-TR')+'/ay | '+(s.retirement.years??0)+' yıl');
 }
 if(s.career){
  console.log('Kariyer: '+(s.career.employed?s.career.title:(s.retirement?.retired?'Emekli':'İşsiz'))+
   (s.career.employed?' | ₺'+s.career.monthlyIncome.toLocaleString('tr-TR')+'/ay | Seviye '+(s.career.level??1)+' | Memnuniyet '+Math.round(s.career.satisfaction??50)+'/100':''));
 }

 const r=s.social?.romance;
 if(r){
  const status={dating:'Sevgili',cohabiting:'Birlikte yaşıyor',married:'Evli'}[r.status]??'İlişki';
  console.log('İlişki: '+r.name+' '+r.surname+' | '+status+' | '+Math.round(r.relationship)+'/100 | '+r.yearsTogether+' yıl');
 }else console.log('İlişki: Yok');

 if(s.children?.length){
  console.log('Çocuklar: '+s.children.map(c=>c.name+' ('+c.age+')'+(c.adultLife?.jobTitle?' — '+c.adultLife.jobTitle:'')).join(', '));
  if((s.grandchildren??0)>0)console.log('Torunlar: '+s.grandchildren);
 }else if(s.player.age>=19) console.log('Çocuklar: Yok');

 if(s.finance){
  console.log('Yaşam: '+s.finance.lifestyle.housing+' / '+s.finance.lifestyle.food+' / '+s.finance.lifestyle.clothing+' / '+s.finance.lifestyle.transport);
  console.log('Birikim: ₺'+Math.round(s.finance.cash).toLocaleString('tr-TR')+' | Borç: ₺'+Math.round(s.finance.debt).toLocaleString('tr-TR')+' | Aylık gider: ₺'+Math.round(s.finance.monthlyExpenses).toLocaleString('tr-TR'));
 }
 if(s.assets){
  console.log('Varlıklar: '+(s.assets.home?s.assets.home.label:'ev yok')+' | '+(s.assets.car?s.assets.car.label:'araba yok'));
 }
 if(s.business){
  console.log('İşletme: '+(s.business.active?'aktif':'kapalı')+' | '+(s.business.years??0)+' yıl | aylık sonuç ₺'+Math.round(s.business.monthlyProfit??0).toLocaleString('tr-TR')+' | çalışan '+(s.business.employees??0));
 }
 if(s.inheritanceHistory?.length){
  console.log('Alınan miras: ₺'+Math.round(s.inheritanceHistory.reduce((sum,x)=>sum+x.amount,0)).toLocaleString('tr-TR'));
 }
 if(s.healthProfile){
  const conditions=s.healthProfile.conditions.length?s.healthProfile.conditions.map(c=>c.label).join(', '):'tanı yok';
  console.log('Sağlık profili: stres '+Math.round(s.healthProfile.stress)+'/100 | fitness '+Math.round(s.healthProfile.fitness)+'/100 | '+conditions);
 }

 console.log('Arkadaş: '+s.social.friends.length+' | Aksiyon: '+s.actions.remaining+'/'+s.actions.max+' | Life Tree: '+s.lifeTree.nodes.length+' düğüm');
 console.log(LINE);
}

export function printNewHistory(game,fromIndex){
 const items=game.state.history.slice(fromIndex);
 for(const item of items) console.log('• ['+item.age+' yaş] '+(item.result??item.text));
 return game.state.history.length;
}

export function printEvent(game,event){
 console.log('\n▶ '+event.title);
 const choices=game.eventChoices(event);
 choices.forEach((choice,index)=>console.log('  '+(index+1)+') '+choice.label));
 return choices;
}

export function printActivities(game){
 const list=game.availableActivities();
 console.log('\nAktiviteler:');
 list.forEach((activity,index)=>console.log('  '+(index+1)+') '+activity.label));
 console.log('  0) Yılı bitir');
 return list;
}
