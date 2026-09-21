import {Game} from '../core/game.js';
import {autoplay} from '../simulation/autoplay.js';
import {validateState} from '../simulation/invariants.js';

function arg(name,fallback){
 const index=process.argv.indexOf('--'+name);
 return index>=0&&process.argv[index+1]!=null?process.argv[index+1]:fallback;
}

const lives=Math.max(1,Number(arg('lives','1000')));
const toAge=Math.max(1,Number(arg('to-age','18')));
const policy=arg('policy','balanced');

const stats={
 invalid:0,
 paths:{},
 next:{},
 friends:0,
 romance:0,
 performance:0,
 treeNodes:0
};
const errors=[];

for(let i=0;i<lives;i++){
 const game=new Game('batch-'+policy+'-'+i);
 try{
  autoplay(game,{toAge,policy});
 }catch(error){
  stats.invalid++;
  if(errors.length<10) errors.push({seed:game.seedText,error:error.message});
  continue;
 }

 const state=game.state;
 const violations=validateState(state);
 if(violations.length){
  stats.invalid++;
  if(errors.length<10) errors.push({seed:game.seedText,error:violations.join('; ')});
 }

 const path=state.education?.path??'none';
 stats.paths[path]=(stats.paths[path]??0)+1;
 const next=state.nextPath??'none';
 stats.next[next]=(stats.next[next]??0)+1;
 stats.friends+=state.social.friends.length;
 stats.romance+=state.social.romance?1:0;
 stats.performance+=state.education?.performance??0;
 stats.treeNodes+=state.lifeTree.nodes.length;
}

console.log('Life Tree batch simulation');
console.log('Lives: '+lives+' | To age: '+toAge+' | Policy: '+policy);
console.log('Invalid states: '+stats.invalid);
console.log('High school paths:',stats.paths);
console.log('Age-18 next paths:',stats.next);
console.log('Average friends: '+(stats.friends/lives).toFixed(2));
console.log('Romance rate: '+(stats.romance/lives*100).toFixed(1)+'%');
console.log('Average school performance: '+(stats.performance/lives).toFixed(1));
console.log('Average Life Tree nodes: '+(stats.treeNodes/lives).toFixed(2));
if(errors.length){
 console.log('Sample errors:',errors);
 process.exitCode=1;
}
