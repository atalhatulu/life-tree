import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {livedLifeTree,renderFamilyTree,continuationTree} from '../src/ui/life_tree_view.js';

const app=()=>fs.readFileSync(new URL('../src/ui/app.js',import.meta.url),'utf8');
const css=()=>fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('real family-tree display connects every alternative to its decision',()=>{
 const nodes=[{
  age:18,title:'Eğitim',label:'Üniversite',choiceId:'uni',eventId:'education',
  alternatives:[{id:'work',label:'İşe başla'},{id:'travel',label:'Seyahat et'}]
 }];
 const tree=livedLifeTree(nodes,null,()=>null);
 assert.equal(tree.label,'Doğum');
 assert.equal(tree.children[0].label,'Eğitim');
 assert.deepEqual(tree.children[0].children.map(item=>item.label),
  ['Üniversite','İşe başla','Seyahat et']);
 const graph=renderFamilyTree(tree,{dead:true});
 assert.equal(graph.nodeCount,5);
 assert.equal((graph.markup.match(/life-graph-node /g)??[]).length,5);
 assert.ok(graph.markup.includes('data-counterfactual-node="0"'));
 assert.ok(graph.markup.includes('data-counterfactual-choice="work"'));
 assert.ok(graph.markup.includes('data-counterfactual-choice="travel"'));
});

test('simulated decisions render sibling choice nodes, nested continuation and endings',()=>{
 const simulated={
  continuation:[{
   kind:'decision',title:'İş teklifi',age:25,label:'Kabul et',
   choiceId:'accept',samples:100,count:65,probability:65,
   forks:[
    {choiceId:'reject',label:'Reddet',count:35,probability:35,result:null},
    {choiceId:'later',label:'Ertele',count:0,probability:0,result:{
     continuation:[{kind:'ending',title:'Yaşam sonu',age:79,label:'Doğal nedenler'}]
    }}
   ]
  },{kind:'ending',title:'Yaşam sonu',age:78,label:'Doğal nedenler'}]
 };
 const nodes=continuationTree(simulated,1,'work');
 assert.equal(nodes.length,1);
 assert.deepEqual(nodes[0].children.map(item=>item.label),['Kabul et','Reddet','Ertele']);
 assert.equal(nodes[0].children[0].children[0].kind,'ending');
 assert.equal(nodes[0].children[1].action.type,'fork');
 assert.equal(nodes[0].children[2].children[0].kind,'ending');
 const graph=renderFamilyTree(nodes[0],{dead:true});
 assert.ok(graph.markup.includes('data-sim-fork'));
 assert.ok(graph.markup.includes('life-graph-ending'));
});

test('current life trail is keyboard scrollable and preserves alternative detail state',()=>{
 const ui=app(),style=css();
 assert.ok(ui.includes('class="life-trail-scroll" tabindex="0"'));
 assert.ok(ui.includes('aria-label="Hayatın kararları ve alternatif yaşamlar"'));
 assert.ok(ui.includes("root.querySelectorAll('details[data-life-alternative][open]')"));
 assert.ok(ui.includes("root.querySelector('.life-trail-scroll').scrollTop=oldScroll"));
 assert.ok(ui.includes('class="life-alt-compare"'));
 assert.ok(style.includes('.life-trail-scroll'));
});

test('alternative lives simulate and compare through the current timeline interface',()=>{
 const ui=app(),engine=fs.readFileSync(new URL('../src/life/counterfactual_continuation.js',import.meta.url),'utf8');
 assert.ok(ui.includes('data-counterfactual-node'));
 assert.ok(ui.includes('data-counterfactual-choice'));
 assert.ok(ui.includes('simulateContinuation(runGame.seedText,node,choiceId'));
 assert.ok(ui.includes('data-afterlife-index'));
 assert.ok(ui.includes('class="afterlife-table"'));
 assert.ok(ui.includes('renderLifeTree();'));
 assert.ok(engine.includes('const checkpoint=milestone.snapshot'));
});

