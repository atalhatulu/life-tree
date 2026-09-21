const LINE='─'.repeat(62);

export function printHeader(game){
 const s=game.state;
 console.log('\n'+LINE);
 console.log(s.player.name+' '+s.player.surname+' — '+s.player.age+' yaş — '+s.year);
 console.log('Sağlık '+s.player.health.current+'/100 | Görünüş '+s.player.appearance.attractiveness+'/100 | Sınıf: '+s.household.economicClass);

 if(s.education){
  console.log('Okul: '+s.education.schoolName+' | Başarı '+Math.round(s.education.performance)+'/100 | Motivasyon '+Math.round(s.education.motivation)+'/100');
 }
 if(s.higherEducation){
  console.log('Üniversite: '+s.higherEducation.programTitle+' | '+(s.higherEducation.completed?'Mezun':'Sınıf '+s.higherEducation.year)+' | Performans '+Math.round(s.higherEducation.performance)+'/100');
 }
 if(s.career?.employed){
  console.log('İş: '+s.career.title+' | ₺'+s.career.monthlyIncome.toLocaleString('tr-TR')+'/ay | Performans '+Math.round(s.career.performance)+'/100');
 }
 if(s.finance){
  console.log('Birikim: ₺'+Math.round(s.finance.cash).toLocaleString('tr-TR')+' | Borç: ₺'+Math.round(s.finance.debt).toLocaleString('tr-TR'));
 }

 console.log('Arkadaş: '+s.social.friends.length+' | Aksiyon: '+s.actions.remaining+'/'+s.actions.max);
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
