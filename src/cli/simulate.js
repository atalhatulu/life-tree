import {Game} from '../core/game.js';
import {autoplay} from '../simulation/autoplay.js';
import {validateState} from '../simulation/invariants.js';

function arg(name,fallback){
 const index=process.argv.indexOf('--'+name);
 return index>=0&&process.argv[index+1]!=null?process.argv[index+1]:fallback;
}

const lives=Math.max(1,Number(arg('lives','1000')));
const toAge=Math.max(1,Number(arg('to-age','80')));
const policy=arg('policy','random');

const stats={
 invalid:0,paths:{},next:{},classes:{},
 friends:0,romance:0,married:0,children:0,grandchildren:0,cars:0,homes:0,
 performance:0,readiness:0,treeNodes:0,admissions:0,
 university:0,graduates:0,employed:0,degreeRelated:0,unemployed:0,
 retired:0,businesses:0,activeBusinesses:0,inheritance:0,
 widowed:0,careNeed:0,careModes:{},estatePlans:{},trustFunds:0,familyLosses:0,
 cash:0,debt:0,health:0,conditions:0,deaths:0,ages:0,estate:0,
 laborMarket:0,costOfLiving:0,wageIndex:0,healthcareCost:0,lifeRecaps:0,
 birthCities:{},currentCities:{},universityMoves:0
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
 const cls=state.player.background?.childhoodClass??state.household.economicClass;
 stats.classes[cls]=(stats.classes[cls]??0)+1;
 const birthCity=state.origin?.cityName??'Bilinmiyor';
 const currentCity=state.location?.cityName??birthCity;
 stats.birthCities[birthCity]=(stats.birthCities[birthCity]??0)+1;
 stats.currentCities[currentCity]=(stats.currentCities[currentCity]??0)+1;
 stats.universityMoves+=state.higherEducation?.movedForUniversity?1:0;

 stats.friends+=state.social.friends.length;
 stats.romance+=state.social.romance?1:0;
 stats.married+=state.social.romance?.status==='married'?1:0;
 stats.children+=state.children?.length??0;
 stats.grandchildren+=state.grandchildren??0;
 stats.cars+=state.assets?.car?1:0;
 stats.homes+=state.assets?.home?1:0;

 stats.performance+=state.education?.performance??0;
 stats.readiness+=state.education?.graduationReadiness??0;
 stats.treeNodes+=state.lifeTree.nodes.length;
 stats.admissions+=state.education?.admissionSucceeded?1:0;
 stats.university+=state.higherEducation?1:0;
 stats.graduates+=state.higherEducation?.completed?1:0;
 stats.employed+=state.career?.employed?1:0;
 stats.unemployed+=state.career&&!state.career.employed&&!state.retirement?.retired?1:0;
 stats.degreeRelated+=state.career?.degreeRelated?1:0;
 stats.retired+=state.retirement?.retired?1:0;
 stats.businesses+=state.business?1:0;
 stats.activeBusinesses+=state.business?.active?1:0;
 stats.widowed+=state.widowedAtAge!=null?1:0;
 stats.careNeed+=state.lateLife?.careNeed?1:0;
 const careMode=state.lateLife?.careMode??'none';
 stats.careModes[careMode]=(stats.careModes[careMode]??0)+1;
 const estatePlan=state.estatePlan?.type??'none';
 stats.estatePlans[estatePlan]=(stats.estatePlans[estatePlan]??0)+1;
 stats.trustFunds+=state.trustFund?.released?1:0;
 stats.familyLosses+=[state.parents.mother,state.parents.father,state.grandparents.maternal.grandmother,state.grandparents.maternal.grandfather,state.grandparents.paternal.grandmother,state.grandparents.paternal.grandfather].filter(p=>!p.alive).length;

 stats.inheritance+=(state.inheritanceHistory??[]).reduce((sum,x)=>sum+x.amount,0);
 stats.cash+=state.finance?.cash??0;
 stats.debt+=state.finance?.debt??0;
 stats.health+=state.player.health.current;
 stats.conditions+=state.healthProfile?.conditions?.length??0;
 stats.deaths+=state.player.alive?0:1;
 stats.ages+=state.player.age;
 stats.estate+=state.estate?.net??0;
 const macro=state.world?.economy??{laborMarket:1,costOfLiving:1,wageIndex:1,healthcareCost:1};
 stats.laborMarket+=macro.laborMarket;
 stats.costOfLiving+=macro.costOfLiving;
 stats.wageIndex+=macro.wageIndex;
 stats.healthcareCost+=macro.healthcareCost;
 stats.lifeRecaps+=state.deathSummary?.recap?1:0;
}

console.log('Life Tree batch simulation');
console.log('Lives: '+lives+' | Target age: '+toAge+' | Policy: '+policy);
console.log('Invalid states: '+stats.invalid);
console.log('Birth household classes:',stats.classes);
console.log('Birth cities:',stats.birthCities);
console.log('Final/current cities:',stats.currentCities);
console.log('Moved city for university: '+(stats.universityMoves/lives*100).toFixed(1)+'%');
console.log('High school paths:',stats.paths);
console.log('Current paths:',stats.next);
console.log('Average final age: '+(stats.ages/lives).toFixed(1));
console.log('Deaths before target: '+(stats.deaths/lives*100).toFixed(1)+'%');
console.log('Admission success: '+(stats.admissions/lives*100).toFixed(1)+'%');
console.log('University graduates: '+(stats.graduates/lives*100).toFixed(1)+'%');
console.log('Employed: '+(stats.employed/lives*100).toFixed(1)+'%');
console.log('Currently unemployed: '+(stats.unemployed/lives*100).toFixed(1)+'%');
console.log('Retired: '+(stats.retired/lives*100).toFixed(1)+'%');
console.log('Degree-related careers: '+(stats.degreeRelated/lives*100).toFixed(1)+'%');
console.log('Ever founded business: '+(stats.businesses/lives*100).toFixed(1)+'%');
console.log('Active business: '+(stats.activeBusinesses/lives*100).toFixed(1)+'%');
console.log('Widowed at least once: '+(stats.widowed/lives*100).toFixed(1)+'%');
console.log('Current elder-care need: '+(stats.careNeed/lives*100).toFixed(1)+'%');
console.log('Care modes:',stats.careModes);
console.log('Estate plans:',stats.estatePlans);
console.log('Released childhood trust fund: '+(stats.trustFunds/lives*100).toFixed(1)+'%');
console.log('Average close-family losses: '+(stats.familyLosses/lives).toFixed(2));
console.log('Active relationship: '+(stats.romance/lives*100).toFixed(1)+'%');
console.log('Married: '+(stats.married/lives*100).toFixed(1)+'%');
console.log('Average children: '+(stats.children/lives).toFixed(2));
console.log('Average grandchildren: '+(stats.grandchildren/lives).toFixed(2));
console.log('Car ownership: '+(stats.cars/lives*100).toFixed(1)+'%');
console.log('Home ownership: '+(stats.homes/lives*100).toFixed(1)+'%');
console.log('Average friends: '+(stats.friends/lives).toFixed(2));
console.log('Average health: '+(stats.health/lives).toFixed(1));
console.log('Average diagnosed conditions: '+(stats.conditions/lives).toFixed(2));
console.log('Average inheritance received: ₺'+Math.round(stats.inheritance/lives).toLocaleString('tr-TR'));
console.log('Average cash: ₺'+Math.round(stats.cash/lives).toLocaleString('tr-TR'));
console.log('Average debt: ₺'+Math.round(stats.debt/lives).toLocaleString('tr-TR'));
console.log('Average estate at death: ₺'+Math.round(stats.estate/Math.max(1,stats.deaths)).toLocaleString('tr-TR'));
console.log('Death recaps created: '+stats.lifeRecaps+'/'+stats.deaths);
console.log('Average labor market index: '+(stats.laborMarket/lives).toFixed(3));
console.log('Average cost-of-living index: '+(stats.costOfLiving/lives).toFixed(3));
console.log('Average real wage index: '+(stats.wageIndex/lives).toFixed(3));
console.log('Average healthcare-cost index: '+(stats.healthcareCost/lives).toFixed(3));
console.log('Average Life Tree nodes: '+(stats.treeNodes/lives).toFixed(2));
if(errors.length){
 console.log('Sample errors:',errors);
 process.exitCode=1;
}
