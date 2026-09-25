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
