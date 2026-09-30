const assert = require('node:assert/strict');
const E = require('../engine.js'), levels = require('../levels.js');
assert.equal(levels.length,51);
for(const rows of levels){const s=E.create(rows);assert.equal(s.boxes.size,s.goals.size);assert.ok(s.floor.has(s.player));assert.equal(E.won(s),false);}
const puzzle=['#######','#@ $ .#','#######'];
let s=E.create(puzzle);
assert.equal(E.move(s,'up'),false);assert.equal(s.moves,0);
assert.equal(E.move(s,'right'),true);assert.equal(s.pushes,0);
assert.equal(E.move(s,'right'),true);assert.equal(s.pushes,1);
assert.equal(E.move(s,'right'),true);assert.equal(E.won(s),true);assert.equal(s.moves,3);assert.equal(s.pushes,2);
assert.equal(E.move(s,'left'),false);
assert.equal(E.undo(s),true);assert.equal(E.won(s),false);assert.equal(s.moves,2);assert.equal(s.pushes,1);
assert.equal(E.redo(s),true);assert.equal(E.won(s),true);
while(E.undo(s)){} assert.deepEqual([...s.boxes],[10]);assert.equal(s.player,8);assert.equal(s.pushes,0);
E.redo(s); E.move(s,'left');assert.equal(s.future.length,0);
s=E.create(['########','#@$$ ..#','########']);assert.equal(E.move(s,'right'),false);assert.equal(s.moves,0);
s=E.create(['######','# $@.#','######']);assert.ok(E.move(s,'left'));assert.ok(E.cornered(s));assert.ok(E.undo(s));assert.ok(!E.cornered(s));
// Undo all random walks in every real level, then redo and compare state.
let seed=42;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
const snapshot=s=>JSON.stringify({player:s.player,boxes:[...s.boxes].sort((a,b)=>a-b),moves:s.moves,pushes:s.pushes});
for(const rows of levels){s=E.create(rows);const start=snapshot(s);for(let i=0;i<1500;i++)E.move(s,Object.keys(E.directions)[Math.floor(random()*4)]);const end=snapshot(s);while(E.undo(s)){}assert.equal(snapshot(s),start);while(E.redo(s)){}assert.equal(snapshot(s),end);}
console.log('PASS: 51 layouts, collisions, pushing, completion, undo/redo, corner detection, 76,500 random moves.');

// The introduction has a short solution with exactly three pushes.
s = E.create(levels[0]);
assert.equal(s.boxes.size, 3);
for (const direction of ['up', 'up', 'down', 'left', 'left', 'up', 'down', 'right', 'right', 'right', 'right', 'up']) assert.ok(E.move(s, direction));
assert.ok(E.won(s)); assert.equal(s.pushes, 3);
console.log('PASS: level 0 solved in 12 moves and 3 pushes.');
