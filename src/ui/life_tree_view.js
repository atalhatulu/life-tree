/**
 * A real top-down life tree: every decision has one sibling choice node per
 * available option. Children never render inside a detail card.
 * Rendering is pure: it never mutates a snapshot or simulates a future.
 */
const safe=value=>String(value??'').replace(/[&<>"']/g,ch=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[ch]);
const encoded=value=>encodeURIComponent(JSON.stringify(value));
const pathKey=path=>JSON.stringify(path);

function decision(label,age,kind='decision',detail='',children=[]){
 return {kind,label,age,detail,children};
}
function choice(label,age,{status='pending',probability=null,count=null,samples=null,action=null,detail='',children=[]}={}){
 return {kind:'choice',label,age,status,probability,count,samples,action,detail,children};
}
function terminal(stage){
 return decision(stage.title??'Son',stage.age,stage.kind==='ending'?'ending':'limit',
  stage.label??stage.cause??'');
}

export function continuationTree(result,rootIndex,rootChoiceId,path=[]){
 if(!result?.continuation?.length)return [];
 function step(index){
  const stage=result.continuation[index];
  if(!stage)return [];
  if(stage.kind!=='decision')return [terminal(stage)];
  const next=step(index+1);
  const children=[
   choice(stage.label,stage.age,{
    status:'simulated',probability:stage.probability,count:stage.count,
    samples:stage.samples,detail:stage.label,children:next
   })
  ];
  for(const fork of stage.forks??[]){
   const nextPath=[...path,{stage:index,choiceId:fork.choiceId}];
   children.push(choice(fork.label,stage.age,{
    status:fork.result?'simulated':'pending',
    probability:fork.probability,count:fork.count,samples:stage.samples,
    detail:fork.result?'Bu ihtimalin devamı simüle edildi.':'Bu ihtimal henüz genişletilmedi.',
    action:fork.result?null:{
     type:'fork',rootIndex,rootChoiceId,path:nextPath
    },
    children:fork.result?continuationTree(fork.result,rootIndex,rootChoiceId,nextPath):[]
   }));
  }
  return [decision(stage.title,stage.age,'decision',
   'Bu kararda her seçim ayrı bir çocuk dal olarak gösterilir.',children)];
 }
 return step(0);
}

export function livedLifeTree(nodes,finale,getResult){
 function step(index){
  const node=nodes[index];
  if(!node){
   return finale?[decision(finale.ending.title,finale.lifespan.age,'ending',finale.ending.description)]:[];
  }
  const main=choice(node.label,node.age,{
   status:'lived',detail:node.label,children:step(index+1)
  });
  const others=(node.alternatives??[]).map(alt=>{
   const result=getResult(node,index,alt);
   return choice(alt.label,node.age,{
    status:result?'simulated':'pending',
    detail:result?'Bu alternatif hayat açıldı.':'Seçilmemiş gerçek hayat alternatifi.',
    action:result?null:{type:'root',rootIndex:index,choiceId:alt.id},
    children:result?continuationTree(result,index,alt.id):[]
   });
  });
  return [decision(node.title,node.age,'decision','Gerçek hayattaki kritik karar.',[main,...others])];
 }
 return decision('Doğum',0,'birth','Bütün hayatların ortak başlangıcı.',step(0));
}

function nodeMarkup(node,depth,context){
 const id='life-node-'+context.id++;
 const canExpand=node.action&&context.dead;
 const nodeClass=node.kind==='choice'?'life-graph-choice '+node.status:'life-graph-'+node.kind;
 const probability=node.probability==null?'':`<span class="life-graph-percent">% ${safe(node.probability)}</span>`;
 const action=node.action?.type==='root'
  ?` data-counterfactual-node="${node.action.rootIndex}" data-counterfactual-choice="${safe(node.action.choiceId)}"`
  :node.action?.type==='fork'
   ?` data-sim-fork data-root-node="${node.action.rootIndex}" data-root-choice="${safe(node.action.rootChoiceId)}" data-fork-path="${encoded(node.action.path)}"`
   :'';
 const selected=canExpand?' data-tree-expand="1"':'';
 const label=depth===0?'BAŞLANGIÇ':node.age!=null?node.age+' yaş':'';
 const detail={title:node.label,age:node.age,kind:node.kind,status:node.status??null,
  probability:node.probability,count:node.count,samples:node.samples,detail:node.detail,canExpand};
 context.details[id]=detail;
 const button=`<button type="button" class="life-graph-node ${nodeClass}" data-tree-node="${id}"${action}${selected} aria-label="${safe(node.label)}">
  <span class="life-graph-age">${safe(label)}</span>
  <strong>${safe(node.label)}</strong>
  ${probability}
  ${canExpand?'<span class="life-graph-plus" aria-hidden="true">＋</span>':''}
 </button>`;
 if(!node.children?.length)return `<li>${button}</li>`;
 return `<li>${button}<ul>${node.children.map(child=>nodeMarkup(child,depth+1,context)).join('')}</ul></li>`;
}

export function renderFamilyTree(root,{dead=false}={}){
 const context={id:0,details:{},dead};
 const markup=`<div class="life-family-tree" role="tree" aria-label="Hayatın dallanan seçenekleri"><ul>${nodeMarkup(root,0,context)}</ul></div>`;
 return {markup,details:context.details,nodeCount:context.id};
}
