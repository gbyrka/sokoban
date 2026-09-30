/* Pure game rules shared by the browser and the Node tests. */
(function (root) {
  'use strict';
  const directions = {up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]};
  function create(rows) {
    const width = Math.max(...rows.map(row => row.length)), height = rows.length;
    const walls = new Set(), goals = new Set(), boxes = new Set(), floor = new Set();
    let player = -1, players = 0;
    rows.forEach((row, y) => [...row].forEach((cell, x) => {
      const p = y * width + x;
      if (cell === '#') walls.add(p);
      if ('.*+'.includes(cell)) goals.add(p);
      if ('$*'.includes(cell)) boxes.add(p);
      if ('@+'.includes(cell)) { player = p; players++; }
    }));
    if (players !== 1 || !boxes.size || boxes.size !== goals.size) throw new Error('Invalid level');
    // Flood fill only the enclosed, playable floor; indentation is not floor.
    const queue = [player]; floor.add(player);
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i], x = p % width, y = Math.floor(p / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) throw new Error('Open level');
      for (const [dx, dy] of Object.values(directions)) {
        const n = (y + dy) * width + x + dx;
        if (!walls.has(n) && !floor.has(n)) { floor.add(n); queue.push(n); }
      }
    }
    if ([...boxes, ...goals].some(p => !floor.has(p))) throw new Error('Unreachable tile');
    return {width, height, walls, goals, boxes, floor, player, moves: 0, pushes: 0, history: [], future: [], facing: 'down'};
  }
  function won(s) { return [...s.boxes].every(p => s.goals.has(p)); }
  function move(s, direction) {
    if (!directions[direction] || won(s)) return false;
    const [dx, dy] = directions[direction], offset = dy * s.width + dx;
    const target = s.player + offset, pushed = s.boxes.has(target), beyond = target + offset;
    s.facing = direction;
    if (!s.floor.has(target) || (pushed && (!s.floor.has(beyond) || s.boxes.has(beyond)))) return false;
    s.history.push({from: s.player, to: target, box: pushed ? beyond : null, direction});
    s.future = [];
    if (pushed) { s.boxes.delete(target); s.boxes.add(beyond); s.pushes++; }
    s.player = target; s.moves++;
    return true;
  }
  function undo(s) {
    const step = s.history.pop(); if (!step) return false;
    if (step.box !== null) { s.boxes.delete(step.box); s.boxes.add(step.to); s.pushes--; }
    s.player = step.from; s.moves--; s.future.push(step); return true;
  }
  function redo(s) {
    const step = s.future.pop(); if (!step) return false;
    const remaining = [...s.future];
    const result = move(s, step.direction); s.future = remaining; return result;
  }
  function cornered(s) {
    return [...s.boxes].some(p => !s.goals.has(p) &&
      (!s.floor.has(p - 1) || !s.floor.has(p + 1)) &&
      (!s.floor.has(p - s.width) || !s.floor.has(p + s.width)));
  }
  const api = {create, move, undo, redo, won, cornered, directions};
  if (typeof module !== 'undefined') module.exports = api; else root.SokobanEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
