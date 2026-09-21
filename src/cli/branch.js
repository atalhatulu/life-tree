import {readFile,writeFile} from 'node:fs/promises';
import {Game} from '../core/game.js';
import {autoplay} from '../simulation/autoplay.js';
import {serializeGame} from '../core/save_system.js';
import {buildLifeRecap} from '../life/life_recap.js';

function arg(name,fallback=null){
 const index=process.argv.indexOf('--'+name);
 return index>=0&&process.argv[index+1]!=null?process.argv[index+1]:fallback;
}

const loadPath=arg('load');
if(!loadPath)throw new Error('--load save.json gerekli.');

const nodeIndex=Number(arg('node','0'));
const choiceId=arg('choice');
if(!choiceId)throw new Error('--choice <choice-id> gerekli.');

const toAge=Math.max(1,Number(arg('to-age','100')));
const policy=arg('policy','balanced');
const savePath=arg('save');

const original=Game.fromSave(await readFile(loadPath,'utf8'));
const node=original.state.lifeTree?.nodes?.[nodeIndex];
if(!node)throw new Error('Life Tree node bulunamadı: '+nodeIndex);
if(!node.snapshot)throw new Error('Bu düğüm branch snapshot taşımıyor.');

const available=node.snapshot.availableChoices??[];
if(!available.some(choice=>choice.id===choiceId)){
 throw new Error('Seçenek bu düğümde yok. Mevcut: '+available.map(x=>x.id).join(', '));
}

const branched=original.branchFromNode(nodeIndex,choiceId);
autoplay(branched,{toAge,policy});

if(savePath){
 await writeFile(savePath,serializeGame(branched),'utf8');
}

const originalChoice=node.label;
const newNode=branched.state.lifeTree.nodes.at(-1);
const recap=branched.state.deathSummary?.recap??buildLifeRecap(branched.state);

console.log('Life Tree branch');
console.log('Kaynak save: '+loadPath);
console.log('Düğüm: '+nodeIndex+' | '+node.age+' yaş | '+node.title);
console.log('Orijinal: '+originalChoice);
console.log('Alternatif: '+newNode.label);
console.log('Yeni hayat son yaşı: '+branched.state.player.age+' | '+(branched.state.player.alive?'hayatta':'öldü'));
console.log('Kariyer: '+(recap.work.history.map(x=>x.title).join(' -> ')||'—'));
console.log('Çocuk: '+recap.family.children.length+' | Torun: '+recap.family.grandchildren);
console.log('Birikim: ₺'+recap.finances.cash.toLocaleString('tr-TR')+' | Borç: ₺'+recap.finances.debt.toLocaleString('tr-TR'));
console.log('Life Tree düğümleri: '+branched.state.lifeTree.nodes.length);
if(savePath)console.log('Branch save: '+savePath);
