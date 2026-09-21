import {Game} from '../core/game.js';
import {autoplay} from '../simulation/autoplay.js';
import {validateState} from '../simulation/invariants.js';

function arg(name,fallback){
 const index=process.argv.indexOf('--'+name);
 return index>=0&&process.argv[index+1]!=null?process.argv[index+1]:fallback;
}

const lives=Math.max(1,Number(arg('lives','1000')));
const toAge=Math.max(1,Number(arg('to-age','30')));
const policy=arg('policy','random');

const stats={
 invalid:0,paths:{},next:{},classes:{},
 friends:0,romance:0,performance:0,readiness:0,treeNodes:0,admissions:0,
 university:0,graduates:0,employed:0,degreeRelated:0,cash:0,debt:0
};
const errors=[];

for(let i=0;i<lives;i++){
 const game=new Game('batch-'+policy+'-'+i);
 try{autoplay(game,{toAge,policy});}
 catch(error){
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
 const cls=state.household.economicClass;
 stats.classes[cls]=(stats.classes[cls]??0)+1;
 stats.friends+=state.social.friends.length;
 stats.romance+=state.social.romance?1:0;
 stats.performance+=state.education?.performance??0;
 stats.readiness+=state.education?.graduationReadiness??0;
 stats.treeNodes+=state.lifeTree.nodes.length;
 stats.admissions+=state.education?.admissionSucceeded?1:0;
 stats.university+=state.higherEducation?1:0;
 stats.graduates+=state.higherEducation?.completed?1:0;
 stats.employed+=state.career?.employed?1:0;
 stats.degreeRelated+=state.career?.degreeRelated?1:0;
 stats.cash+=state.finance?.cash??0;
 stats.debt+=state.finance?.debt??0;
}

console.log('Life Tree batch simulation');
console.log('Lives: '+lives+' | To age: '+toAge+' | Policy: '+policy);
console.log('Invalid states: '+stats.invalid);
console.log('Household classes:',stats.classes);
console.log('High school paths:',stats.paths);
console.log('Current paths:',stats.next);
console.log('Admission success: '+(stats.admissions/lives*100).toFixed(1)+'%');
console.log('University experience: '+(stats.university/lives*100).toFixed(1)+'%');
console.log('University graduates: '+(stats.graduates/lives*100).toFixed(1)+'%');
console.log('Employed: '+(stats.employed/lives*100).toFixed(1)+'%');
console.log('Degree-related careers: '+(stats.degreeRelated/lives*100).toFixed(1)+'%');
console.log('Average friends: '+(stats.friends/lives).toFixed(2));
console.log('Romance active: '+(stats.romance/lives*100).toFixed(1)+'%');
console.log('Average school performance: '+(stats.performance/lives).toFixed(1));
console.log('Average graduation readiness: '+(stats.readiness/lives).toFixed(1));
console.log('Average cash: ₺'+Math.round(stats.cash/lives).toLocaleString('tr-TR'));
console.log('Average debt: ₺'+Math.round(stats.debt/lives).toLocaleString('tr-TR'));
console.log('Average Life Tree nodes: '+(stats.treeNodes/lives).toFixed(2));
if(errors.length){
 console.log('Sample errors:',errors);
 process.exitCode=1;
}
