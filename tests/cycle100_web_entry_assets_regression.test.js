// Browserless preflight: verifies that the HTML entry and every reachable
// local ESM import can be served from the packaged project. This is NOT E2E.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,extname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(resolve(root,'index.html'),'utf8');
const local=spec=>spec.split(/[?#]/,1)[0];
const inside=path=>!relative(root,path).startsWith('..')&&relative(root,path)!=='..';

function resolveAsset(from,spec){
 const path=resolve(dirname(from),local(spec));
 assert.ok(inside(path),`Asset escapes project root: ${spec}`);
 assert.ok(existsSync(path),`Missing asset ${spec} from ${relative(root,from)}`);
 return path;
}

test('browser HTML module entry and stylesheet assets exist in project',()=>{
 const scripts=[...html.matchAll(/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["']/g)].map(m=>m[1]);
 const styles=[...html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["']/g)].map(m=>m[1]);
 assert.ok(scripts.length>0,'Expected an HTML module entry');
 assert.ok(styles.length>0,'Expected local stylesheets');
 for(const spec of [...scripts,...styles]){
  assert.ok(spec.startsWith('./'),`Unexpected nonlocal HTML asset: ${spec}`);
  resolveAsset(resolve(root,'index.html'),spec);
 }
});

test('browser entry import graph has no missing local JavaScript modules',()=>{
 const entry=resolve(root,'src/ui/app.js');
 const visited=new Set();
 const queue=[entry];
 while(queue.length){
  const path=queue.pop();
  if(visited.has(path))continue;
  visited.add(path);
  const source=readFileSync(path,'utf8');
  // Covers static import/export-from and literal dynamic import. Nonliteral
  // imports are intentionally outside this asset preflight.
  const specs=[
   ...source.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?["']([^"']+)["']/g),
   ...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)
  ].map(match=>match[1]);
  for(const spec of specs){
   if(!spec.startsWith('.'))continue;
   const target=resolveAsset(path,spec);
   assert.equal(extname(target),'.js',`Unexpected browser module extension: ${spec}`);
   queue.push(target);
  }
 }
 assert.ok(visited.size>30,`Suspiciously small UI import graph: ${visited.size}`);
});
