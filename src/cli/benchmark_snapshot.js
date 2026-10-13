import {performance} from 'node:perf_hooks';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Game} from '../core/game.js';
import {snapshotObjectGraph} from '../core/transaction_snapshot.js';

// A repeatable local profile, not a CI timing threshold: CPU contention and
// runtime versions can dominate small performance differences.
export function benchmarkSnapshot(iterations=200){
 if(!Number.isSafeInteger(iterations)||iterations<1||iterations>100000)
  throw new RangeError('iterations must be between 1 and 100000');
 const game=new Game('snapshot-profile-cycle103');
 const run=(mutate)=>{
  const start=performance.now();
  for(let i=0;i<iterations;i++){
   const restore=snapshotObjectGraph([game.state]);
   if(mutate)game.state.player.age+=1;
   restore();
  }
  return Number((performance.now()-start).toFixed(3));
 };
 // Warm up the VM before collecting independent samples.
 run(false);
 const unchangedMs=run(false),changedMs=run(true);
 return {iterations,unchangedMs,changedMs,
  unchangedMsPerSnapshot:Number((unchangedMs/iterations).toFixed(4)),
  changedMsPerSnapshot:Number((changedMs/iterations).toFixed(4))};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const arg=process.argv[2];
  if(process.argv.length>3||(arg!==undefined&&!/^[1-9]\d*$/.test(arg)))
   throw new RangeError('Usage: node src/cli/benchmark_snapshot.js [iterations]');
  console.log(JSON.stringify(benchmarkSnapshot(arg===undefined?200:Number(arg))));
 }catch(error){console.error(error.message);process.exitCode=2;}
}
