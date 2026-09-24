import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Life Tree supports right mouse drag navigation and cursor-centered wheel zoom',()=>{
 const app=fs.readFileSync(new URL('../src/ui/app.js',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert.ok(app.includes("treeScroll.addEventListener('mousedown'"));
 assert.ok(app.includes("event.button!==2"));
 assert.ok(app.includes("treeScroll.addEventListener('contextmenu'"));
 assert.ok(app.includes("window.addEventListener('mousemove',moveDrag)"));
 assert.ok(app.includes('treeScroll.scrollLeft=dragging.left+dragging.x-event.clientX'));
 assert.ok(app.includes('panel.scrollTop=dragging.top+dragging.y-event.clientY'));
 assert.ok(app.includes("treeScroll.addEventListener('wheel'"));
 assert.ok(app.includes("event.preventDefault()"));
 assert.ok(app.includes('canvas.style.zoom=String(next)'));
 assert.ok(app.includes('treeScroll.scrollLeft=contentX*next-offsetX'));
 for(const direction of ['out','reset','in'])assert.ok(app.includes('data-tree-zoom="'+direction+'"'));
 assert.ok(!app.includes('data-tree-pan='));
 assert.ok(css.includes('.genealogy-scroll.is-panning'));
 assert.ok(css.includes('.genealogy-zoom-button{'));
});

test('Life Tree renders recursive simulated forks with actionable paths',()=>{
 const app=fs.readFileSync(new URL('../src/ui/app.js',import.meta.url),'utf8');
 const engine=fs.readFileSync(new URL('../src/life/counterfactual_continuation.js',import.meta.url),'utf8');
 assert.ok(app.includes("function renderContinuation(result,nodeIndex,rootChoiceId,path=[])"));
 assert.ok(app.includes('data-sim-fork'));
 assert.ok(app.includes('data-fork-path='));
 assert.ok(app.includes('expandContinuationFork(runGame.seedText,parent,last.stage,last.choiceId'));
 assert.ok(app.includes('renderContinuation(fork.result,nodeIndex,rootChoiceId,nextPath)'));
 assert.ok(engine.includes('const checkpoint=milestone.snapshot'));
 assert.ok(engine.includes('const forks=winner.kind'));
 assert.ok(engine.includes('fork.result=result'));
});
