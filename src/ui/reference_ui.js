const $=selector=>document.querySelector(selector);
const screenText={
 lifeScreen:['Hayat','Her yaşam bir hikâye.'],
 relationshipsScreen:['İlişkiler','Hayatındaki insanlarla bağlarını güçlendir.'],
 activitiesScreen:['Eylemler','Bu dönemde ne yapmak istersin?'],
 assetsScreen:['Varlıklar','Sahip oldukların ve birikimlerin.'],
 careerScreen:['Kariyer','Eğitim ve iş hayatın.'],
 treeScreen:['Hayat Ağacı','Geçmişini gör, yeni ihtimalleri keşfet.'],
 albumScreen:['Hayat Albümü','Yaşadığın anların günlüğü.']
};
let filter='all';
function category(text){
 const t=String(text).toLocaleLowerCase('tr-TR');
 if(/çalış|iş|kariyer|meslek|terfi|maaş|eğitim|ders|öğren|kurs/.test(t))return 'career';
 if(/arkadaş|aile|sosyal|partner|buluş|sohbet|tanış|ilişki|randevu/.test(t))return 'social';
 return 'personal';
}
function bindDecisionGesture(){
 const card=$('#eventCard');
 if(!card||card.classList.contains('hidden')||card.dataset.gestureBound==='yes')return;
 const choices=[...card.querySelectorAll('[data-choice],[data-moment]')];
 if(choices.length!==2)return; // Other decisions retain their full choice list.
 card.dataset.gestureBound='yes';
 let start=null;
 card.addEventListener('pointerdown',event=>{
  if(!document.body.classList.contains('reference-ui')||event.target.closest('button')||event.button!==0)return;
  start={x:event.clientX,y:event.clientY,id:event.pointerId};
 });
 card.addEventListener('pointermove',event=>{
  if(!start||start.id!==event.pointerId)return;
  const dx=event.clientX-start.x,dy=event.clientY-start.y;
  if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>20){start=null;return;}
  if(Math.abs(dx)<12)return;
  card.classList.add('ref-dragging');
  card.classList.toggle('ref-swipe-left',dx<0);
  card.classList.toggle('ref-swipe-right',dx>0);
  card.style.transform='rotate('+Math.max(-10,Math.min(10,dx/17))+'deg) translateX('+Math.max(-95,Math.min(95,dx))+'px)';
 });
 const reset=()=>{
  card.classList.remove('ref-dragging','ref-swipe-left','ref-swipe-right');
  card.style.transform='';
 };
 card.addEventListener('pointerup',event=>{
  if(!start||start.id!==event.pointerId)return;
  const dx=event.clientX-start.x,dy=event.clientY-start.y;
  start=null;reset();
  if(Math.abs(dx)>=90&&Math.abs(dx)>Math.abs(dy)*1.3){
   // Left = first choice, right = second choice. Buttons remain keyboard accessible.
   const selected=choices[dx<0?0:1];
   if(selected&&!selected.disabled)selected.click();
  }
 });
 card.addEventListener('pointercancel',()=>{start=null;reset();});
}
function decorate(){
 const active=$('.screen-panel.active')?.id??'lifeScreen';
 const [title,description]=screenText[active]??screenText.lifeScreen;
 if($('#refScreenTitle'))$('#refScreenTitle').textContent=title;
 if($('#refScreenDescription'))$('#refScreenDescription').textContent=description;
 const identity=$('#identity')?.textContent??'Yeni hayat';
 if($('#refName'))$('#refName').textContent=identity;
 if($('#refMeta'))$('#refMeta').textContent=$('#subtitle')?.textContent??'';
 const remaining=$('.ref-action-filter');
 if(remaining)remaining.hidden=active!=='activitiesScreen';
 const actions=$('#activities');
 if(actions){
  actions.querySelectorAll('[data-activity],[data-leisure]').forEach(button=>{
   if(!button.dataset.refCategory)button.dataset.refCategory=category(button.textContent);
   const kind=button.dataset.refCategory;
   button.classList.add('ref-illustrated-action');
   if(!button.querySelector('.ref-action-picture')){
    const picture=document.createElement('span');
    picture.className='ref-action-picture ref-picture-'+kind;
    picture.setAttribute('aria-hidden','true');
    picture.textContent=kind==='career'?'▣':kind==='social'?'♧':'✧';
    button.prepend(picture);
   }
   button.hidden=filter!=='all'&&kind!==filter;
  });
 }
 bindDecisionGesture();
 const event=$('#eventCard');
 if(event&&!event.classList.contains('hidden')){
  event.classList.toggle('ref-decision',Boolean(event.querySelector('[data-choice],[data-moment]')));
 }
 document.querySelectorAll('.nav-item').forEach(button=>{
  button.classList.toggle('ref-visible-nav',['lifeScreen','relationshipsScreen','activitiesScreen','assetsScreen','treeScreen'].includes(button.dataset.screen));
 });
}
document.querySelectorAll('[data-ref-screen]').forEach(button=>button.addEventListener('click',()=>document.querySelector('.nav-item[data-screen="'+button.dataset.refScreen+'"]')?.click()));
document.querySelectorAll('[data-ref-filter]').forEach(button=>button.addEventListener('click',()=>{
 filter=button.dataset.refFilter;
 document.querySelectorAll('[data-ref-filter]').forEach(item=>item.classList.toggle('selected',item===button));
 decorate();
}));
document.addEventListener('life-tree-render',decorate);
document.addEventListener('life-tree-screen',decorate);
document.addEventListener('life-tree-ui-mode',decorate);
decorate();
