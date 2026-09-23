import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('simulate-to-end UI is wired and chunked to avoid blocking the browser',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../src/ui/app.js',import.meta.url),'utf8');

 assert.match(html,/id="simulateEnd"/);
 assert.match(app,/$('#simulateEnd').addEventListener('click',fastForwardToEnd)/);
 assert.match(app,/while(game.state.player.alive&&game.state.player.age<maxAge)/);
 assert.match(app,/autoplay(game,{toAge:chunkTarget,policy:'human-like'})/);
 assert.match(app,/await sleep(0)/);

 const fn=app.slice(app.indexOf('async function fastForwardToEnd'),app.indexOf('function switchScreen'));
 assert.doesNotMatch(fn,/simulateToEnd(game/);
});
