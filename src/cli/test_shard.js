import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';

// Deterministic, exhaustive and non-overlapping full-suite partitions.
// Keep npm test unchanged for local runs; CI can run the shards in parallel.
export function shardTestFiles(files,shard,total){
 if(!Number.isSafeInteger(shard)||!Number.isSafeInteger(total)||
    total<1||shard<1||shard>total)
  throw new RangeError('Usage: npm run test:shard -- <shard 1..N> <N>');
 return [...files].sort().filter((_,index)=>index%total===shard-1);
}

export function discoverTestFiles(directory){
 const files=[];
 // Discover nested tests too; do not follow symlinked directories, which
 // could create cycles or include files outside the checkout.
 const walk=(absolute,relative)=>{
  for(const entry of readdirSync(absolute,{withFileTypes:true})){
   const path=join(absolute,entry.name);
   const name=relative?relative+'/'+entry.name:entry.name;
   if(entry.isDirectory())walk(path,name);
   else if(entry.isFile()&&entry.name.endsWith('.test.js'))files.push(name);
  }
 };
 walk(directory,'');
 return files.map(name=>directory.replaceAll('\\','/')+'/'+name).sort();
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [shardText,totalText,...extra]=process.argv.slice(2);
  if(extra.length||!/^[1-9]\d*$/.test(shardText??'')||!/^[1-9]\d*$/.test(totalText??''))
   throw new RangeError('Usage: npm run test:shard -- <shard 1..N> <N>');
  const files=shardTestFiles(discoverTestFiles('tests'),Number(shardText),Number(totalText));
  if(!files.length)throw new RangeError('Empty test shard');
  console.log(`Full-suite shard ${shardText}/${totalText}: ${files.length} files`);
  const child=spawnSync(process.execPath,['--test','--test-concurrency=4',...files],{stdio:'inherit'});
  if(child.error)throw child.error;
  process.exit(child.status??1);
 }catch(error){console.error(error.message);process.exitCode=2;}
}
