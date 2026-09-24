import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Life Tree provides visible left, right and center navigation on the horizontal tree',()=>{
 const app=fs.readFileSync(new URL('../src/ui/app.js',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 for(const direction of ['left','center','right'])assert.ok(app.includes('data-tree-pan="'+direction+'"'));
 assert.ok(app.includes('treeScroll.scrollTo({left:destination'));
 assert.ok(app.includes('treeScroll.addEventListener(\'scroll\',updatePanStatus'));
 assert.ok(app.includes('tabindex="0" role="region" aria-label="Yatay kaydırılabilir hayat ağacı"'));
 assert.ok(css.includes('.genealogy-navigation{'));
 assert.ok(css.includes('position:sticky;'));
 assert.ok(css.includes('.genealogy-nav-button:disabled{'));
});
