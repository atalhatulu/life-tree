import {readFile,writeFile,mkdtemp,link,rm} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {repairSavePayload} from '../core/save_system.js';

export async function repairSaveFile(inputPath,outputPath,{dryRun=false}={}){
 if(!inputPath||(!dryRun&&!outputPath)||
    (outputPath&&resolve(inputPath)===resolve(outputPath)))
  throw new Error('Usage: node src/cli/repair_save.js <input.json> <output.json> [--dry-run]');
 const source=await readFile(inputPath,'utf8');
 const {payload,repairs}=repairSavePayload(source);
 // Publish only a complete, validated save. An exclusive hard-link creation
 // is atomic and fails if the destination already exists (including symlinks).
 // The temporary file is in the destination filesystem to permit linking.
 if(!dryRun){
  const destination=resolve(outputPath);
  const temporaryDirectory=await mkdtemp(join(dirname(destination),'.life-tree-repair-'));
  try{
   const temporaryFile=join(temporaryDirectory,'payload.json');
   await writeFile(temporaryFile,JSON.stringify(payload,null,2)+'\n',{flag:'wx'});
   await link(temporaryFile,destination);
  }finally{await rm(temporaryDirectory,{recursive:true,force:true});}
 }
 return {repairs,outputPath:dryRun?null:outputPath};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [inputPath,outputPath,...flags]=process.argv.slice(2);
 const dryRun=flags.length===1&&flags[0]==='--dry-run'||
   outputPath==='--dry-run'&&flags.length===0;
 const destination=outputPath==='--dry-run'?undefined:outputPath;
 if(flags.length&&!dryRun){
  console.error('Usage: node src/cli/repair_save.js <input.json> <output.json> [--dry-run]');
  process.exitCode=2;
 }else{
  try{
   const result=await repairSaveFile(inputPath,destination,{dryRun});
   console.log(JSON.stringify({dryRun,repairs:result.repairs,output:result.outputPath}));
  }catch(error){console.error(error.message);process.exitCode=1;}
 }
}
