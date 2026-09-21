import {Game} from '../core/game.js';
import {autoplay} from '../simulation/autoplay.js';
import {buildLifeRecap} from '../life/life_recap.js';
import {pacingSummary} from '../life/pacing_system.js';

const seeds=['pacing-life-a','pacing-life-b','pacing-life-c'];

for(const seed of seeds){
 const game=new Game(seed);
 autoplay(game,{toAge:100,policy:'random'});
 const recap=game.state.deathSummary?.recap??buildLifeRecap(game.state);
 const pacing=pacingSummary(game.state);

 console.log('\n=== LIFE '+seed+' ===');
 console.log('IDENTITY '+recap.identity.name+' | '+recap.identity.finalAge+' | '+recap.origin.birthCity+' -> '+recap.origin.currentCity);
 console.log('EDUCATION '+(recap.education.university??recap.education.highSchoolPath??'—'));
 console.log('CAREER '+(recap.work.history.map(x=>x.title).join(' -> ')||'—'));
 console.log('RELATIONSHIPS '+(recap.relationships.map(x=>x.name+' ['+x.status+']').join(' -> ')||'—'));
 console.log('FAMILY children='+recap.family.children.length+' grandchildren='+recap.family.grandchildren);
 console.log('HEALTH final='+recap.health.finalHealth+' conditions='+(recap.health.conditions.join(',')||'none'));
 console.log('FINANCE cash='+recap.finances.cash+' debt='+recap.finances.debt);
 console.log('PACING adultMajor='+pacing.adultMajorDecisions+' shortestGap='+(pacing.shortestAdultMajorGap??'n/a'));

 console.log('MIGRATIONS');
 for(const move of recap.origin.migrations??[]){
  console.log(' - '+move.age+' '+move.fromCityName+' -> '+move.toCityName+' ['+move.reason+']');
 }

 console.log('LIFETREE');
 for(const node of recap.decisions){
  console.log(' - '+node.age+' '+node.title+' => '+node.choice);
 }

 console.log('STORY');
 for(const item of game.state.history.filter(x=>!['activity','finance'].includes(x.kind))){
  console.log(' - '+item.age+' '+(item.result??item.text??item.eventId??'event'));
 }
}
