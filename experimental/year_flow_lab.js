import {Game} from '../src/core/game.js';
import {restoreExperimentalYearSession} from '../src/experimental/year_session.js';
import {ExperimentalYearSession} from '../src/experimental/year_session.js';
import {calendarDate} from '../src/experimental/year_flow_scheduler.js';
const $=id=>document.getElementById(id);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let game,session,token=0,shownMonths=0;
const SAVE_KEY='life-tree-experimental-year-v1';
function controls(){
 $('pause').disabled=!session||!['running','paused'].includes(session.phase);
 $('pause').textContent=session?.phase==='paused'?'Devam et':'Duraklat';
 $('save').disabled=!session;
 $('start').disabled=Boolean(session&&session.phase!=='complete')||!game.state.player.alive;
}
function dateText(year,day){return new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(calendarDate(year,day));}
function refresh(){
  $('identity').textContent=game.state.player.name+' '+game.state.player.surname;
  $('age').textContent=game.state.player.age+' yaş';
  if(session){$('date').textContent=dateText(session.year,session.day);$('progress').max=session.snapshot().totalDays;$('progress').value=session.day;}
  controls();
}
function add(text,day,heading){
  const el=document.createElement('article');el.className='item';
  const small=document.createElement('small');small.textContent=dateText(session.year,day);
  const title=document.createElement('strong');title.textContent=heading;
  const body=document.createElement('div');body.textContent=text??'';
  el.append(small,title,body);$('feed').prepend(el);
}
async function animateTo(day,localToken){
  const from=session.day,to=day,steps=Math.max(1,Math.ceil((to-from)/5));
  for(let i=1;i<=steps;i++){
    if(token!==localToken||session.phase!=='running')return false;
    const shown=Math.round(from+(to-from)*i/steps);
    while(session.day<shown){
      if(token!==localToken||session.phase!=='running')return false;
      session.tickDay();
      const ledger=session.preview.state.finance?.experimentalMonthlyLedger??[];
      while(shownMonths<ledger.length){
        const entry=ledger[shownMonths++];
        const date=new Date(Date.UTC(entry.year,entry.month,0));
        const day=Math.round((date-Date.UTC(entry.year,0,1))/86400000)+1;
        add('Gelir ₺'+entry.income.toLocaleString('tr-TR')+' · gider ₺'+entry.expense.toLocaleString('tr-TR')+
          ' · net ₺'+entry.net.toLocaleString('tr-TR')+' · borç ₺'+entry.debt.toLocaleString('tr-TR'),day,'Aylık bütçe');
      }
    }
    $('date').textContent=dateText(session.year,session.day);$('progress').value=session.day;
    await pause(Number($('speed').value));
  }
  return token===localToken;
}
async function run(localToken){
  while(token===localToken&&session.phase==='running'){
    const next=session.timeline[session.cursor];
    if(next&&!await animateTo(Math.max(session.day,next.day),localToken))return;
    if(!next&&!await animateTo(session.snapshot().totalDays,localToken))return;
    const item=session.advance();refresh();
    if(item.type==='notice')add(item.text,item.day,'Yıl içinden bir gelişme');
    if(item.type==='decision'){
      add('Kararını verdiğinde takvim kaldığı yerden devam edecek.',item.day,item.pending.title);
      $('status').textContent='Zaman durdu · karar bekleniyor';controls();
      const wrap=document.createElement('div');wrap.id='choices';
      for(const choice of item.pending.choices){
        const button=document.createElement('button');button.textContent=choice.label;
        button.onclick=()=>{
          if(token!==localToken)return;
          try{
            const resolved=session.choose(choice.id);
            wrap.remove();add(String(resolved.result??'Kararın kaydedildi.'),session.day,'Seçiminin sonucu');
            $('status').textContent='Yıl ilerliyor…';controls();void run(localToken);
          }catch(error){$('status').textContent=error.message;}
        };
        wrap.append(button);
      }
      $('feed').prepend(wrap);return;
    }
    if(item.type==='complete'){
      session.commit();refresh();
      $('status').textContent='Yıl tamamlandı · sonuçlar deney oyununa işlendi';
      controls();
      return;
    }
  }
}
function reset(){
  token++;shownMonths=0;game=new Game('year-flow-lab-'+Date.now());session=null;
  $('feed').replaceChildren();$('status').textContent='Deney için yeni bir yıl başlat.';
  $('start').disabled=false;$('date').textContent=dateText(game.state.year+1,1);
  $('progress').value=1;$('progress').max=365;refresh();
}
$('start').onclick=()=>{
  if(session&&session.phase!=='complete')return;
  if(!game.state.player.alive)return;
  shownMonths=0;session=new ExperimentalYearSession(game,{maxDecisions:3});
  try{session.start();}catch(error){$('status').textContent=error.message;return;}
  $('start').disabled=true;$('feed').replaceChildren();refresh();
  $('status').textContent='Yıl ilerliyor…';controls();void run(++token);
};

$('pause').onclick=()=>{
 if(!session)return;
 if(session.phase==='running'){session.pause();token++;$('status').textContent='Takvim duraklatıldı';}
 else if(session.phase==='paused'){session.resume();$('status').textContent='Yıl ilerliyor…';void run(++token);}
 controls();
};
$('save').onclick=()=>{
 if(!session)return;
 try{localStorage.setItem(SAVE_KEY,JSON.stringify(session.exportCheckpoint()));$('status').textContent='Deney oturumu kaydedildi';}
 catch(error){$('status').textContent='Kaydetme başarısız: '+error.message;}
};
$('load').onclick=()=>{
 try{
  const saved=localStorage.getItem(SAVE_KEY);
  if(!saved)throw new Error('Kayıt bulunamadı');
  token++;session=restoreExperimentalYearSession(Game,JSON.parse(saved));game=session.game;
  shownMonths=session.preview.state.finance?.experimentalMonthlyLedger?.length??0;
  $('feed').replaceChildren();refresh();
  $('status').textContent='Kayıt yüklendi · '+session.phase;
  if(session.phase==='running')void run(++token);
  else if(session.phase==='waiting')showPending(token);
 }catch(error){$('status').textContent='Yükleme başarısız: '+error.message;}
};
function showPending(localToken){
 const pending=session.snapshot().pending;if(!pending)return;
 const wrap=document.createElement('div');wrap.id='choices';
 for(const choice of pending.choices){
  const button=document.createElement('button');button.textContent=choice.label;
  button.onclick=()=>{
   if(token!==localToken)return;
   try{const result=session.choose(choice.id);wrap.remove();add(String(result.result??'Kararın kaydedildi.'),session.day,'Seçiminin sonucu');controls();void run(localToken);}
   catch(error){$('status').textContent=error.message;}
  };wrap.append(button);
 }
 $('feed').prepend(wrap);
}
$('reset').onclick=reset;
reset();
