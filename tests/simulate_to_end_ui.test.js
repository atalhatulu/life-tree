import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('simulate-to-end UI is wired and chunked to avoid blocking the browser',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../src/ui/app.js',import.meta.url),'utf8');

 assert.ok(html.includes('id="simulateEnd"'));
 assert.ok(app.includes("$('#simulateEnd').addEventListener('click',fastForwardToEnd)"));
 const fn=app.slice(app.indexOf('async function fastForwardToEnd'),app.indexOf('function switchScreen'));
 assert.ok(fn.includes('while(game.state.player.alive&&game.state.player.age<maxAge)'));
 assert.ok(fn.includes("autoplay(game,{toAge:chunkTarget,policy:'human-like'})"));
 assert.ok(fn.includes('await sleep(0)'));
 assert.ok(!fn.includes('simulateToEnd(game'));
});
