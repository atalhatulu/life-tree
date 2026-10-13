import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotObjectGraph} from '../src/core/transaction_snapshot.js';
import {Game} from '../src/core/game.js';

function chain(depth){
 const root={value:0};let cursor=root;
 for(let i=0;i<depth;i++){cursor.next={value:i+1};cursor=cursor.next;}
 return {root,tail:cursor};
}

test('snapshot supports 20,000 nested history objects without recursion overflow',()=>{
 const {root,tail}=chain(20000);
 const restore=snapshotObjectGraph([root]);
 tail.value=999;tail.extra='temporary';
 root.value=-1;
 restore();
 assert.equal(root.value,0);
 assert.equal(tail.value,20000);
 assert.equal(Object.hasOwn(tail,'extra'),false);
});

test('graph restore retains cycles, aliases and sparse arrays',()=>{
 const sparse=[];sparse.length=5;sparse[3]='keep';
 const node={items:sparse};node.self=node;node.other={ref:node};
 const restore=snapshotObjectGraph([node]);
 sparse.push('new');sparse[0]='filled';delete sparse[3];
 node.other.ref={};node.self=null;node.extra=1;
 restore();
 assert.equal(node.self,node);
 assert.equal(node.other.ref,node);
 assert.equal(node.items,sparse);
 assert.equal(sparse.length,5);
 assert.equal(0 in sparse,false);
 assert.equal(sparse[3],'keep');
 assert.equal(Object.hasOwn(node,'extra'),false);
});

test('Game transaction can roll back with a deeply nested legacy history',()=>{
 const game=new Game('cycle98-deep-game');
 const {root,tail}=chain(15000);
 game.state.history.push(root);
 game.state.player.age=25;
 game.state.actions={max:3,remaining:3};
 game.events.choose=()=>{tail.value=-1;throw new Error('event selection failed');};
 const age=game.state.player.age;
 assert.throws(()=>game.ageOneYear(),/event selection failed/);
 assert.equal(game.state.player.age,age);
 assert.equal(tail.value,15000);
 assert.equal(game.state.history[0],root);
});
