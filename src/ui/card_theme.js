// The illustrated interface is a separate mode. Classic DOM and styles stay intact.
const KEY='life-tree-reference-ui';
const button=document.getElementById('themeToggle');
function applyReference(enabled){
  document.body.classList.toggle('reference-ui',enabled);
  document.body.classList.remove('card-theme');
  if(button){
    button.textContent=enabled?'◐':'✦';
    button.title=enabled?'Klasik arayüze geç':'Resimli arayüze geç';
    button.setAttribute('aria-label',button.title);
    button.setAttribute('aria-pressed',String(enabled));
  }
  document.dispatchEvent(new CustomEvent('life-tree-ui-mode',{detail:{enabled}}));
}
let enabled=true;
try{const saved=localStorage.getItem(KEY);if(saved!==null)enabled=saved==='on';}catch{}
applyReference(enabled);
button?.addEventListener('click',()=>{
  enabled=!document.body.classList.contains('reference-ui');
  applyReference(enabled);
  try{localStorage.setItem(KEY,enabled?'on':'off');}catch{}
});
