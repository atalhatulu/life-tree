import test from 'node:test';
import {Game} from '../src/core/game.js';
import {autoplay} from '../src/simulation/autoplay.js';

test('narrative playthrough audit (three deterministic lives)',()=>{
 for(const [seed,policy] of [['narrative-audit-a','human-like'],['narrative-audit-b','balanced'],['narrative-audit-c','social']]){
  const game=new Game(seed);
  const lines=[];
  let cursor=game.state.history.length;
  autoplay(game,{toAge:78,policy,onYear:(s,{event})=>{
   const fresh=s.history.slice(cursor);
   cursor=s.history.length;
   const significant=fresh.filter(x=>x.kind!=='activity'&&x.kind!=='finance').map(x=>String(x.result??x.text??'')).filter(Boolean);
   if(event||significant.length||s.player.age<=4||s.player.age%10===0){
    lines.push(JSON.stringify({age:s.player.age,alive:s.player.alive,event:event?.id??null,title:event?.title??null,
      status:{career:s.career?.employed?s.career.title:'işsiz',romance:s.social?.romance?.status??null,children:s.children?.length??0},
      story:significant.slice(-4)}));
   }
  }});
  console.log('AUDIT_START '+seed+' '+policy+' '+game.state.player.name+' '+game.state.player.surname);
  for(const line of lines)console.log('AUDIT '+line);
  console.log('AUDIT_END '+seed+' '+game.state.player.age+' '+(game.state.player.alive?'alive':'dead')+' nodes='+game.state.lifeTree.nodes.length);
 }
});
