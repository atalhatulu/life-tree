const KEY='life-tree-card-theme';
const button=document.getElementById('themeToggle');
function applyTheme(enabled){
  document.body.classList.toggle('card-theme',enabled);
  button?.setAttribute('aria-pressed',String(enabled));
  if(button){button.textContent=enabled?'◐':'✦';button.title=enabled?'Klasik görünüme geç':'Kart görünümüne geç';button.setAttribute('aria-label',button.title);}
}
let enabled=false;
try{enabled=localStorage.getItem(KEY)==='on';}catch{}
applyTheme(enabled);
button?.addEventListener('click',()=>{
  enabled=!document.body.classList.contains('card-theme');
  applyTheme(enabled);
  try{localStorage.setItem(KEY,enabled?'on':'off');}catch{}
});
