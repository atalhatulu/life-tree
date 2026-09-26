import {Game} from '../src/core/game.js';
import {ExperimentalYearSession} from '../src/experimental/year_session.js';

const seed=process.argv[2]??'year-flow-actions-demo-2026';
const policy=process.argv[3]??'first';
const game=new Game(seed);
const output={seed,policy,initial:{year:game.state.year,age:game.state.player.age},years:[],assertions:[]};
function check(condition,message){if(!condition)throw new Error(message);output.assertions.push(message);}
let decisionCount=0,noticeCount=0,paused=0;
for(let yearIndex=0;yearIndex<25&&game.state.player.alive;yearIndex++){
  const before=structuredClone(game.state);
  const session=new ExperimentalYearSession(game,{maxDecisions:3});
  session.start();
  check(game.state.year===before.year,'Live game remains unchanged while preview starts');
  const log=[];
  const beforeStats={health:game.state.player.health,money:game.state.player.money};
  for(let step=0;step<50&&session.phase!=='complete';step++){
    const item=session.advance();
    if(item.type==='notice'){noticeCount++;log.push({day:item.day,type:'notice',text:item.text});}
    if(item.type==='decision'){
      decisionCount++;paused++;
      check(session.phase==='waiting','Calendar pauses at decision');
      const choices=item.pending.choices;
      const choice=policy==='last'?choices[choices.length-1]:policy==='alternate'?choices[decisionCount%choices.length]:choices[0];
      log.push({day:item.day,type:'decision',event:item.pending.id,choice:choice.id});
      session.choose(choice.id);
      check(session.phase==='running','Calendar resumes after choice');
    }
  }
  check(session.phase==='complete','Annual session reaches December 31');
  check(game.state.year===before.year,'Preview never commits before year end');
  session.commit();
  check(game.state.year===before.year+1,'Commit advances exactly one year');
  output.years.push({year:game.state.year,age:game.state.player.age,alive:game.state.player.alive,beforeStats,afterStats:{health:game.state.player.health,money:game.state.player.money},events:log});
}
output.summary={years:output.years.length,decisions:decisionCount,notices:noticeCount,pauses:paused,alive:game.state.player.alive,finalAge:game.state.player.age,checks:output.assertions.length};
console.log(JSON.stringify(output,null,2));
check(output.years.length>=1,'At least one life year simulated');
check(decisionCount>0,'At least one real event decision occurred');
console.log('YEAR_FLOW_DEMO_PASS',JSON.stringify(output.summary));
